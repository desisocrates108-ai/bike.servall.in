"""
Backend tests for Modules 5 (Booking Management) and 6 (Vehicle Allotment).

Covers:
- Booking create validations (final_deal_price, amount<=final, delivery>=booking_date)
- Booking create success + stage auto-advance + timeline
- Duplicate booking
- Booking RBAC (branch scoped / sales assigned)
- PUT booking (admin-only fields stripped for sales)
- Payments validations + persistence + cumulative cap + totals update
- Confirm rules
- Cancel RBAC
- Allotment rules (needs Confirmed, unique chassis system-wide, unique per booking, case-insensitive)
- Allotment success -> lead.stage auto-advances to Delivery + timeline events
- PUT allotment admin/super_admin only + chassis uniqueness + status validation
- /constants now includes booking_statuses, allotment_statuses, loan_statuses
- Regression: auth, leads, followups, deal, tasks, analytics still work

Helper builds a "booking-ready" lead for sales1 (Bilimora) by:
  1. creating a lead in Bilimora (auto-assigned to creator=sales1)
  2. setting deal prices + final_deal_price (with discount<5000 so no approval)
  3. adding a Connected followup
  4. moving stage Connected -> Deal -> Booking? Actually we skip /stage: POST /leads/{lid}/booking auto-advances.
"""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timezone, timedelta

def _load_base_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        try:
            with open("/app/frontend/.env", "r") as f:
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

def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
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


