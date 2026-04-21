"""
Backend tests for Modules 9 (Payment & Finance) & 10 (Exchange Vehicle).

Covers every requirement in iteration_5 review request.
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


def _new_lead(tok, branch_id, suffix="", purchase_type=None):
    payload = {
        "customer_name": f"TEST_M910_{suffix}_{uuid.uuid4().hex[:6]}",
        "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
        "source": "Walk-in",
        "branch_id": branch_id,
        "priority": "Warm",
    }
    if purchase_type:
        payload["purchase_type"] = purchase_type
    r = requests.post(f"{API}/leads", headers=_hj(tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _make_jpeg(text_lines=None, size=(400, 250)):
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    y = 20
    for line in text_lines or ["SAMPLE DOCUMENT"]:
        d.text((10, y), line, fill="black")
        y += 30
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=70)
    buf.seek(0)
    return buf.getvalue()


def _upload_doc(tok, lid, doc_type, doc_number=None):
    files = {"front": (f"{doc_type}.jpg", _make_jpeg([doc_type, doc_number or ""]), "image/jpeg")}
    data = {"doc_type": doc_type}
    if doc_number:
        data["doc_number"] = doc_number
    return requests.post(f"{API}/leads/{lid}/documents", headers=_h(tok),
                         files=files, data=data, timeout=30)


def _make_booking(sales_tok, branch_id, suffix, final_price=71000, booking_amount=2000,
                  delivery_days_from_now=5):
    """Create lead -> deal -> booking, pay only booking_amount (pending > 0)."""
    lead = _new_lead(sales_tok, branch_id, suffix)
    lid = lead["id"]
    requests.put(f"{API}/leads/{lid}", headers=_hj(sales_tok),
                 json={"deal": {"customer_expected_price": final_price - 1000,
                                "offered_price": final_price + 1000,
                                "ex_showroom_price": final_price + 2000,
                                "final_deal_price": final_price,
                                "discount": 2000},
                       "payment_mode": "Cash"},
                 timeout=15)
    rb = requests.post(f"{API}/leads/{lid}/booking", headers=_hj(sales_tok),
                       json={"booking_date": _today(),
                             "expected_delivery_date": _future_date(delivery_days_from_now),
                             "booking_amount": booking_amount}, timeout=15)
    assert rb.status_code == 200, rb.text
    bid = rb.json()["id"]
    rp = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales_tok),
                       json={"amount": booking_amount, "mode": "Cash",
                             "payment_type": "Booking"}, timeout=10)
    assert rp.status_code == 200, rp.text
    return lid, bid


def _confirm_and_allot(sales_tok, bid):
    rc = requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales_tok), timeout=10)
    assert rc.status_code == 200, rc.text
    chassis = f"CHSX{uuid.uuid4().hex[:10].upper()}"
    ra = requests.post(f"{API}/bookings/{bid}/allotment", headers=_hj(sales_tok),
                       json={"chassis_number": chassis, "engine_number": "EN-1"}, timeout=10)
    assert ra.status_code == 200, ra.text


# ======================================================================
# /constants
# ======================================================================
class TestConstants:
    def test_constants_have_m910_keys(self, sales1_tok):
        r = requests.get(f"{API}/constants", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["payment_types"] == ["Booking", "Margin", "Final", "Other"]
        assert data["payment_statuses"] == ["Pending", "Partial", "Completed"]
        assert data["finance_statuses"] == ["Not Applied", "Applied", "Under Review",
                                            "Approved", "Rejected"]
        assert data["exchange_conditions"] == ["Good", "Average", "Poor"]


# ======================================================================
# Payments with payment_type + auto payment_status
# ======================================================================
class TestPayments:
    def test_invalid_payment_type_400(self, sales1_tok, bilimora_branch_id):
        _, bid = _make_booking(sales1_tok, bilimora_branch_id, "bad_ptype",
                               final_price=50000, booking_amount=2000)
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                          json={"amount": 500, "mode": "Cash",
                                "payment_type": "Bogus"}, timeout=10)
        assert r.status_code == 400

    def test_valid_payment_types_accepted(self, sales1_tok, bilimora_branch_id):
        _, bid = _make_booking(sales1_tok, bilimora_branch_id, "valid_ptypes",
                               final_price=50000, booking_amount=2000)
        # Booking payment already added as 2000
        for ptype, amt in [("Margin", 500), ("Final", 500), ("Other", 500)]:
            r = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                              json={"amount": amt, "mode": "UPI",
                                    "payment_type": ptype}, timeout=10)
            assert r.status_code == 200, f"{ptype}: {r.text}"
            assert r.json()["payment"]["payment_type"] == ptype

    def test_payment_status_auto_computes(self, sales1_tok, bilimora_branch_id):
        # Initial: just booking amount paid (2000 of 50000) -> Partial
        _, bid = _make_booking(sales1_tok, bilimora_branch_id, "pstatus",
                               final_price=50000, booking_amount=2000)
        rb = requests.get(f"{API}/bookings/{bid}/payment-summary",
                          headers=_h(sales1_tok), timeout=10)
        # After booking payment, total_paid=2000, pending=48000 -> Partial
        assert rb.status_code == 200
        data = rb.json()
        assert data["payment_status"] == "Partial"
        assert data["total_paid"] == 2000
        # Pay remainder -> Completed
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                          json={"amount": 48000, "mode": "Cash",
                                "payment_type": "Final"}, timeout=10)
        assert r.status_code == 200, r.text
        booking = r.json()["booking"]
        assert booking["payment_status"] == "Completed"
        assert booking["pending_amount"] <= 0.01


# ======================================================================
# payment-summary by_type & margin alert
# ======================================================================
class TestPaymentSummary:
    def test_by_type_sums_correctly(self, sales1_tok, bilimora_branch_id):
        _, bid = _make_booking(sales1_tok, bilimora_branch_id, "bytype",
                               final_price=50000, booking_amount=2000)
        # Booking already 2000, add Margin 1000 twice + Final 500
        for amt, ptype in [(1000, "Margin"), (1000, "Margin"), (500, "Final")]:
            requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                          json={"amount": amt, "mode": "Cash",
                                "payment_type": ptype}, timeout=10)
        r = requests.get(f"{API}/bookings/{bid}/payment-summary",
                         headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        s = r.json()
        assert s["by_type"]["Booking"] == 2000
        assert s["by_type"]["Margin"] == 2000
        assert s["by_type"]["Final"] == 500
        assert s["by_type"]["Other"] == 0
        assert s["net_payable"] == 50000
        assert s["total_paid"] == 4500
        assert s["pending_amount"] == 45500

    def test_margin_alert_today_no_margin(self, sales1_tok, admin_tok, bilimora_branch_id):
        """Create lead + booking + allotment + delivery today, no Margin, pending>0."""
        lid, bid = _make_booking(sales1_tok, bilimora_branch_id, "margalert",
                                 final_price=50000, booking_amount=2000,
                                 delivery_days_from_now=2)
        _confirm_and_allot(sales1_tok, bid)
        # Create delivery scheduled today
        r = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales1_tok),
                          json={"delivery_date": _today(),
                                "time_slot": "14:00-16:00"}, timeout=10)
        assert r.status_code == 200, r.text
        rs = requests.get(f"{API}/bookings/{bid}/payment-summary",
                          headers=_h(sales1_tok), timeout=10)
        assert rs.status_code == 200, rs.text
        s = rs.json()
        assert s["margin_alert"] is True, f"Expected margin_alert=True, got {s}"
        assert s["days_to_delivery"] == 0
        # Now add a Margin payment -> alert flips off
        rm = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                           json={"amount": 1000, "mode": "Cash",
                                 "payment_type": "Margin"}, timeout=10)
        assert rm.status_code == 200, rm.text
        rs2 = requests.get(f"{API}/bookings/{bid}/payment-summary",
                           headers=_h(sales1_tok), timeout=10)
        assert rs2.json()["margin_alert"] is False


# ======================================================================
# /payments/{pid}/receipt
# ======================================================================
class TestReceipt:
    def test_receipt_bearer_and_query_auth(self, sales1_tok, bilimora_branch_id):
        _, bid = _make_booking(sales1_tok, bilimora_branch_id, "rcpt",
                               final_price=50000, booking_amount=2000)
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                          json={"amount": 1500, "mode": "UPI",
                                "payment_type": "Margin"}, timeout=10)
        assert r.status_code == 200
        pid = r.json()["payment"]["id"]
        # Bearer
        rr = requests.get(f"{API}/payments/{pid}/receipt",
                          headers=_h(sales1_tok), timeout=10)
        assert rr.status_code == 200
        assert "text/html" in rr.headers.get("content-type", "")
        body = rr.text
        assert "TEST_M910" in body  # customer name
        assert "Margin" in body  # payment_type label
        assert "1,500.00" in body or "1500" in body  # amount

        # Query param auth (no bearer, no cookie)
        rq = requests.get(f"{API}/payments/{pid}/receipt?auth={sales1_tok}", timeout=10)
        assert rq.status_code == 200
        assert "Payment Receipt" in rq.text

    def test_receipt_requires_auth(self, sales1_tok, bilimora_branch_id):
        _, bid = _make_booking(sales1_tok, bilimora_branch_id, "rcpt_noauth",
                               final_price=50000, booking_amount=2000)
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_hj(sales1_tok),
                          json={"amount": 500, "mode": "Cash"}, timeout=10)
        pid = r.json()["payment"]["id"]
        rr = requests.get(f"{API}/payments/{pid}/receipt", timeout=10)
        assert rr.status_code == 401


# ======================================================================
# Finance Case CRUD + RBAC
# ======================================================================
class TestFinanceCase:
    def test_create_get_and_duplicate(self, sales1_tok, bilimora_branch_id):
        lid, _ = _make_booking(sales1_tok, bilimora_branch_id, "fc_create",
                               final_price=60000, booking_amount=2000)
        r = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales1_tok),
                          json={"finance_company": "HDFC Bank",
                                "downpayment_amount": 10000,
                                "emi": 2000, "tenure": 24}, timeout=10)
        assert r.status_code == 200, r.text
        fc = r.json()
        assert fc["status"] == "Applied"
        # loan_amount = 60000 - 10000 = 50000
        assert fc["loan_amount"] == 50000
        assert fc["downpayment_received"] is False

        # GET
        rg = requests.get(f"{API}/leads/{lid}/finance-case",
                          headers=_h(sales1_tok), timeout=10)
        assert rg.status_code == 200
        assert rg.json()["id"] == fc["id"]

        # Duplicate -> 400
        r2 = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales1_tok),
                           json={"finance_company": "ICICI"}, timeout=10)
        assert r2.status_code == 400

    def test_sales_cannot_approve_reject_admin_can(self, sales1_tok, admin_tok,
                                                   bilimora_branch_id):
        lid, _ = _make_booking(sales1_tok, bilimora_branch_id, "fc_rbac",
                               final_price=60000, booking_amount=2000)
        r = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales1_tok),
                          json={"finance_company": "SBI",
                                "downpayment_amount": 10000}, timeout=10)
        assert r.status_code == 200
        fid = r.json()["id"]

        # Sales can change status to Under Review
        r1 = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(sales1_tok),
                          json={"status": "Under Review"}, timeout=10)
        assert r1.status_code == 200, r1.text
        assert r1.json()["status"] == "Under Review"

        # Sales cannot Approve -> 403
        r2 = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(sales1_tok),
                          json={"status": "Approved"}, timeout=10)
        assert r2.status_code == 403

        # Sales cannot Reject -> 403
        r3 = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(sales1_tok),
                          json={"status": "Rejected",
                                "rejection_reason": "bad credit"}, timeout=10)
        assert r3.status_code == 403

        # Admin Reject without reason -> 400
        r4 = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(admin_tok),
                          json={"status": "Rejected"}, timeout=10)
        assert r4.status_code == 400

        # Admin Approve -> sets approved_at / approved_by
        r5 = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(admin_tok),
                          json={"status": "Approved"}, timeout=10)
        assert r5.status_code == 200, r5.text
        out = r5.json()
        assert out["status"] == "Approved"
        assert out["approved_at"] and out["approved_by"]

    def test_downpayment_recomputes_loan_and_received_toggle(
            self, sales1_tok, bilimora_branch_id):
        lid, _ = _make_booking(sales1_tok, bilimora_branch_id, "fc_dp",
                               final_price=60000, booking_amount=2000)
        r = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales1_tok),
                          json={"finance_company": "Axis",
                                "downpayment_amount": 5000}, timeout=10)
        fid = r.json()["id"]
        assert r.json()["loan_amount"] == 55000

        ru = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(sales1_tok),
                          json={"downpayment_amount": 20000}, timeout=10)
        assert ru.status_code == 200
        assert ru.json()["loan_amount"] == 40000

        # Toggle downpayment_received=true
        rt = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(sales1_tok),
                          json={"downpayment_received": True}, timeout=10)
        assert rt.status_code == 200
        assert rt.json()["downpayment_received"] is True


# ======================================================================
# Delivery /complete: Finance path
# ======================================================================
def _finish_delivery_setup(sales_tok, admin_tok, branch_id, suffix,
                           final_price=50000, booking_paid=2000):
    """Create lead, booking (partial paid), confirm, allot, upload+verify Aadhaar+Invoice,
    create delivery, complete checklist, OTP verify. Returns (lid, bid, did)."""
    lid, bid = _make_booking(sales_tok, branch_id, suffix, final_price=final_price,
                             booking_amount=booking_paid, delivery_days_from_now=5)
    _confirm_and_allot(sales_tok, bid)
    # Upload & verify Aadhaar + Invoice (required for Delivery stage)
    for dt, num in [("Aadhaar Card", "111122223333"), ("Invoice", "INV-001")]:
        r = _upload_doc(sales_tok, lid, dt, num)
        assert r.status_code == 200, r.text
        did_doc = r.json()["id"]
        rv = requests.post(f"{API}/documents/{did_doc}/verify",
                           headers=_h(admin_tok), timeout=10)
        assert rv.status_code == 200
    # Create delivery
    rd = requests.post(f"{API}/leads/{lid}/delivery", headers=_hj(sales_tok),
                       json={"delivery_date": _future_date(3),
                             "time_slot": "10:00-12:00"}, timeout=10)
    assert rd.status_code == 200, rd.text
    did = rd.json()["id"]
    # Checklist all true
    requests.put(f"{API}/deliveries/{did}", headers=_hj(sales_tok),
                 json={"checklist": {"payment_completed": True,
                                     "documents_verified": True,
                                     "vehicle_ready": True,
                                     "accessories_ready": True}}, timeout=10)
    # OTP
    rg = requests.post(f"{API}/deliveries/{did}/otp-generate",
                       headers=_h(sales_tok), timeout=10)
    otp = rg.json().get("otp")
    rv = requests.post(f"{API}/deliveries/{did}/otp-verify?otp={otp}",
                       headers=_h(sales_tok), timeout=10)
    assert rv.status_code == 200, rv.text
    return lid, bid, did


class TestDeliveryFinancePath:
    def test_complete_fails_when_pending_and_no_finance(
            self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, bid, did = _finish_delivery_setup(sales1_tok, admin_tok,
                                               bilimora_branch_id, "fin_none")
        rc = requests.post(f"{API}/deliveries/{did}/complete",
                           headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 400
        assert "pending" in rc.text.lower() or "finance" in rc.text.lower()

    def test_complete_fails_when_approved_but_no_downpayment(
            self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, bid, did = _finish_delivery_setup(sales1_tok, admin_tok,
                                               bilimora_branch_id, "fin_no_dp")
        # Create finance and approve, downpayment_received stays false
        rf = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales1_tok),
                           json={"finance_company": "HDFC",
                                 "downpayment_amount": 5000}, timeout=10)
        fid = rf.json()["id"]
        ra = requests.put(f"{API}/finance-cases/{fid}", headers=_hj(admin_tok),
                          json={"status": "Approved"}, timeout=10)
        assert ra.status_code == 200
        rc = requests.post(f"{API}/deliveries/{did}/complete",
                           headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 400

    def test_complete_succeeds_with_finance_approved_and_dp_received(
            self, sales1_tok, admin_tok, bilimora_branch_id):
        lid, bid, did = _finish_delivery_setup(sales1_tok, admin_tok,
                                               bilimora_branch_id, "fin_ok")
        rf = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales1_tok),
                           json={"finance_company": "HDFC",
                                 "downpayment_amount": 5000}, timeout=10)
        fid = rf.json()["id"]
        requests.put(f"{API}/finance-cases/{fid}", headers=_hj(admin_tok),
                     json={"status": "Approved"}, timeout=10)
        requests.put(f"{API}/finance-cases/{fid}", headers=_hj(sales1_tok),
                     json={"downpayment_received": True}, timeout=10)
        rc = requests.post(f"{API}/deliveries/{did}/complete",
                           headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 200, rc.text
        assert rc.json()["status"] == "Delivered"


# ======================================================================
# Exchange: recompute booking on final_value change + valuations + photos
# ======================================================================
class TestExchangeRecompute:
    def test_put_lead_exchange_final_value_recomputes_booking(
            self, sales1_tok, bilimora_branch_id):
        lid, bid = _make_booking(sales1_tok, bilimora_branch_id, "xch_recomp",
                                 final_price=60000, booking_amount=2000)
        # Change exchange.final_value to 15000 via PUT /leads/{lid}
        r = requests.put(f"{API}/leads/{lid}", headers=_hj(sales1_tok),
                         json={"exchange": {"old_model": "Activa 5G",
                                            "final_value": 15000,
                                            "offered_price": 16000}}, timeout=15)
        assert r.status_code == 200, r.text
        # Fetch booking
        rb = requests.get(f"{API}/leads/{lid}/booking", headers=_h(sales1_tok), timeout=10)
        assert rb.status_code == 200
        b = rb.json()
        # net_payable = 60000 - 15000 = 45000, paid=2000, pending=43000
        assert b["exchange_adjustment"] == 15000
        assert b["net_payable"] == 45000
        assert b["pending_amount"] == 43000

        # Update final_value to 5000 -> net_payable = 55000
        r2 = requests.put(f"{API}/leads/{lid}", headers=_hj(sales1_tok),
                          json={"exchange": {"old_model": "Activa 5G",
                                             "final_value": 5000}}, timeout=15)
        assert r2.status_code == 200
        rb2 = requests.get(f"{API}/leads/{lid}/booking", headers=_h(sales1_tok), timeout=10)
        b2 = rb2.json()
        assert b2["exchange_adjustment"] == 5000
        assert b2["net_payable"] == 55000


class TestExchangeValuations:
    def test_400_when_not_exchange_purchase_type(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "xval_notxch")
        r = requests.post(f"{API}/leads/{lead['id']}/exchange-valuations",
                          headers=_hj(sales1_tok),
                          json={"source": "broker", "value": 10000}, timeout=10)
        assert r.status_code == 400

    def test_create_broker_updates_lead_and_list_desc(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "xval_ok",
                         purchase_type="Exchange Vehicle")
        lid = lead["id"]
        # internal
        r1 = requests.post(f"{API}/leads/{lid}/exchange-valuations", headers=_hj(sales1_tok),
                           json={"source": "internal", "value": 12000,
                                 "remarks": "low mileage"}, timeout=10)
        assert r1.status_code == 200
        # online
        r2 = requests.post(f"{API}/leads/{lid}/exchange-valuations", headers=_hj(sales1_tok),
                           json={"source": "online", "value": 13500}, timeout=10)
        assert r2.status_code == 200
        # broker -> updates lead.exchange.broker_value
        r3 = requests.post(f"{API}/leads/{lid}/exchange-valuations", headers=_hj(sales1_tok),
                           json={"source": "broker", "value": 14000,
                                 "remarks": "broker X"}, timeout=10)
        assert r3.status_code == 200

        # Lead should have broker_value=14000
        rl = requests.get(f"{API}/leads/{lid}", headers=_h(sales1_tok), timeout=10)
        lead_fresh = rl.json()
        assert (lead_fresh.get("exchange") or {}).get("broker_value") == 14000
        assert (lead_fresh.get("exchange") or {}).get("broker_remarks") == "broker X"

        # List descending by created_at
        rlist = requests.get(f"{API}/leads/{lid}/exchange-valuations",
                             headers=_h(sales1_tok), timeout=10)
        assert rlist.status_code == 200
        items = rlist.json()
        assert len(items) == 3
        # descending: latest (broker) first
        assert items[0]["source"] == "broker"
        assert items[-1]["source"] == "internal"


class TestExchangePhotos:
    def test_upload_appends_file_id(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "xph",
                         purchase_type="Exchange Vehicle")
        lid = lead["id"]
        files = {"file": ("photo.jpg", _make_jpeg(["EXCHANGE PHOTO"]), "image/jpeg")}
        r = requests.post(f"{API}/leads/{lid}/exchange-photos",
                          headers=_h(sales1_tok), files=files, timeout=30)
        assert r.status_code == 200, r.text
        out = r.json()
        assert "file_id" in out
        fid = out["file_id"]
        assert fid in out["photos"]

        # Upload second photo -> list grows
        files2 = {"file": ("photo2.jpg", _make_jpeg(["PHOTO 2"]), "image/jpeg")}
        r2 = requests.post(f"{API}/leads/{lid}/exchange-photos",
                           headers=_h(sales1_tok), files=files2, timeout=30)
        assert r2.status_code == 200
        assert len(r2.json()["photos"]) == 2

        # Verify lead.exchange.photos reflects
        rl = requests.get(f"{API}/leads/{lid}", headers=_h(sales1_tok), timeout=10)
        ph = (rl.json().get("exchange") or {}).get("photos") or []
        assert len(ph) == 2


# ======================================================================
# RBAC regression (cross-branch)
# ======================================================================
class TestRBAC:
    def test_sales_cross_branch_cannot_create_finance_case(
            self, sales1_tok, sales3_tok, bilimora_branch_id):
        lid, _ = _make_booking(sales1_tok, bilimora_branch_id, "rbac_fc",
                               final_price=50000, booking_amount=2000)
        r = requests.post(f"{API}/leads/{lid}/finance-case", headers=_hj(sales3_tok),
                          json={"finance_company": "HDFC"}, timeout=10)
        assert r.status_code == 403

    def test_sales_cross_branch_cannot_add_valuation(
            self, sales1_tok, sales3_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "rbac_val",
                         purchase_type="Exchange Vehicle")
        r = requests.post(f"{API}/leads/{lead['id']}/exchange-valuations",
                          headers=_hj(sales3_tok),
                          json={"source": "broker", "value": 10000}, timeout=10)
        assert r.status_code == 403
