"""
Iteration 22 backend tests:
- Followups POST/GET still accept and return type='Call' and type='WhatsApp'
- /constants followup_types list is intact
- WA messages GET (existing) and POST (new manual send) work end-to-end
- Verify a WhatsApp-typed followup is persisted in DB (frontend filters it out
  of Call History, but backend stores it just like any other followup)

Iter22 is a frontend-only restructure (WA tab removed, Follow-ups tab now
holds Call History + WhatsApp side-by-side). The backend should be
completely untouched — these tests guard against regression.
"""
import os
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


def _phone():
    return f"9{uuid.uuid4().int % 10**9:09d}"


def _create_test_lead(sess, label):
    """Create a fresh lead with TEST_Iter22 prefix for clean teardown."""
    branches = sess.get(f"{API}/branches", timeout=30).json()
    branch_id = branches[0]["id"] if branches else None
    payload = {
        "customer_name": f"TEST_Iter22 {label} {uuid.uuid4().hex[:6]}",
        "phone": _phone(),
        "source": "Walk-in",
        "priority": "Warm",
        "branch_id": branch_id,
    }
    r = sess.post(f"{API}/leads", json=payload, timeout=30)
    assert r.status_code == 200, f"create lead failed: {r.status_code} {r.text}"
    return r.json()


# ---------------------------------------------------------------------------
# 1. /constants — followup_types intact (Call, WhatsApp, Visit, Test Ride, Other)
# ---------------------------------------------------------------------------
class TestConstantsFollowupTypes:
    def test_followup_types_contains_expected(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200, r.text
        ftypes = r.json().get("followup_types") or []
        for t in ["Call", "WhatsApp", "Visit", "Test Ride", "Other"]:
            assert t in ftypes, f"followup_type '{t}' missing from /constants: {ftypes}"


# ---------------------------------------------------------------------------
# 2. Followups POST/GET — Call type
# ---------------------------------------------------------------------------
class TestFollowupCall:
    def test_post_call_followup_persists_and_returns(self, super_session):
        lead = _create_test_lead(super_session, "Call")
        lid = lead["id"]
        body = {
            "type": "Call",
            "notes": "Iter22 call follow-up note",
            "scheduled_date": "2026-02-15",
            "scheduled_time": "10:30",
            "call_status": "Connected",
            "customer_response": "Interested",
        }
        r = super_session.post(f"{API}/leads/{lid}/followups", json=body, timeout=30)
        assert r.status_code == 200, f"POST followup Call failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["type"] == "Call"
        assert data["notes"] == body["notes"]
        assert data["call_status"] == "Connected"
        assert "id" in data and data["lead_id"] == lid

        # GET — list returns the followup
        g = super_session.get(f"{API}/leads/{lid}/followups", timeout=30)
        assert g.status_code == 200, g.text
        items = g.json()
        assert isinstance(items, list)
        assert any(f["id"] == data["id"] and f["type"] == "Call" for f in items), \
            f"Call followup {data['id']} missing from GET list"


# ---------------------------------------------------------------------------
# 3. Followups POST/GET — WhatsApp type (must persist; frontend filters from Call History)
# ---------------------------------------------------------------------------
class TestFollowupWhatsApp:
    def test_post_whatsapp_followup_persists_and_returns(self, super_session):
        # Use a SEPARATE lead so we don't trip the 60s rate-limit gap from prior test
        lead = _create_test_lead(super_session, "WAType")
        lid = lead["id"]
        body = {
            "type": "WhatsApp",
            "notes": "Iter22 whatsapp typed follow-up — should still save",
            "scheduled_date": "2026-02-16",
        }
        r = super_session.post(f"{API}/leads/{lid}/followups", json=body, timeout=30)
        assert r.status_code == 200, f"POST WhatsApp followup failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["type"] == "WhatsApp"

        # GET shows it (so backend stores; frontend filter removes from Call History panel)
        g = super_session.get(f"{API}/leads/{lid}/followups", timeout=30)
        assert g.status_code == 200, g.text
        items = g.json()
        assert any(f["id"] == data["id"] and f["type"] == "WhatsApp" for f in items), \
            "WhatsApp followup should be present in GET list"


# ---------------------------------------------------------------------------
# 4. WA messages GET (empty) and POST (manual send) — endpoints intact
# ---------------------------------------------------------------------------
class TestWaMessagesEndpoints:
    def test_wa_messages_get_initial_empty_then_post_then_get_present(self, super_session):
        lead = _create_test_lead(super_session, "WAMsg")
        lid = lead["id"]

        # GET initial — list (may be empty)
        g0 = super_session.get(f"{API}/leads/{lid}/wa-messages", timeout=30)
        assert g0.status_code == 200, g0.text
        initial = g0.json()
        assert isinstance(initial, list)

        # POST — manual text send
        body = {
            "content": "Iter22 hello from automated test",
            "message_type": "text",
        }
        p = super_session.post(f"{API}/leads/{lid}/wa-messages", json=body, timeout=30)
        # If WhatsApp is gated (e.g. opted out / template required) the API may return
        # 400/403; explicitly assert success since seed lead has no opt-out.
        assert p.status_code == 200, f"POST wa-message failed: {p.status_code} {p.text}"
        msg = p.json()
        assert msg.get("lead_id") == lid
        assert msg.get("direction") == "outbound"
        assert msg.get("content") == body["content"]
        msg_id = msg.get("id")
        assert msg_id

        # GET — message now visible
        g1 = super_session.get(f"{API}/leads/{lid}/wa-messages", timeout=30)
        assert g1.status_code == 200
        items = g1.json()
        assert any(m["id"] == msg_id for m in items), "Sent WA message missing from GET"


# ---------------------------------------------------------------------------
# 5. Cleanup — direct mongo delete of TEST_Iter22 leads + their followups + wa_messages
# ---------------------------------------------------------------------------
class TestZCleanup:
    def test_cleanup_iter22(self):
        try:
            from pymongo import MongoClient
            mongo_url = os.environ["MONGO_URL"]
            db_name = os.environ["DB_NAME"]
            client = MongoClient(mongo_url)
            db = client[db_name]
            leads_to_delete = list(db.leads.find({"customer_name": {"$regex": "^TEST_Iter22"}}, {"id": 1}))
            lead_ids = [l["id"] for l in leads_to_delete]
            if lead_ids:
                fu = db.followups.delete_many({"lead_id": {"$in": lead_ids}})
                wa = db.wa_messages.delete_many({"lead_id": {"$in": lead_ids}})
                tl = db.lead_timeline.delete_many({"lead_id": {"$in": lead_ids}})
                ld = db.leads.delete_many({"id": {"$in": lead_ids}})
                print(f"cleanup: leads={ld.deleted_count} followups={fu.deleted_count} "
                      f"wa_messages={wa.deleted_count} timeline={tl.deleted_count}")
            client.close()
        except Exception as e:
            print(f"mongo cleanup failed: {e}")
        assert True