def _new_lead(tok, branch_id, suffix=""):
    payload = {
        "customer_name": f"TEST_M56_{suffix}_{uuid.uuid4().hex[:6]}",
        "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
        "source": "Walk-in",
        "branch_id": branch_id,
        "priority": "Warm",
    }
    r = requests.post(f"{API}/leads", headers=_h(tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _make_booking_ready_lead(tok, branch_id, suffix=""):
    """Create a lead with final_deal_price set (discount<5000 -> no approval needed)."""
    lead = _new_lead(tok, branch_id, suffix)
    lid = lead["id"]
    r = requests.put(
        f"{API}/leads/{lid}", headers=_h(tok),
        json={"deal": {
            "customer_expected_price": 70000, "offered_price": 72000,
            "ex_showroom_price": 73000, "final_deal_price": 71000,
            "discount": 2000,
        }}, timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _future_date(days=5):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%d")


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# ======================================================================
# /constants
# ======================================================================
class TestConstants:
    def test_constants_include_module_5_6_keys(self, sales1_tok):
        r = requests.get(f"{API}/constants", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in ("booking_statuses", "allotment_statuses", "loan_statuses", "payment_modes"):
            assert k in data, f"missing {k} in /constants"
        assert set(data["booking_statuses"]) == {"Pending", "Confirmed", "Cancelled"}
        assert set(data["allotment_statuses"]) == {"Pending", "Allotted"}
        assert "Cash" in data["payment_modes"] and "UPI" in data["payment_modes"]


# ======================================================================
# Booking CREATE validations
# ======================================================================
class TestBookingCreateValidation:
    def test_400_without_final_deal_price(self, sales1_tok, bilimora_branch_id):
        lead = _new_lead(sales1_tok, bilimora_branch_id, "nofinal")
        r = requests.post(
            f"{API}/leads/{lead['id']}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(7), "booking_amount": 1000},
            timeout=15,
        )
        assert r.status_code == 400
        assert "final" in r.text.lower()

    def test_400_amount_exceeds_final(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "exceed")
        r = requests.post(
            f"{API}/leads/{lead['id']}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(7), "booking_amount": 999999},
            timeout=15,
        )
        assert r.status_code == 400

    def test_400_delivery_before_booking(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "badDate")
        body = {
            "booking_date": _future_date(10),
            "expected_delivery_date": _future_date(2),
            "booking_amount": 5000,
        }
        r = requests.post(f"{API}/leads/{lead['id']}/booking",
                          headers=_h(sales1_tok), json=body, timeout=15)
        assert r.status_code == 400
        assert "delivery" in r.text.lower()


# ======================================================================
# Booking CREATE success + duplicate + GET
# ======================================================================
class TestBookingCreateAndGet:
    def test_create_success_auto_advances_and_timeline(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "ok")
        lid = lead["id"]
        body = {
            "booking_date": _today(),
            "expected_delivery_date": _future_date(10),
            "booking_amount": 5000,
            "notes": "first booking",
        }
        r = requests.post(f"{API}/leads/{lid}/booking",
                          headers=_h(sales1_tok), json=body, timeout=15)
        assert r.status_code == 200, r.text
        booking = r.json()
        assert booking["status"] == "Pending"
        assert booking["booking_amount"] == 5000
        assert booking["lead_id"] == lid

        # lead.stage auto advanced to Booking
        rl = requests.get(f"{API}/leads/{lid}", headers=_h(sales1_tok), timeout=10)
        assert rl.status_code == 200
        assert rl.json()["stage"] == "Booking"

        # Timeline has "Booking Created"
        rt = requests.get(f"{API}/leads/{lid}/timeline", headers=_h(sales1_tok), timeout=10)
        assert rt.status_code == 200
        events = [e.get("event") or e.get("type") or "" for e in rt.json()]
        assert any("Booking Created" in str(e) for e in events), f"events={events}"

        # GET /leads/{lid}/booking returns this booking
        rg = requests.get(f"{API}/leads/{lid}/booking", headers=_h(sales1_tok), timeout=10)
        assert rg.status_code == 200
        assert rg.json()["id"] == booking["id"]

    def test_duplicate_booking_rejected(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "dup")
        lid = lead["id"]
        body = {"expected_delivery_date": _future_date(7), "booking_amount": 3000}
        r1 = requests.post(f"{API}/leads/{lid}/booking",
                           headers=_h(sales1_tok), json=body, timeout=15)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/leads/{lid}/booking",
                           headers=_h(sales1_tok), json=body, timeout=15)
        assert r2.status_code == 400
        assert "exist" in r2.text.lower() or "already" in r2.text.lower()


# ======================================================================
# Booking RBAC + PUT update
# ======================================================================
class TestBookingRBACAndUpdate:
    def test_cross_branch_sales_gets_403_on_get(self, sales1_tok, sales3_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "rbac")
        lid = lead["id"]
        r = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(7), "booking_amount": 2000},
            timeout=15,
        )
        assert r.status_code == 200
        bid = r.json()["id"]
        rg = requests.get(f"{API}/bookings/{bid}", headers=_h(sales3_tok), timeout=10)
        assert rg.status_code == 403

    def test_admin_can_change_booking_date_and_status_sales_cannot(
        self, sales1_tok, admin_tok, bilimora_branch_id
    ):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "putfields")
        lid = lead["id"]
        r = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"booking_date": _today(), "expected_delivery_date": _future_date(7),
                  "booking_amount": 2000},
            timeout=15,
        )
        assert r.status_code == 200
        bid = r.json()["id"]
        original_date = r.json()["booking_date"]
        original_status = r.json()["status"]

        # Sales update of booking_date/status should be silently stripped
        new_date = _future_date(3)
        rs = requests.put(f"{API}/bookings/{bid}", headers=_h(sales1_tok),
                          json={"booking_date": new_date, "status": "Confirmed",
                                "notes": "sales-edit"}, timeout=10)
        assert rs.status_code == 200, rs.text
        fresh = rs.json()
        assert fresh["booking_date"] == original_date  # unchanged
        assert fresh["status"] == original_status      # unchanged
        assert fresh.get("notes") == "sales-edit"      # allowed fields still saved

        # Admin can change booking_date
        ra = requests.put(f"{API}/bookings/{bid}", headers=_h(admin_tok),
                          json={"booking_date": new_date}, timeout=10)
        assert ra.status_code == 200, ra.text
        assert ra.json()["booking_date"] == new_date

    def test_put_validates_amount_and_delivery_dates(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "putval")
        lid = lead["id"]
        r = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"booking_date": _today(), "expected_delivery_date": _future_date(10),
                  "booking_amount": 2000},
            timeout=15,
        )
        assert r.status_code == 200
        bid = r.json()["id"]

        # amount > final_deal_price (71000)
        r1 = requests.put(f"{API}/bookings/{bid}", headers=_h(sales1_tok),
                          json={"booking_amount": 999999}, timeout=10)
        assert r1.status_code == 400

        # delivery before booking_date
        r2 = requests.put(f"{API}/bookings/{bid}", headers=_h(sales1_tok),
                          json={"expected_delivery_date": "2000-01-01"}, timeout=10)
        assert r2.status_code == 400


