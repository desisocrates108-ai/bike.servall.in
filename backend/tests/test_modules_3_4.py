"""
Backend tests for Modules 3 (Follow-up & Call Tracking) and 4 (Deal & Negotiation).
Covers new /tasks, /analytics/performance, /analytics/deals, deal approval,
negotiation history, stricter stage validation, at_risk computation, and new constants.
"""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://leads-date-tracking.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Direct mongo for seeding missed follow-ups
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "twowheeler_crm")
_mclient = MongoClient(MONGO_URL)
mdb = _mclient[DB_NAME]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _headers(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Fixtures ----------

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
def sales2_tok():
    return _login("sales2@dealer.com", "sales123")


@pytest.fixture(scope="session")
def bilimora_branch_id(super_tok):
    r = requests.get(f"{API}/branches", headers=_headers(super_tok), timeout=10)
    assert r.status_code == 200
    for b in r.json():
        if b["name"] == "Bilimora":
            return b["id"]
    pytest.fail("Bilimora branch not found")


def _create_lead(tok, branch_id, name_suffix=""):
    payload = {
        "customer_name": f"TEST_{name_suffix}_{uuid.uuid4().hex[:6]}",
        "phone": f"90000{uuid.uuid4().int % 100000:05d}",
        "source": "Walk-in",
        "branch_id": branch_id,
        "priority": "Warm",
    }
    r = requests.post(f"{API}/leads", headers=_headers(tok), json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- /constants ----------

class TestConstants:
    def test_constants_new_keys(self, sales1_tok):
        r = requests.get(f"{API}/constants", headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        for key in ["call_statuses", "customer_responses", "outcome_tags",
                    "deal_loss_reasons", "deal_statuses", "config"]:
            assert key in data, f"missing key {key}"
        assert data["config"]["discount_approval_threshold"] == 5000
        assert data["config"]["followup_min_gap_seconds"] == 60
        assert "Connected" in data["call_statuses"]
        assert "Not Connected" in data["call_statuses"]


# ---------- Followup validations ----------

class TestFollowups:
    def test_followup_requires_notes_and_scheduled_date(self, sales1_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "fu_req")
        # Missing notes -> Pydantic 422
        r = requests.post(f"{API}/leads/{lead['id']}/followups",
                          headers=_headers(sales1_tok),
                          json={"type": "Call", "scheduled_date": "2026-12-31"}, timeout=10)
        assert r.status_code == 422
        # Missing scheduled_date -> 400
        r = requests.post(f"{API}/leads/{lead['id']}/followups",
                          headers=_headers(sales1_tok),
                          json={"type": "Call", "notes": "hi"}, timeout=10)
        assert r.status_code == 400

    def test_followup_saves_new_fields_and_updates_priority(self, sales1_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "fu_fields")
        body = {
            "type": "Call", "notes": "spoke briefly",
            "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d"),
            "call_status": "Connected",
            "customer_response": "Interested",
            "outcome_tag": "Progressed",
            "lead_temperature": "Hot",
            "call_duration": 120,
        }
        r = requests.post(f"{API}/leads/{lead['id']}/followups",
                          headers=_headers(sales1_tok), json=body, timeout=10)
        assert r.status_code == 200, r.text
        fu = r.json()
        assert fu["call_status"] == "Connected"
        assert fu["customer_response"] == "Interested"
        assert fu["outcome_tag"] == "Progressed"
        assert fu["call_duration"] == 120
        assert fu["done_at"] is not None
        assert fu["scheduled_at"] is not None
        # Verify lead.priority updated
        rl = requests.get(f"{API}/leads/{lead['id']}", headers=_headers(sales1_tok), timeout=10)
        assert rl.status_code == 200
        assert rl.json()["priority"] == "Hot"

    def test_followup_rapid_duplicate_returns_429(self, sales1_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "fu_dup")
        body = {"type": "Call", "notes": "first",
                "scheduled_date": "2026-12-31", "call_status": "Connected"}
        r1 = requests.post(f"{API}/leads/{lead['id']}/followups",
                           headers=_headers(sales1_tok), json=body, timeout=10)
        assert r1.status_code == 200
        # immediate 2nd
        body["notes"] = "second"
        r2 = requests.post(f"{API}/leads/{lead['id']}/followups",
                           headers=_headers(sales1_tok), json=body, timeout=10)
        assert r2.status_code == 429, r2.text


# ---------- Tasks ----------

class TestTasks:
    def test_tasks_today_and_upcoming(self, sales1_tok, bilimora_branch_id):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # create a lead with next_followup_date = today via direct update
        lead = _create_lead(sales1_tok, bilimora_branch_id, "task_today")
        mdb.leads.update_one({"id": lead["id"]}, {"$set": {"next_followup_date": today}})

        r = requests.get(f"{API}/tasks?kind=today", headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200
        ids = [l["id"] for l in r.json()]
        assert lead["id"] in ids

        r = requests.get(f"{API}/tasks?kind=upcoming", headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200  # just ensure endpoint works

    def test_tasks_missed_and_at_risk(self, sales1_tok, bilimora_branch_id):
        """Seed 2 missed followups then add a new followup to trigger at_risk recompute."""
        lead = _create_lead(sales1_tok, bilimora_branch_id, "atrisk")
        lid = lead["id"]
        past = (datetime.now(timezone.utc) - timedelta(days=3)).strftime("%Y-%m-%d")
        # assigned_to = sales1 from creation
        for i in range(2):
            mdb.followups.insert_one({
                "id": str(uuid.uuid4()),
                "lead_id": lid,
                "branch_id": lead.get("branch_id"),
                "assigned_to": lead.get("assigned_to"),
                "type": "Call", "notes": f"missed-{i}",
                "scheduled_date": past,
                "done": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        # also set lead's next_followup_date in past so it shows in missed list
        mdb.leads.update_one({"id": lid}, {"$set": {"next_followup_date": past}})

        # wait >60s? No — use a fresh lead so gap control doesn't bite
        # The new followup POST will recompute at_risk. But min-gap is per-lead since
        # we query last by lead_id. None in followups collection were inserted via API
        # but still present. Gap check uses last by created_at of this lead — we just
        # inserted two. Their created_at is "now", so we may hit 429. Use time.sleep.
        time.sleep(62)
        body = {"type": "Call", "notes": "recompute",
                "scheduled_date": (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d"),
                "call_status": "Connected"}
        r = requests.post(f"{API}/leads/{lid}/followups",
                          headers=_headers(sales1_tok), json=body, timeout=15)
        assert r.status_code == 200, r.text

        # Verify at_risk flag via /tasks?kind=at_risk
        r = requests.get(f"{API}/tasks?kind=at_risk", headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200
        ids = [l["id"] for l in r.json()]
        assert lid in ids, "lead not flagged at_risk despite 2 missed followups"

        # Missed tasks list
        r = requests.get(f"{API}/tasks?kind=missed", headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200


# ---------- Stage validation ----------

class TestStageValidation:
    def test_deal_requires_connected_followup(self, sales1_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "stage_deal")
        # Set deal prices
        r = requests.put(f"{API}/leads/{lead['id']}",
                         headers=_headers(sales1_tok),
                         json={"deal": {"customer_expected_price": 70000, "offered_price": 72000}},
                         timeout=10)
        assert r.status_code == 200
        # No connected followups yet -> should 400
        r = requests.post(f"{API}/leads/{lead['id']}/stage",
                          headers=_headers(sales1_tok), json={"stage": "Deal"}, timeout=10)
        assert r.status_code == 400
        assert "Connected" in r.text

        # Add a connected followup
        body = {"type": "Call", "notes": "connected",
                "scheduled_date": "2026-12-31", "call_status": "Connected"}
        r = requests.post(f"{API}/leads/{lead['id']}/followups",
                          headers=_headers(sales1_tok), json=body, timeout=10)
        assert r.status_code == 200
        # Now Deal should succeed
        r = requests.post(f"{API}/leads/{lead['id']}/stage",
                          headers=_headers(sales1_tok), json={"stage": "Deal"}, timeout=10)
        assert r.status_code == 200, r.text

    def test_booking_requires_final_price_and_approval(self, admin_tok, sales1_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "stage_book")
        lid = lead["id"]
        # set basic deal and connected followup, then move to Deal
        requests.put(f"{API}/leads/{lid}", headers=_headers(sales1_tok),
                     json={"deal": {"customer_expected_price": 70000, "offered_price": 72000},
                           "payment_mode": "Cash"}, timeout=10)
        body = {"type": "Call", "notes": "c",
                "scheduled_date": "2026-12-31", "call_status": "Connected"}
        requests.post(f"{API}/leads/{lid}/followups", headers=_headers(sales1_tok),
                      json=body, timeout=10)
        r = requests.post(f"{API}/leads/{lid}/stage", headers=_headers(sales1_tok),
                          json={"stage": "Deal"}, timeout=10)
        assert r.status_code == 200

        # Booking without final_deal_price -> 400
        r = requests.post(f"{API}/leads/{lid}/stage", headers=_headers(sales1_tok),
                          json={"stage": "Booking"}, timeout=10)
        assert r.status_code == 400
        assert "Final Deal Price" in r.text or "final" in r.text.lower()

        # Set final_deal_price with large discount -> triggers approval required
        r = requests.put(f"{API}/leads/{lid}", headers=_headers(sales1_tok),
                         json={"deal": {"customer_expected_price": 70000, "offered_price": 72000,
                                        "final_deal_price": 67000, "discount": 6000,
                                        "ex_showroom_price": 73000}}, timeout=10)
        assert r.status_code == 200
        deal = r.json().get("deal", {})
        assert deal.get("approval_required") is True
        assert deal.get("approval_status") == "Pending"
        assert deal.get("deal_status") == "Approval Pending"

        # Booking blocked by pending approval
        r = requests.post(f"{API}/leads/{lid}/stage", headers=_headers(sales1_tok),
                          json={"stage": "Booking"}, timeout=10)
        assert r.status_code == 400
        assert "approval" in r.text.lower()

        # Admin approves
        r = requests.post(f"{API}/leads/{lid}/deal/approve",
                          headers=_headers(admin_tok),
                          json={"approve": True, "remarks": "ok"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["deal"]["approval_status"] == "Approved"
        assert r.json()["deal"]["deal_status"] == "Approved"

        # Booking now succeeds
        r = requests.post(f"{API}/leads/{lid}/stage", headers=_headers(sales1_tok),
                          json={"stage": "Booking"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "Booking"


# ---------- Approval & negotiations ----------

class TestApprovalAndNegotiations:
    def test_request_approval_and_rbac(self, sales1_tok, admin_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "approval")
        lid = lead["id"]
        # set deal
        requests.put(f"{API}/leads/{lid}", headers=_headers(sales1_tok),
                     json={"deal": {"customer_expected_price": 60000, "offered_price": 65000,
                                    "discount": 3000, "final_deal_price": 62000}},
                     timeout=10)
        r = requests.post(f"{API}/leads/{lid}/deal/request-approval",
                          headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200
        assert r.json()["deal"]["approval_status"] == "Pending"

        # Sales exec cannot approve
        r = requests.post(f"{API}/leads/{lid}/deal/approve",
                          headers=_headers(sales1_tok),
                          json={"approve": True}, timeout=10)
        assert r.status_code == 403

        # Admin can reject
        r = requests.post(f"{API}/leads/{lid}/deal/approve",
                          headers=_headers(admin_tok),
                          json={"approve": False, "remarks": "too low"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["deal"]["approval_status"] == "Rejected"
        assert r.json()["deal"]["deal_status"] == "Rejected"

    def test_negotiation_history_logged(self, sales1_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "nego")
        lid = lead["id"]
        # first change
        requests.put(f"{API}/leads/{lid}", headers=_headers(sales1_tok),
                     json={"deal": {"customer_expected_price": 70000, "offered_price": 72000}},
                     timeout=10)
        # second change
        requests.put(f"{API}/leads/{lid}", headers=_headers(sales1_tok),
                     json={"deal": {"customer_expected_price": 70000, "offered_price": 71000,
                                    "discount": 1000}}, timeout=10)
        r = requests.get(f"{API}/leads/{lid}/negotiations",
                         headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        assert "changes" in items[0]


# ---------- Analytics ----------

class TestAnalytics:
    def test_summary_new_keys(self, admin_tok):
        r = requests.get(f"{API}/analytics/summary", headers=_headers(admin_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        for key in ["followups_missed", "followups_upcoming", "at_risk",
                    "conversion_rate", "deals_in_progress", "avg_discount", "pending_approvals"]:
            assert key in data, f"missing {key}"

    def test_performance_admin_only(self, sales1_tok, admin_tok):
        r = requests.get(f"{API}/analytics/performance", headers=_headers(sales1_tok), timeout=10)
        assert r.status_code == 403
        r = requests.get(f"{API}/analytics/performance", headers=_headers(admin_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for key in ["total_leads", "converted", "lost", "missed_followups",
                        "at_risk", "followups_logged", "connect_rate", "conversion_rate"]:
                assert key in row, f"missing {key} in performance row"

    def test_deals_analytics(self, admin_tok):
        r = requests.get(f"{API}/analytics/deals", headers=_headers(admin_tok), timeout=10)
        assert r.status_code == 200
        data = r.json()
        for key in ["in_progress", "booked", "deal_to_booking_rate", "loss_reasons", "branches"]:
            assert key in data


# ---------- RBAC on negotiations ----------

class TestNegotiationRBAC:
    def test_other_sales_blocked(self, sales1_tok, sales2_tok, bilimora_branch_id):
        lead = _create_lead(sales1_tok, bilimora_branch_id, "nego_rbac")
        lid = lead["id"]
        requests.put(f"{API}/leads/{lid}", headers=_headers(sales1_tok),
                     json={"deal": {"offered_price": 50000}}, timeout=10)
        # sales2 should not access
        r = requests.get(f"{API}/leads/{lid}/negotiations",
                         headers=_headers(sales2_tok), timeout=10)
        assert r.status_code == 403
