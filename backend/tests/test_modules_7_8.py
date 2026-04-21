"""
Backend tests for Modules 7 (Documents + Gemini OCR) & 8 (Delivery).

Covers every requirement in iteration_4 review request.
"""
import io
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw


def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.strip().startswith("REACT_APP_BACKEND_URL="):
                        url = line.strip().split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    return url.rstrip("/")


BASE_URL = _load_base_url()
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"


# ---------- helpers ----------

def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _hj(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def super_tok():
    return _login("superadmin@dealer.com", "super123")


@pytest.fixture(scope="session")
def admin_tok():
    return _login("admin@dealer.com", "admin123")


@pytest.fixture(scope="session")
def sales1_tok():
    return _login("sales1@dealer.com", "sales123")


@pytest.fixture(scope="session")
def sales3_tok():
    return _login("sales3@dealer.com", "sales123")


@pytest.fixture(scope="session")
def bilimora_branch_id(super_tok):
    r = requests.get(f"{API}/branches", headers=_h(super_tok), timeout=10)
    assert r.status_code == 200
    for b in r.json():
        if b["name"] == "Bilimora":
            return b["id"]
    pytest.fail("Bilimora branch not found")


def _future_date(days=5):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _make_jpeg(text_lines=None, size=(400, 250)):
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    y = 20
    for line in text_lines or ["AADHAAR CARD", "Name: Test User",
                               "Aadhaar: 1234 5678 9012", "DOB: 01/01/1990",
                               "Address: TestNagar, Mumbai"]:
        d.text((10, y), line, fill="black")
        y += 35
    # add some "texture" rectangles
    d.rectangle([(350, 10), (390, 50)], outline="black", width=2)
    d.line([(10, 240), (390, 240)], fill="black", width=2)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    buf.seek(0)
    return buf.getvalue()


def _new_lead(tok, branch_id, suffix=""):
    payload = {
        "customer_name": f"TEST_M78_{suffix}_{uuid.uuid4().hex[:6]}",
        "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
        "source": "Walk-in",
        "branch_id": branch_id,
        "priority": "Warm",
    }
    r = requests.post(f"{API}/leads", headers=_hj(tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _upload(tok, lid, doc_type, doc_number=None, notes=None, jpg=None):
    jpg = jpg or _make_jpeg()
    files = {"front": (f"{doc_type}.jpg", jpg, "image/jpeg")}
    data = {"doc_type": doc_type}
    if doc_number is not None:
        data["doc_number"] = doc_number
    if notes is not None:
        data["notes"] = notes
    r = requests.post(f"{API}/leads/{lid}/documents", headers=_h(tok),
                      files=files, data=data, timeout=30)
    return r


# ======================================================================
# /constants
# ======================================================================
class TestConstants:
    def test_constants_have_module7_8_keys(self, sales1_tok):
        r = requests.get(f"{API}/constants", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "doc_types" in data and len(data["doc_types"]) == 14
        assert set(data["doc_statuses"]) == {"Pending", "Verified", "Rejected"}
        assert "Registration" in data["doc_requirements"]
        assert set(data["doc_requirements"]["Registration"]) == {
            "Aadhaar Card", "PAN Card", "RTO Form 20", "RTO Form 21"
        }
        assert set(data["doc_requirements"]["Delivery"]) == {"Aadhaar Card", "Invoice"}
        assert set(data["delivery_statuses"]) == {"Scheduled", "Ready", "Delivered", "Cancelled"}
        assert "Helmet" in data["default_accessories"]


# ======================================================================
# Documents upload + versioning
# ======================================================================
class TestDocUploadVersioning:
    def test_invalid_doc_type_400(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "bad")
        r = _upload(sales1_tok, lead["id"], "Bogus Doc", "X")
        assert r.status_code == 400

    def test_cross_branch_403(self, sales1_tok, sales3_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "cb")
        r = _upload(sales3_tok, lead["id"], "Aadhaar Card", "111122223333")
        assert r.status_code == 403

    def test_upload_creates_v1_and_reupload_supersedes(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "ver")
        lid = lead["id"]
        r1 = _upload(sales1_tok, lid, "Aadhaar Card", "111122223333")
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["version"] == 1 and d1["is_latest"] is True
        assert d1["status"] == "Pending"
        did1 = d1["id"]

        r2 = _upload(sales1_tok, lid, "Aadhaar Card", "444455556666")
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2["version"] == 2 and d2["is_latest"] is True

        # latest list returns only v2
        rl = requests.get(f"{API}/leads/{lid}/documents", headers=_h(sales1_tok), timeout=10)
        assert rl.status_code == 200
        latest = rl.json()
        aadhaar_latest = [x for x in latest if x["doc_type"] == "Aadhaar Card"]
        assert len(aadhaar_latest) == 1 and aadhaar_latest[0]["id"] == d2["id"]

        # history=true returns both
        rh = requests.get(f"{API}/leads/{lid}/documents?include_history=true",
                          headers=_h(sales1_tok), timeout=10)
        assert rh.status_code == 200
        hist_ids = [x["id"] for x in rh.json() if x["doc_type"] == "Aadhaar Card"]
        assert did1 in hist_ids and d2["id"] in hist_ids


# ======================================================================
# Masking
# ======================================================================
class TestMasking:
    def test_aadhaar_and_pan_masked_on_read(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "mask")
        lid = lead["id"]
        _upload(sales1_tok, lid, "Aadhaar Card", "123456789012")
        _upload(sales1_tok, lid, "PAN Card", "ABCDE1234L")

        r = requests.get(f"{API}/leads/{lid}/documents", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        items = {x["doc_type"]: x for x in r.json()}
        # Aadhaar -> XXXX XXXX 9012
        assert items["Aadhaar Card"]["doc_number"].endswith("9012")
        assert "XXXX" in items["Aadhaar Card"]["doc_number"]
        # PAN -> AB XXXX 4L format (first 2 + XXXX + last 2)  = "ABXXXX4L"
        pan_num = items["PAN Card"]["doc_number"]
        assert pan_num.startswith("AB") and pan_num.endswith("4L") and "XXXX" in pan_num


# ======================================================================
# PUT document - owner edits
# ======================================================================
class TestDocUpdate:
    def test_sales_owner_can_edit_doc_number_and_extracted(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "edit")
        lid = lead["id"]
        r = _upload(sales1_tok, lid, "PAN Card", "ABCDE1234L")
        did = r.json()["id"]
        payload = {
            "doc_number": "ZYXWV9876K",
            "extracted": {"document_number": "ZYXWV9876K", "name": "Edited"},
            "notes": "edited by sales",
        }
        ru = requests.put(f"{API}/documents/{did}", headers=_hj(sales1_tok),
                          json=payload, timeout=10)
        assert ru.status_code == 200, ru.text
        out = ru.json()
        # PAN masking in response -> starts with ZY, contains XXXX, ends with 6K
        assert out["doc_number"].startswith("ZY") and out["doc_number"].endswith("6K")
        assert out["extracted"]["name"] == "Edited"
        assert out["notes"] == "edited by sales"


# ======================================================================
# Verify / Reject RBAC
# ======================================================================
class TestVerifyReject:
    def test_sales_cannot_verify_admin_can(self, sales1_tok, admin_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "ver1")
        lid = lead["id"]
        r = _upload(sales1_tok, lid, "Aadhaar Card", "111122223333")
        did = r.json()["id"]
        rs = requests.post(f"{API}/documents/{did}/verify", headers=_h(sales1_tok), timeout=10)
        assert rs.status_code == 403
        ra = requests.post(f"{API}/documents/{did}/verify", headers=_h(admin_tok), timeout=10)
        assert ra.status_code == 200, ra.text
        out = ra.json()
        assert out["status"] == "Verified"
        assert out["verified_by"] and out["verified_at"]

    def test_reject_requires_reason_and_admin_only(self, sales1_tok, admin_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "rej1")
        lid = lead["id"]
        r = _upload(sales1_tok, lid, "PAN Card", "ABCDE1234L")
        did = r.json()["id"]
        # sales forbidden (will 403 before body validation in most cases)
        rs = requests.post(f"{API}/documents/{did}/reject",
                           headers=_hj(sales1_tok), json={"reason": "bad"}, timeout=10)
        assert rs.status_code == 403
        # admin without reason -> 422 (pydantic validation)
        rnr = requests.post(f"{API}/documents/{did}/reject",
                            headers=_hj(admin_tok), json={}, timeout=10)
        assert rnr.status_code in (400, 422)
        # admin with reason -> 200
        ra = requests.post(f"{API}/documents/{did}/reject",
                           headers=_hj(admin_tok), json={"reason": "blurry"}, timeout=10)
        assert ra.status_code == 200, ra.text
        out = ra.json()
        assert out["status"] == "Rejected"
        assert out["rejection_reason"] == "blurry"


# ======================================================================
# Duplicate detection
# ======================================================================
class TestDuplicates:
    def test_duplicates_returns_other_lead_docs_same_number(self, sales1_tok, bilimora_branch_id):
        lead1 = _new_lead(sales1_tok, bilimora_branch_id, "dup1")
        lead2 = _new_lead(sales1_tok, bilimora_branch_id, "dup2")
        # same doc_type + same doc_number on 2 leads
        r1 = _upload(sales1_tok, lead1["id"], "Aadhaar Card", "999988887777")
        r2 = _upload(sales1_tok, lead2["id"], "Aadhaar Card", "999988887777")
        assert r1.status_code == 200 and r2.status_code == 200
        did1 = r1.json()["id"]
        rd = requests.get(f"{API}/documents/{did1}/duplicates",
                          headers=_h(sales1_tok), timeout=10)
        assert rd.status_code == 200
        dups = rd.json()
        assert isinstance(dups, list) and len(dups) >= 1
        # should include lead2's doc, not lead1's
        dup_leads = [d["lead_id"] for d in dups]
        assert lead2["id"] in dup_leads
        assert lead1["id"] not in dup_leads


# ======================================================================
# OCR (wiring only)
# ======================================================================
class TestOCR:
    def test_ocr_endpoint_wiring(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "ocr")
        lid = lead["id"]
        r = _upload(sales1_tok, lid, "Aadhaar Card", None,
                    jpg=_make_jpeg(["AADHAAR CARD", "Name: RAMESH KUMAR",
                                    "DOB: 12/05/1985", "1234 5678 9012",
                                    "Gender: M"]))
        assert r.status_code == 200, r.text
        did = r.json()["id"]
        ro = requests.post(f"{API}/documents/{did}/ocr", headers=_h(sales1_tok), timeout=90)
        assert ro.status_code == 200, f"OCR failed: {ro.status_code} {ro.text}"
        out = ro.json()
        assert out["ocr_ran"] is True
        ext = out.get("extracted") or {}
        for k in ("document_number", "name", "address", "chassis_number",
                  "engine_number", "vehicle_model", "variant", "confidence_score"):
            assert k in ext, f"missing OCR key {k}"


# ======================================================================
# Registration stage strict (requires all 4 required docs Verified)
# ======================================================================
def _ready_confirmed_allotted_lead(sales1_tok, admin_tok, bilimora_branch_id, suffix):
    """Create lead w/ Deal, Booking, Payment, Confirmed, Allotment -> stage=Delivery."""
    lead = _new_lead(sales1_tok, bilimora_branch_id, suffix)
    lid = lead["id"]
    # set deal w/ small discount
    requests.put(f"{API}/leads/{lid}", headers=_hj(sales1_tok),
                 json={"deal": {"customer_expected_price": 70000,
                                "offered_price": 72000,
                                "ex_showroom_price": 73000,
                                "final_deal_price": 71000,
                                "discount": 2000},
                       "payment_mode": "Cash"},
                 timeout=15)
    rb = requests.post(f"{API}/leads/{lid}/booking", headers=_hj(sales1_tok),
                       json={"booking_date": _today(),
                             "expected_delivery_date": _future_date(7),
                             "booking_amount": 2000}, timeout=15)
    assert rb.status_code == 200, rb.text
    bid = rb.json()["id"]
    # pay full final_deal_price so pending_amount==0
    requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                  json={"amount": 71000, "mode": "Cash"}, timeout=10)
    rc = requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales1_tok), timeout=10)
    assert rc.status_code == 200, rc.text
    chassis = f"CHSX{uuid.uuid4().hex[:10].upper()}"
    ra = requests.post(f"{API}/bookings/{bid}/allotment", headers=_hj(sales1_tok),
                       json={"chassis_number": chassis, "engine_number": "EN-1"}, timeout=10)
    assert ra.status_code == 200, ra.text
    return lid, bid, ra.json()


class TestRegistrationStageStrict:
    def test_registration_requires_all_4_verified_docs(
            self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, bid, _ = _ready_confirmed_allotted_lead(
            sales1_tok, admin_tok, bilimora_branch_id, "regstrict")

        # Lead should be at Delivery stage now
        rl = requests.get(f"{API}/leads/{lid}", headers=_h(sales1_tok), timeout=10)
        assert rl.json()["stage"] == "Delivery"

        # Try to jump to Registration without any verified docs -> 400
        rs = requests.post(f"{API}/leads/{lid}/stage", headers=_hj(sales1_tok),
                           json={"stage": "Registration"}, timeout=10)
        assert rs.status_code == 400

        # Upload only 3 of 4 required docs, verify them
        for dt, num in [("Aadhaar Card", "111122223333"),
                        ("PAN Card", "ABCDE1234L"),
                        ("RTO Form 20", "F20-001")]:
            r = _upload(sales1_tok, lid, dt, num)
            assert r.status_code == 200, r.text
            requests.post(f"{API}/documents/{r.json()['id']}/verify",
                          headers=_h(admin_tok), timeout=10)

        rs2 = requests.post(f"{API}/leads/{lid}/stage", headers=_hj(sales1_tok),
                            json={"stage": "Registration"}, timeout=10)
        assert rs2.status_code == 400
        assert "RTO Form 21" in rs2.text

        # Add the last one + verify
        r = _upload(sales1_tok, lid, "RTO Form 21", "F21-001")
        requests.post(f"{API}/documents/{r.json()['id']}/verify",
                      headers=_h(admin_tok), timeout=10)

        rs3 = requests.post(f"{API}/leads/{lid}/stage", headers=_hj(sales1_tok),
                            json={"stage": "Registration"}, timeout=10)
        assert rs3.status_code == 200, rs3.text
        assert rs3.json()["stage"] == "Registration"


# ======================================================================
# Module 8 — Delivery
# ======================================================================
class TestDeliveryCreate:
    def test_requires_confirmed_and_allotted(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "delnoconf")
        lid = lead["id"]
        r = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales1_tok),
                          json={"delivery_date": _future_date(3)}, timeout=10)
        assert r.status_code == 400

    def test_cross_branch_403(self, sales1_tok, sales3_tok, admin_tok, bilimora_branch_id):
        lid, _, _ = _ready_confirmed_allotted_lead(
            sales1_tok, admin_tok, bilimora_branch_id, "delxb")
        r = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales3_tok),
                          json={"delivery_date": _future_date(3)}, timeout=10)
        assert r.status_code == 403

    def test_create_success_and_whatsapp_log(self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, _, _ = _ready_confirmed_allotted_lead(
            sales1_tok, admin_tok, bilimora_branch_id, "delok")
        r = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales1_tok),
                          json={"delivery_date": _future_date(3),
                                "time_slot": "10:00-12:00",
                                "notes": "ready"}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "Scheduled"
        assert d["delivery_date"]
        # whatsapp log entry exists with intent delivery_scheduled
        rw = requests.get(f"{API}/leads/{lid}/whatsapp-logs",
                          headers=_h(sales1_tok), timeout=10)
        assert rw.status_code == 200
        intents = [x["intent"] for x in rw.json()]
        assert "delivery_scheduled" in intents