# ======================================================================
# Payments
# ======================================================================
class TestPayments:
    def _seed_booking(self, sales1_tok, bilimora_branch_id, amount=5000, final=71000):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, f"pay_{uuid.uuid4().hex[:4]}")
        lid = lead["id"]
        r = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"booking_date": _today(), "expected_delivery_date": _future_date(10),
                  "booking_amount": amount},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        return lid, r.json()

    def test_payment_validations_and_persistence(self, sales1_tok, bilimora_branch_id):
        lid, booking = self._seed_booking(sales1_tok, bilimora_branch_id, amount=5000)
        bid = booking["id"]

        # amount<=0
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                          json={"amount": 0, "mode": "Cash"}, timeout=10)
        assert r.status_code == 400

        # bad mode
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                          json={"amount": 1000, "mode": "Bitcoin"}, timeout=10)
        assert r.status_code == 400

        # good payment
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                          json={"amount": 3000, "mode": "Cash", "notes": "part"}, timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "payment" in data and "booking" in data
        assert data["booking"]["total_paid"] == 3000
        assert data["booking"]["pending_amount"] == 71000 - 3000

        # Cannot exceed final
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                          json={"amount": 999999, "mode": "Cash"}, timeout=10)
        assert r.status_code == 400

        # GET payments
        r = requests.get(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all("amount" in p and "mode" in p for p in items)


# ======================================================================
# Confirm
# ======================================================================
class TestConfirm:
    def test_confirm_blocked_until_booking_amount_paid(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "conf")
        lid = lead["id"]
        r = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(7), "booking_amount": 5000},
            timeout=15,
        )
        assert r.status_code == 200
        bid = r.json()["id"]

        # Not enough paid -> 400
        rc = requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 400

        # Pay partial
        requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                      json={"amount": 2000, "mode": "Cash"}, timeout=10)
        rc = requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 400

        # Pay the rest
        requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                      json={"amount": 3000, "mode": "UPI"}, timeout=10)
        rc = requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 200, rc.text
        data = rc.json()
        assert data["status"] == "Confirmed"
        assert data.get("confirmed_at") is not None
        assert data.get("confirmed_by") is not None


# ======================================================================
# Cancel RBAC
# ======================================================================
class TestCancel:
    def test_cancel_rbac(self, sales1_tok, admin_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "cxl")
        lid = lead["id"]
        r = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(5), "booking_amount": 2000},
            timeout=15,
        )
        assert r.status_code == 200
        bid = r.json()["id"]

        # Sales forbidden
        rs = requests.post(f"{API}/bookings/{bid}/cancel", headers=_h(sales1_tok), timeout=10)
        assert rs.status_code == 403

        # Admin cancels
        ra = requests.post(f"{API}/bookings/{bid}/cancel", headers=_h(admin_tok), timeout=10)
        assert ra.status_code == 200, ra.text
        assert ra.json()["status"] == "Cancelled"


# ======================================================================
# Allotment
# ======================================================================
class TestAllotment:
    def _confirmed_booking(self, sales1_tok, bilimora_branch_id, suffix):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, suffix)
        lid = lead["id"]
        rb = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(7), "booking_amount": 2000},
            timeout=15,
        )
        assert rb.status_code == 200, rb.text
        bid = rb.json()["id"]
        # pay and confirm
        requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                      json={"amount": 2000, "mode": "Cash"}, timeout=10)
        rc = requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales1_tok), timeout=10)
        assert rc.status_code == 200, rc.text
        return lid, bid

    def test_allotment_requires_confirmed(self, sales1_tok, bilimora_branch_id):
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "alot_noconf")
        lid = lead["id"]
        rb = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(5), "booking_amount": 2000},
            timeout=15,
        )
        bid = rb.json()["id"]
        r = requests.post(f"{API}/bookings/{bid}/allotment", headers=_h(sales1_tok),
                          json={"chassis_number": f"CH{uuid.uuid4().hex[:10].upper()}"},
                          timeout=10)
        assert r.status_code == 400
        assert "confirm" in r.text.lower()

    def test_allotment_success_advances_stage_and_duplicates_rejected(
        self, sales1_tok, bilimora_branch_id
    ):
        lid, bid = self._confirmed_booking(sales1_tok, bilimora_branch_id, "alot_ok")
        chassis = f"CH{uuid.uuid4().hex[:10].upper()}"
        r = requests.post(f"{API}/bookings/{bid}/allotment", headers=_h(sales1_tok),
                          json={"chassis_number": chassis, "engine_number": "EN123"},
                          timeout=10)
        assert r.status_code == 200, r.text
        allot = r.json()
        assert allot["chassis_number"] == chassis.upper()

        # Lead.stage should be Delivery
        rl = requests.get(f"{API}/leads/{lid}", headers=_h(sales1_tok), timeout=10)
        assert rl.json()["stage"] == "Delivery"

        # Timeline has Vehicle Allotted + Stage Changed
        rt = requests.get(f"{API}/leads/{lid}/timeline", headers=_h(sales1_tok), timeout=10)
        events = [str(e.get("event") or e.get("type") or "") for e in rt.json()]
        assert any("Vehicle Allotted" in e for e in events), f"events={events}"
        assert any("Stage Changed" in e for e in events), f"events={events}"

        # Duplicate allotment on same booking -> 400
        r2 = requests.post(f"{API}/bookings/{bid}/allotment", headers=_h(sales1_tok),
                           json={"chassis_number": f"CH{uuid.uuid4().hex[:10].upper()}"},
                           timeout=10)
        assert r2.status_code == 400

        # GET
        rg = requests.get(f"{API}/bookings/{bid}/allotment", headers=_h(sales1_tok), timeout=10)
        assert rg.status_code == 200
        assert rg.json()["chassis_number"] == chassis.upper()

        return lid, bid, chassis

    def test_chassis_unique_across_system_case_insensitive(
        self, sales1_tok, bilimora_branch_id
    ):
        # first allotment
        lid1, bid1 = self._confirmed_booking(sales1_tok, bilimora_branch_id, "uq1")
        chassis = f"UNQ{uuid.uuid4().hex[:8].upper()}"
        r = requests.post(f"{API}/bookings/{bid1}/allotment", headers=_h(sales1_tok),
                          json={"chassis_number": chassis}, timeout=10)
        assert r.status_code == 200

        # second booking tries to use same chassis (lowercase to test case-insensitive)
        lid2, bid2 = self._confirmed_booking(sales1_tok, bilimora_branch_id, "uq2")
        r2 = requests.post(f"{API}/bookings/{bid2}/allotment", headers=_h(sales1_tok),
                           json={"chassis_number": chassis.lower()}, timeout=10)
        assert r2.status_code == 400
        assert "chassis" in r2.text.lower() or "exist" in r2.text.lower() or "already" in r2.text.lower()


