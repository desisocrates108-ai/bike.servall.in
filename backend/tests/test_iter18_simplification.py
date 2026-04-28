"""
Iteration 18 backend tests — simplification & enhancement
- Constants: 9 stages
- /admin/migrate-stages (super_admin)
- POST /leads with only customer_name + phone
- exchange-photos with doc_type=pan / rc
- Stage transition KYC gating (Aadhaar required for Test Ride)
- Inventory CRUD + CSV upload (idempotent)
- Booking with payment_type=Token / Full + inventory lock
"""
import os
import io
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@dealer.com"
SUPER_PASS = "super123"


@pytest.fixture(scope="session")
def super_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=30)
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def bilimora_branch_id(super_session):
    r = super_session.get(f"{API}/branches", timeout=30)
    assert r.status_code == 200
    for b in r.json():
        if b.get("name") == "Bilimora":
            return b["id"]
    pytest.skip("Bilimora branch missing")


# ----------------------------------------------------------------------------
# 1. Constants
# ----------------------------------------------------------------------------
class TestConstants:
    def test_constants_have_9_new_stages(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200
        data = r.json()
        expected = ["Inquiry", "Follow-up", "Test Ride", "Booking", "Booking Hold",
                    "Allotment", "RTO", "Delivered", "Lost"]
        assert data.get("stages") == expected, f"got: {data.get('stages')}"
        # lost_reasons unchanged
        assert "lost_reasons" in data
        assert isinstance(data["lost_reasons"], list)
        assert len(data["lost_reasons"]) >= 5


# ----------------------------------------------------------------------------
# 2. Migration endpoint
# ----------------------------------------------------------------------------
class TestMigrateStages:
    def test_migrate_stages_super_admin(self, super_session):
        r = super_session.post(f"{API}/admin/migrate-stages", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "migrated" in data
        assert isinstance(data["migrated"], dict)
        # Idempotent → second run all zeros
        r2 = super_session.post(f"{API}/admin/migrate-stages", timeout=30)
        assert r2.status_code == 200
        assert all(v == 0 for v in r2.json()["migrated"].values()), r2.text


# ----------------------------------------------------------------------------
# 3. Lead create with minimal fields
# ----------------------------------------------------------------------------
class TestLeadMinimal:
    def test_create_lead_only_name_phone(self, super_session, bilimora_branch_id):
        payload = {"customer_name": "TEST_Iter18 Min Lead", "phone": f"9{uuid.uuid4().int % 10**9:09d}"}
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["customer_name"] == payload["customer_name"]
        assert lead["phone"] == payload["phone"]
        # branch auto-resolved
        assert lead.get("branch_id"), "branch_id not auto-resolved"
        # source default = Walk-in
        assert lead.get("source") == "Walk-in"
        # stage = Inquiry
        assert lead.get("stage") == "Inquiry"
        # Persist marker
        pytest.iter18_min_lead_id = lead["id"]

    def test_min_lead_persisted(self, super_session):
        lid = getattr(pytest, "iter18_min_lead_id", None)
        assert lid, "previous test failed"
        r = super_session.get(f"{API}/leads/{lid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["customer_name"].startswith("TEST_Iter18")


# ----------------------------------------------------------------------------
# 4. Stage gating (KYC) — Test Ride needs aadhaar
# ----------------------------------------------------------------------------
class TestStageKYCGate:
    def test_test_ride_blocked_without_aadhaar(self, super_session):
        lid = getattr(pytest, "iter18_min_lead_id", None)
        assert lid
        r = super_session.post(f"{API}/leads/{lid}/stage", json={"stage": "Test Ride"}, timeout=30)
        assert r.status_code == 400, r.text
        msg = r.json().get("detail", "")
        assert "Aadhaar" in msg, f"got: {msg}"


# ----------------------------------------------------------------------------
# 5. Exchange-photos endpoint with doc_type=pan / rc
# ----------------------------------------------------------------------------
class TestExchangePhotosNewBuckets:
    def _upload(self, sess, lid, doc_type, name="t.jpg"):
        files = {"file": (name, b"\xff\xd8\xff\xe0testimg", "image/jpeg")}
        return sess.post(f"{API}/leads/{lid}/exchange-photos", params={"doc_type": doc_type},
                         files=files, timeout=30)

    def test_pan_stored_in_identity_docs(self, super_session):
        lid = getattr(pytest, "iter18_min_lead_id", None)
        r = self._upload(super_session, lid, "pan", "pan.jpg")
        assert r.status_code == 200, r.text
        body = r.json()
        # Should reflect on identity_docs.pan
        idoc = body.get("identity_docs") or {}
        assert "pan" in idoc and len(idoc["pan"]) >= 1, body

    def test_aadhaar_upload_then_test_ride_succeeds(self, super_session):
        lid = getattr(pytest, "iter18_min_lead_id", None)
        r = self._upload(super_session, lid, "aadhaar", "aadhaar.jpg")
        assert r.status_code == 200, r.text
        # Now Test Ride should work
        r2 = super_session.post(f"{API}/leads/{lid}/stage", json={"stage": "Test Ride"}, timeout=30)
        assert r2.status_code == 200, r2.text
        assert r2.json()["stage"] == "Test Ride"

    def test_rc_stored_in_exchange_documents(self, super_session, bilimora_branch_id):
        # Create separate exchange lead
        payload = {
            "customer_name": "TEST_Iter18 Exchange Lead",
            "phone": f"9{uuid.uuid4().int % 10**9:09d}",
            "purchase_type": "Exchange Vehicle",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200
        lid = r.json()["id"]
        pytest.iter18_ex_lead_id = lid
        r2 = self._upload(super_session, lid, "rc", "rc.jpg")
        assert r2.status_code == 200, r2.text
        body = r2.json()
        ex = body.get("exchange") or {}
        rc_list = (ex.get("documents") or {}).get("rc") or []
        assert len(rc_list) >= 1, body

    def test_legacy_aadhaar_back_accepted(self, super_session):
        lid = getattr(pytest, "iter18_ex_lead_id", None)
        assert lid
        r = self._upload(super_session, lid, "aadhaar_back", "ab.jpg")
        assert r.status_code == 200, r.text


# ----------------------------------------------------------------------------
# 6. Inventory CRUD + duplicate + delete-only-available
# ----------------------------------------------------------------------------
class TestInventoryCRUD:
    def test_create_chassis(self, super_session):
        chassis = f"TEST{uuid.uuid4().hex[:10].upper()}"
        pytest.iter18_chassis = chassis
        body = {"brand": "Honda", "model": "Activa", "variant": "STD",
                "color": "Black", "chassis_number": chassis}
        r = super_session.post(f"{API}/inventory", json=body, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["chassis_number"] == chassis
        assert data["status"] == "available"
        pytest.iter18_inv_id = data["id"]

    def test_duplicate_chassis_rejected(self, super_session):
        chassis = pytest.iter18_chassis
        body = {"brand": "Honda", "model": "Activa", "chassis_number": chassis}
        r = super_session.post(f"{API}/inventory", json=body, timeout=30)
        assert r.status_code == 400, r.text

    def test_list_inventory_with_filters(self, super_session):
        chassis = pytest.iter18_chassis
        r = super_session.get(f"{API}/inventory", params={"chassis": chassis}, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert any(i["chassis_number"] == chassis for i in items)

    def test_delete_available(self, super_session):
        # create separate one to delete
        chassis = f"TESTDEL{uuid.uuid4().hex[:6].upper()}"
        r = super_session.post(f"{API}/inventory",
                               json={"brand": "Honda", "model": "Activa", "chassis_number": chassis},
                               timeout=30)
        assert r.status_code == 200
        iid = r.json()["id"]
        r2 = super_session.delete(f"{API}/inventory/{iid}", timeout=30)
        assert r2.status_code == 200


# ----------------------------------------------------------------------------
# 7. Inventory CSV upload (idempotent)
# ----------------------------------------------------------------------------
class TestInventoryUpload:
    def _csv(self, n=3):
        rows = "brand,model,chassis_number,variant,color\n"
        chassis_list = []
        for i in range(n):
            c = f"TESTUP{uuid.uuid4().hex[:8].upper()}"
            chassis_list.append(c)
            rows += f"Honda,Activa,{c},STD,Red\n"
        return rows.encode(), chassis_list

    def test_upload_csv_then_reupload(self, super_session):
        csv_bytes, chassis_list = self._csv(3)
        files = {"file": ("inv.csv", csv_bytes, "text/csv")}
        r = super_session.post(f"{API}/inventory/upload", files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["added"] == 3, d
        assert d["skipped_duplicates"] == 0, d
        # Re-upload same file → all skipped
        files2 = {"file": ("inv.csv", csv_bytes, "text/csv")}
        r2 = super_session.post(f"{API}/inventory/upload", files=files2, timeout=60)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["added"] == 0
        assert d2["skipped_duplicates"] == 3, d2
        pytest.iter18_csv_chassis = chassis_list


# ----------------------------------------------------------------------------
# 8. Booking with payment_type Token + inventory_id (locks chassis, stage→Booking Hold)
# ----------------------------------------------------------------------------
class TestBookingFlows:
    def _prepare_lead_with_deal(self, sess, expected=70000.0, final=68000.0):
        # Lead
        payload = {"customer_name": "TEST_Iter18 Booking Lead",
                   "phone": f"9{uuid.uuid4().int % 10**9:09d}"}
        r = sess.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200
        lid = r.json()["id"]
        # Get a brand & model to attach
        brands = sess.get(f"{API}/brands", timeout=30).json()
        models = sess.get(f"{API}/models", timeout=30).json()
        brand_id = brands[0]["id"] if brands else None
        model_id = models[0]["id"] if models else None
        upd = {
            "brand_id": brand_id, "model_id": model_id,
            "deal": {"customer_expected_price": expected, "final_deal_price": final},
            "payment_mode": "Cash",
        }
        r2 = sess.put(f"{API}/leads/{lid}", json=upd, timeout=30)
        assert r2.status_code == 200, r2.text
        return lid

    def _create_inventory(self, sess):
        chassis = f"TESTBK{uuid.uuid4().hex[:8].upper()}"
        r = sess.post(f"{API}/inventory",
                      json={"brand": "Honda", "model": "Activa", "chassis_number": chassis},
                      timeout=30)
        assert r.status_code == 200, r.text
        return r.json()["id"], chassis

    def test_booking_token_sets_booking_hold(self, super_session):
        lid = self._prepare_lead_with_deal(super_session, final=68000.0)
        inv_id, chassis = self._create_inventory(super_session)
        body = {
            "expected_delivery_date": "2030-12-31",
            "booking_amount": 5000.0,
            "payment_type": "Token",
            "inventory_id": inv_id,
        }
        r = super_session.post(f"{API}/leads/{lid}/booking", json=body, timeout=30)
        assert r.status_code == 200, r.text
        bk = r.json()
        assert bk["payment_type"] == "Token"
        assert bk["chassis_number"] == chassis
        # lead stage should be Booking Hold
        lr = super_session.get(f"{API}/leads/{lid}", timeout=30).json()
        assert lr["stage"] == "Booking Hold", lr.get("stage")
        # inventory now booked
        ir = super_session.get(f"{API}/inventory", params={"chassis": chassis}, timeout=30).json()
        assert ir and ir[0]["status"] == "booked"
        # store for reuse
        pytest.iter18_inv_locked_chassis = chassis
        pytest.iter18_inv_locked_id = inv_id

    def test_chassis_double_booking_rejected(self, super_session):
        # Create another lead and try to book same chassis (free-text)
        lid2 = self._prepare_lead_with_deal(super_session, final=68000.0)
        chassis = pytest.iter18_inv_locked_chassis
        body = {
            "expected_delivery_date": "2030-12-31",
            "booking_amount": 5000.0,
            "payment_type": "Token",
            "chassis_number": chassis,
        }
        r = super_session.post(f"{API}/leads/{lid2}/booking", json=body, timeout=30)
        assert r.status_code == 400, r.text
        assert "already booked" in r.json().get("detail", "").lower()

    def test_booking_full_payment_sets_booking(self, super_session):
        lid = self._prepare_lead_with_deal(super_session, final=68000.0)
        inv_id, chassis = self._create_inventory(super_session)
        body = {
            "expected_delivery_date": "2030-12-31",
            "booking_amount": 68000.0,
            "payment_type": "Full",
            "inventory_id": inv_id,
        }
        r = super_session.post(f"{API}/leads/{lid}/booking", json=body, timeout=30)
        assert r.status_code == 200, r.text
        bk = r.json()
        assert bk["payment_type"] == "Full"
        lr = super_session.get(f"{API}/leads/{lid}", timeout=30).json()
        assert lr["stage"] == "Booking", lr.get("stage")

    def test_delete_booked_inventory_rejected(self, super_session):
        iid = pytest.iter18_inv_locked_id
        r = super_session.delete(f"{API}/inventory/{iid}", timeout=30)
        assert r.status_code == 400, r.text


# ----------------------------------------------------------------------------
# 9. Cleanup test data
# ----------------------------------------------------------------------------
class TestZCleanup:
    def test_cleanup(self, super_session):
        # Delete TEST_ leads
        leads = super_session.get(f"{API}/leads", params={"search": "TEST_Iter18"}, timeout=30).json()
        for ld in leads:
            try:
                super_session.delete(f"{API}/leads/{ld['id']}", timeout=30)
            except Exception:
                pass
        # Delete TEST chassis inventory (only available ones)
        inv = super_session.get(f"{API}/inventory", params={"chassis": "TEST"}, timeout=30).json()
        for it in inv:
            if it.get("status") == "available":
                try:
                    super_session.delete(f"{API}/inventory/{it['id']}", timeout=30)
                except Exception:
                    pass
        assert True
