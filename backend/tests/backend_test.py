"""Backend API tests for Two-Wheeler CRM.

Covers auth, constants/master data, leads CRUD with RBAC,
stage validation rules, follow-ups, timeline, document upload,
user management, and analytics.
"""
import os
import io
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") \
    if os.environ.get("REACT_APP_BACKEND_URL") else None
# Fallback to frontend/.env
if not BASE_URL:
    load_dotenv(Path("/app/frontend/.env"))
    BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

API = f"{BASE_URL}/api"

CREDS = {
    "super": ("superadmin@dealer.com", "super123"),
    "admin": ("admin@dealer.com", "admin123"),
    "sales1": ("sales1@dealer.com", "sales123"),
    "sales2": ("sales2@dealer.com", "sales123"),
    "sales3": ("sales3@dealer.com", "sales123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login failed {email}: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"], r.cookies


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------------------------------------------------------
# Session-scoped auth tokens & master data ids
# ------------------------------------------------------------
@pytest.fixture(scope="session")
def tokens():
    out = {}
    for k, (e, p) in CREDS.items():
        t, u, _ = _login(e, p)
        out[k] = {"token": t, "user": u}
    return out


@pytest.fixture(scope="session")
def masters(tokens):
    h = _hdr(tokens["super"]["token"])
    branches = requests.get(f"{API}/branches", headers=h).json()
    brands = requests.get(f"{API}/brands", headers=h).json()
    colors = requests.get(f"{API}/colors", headers=h).json()
    bilimora = next(b for b in branches if b["name"] == "Bilimora")
    chikhli = next(b for b in branches if b["name"] == "Chikhli")
    honda = next(b for b in brands if b["name"] == "Honda")
    models = requests.get(f"{API}/models", params={"brand_id": honda["id"]}, headers=h).json()
    activa = next(m for m in models if m["name"] == "Activa 6G")
    variants = requests.get(f"{API}/variants", params={"model_id": activa["id"]}, headers=h).json()
    return {
        "branches": branches, "brands": brands, "colors": colors,
        "bilimora": bilimora, "chikhli": chikhli, "honda": honda,
        "activa": activa, "variants": variants,
    }


# ============================================================
# AUTH
# ============================================================
class TestAuth:
    def test_login_super(self):
        t, u, c = _login(*CREDS["super"])
        assert u["role"] == "super_admin"
        assert u["email"] == "superadmin@dealer.com"
        assert "access_token" in c or t  # cookie or body token

    def test_login_admin(self):
        _, u, _ = _login(*CREDS["admin"])
        assert u["role"] == "admin"
        assert u.get("branch_id")

    def test_login_sales(self):
        _, u, _ = _login(*CREDS["sales1"])
        assert u["role"] == "sales_executive"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "superadmin@dealer.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_returns_user(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=_hdr(tokens["super"]["token"]))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "superadmin@dealer.com"
        assert "password_hash" not in data
        assert "_id" not in data

    def test_me_no_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self, tokens):
        r = requests.post(f"{API}/auth/logout", headers=_hdr(tokens["super"]["token"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ============================================================
# Constants & Master data
# ============================================================
class TestConstantsAndMaster:
    def test_constants(self):
        r = requests.get(f"{API}/constants")
        assert r.status_code == 200
        d = r.json()
        for k in ["lead_sources", "priorities", "stages", "payment_modes",
                  "followup_types", "lost_reasons", "roles"]:
            assert k in d and isinstance(d[k], list) and len(d[k]) > 0
        assert "Walk-in" in d["lead_sources"]
        assert "Hot" in d["priorities"]
        assert "Booking" in d["stages"]

    def test_branches_requires_auth(self):
        r = requests.get(f"{API}/branches")
        assert r.status_code == 401

    def test_branches_auth(self, tokens):
        r = requests.get(f"{API}/branches", headers=_hdr(tokens["super"]["token"]))
        assert r.status_code == 200
        names = [b["name"] for b in r.json()]
        for name in ["Bilimora", "Chikhli", "Gandevi"]:
            assert name in names

    def test_brands(self, tokens):
        r = requests.get(f"{API}/brands", headers=_hdr(tokens["super"]["token"]))
        assert r.status_code == 200
        names = [b["name"] for b in r.json()]
        for name in ["Honda", "Hero", "TVS", "Suzuki"]:
            assert name in names

    def test_colors(self, tokens):
        r = requests.get(f"{API}/colors", headers=_hdr(tokens["super"]["token"]))
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_models_filter(self, tokens, masters):
        h = _hdr(tokens["super"]["token"])
        r = requests.get(f"{API}/models", params={"brand_id": masters["honda"]["id"]}, headers=h)
        assert r.status_code == 200
        data = r.json()
        assert all(m["brand_id"] == masters["honda"]["id"] for m in data)
        assert any(m["name"] == "Activa 6G" for m in data)

    def test_variants_filter(self, tokens, masters):
        h = _hdr(tokens["super"]["token"])
        r = requests.get(f"{API}/variants", params={"model_id": masters["activa"]["id"]}, headers=h)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(v["model_id"] == masters["activa"]["id"] for v in data)

    def test_super_admin_can_create_and_delete_color(self, tokens):
        h = _hdr(tokens["super"]["token"])
        r = requests.post(f"{API}/colors", json={"name": f"TEST_Color_{uuid.uuid4().hex[:6]}", "hex": "#ABCDEF"}, headers=h)
        assert r.status_code == 200
        cid = r.json()["id"]
        # cleanup
        rd = requests.delete(f"{API}/colors/{cid}", headers=h)
        assert rd.status_code == 200

    def test_admin_cannot_create_branch(self, tokens):
        h = _hdr(tokens["admin"]["token"])
        r = requests.post(f"{API}/branches", json={"name": "TEST_Branch", "code": "TST"}, headers=h)
        assert r.status_code == 403


# ============================================================
# Leads CRUD, RBAC, stage validation
# ============================================================
class TestLeads:
    created_ids = []

    def _new_lead_payload(self, masters, source="Walk-in", priority="Hot", assigned_to=None, branch=None):
        return {
            "customer_name": f"TEST_Customer_{uuid.uuid4().hex[:6]}",
            "phone": "9998887777",
            "source": source,
            "branch_id": (branch or masters["bilimora"])["id"],
            "priority": priority,
            "brand_id": masters["honda"]["id"],
            "model_id": masters["activa"]["id"],
            "purchase_type": "New Purchase",
            "assigned_to": assigned_to,
            "notes": "pytest lead",
        }

    def test_create_lead_round_robin(self, tokens, masters):
        h = _hdr(tokens["super"]["token"])
        # Reset counter by creating 3 leads without assigned_to -> different sales execs
        ids = []
        assigned = []
        for _ in range(3):
            r = requests.post(f"{API}/leads", json=self._new_lead_payload(masters), headers=h)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d["stage"] == "Inquiry"
            assert d.get("assigned_to")  # auto-assigned
            ids.append(d["id"])
            assigned.append(d["assigned_to"])
            TestLeads.created_ids.append(d["id"])
        # At least 2 distinct assignees in Bilimora (2 sales execs there)
        assert len(set(assigned)) >= 2

    def test_create_lead_with_explicit_assignee(self, tokens, masters):
        h = _hdr(tokens["super"]["token"])
        sales1_id = tokens["sales1"]["user"]["id"]
        payload = self._new_lead_payload(masters, assigned_to=sales1_id)
        r = requests.post(f"{API}/leads", json=payload, headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d["assigned_to"] == sales1_id
        TestLeads.created_ids.append(d["id"])

    def test_list_leads_filters(self, tokens):
        h = _hdr(tokens["super"]["token"])
        r = requests.get(f"{API}/leads", params={"source": "Walk-in"}, headers=h)
        assert r.status_code == 200
        assert all(l["source"] == "Walk-in" for l in r.json())

        r2 = requests.get(f"{API}/leads", params={"priority": "Hot"}, headers=h)
        assert r2.status_code == 200
        assert all(l["priority"] == "Hot" for l in r2.json())

        r3 = requests.get(f"{API}/leads", params={"search": "TEST_Customer"}, headers=h)
        assert r3.status_code == 200
        assert len(r3.json()) >= 1

    def test_rbac_sales_sees_only_own(self, tokens):
        h = _hdr(tokens["sales1"]["token"])
        r = requests.get(f"{API}/leads", headers=h)
        assert r.status_code == 200
        uid = tokens["sales1"]["user"]["id"]
        assert all(l["assigned_to"] == uid for l in r.json())

    def test_rbac_admin_sees_only_branch(self, tokens):
        h = _hdr(tokens["admin"]["token"])
        r = requests.get(f"{API}/leads", headers=h)
        assert r.status_code == 200
        br = tokens["admin"]["user"]["branch_id"]
        assert all(l["branch_id"] == br for l in r.json())

    def test_rbac_sales_cannot_access_other_lead(self, tokens, masters):
        # Create a lead assigned to sales2, then try to access from sales3 (different branch)
        h_super = _hdr(tokens["super"]["token"])
        sales2_id = tokens["sales2"]["user"]["id"]
        payload = {
            "customer_name": "TEST_RBAC",
            "phone": "9000000001",
            "source": "Walk-in",
            "branch_id": masters["bilimora"]["id"],
            "priority": "Warm",
            "assigned_to": sales2_id,
        }
        r = requests.post(f"{API}/leads", json=payload, headers=h_super)
        assert r.status_code == 200
        lid = r.json()["id"]
        TestLeads.created_ids.append(lid)

        # sales3 (Chikhli) should get 403
        r2 = requests.get(f"{API}/leads/{lid}", headers=_hdr(tokens["sales3"]["token"]))
        assert r2.status_code == 403

    def test_get_lead_super(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.get(f"{API}/leads/{lid}", headers=h)
        assert r.status_code == 200
        assert r.json()["id"] == lid

    def test_update_lead(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.put(f"{API}/leads/{lid}", json={"notes": "updated-pytest", "priority": "Cold"}, headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d["notes"] == "updated-pytest"
        assert d["priority"] == "Cold"

    # Stage validation ---------------------------------------
    def test_stage_deal_requires_prices(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.post(f"{API}/leads/{lid}/stage", json={"stage": "Deal"}, headers=h)
        assert r.status_code == 400

    def test_stage_deal_success_after_prices(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        # Set deal prices
        r0 = requests.put(f"{API}/leads/{lid}",
                          json={"deal": {"customer_expected_price": 80000, "offered_price": 78000}},
                          headers=h)
        assert r0.status_code == 200
        r = requests.post(f"{API}/leads/{lid}/stage", json={"stage": "Deal"}, headers=h)
        assert r.status_code == 200
        assert r.json()["stage"] == "Deal"

    def test_stage_booking_requires_payment_mode(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.post(f"{API}/leads/{lid}/stage", json={"stage": "Booking"}, headers=h)
        assert r.status_code == 400

    def test_stage_booking_success_with_payment_mode(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r0 = requests.put(f"{API}/leads/{lid}", json={"payment_mode": "Cash"}, headers=h)
        assert r0.status_code == 200
        r = requests.post(f"{API}/leads/{lid}/stage", json={"stage": "Booking"}, headers=h)
        assert r.status_code == 200
        assert r.json()["stage"] == "Booking"

    def test_stage_registration_requires_document(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.post(f"{API}/leads/{lid}/stage", json={"stage": "Registration"}, headers=h)
        assert r.status_code == 400

    def test_stage_lost_requires_reason(self, tokens, masters):
        # Create a fresh lead for Lost test
        h = _hdr(tokens["super"]["token"])
        payload = {
            "customer_name": "TEST_LostLead", "phone": "9111122233",
            "source": "Walk-in", "branch_id": masters["bilimora"]["id"], "priority": "Cold",
        }
        r0 = requests.post(f"{API}/leads", json=payload, headers=h)
        assert r0.status_code == 200
        lid = r0.json()["id"]
        TestLeads.created_ids.append(lid)

        r = requests.post(f"{API}/leads/{lid}/stage", json={"stage": "Lost"}, headers=h)
        assert r.status_code == 400

        r2 = requests.post(f"{API}/leads/{lid}/stage",
                           json={"stage": "Lost", "lost_reason": "Price Issue",
                                 "lost_reason_text": "Too high"}, headers=h)
        assert r2.status_code == 200
        d = r2.json()
        assert d["stage"] == "Lost"
        assert d["lost_reason"] == "Price Issue"

    # Assign / followups / timeline -------------------------
    def test_admin_reassign_lead(self, tokens):
        h = _hdr(tokens["admin"]["token"])
        lid = TestLeads.created_ids[0]
        sales2_id = tokens["sales2"]["user"]["id"]
        r = requests.post(f"{API}/leads/{lid}/assign", params={"assigned_to": sales2_id}, headers=h)
        assert r.status_code == 200
        assert r.json()["assigned_to"] == sales2_id

    def test_sales_exec_cannot_reassign(self, tokens):
        h = _hdr(tokens["sales1"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.post(f"{API}/leads/{lid}/assign",
                          params={"assigned_to": tokens["sales1"]["user"]["id"]}, headers=h)
        assert r.status_code == 403

    def test_add_followup_and_count(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        # get before count
        before = requests.get(f"{API}/leads/{lid}", headers=h).json().get("followup_count", 0)
        r = requests.post(f"{API}/leads/{lid}/followups",
                          json={"type": "Call", "notes": "ring soon", "scheduled_date": "2026-02-15"},
                          headers=h)
        assert r.status_code == 200
        assert r.json()["type"] == "Call"

        after = requests.get(f"{API}/leads/{lid}", headers=h).json()
        assert after["followup_count"] == before + 1
        assert after["next_followup_date"] == "2026-02-15"
        assert after["next_followup_type"] == "Call"

        lst = requests.get(f"{API}/leads/{lid}/followups", headers=h).json()
        assert len(lst) >= 1

    def test_followup_invalid_type(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.post(f"{API}/leads/{lid}/followups",
                          json={"type": "SMS"}, headers=h)
        assert r.status_code == 400

    def test_timeline_has_events(self, tokens):
        h = _hdr(tokens["super"]["token"])
        lid = TestLeads.created_ids[0]
        r = requests.get(f"{API}/leads/{lid}/timeline", headers=h)
        assert r.status_code == 200
        events = [e["event"] for e in r.json()]
        # At minimum, Lead Created should be present
        assert "Lead Created" in events
        # Stage change(s) should be present (Deal or Booking)
        assert any("Stage Changed" in e for e in events)
        # Follow-up added event present
        assert "Follow-up Added" in events


# ============================================================
# Document upload (live Emergent storage)
# ============================================================
class TestDocuments:
    def test_upload_and_download_document(self, tokens, masters):
        h = _hdr(tokens["super"]["token"])
        # create a new lead
        payload = {
            "customer_name": "TEST_DocLead", "phone": "9222233344",
            "source": "Walk-in", "branch_id": masters["bilimora"]["id"], "priority": "Warm",
        }
        r0 = requests.post(f"{API}/leads", json=payload, headers=h)
        assert r0.status_code == 200
        lid = r0.json()["id"]
        TestLeads.created_ids.append(lid)

        # upload
        files = {"file": ("test.txt", io.BytesIO(b"Hello CRM Document Upload"), "text/plain")}
        data = {"doc_type": "rc"}
        r = requests.post(f"{API}/leads/{lid}/documents", headers=h, files=files, data=data, timeout=90)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["doc_type"] == "rc"
        assert rec["original_filename"] == "test.txt"
        fid = rec["id"]

        # verify lead has document
        lead = requests.get(f"{API}/leads/{lid}", headers=h).json()
        assert any(d["id"] == fid for d in lead["documents"])

        # can now move to Registration (requires doc)
        rs = requests.post(f"{API}/leads/{lid}/stage",
                           json={"stage": "Registration"}, headers=h)
        assert rs.status_code == 200
        assert rs.json()["stage"] == "Registration"

        # download via auth query
        token = tokens["super"]["token"]
        rd = requests.get(f"{API}/files/{fid}", params={"auth": token}, timeout=60)
        assert rd.status_code == 200
        assert b"Hello CRM Document Upload" in rd.content

    def test_download_file_no_auth(self, tokens):
        # any file id - should 401 without token even if file exists
        r = requests.get(f"{API}/files/{uuid.uuid4()}")
        assert r.status_code == 401


# ============================================================
# Users mgmt
# ============================================================
class TestUsers:
    def test_super_can_create_user(self, tokens, masters):
        h = _hdr(tokens["super"]["token"])
        email = f"TEST_user_{uuid.uuid4().hex[:6]}@dealer.com"
        r = requests.post(f"{API}/users", json={
            "email": email, "password": "test123", "name": "TEST User",
            "role": "sales_executive", "branch_id": masters["chikhli"]["id"],
        }, headers=h)
        assert r.status_code == 200
        uid = r.json()["id"]
        assert r.json()["email"] == email.lower()

        # Update
        ru = requests.put(f"{API}/users/{uid}", json={"name": "TEST User Renamed"}, headers=h)
        assert ru.status_code == 200
        assert ru.json()["name"] == "TEST User Renamed"

        # List
        rl = requests.get(f"{API}/users", headers=h)
        assert rl.status_code == 200
        assert any(u["id"] == uid for u in rl.json())

        # Delete
        rd = requests.delete(f"{API}/users/{uid}", headers=h)
        assert rd.status_code == 200

    def test_admin_cannot_create_super_admin(self, tokens):
        h = _hdr(tokens["admin"]["token"])
        r = requests.post(f"{API}/users", json={
            "email": f"TEST_evil_{uuid.uuid4().hex[:6]}@dealer.com",
            "password": "x", "name": "Evil",
            "role": "super_admin",
        }, headers=h)
        assert r.status_code == 403

    def test_sales_cannot_list_all_users(self, tokens):
        h = _hdr(tokens["sales1"]["token"])
        r = requests.get(f"{API}/users", headers=h)
        assert r.status_code == 200
        # sales_executive scoped to own id only
        ids = [u["id"] for u in r.json()]
        assert ids == [tokens["sales1"]["user"]["id"]]


# ============================================================
# Analytics
# ============================================================
class TestAnalytics:
    def test_analytics_super(self, tokens):
        h = _hdr(tokens["super"]["token"])
        r = requests.get(f"{API}/analytics/summary", headers=h)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_leads", "per_source", "per_stage", "converted", "lost", "followups_due_today"]:
            assert k in d
        assert isinstance(d["total_leads"], int)
        assert d["total_leads"] >= 1

    def test_analytics_admin_scope(self, tokens):
        h = _hdr(tokens["admin"]["token"])
        r = requests.get(f"{API}/analytics/summary", headers=h)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["total_leads"], int)

    def test_analytics_sales_scope(self, tokens):
        h = _hdr(tokens["sales1"]["token"])
        r = requests.get(f"{API}/analytics/summary", headers=h)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["total_leads"], int)


# ============================================================
# Cleanup
# ============================================================
@pytest.fixture(scope="session", autouse=True)
def _cleanup(tokens):
    yield
    h = _hdr(tokens["super"]["token"])
    for lid in TestLeads.created_ids:
        try:
            # No delete lead endpoint; just leave them. Documents/leads remain. OK.
            pass
        except Exception:
            pass