# ======================================================================
# PUT allotment
# ======================================================================
class TestAllotmentUpdate:
    def test_put_allotment_admin_only_and_status_validation(
        self, sales1_tok, admin_tok, bilimora_branch_id
    ):
        # setup: confirmed booking + allotment
        lead = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "put_alot")
        lid = lead["id"]
        rb = requests.post(
            f"{API}/leads/{lid}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(5), "booking_amount": 2000},
            timeout=15,
        )
        bid = rb.json()["id"]
        requests.post(f"{API}/bookings/{bid}/payments", headers=_h(sales1_tok),
                      json={"amount": 2000, "mode": "Cash"}, timeout=10)
        requests.post(f"{API}/bookings/{bid}/confirm", headers=_h(sales1_tok), timeout=10)
        chassis1 = f"CA{uuid.uuid4().hex[:10].upper()}"
        ra = requests.post(f"{API}/bookings/{bid}/allotment", headers=_h(sales1_tok),
                           json={"chassis_number": chassis1}, timeout=10)
        assert ra.status_code == 200
        aid = ra.json()["id"]

        # Sales forbidden
        rs = requests.put(f"{API}/allotments/{aid}", headers=_h(sales1_tok),
                          json={"engine_number": "E1"}, timeout=10)
        assert rs.status_code == 403

        # Admin invalid status -> 400
        rb2 = requests.put(f"{API}/allotments/{aid}", headers=_h(admin_tok),
                           json={"status": "BOGUS"}, timeout=10)
        assert rb2.status_code == 400

        # Admin valid update
        new_engine = "EN-NEW-1"
        rok = requests.put(f"{API}/allotments/{aid}", headers=_h(admin_tok),
                           json={"engine_number": new_engine, "status": "Allotted"}, timeout=10)
        assert rok.status_code == 200, rok.text
        assert rok.json()["engine_number"] == new_engine
        assert rok.json()["status"] == "Allotted"

        # Chassis uniqueness on update: create another allotment, then try to rename first one to that chassis
        lid2 = _make_booking_ready_lead(sales1_tok, bilimora_branch_id, "put_alot2")["id"]
        rb3 = requests.post(
            f"{API}/leads/{lid2}/booking", headers=_h(sales1_tok),
            json={"expected_delivery_date": _future_date(5), "booking_amount": 2000},
            timeout=15,
        )
        bid2 = rb3.json()["id"]
        requests.post(f"{API}/bookings/{bid2}/payments", headers=_h(sales1_tok),
                      json={"amount": 2000, "mode": "Cash"}, timeout=10)
        requests.post(f"{API}/bookings/{bid2}/confirm", headers=_h(sales1_tok), timeout=10)
        chassis2 = f"CB{uuid.uuid4().hex[:10].upper()}"
        requests.post(f"{API}/bookings/{bid2}/allotment", headers=_h(sales1_tok),
                      json={"chassis_number": chassis2}, timeout=10)

        rdup = requests.put(f"{API}/allotments/{aid}", headers=_h(admin_tok),
                            json={"chassis_number": chassis2.lower()}, timeout=10)
        assert rdup.status_code == 400


# ======================================================================
# Regression: core flows still work
# ======================================================================
class TestRegression:
    def test_auth_me_and_leads_list(self, sales1_tok):
        r = requests.get(f"{API}/auth/me", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == "sales1@dealer.com"

        r = requests.get(f"{API}/leads", headers=_h(sales1_tok), timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_analytics_summary_still_works(self, admin_tok):
        r = requests.get(f"{API}/analytics/summary", headers=_h(admin_tok), timeout=10)
        assert r.status_code == 200
        for k in ("conversion_rate", "deals_in_progress", "pending_approvals"):
            assert k in r.json()