# ======================================================================
# PUT delivery, OTP, complete
# ======================================================================
class TestDeliveryFlow:
    def _create_delivery(self, sales1_tok, admin_tok, bilimora_branch_id, suffix):
        lid, bid, _ = _ready_confirmed_allotted_lead(
            sales1_tok, admin_tok, bilimora_branch_id, suffix)
        r = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales1_tok),
                          json={"delivery_date": _future_date(3),
                                "time_slot": "14:00-16:00"}, timeout=10)
        assert r.status_code == 200, r.text
        return lid, bid, r.json()["id"]

    def test_put_delivery_updates_checklist_accessories(self, sales1_tok, admin_tok,
                                                       bilimora_branch_id):
        lid, _, did = self._create_delivery(sales1_tok, admin_tok, bilimora_branch_id, "put")
        payload = {
            "checklist": {"payment_completed": True, "documents_verified": True,
                          "vehicle_ready": True, "accessories_ready": True},
            "accessories": [{"name": "Helmet", "quantity": 1, "value": 1500}],
            "time_slot": "09:00-10:00",
            "notes": "updated",
        }
        r = requests.put(f"{API}/deliveries/{did}", headers=_hj(sales1_tok),
                         json=payload, timeout=10)
        assert r.status_code == 200, r.text
        out = r.json()
        assert out["checklist"]["payment_completed"] is True
        assert out["accessories"][0]["name"] == "Helmet"
        assert out["time_slot"] == "09:00-10:00"

    def test_otp_generate_and_verify_flow(self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, _, did = self._create_delivery(sales1_tok, admin_tok, bilimora_branch_id, "otp")
        rg = requests.post(f"{API}/deliveries/{did}/otp-generate",
                           headers=_h(sales1_tok), timeout=10)
        assert rg.status_code == 200, rg.text
        otp = rg.json()["otp"]
        assert len(otp) == 6 and otp.isdigit()
        assert "expires_at" in rg.json()

        # bad otp
        rb = requests.post(f"{API}/deliveries/{did}/otp-verify",
                           params={"otp": "000000" if otp != "000000" else "111111"},
                           headers=_h(sales1_tok), timeout=10)
        assert rb.status_code == 400

        # good otp
        rv = requests.post(f"{API}/deliveries/{did}/otp-verify",
                           params={"otp": otp}, headers=_h(sales1_tok), timeout=10)
        assert rv.status_code == 200

        # whatsapp log includes delivery_otp
        rw = requests.get(f"{API}/leads/{lid}/whatsapp-logs",
                          headers=_h(sales1_tok), timeout=10)
        intents = [x["intent"] for x in rw.json()]
        assert "delivery_otp" in intents

    def test_complete_validations_and_success(self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, bid, did = self._create_delivery(sales1_tok, admin_tok, bilimora_branch_id, "cmp")

        # 1) complete blocked: checklist not set, otp not verified, docs missing
        r = requests.post(f"{API}/deliveries/{did}/complete",
                          headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 400

        # 2) set checklist all true; no otp, no docs -> still 400 on otp
        requests.put(f"{API}/deliveries/{did}", headers=_hj(sales1_tok),
                     json={"checklist": {"payment_completed": True,
                                         "documents_verified": True,
                                         "vehicle_ready": True,
                                         "accessories_ready": True}}, timeout=10)
        r2 = requests.post(f"{API}/deliveries/{did}/complete",
                           headers=_h(sales1_tok), timeout=10)
        assert r2.status_code == 400
        assert "otp" in r2.text.lower()

        # 3) generate + verify otp
        rg = requests.post(f"{API}/deliveries/{did}/otp-generate",
                           headers=_h(sales1_tok), timeout=10)
        otp = rg.json()["otp"]
        requests.post(f"{API}/deliveries/{did}/otp-verify",
                      params={"otp": otp}, headers=_h(sales1_tok), timeout=10)

        # 4) still 400: missing Aadhaar + Invoice verified
        r3 = requests.post(f"{API}/deliveries/{did}/complete",
                           headers=_h(sales1_tok), timeout=10)
        assert r3.status_code == 400
        assert "Aadhaar" in r3.text or "Invoice" in r3.text

        # 5) upload + verify required delivery docs
        for dt, num in [("Aadhaar Card", "111122223333"),
                        ("Invoice", "INV-001")]:
            up = _upload(sales1_tok, lid, dt, num)
            assert up.status_code == 200, up.text
            rv = requests.post(f"{API}/documents/{up.json()['id']}/verify",
                               headers=_h(admin_tok), timeout=10)
            assert rv.status_code == 200

        # 6) complete -> 200
        rc = requests.post(f"{API}/deliveries/{did}/complete",
                           headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 200, rc.text
        assert rc.json()["status"] == "Delivered"

        # lead.stage advanced to Registration (strict check: 4 docs not verified but the endpoint directly sets stage)
        rl = requests.get(f"{API}/leads/{lid}", headers=_h(sales1_tok), timeout=10)
        assert rl.json()["stage"] == "Registration"

        # whatsapp intents logged: thank_you, feedback_reminder, rc_followup
        rw = requests.get(f"{API}/leads/{lid}/whatsapp-logs",
                          headers=_h(sales1_tok), timeout=10)
        intents = [x["intent"] for x in rw.json()]
        for it in ("delivery_thank_you", "feedback_reminder", "rc_followup"):
            assert it in intents, f"missing {it} in {intents}"


# ======================================================================
# Challan HTML + whatsapp-logs structure
# ======================================================================
class TestChallanAndWhatsappLogs:
    def test_challan_returns_html(self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, _, _ = _ready_confirmed_allotted_lead(
            sales1_tok, admin_tok, bilimora_branch_id, "chal")
        rd = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales1_tok),
                           json={"delivery_date": _future_date(2)}, timeout=10)
        assert rd.status_code == 200
        did = rd.json()["id"]
        r = requests.get(f"{API}/deliveries/{did}/challan", headers=_h(sales1_tok), timeout=15)
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert r.text.strip().lower().startswith("<!doctype html>")

    def test_whatsapp_logs_have_sort_and_fields(self, sales1_tok, admin_tok,
                                                bilimora_branch_id):
        lid, _, _ = _ready_confirmed_allotted_lead(
            sales1_tok, admin_tok, bilimora_branch_id, "wlogs")
        requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales1_tok),
                      json={"delivery_date": _future_date(2)}, timeout=10)
        r = requests.get(f"{API}/leads/{lid}/whatsapp-logs",
                         headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        first = items[0]
        for k in ("intent", "payload", "status", "created_at"):
            assert k in first
        # desc sort: created_at of first >= last
        if len(items) >= 2:
            assert items[0]["created_at"] >= items[-1]["created_at"]
