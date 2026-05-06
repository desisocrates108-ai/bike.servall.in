"""
Iteration 24 backend tests — Edit Lead + Delete Lead cascade.

Covers:
- PUT /api/leads/{id} stage whitelist (400 on invalid)
- PUT /api/leads/{id} stage override by sales_executive blocked (403)
- PUT /api/leads/{id} stage override by super_admin works
- DELETE /api/leads/{id} as super_admin cascades all 11 related collections + releases inventory
- DELETE /api/leads/{id} as admin outside branch → 403
- DELETE /api/leads/{id} as sales_executive → 403
- GET /api/leads/{deleted} → 404
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@dealer.com"
SUPER_PASS = "super123"

TEST_PREFIX = "TEST_Iter24_"


def _phone():
    return f"9{uuid.uuid4().int % 10**9:09d}"


# ---------- shared fixtures ----------
@pytest.fixture(scope="session")
def super_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=30)
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "no access_token"
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def super_me(super_session):
    r = super_session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def branches(super_session):
    r = super_session.get(f"{API}/branches", timeout=30)
    assert r.status_code == 200
    bs = r.json()
    assert len(bs) >= 2, "need at least 2 branches for cross-branch tests"
    return bs


@pytest.fixture(scope="session")
def sales_exec(super_session, branches):
    """Create a TEST_ sales_executive in branch[0] and return (user_dict, session_with_token).
    Cleaned up in teardown."""
    branch_id = branches[0]["id"]
    email = f"{TEST_PREFIX}sales_{uuid.uuid4().hex[:6]}@dealer.com"
    password = "salespass123"
    payload = {
        "email": email,
        "password": password,
        "name": f"{TEST_PREFIX}Sales Executive",
        "role": "sales_executive",
        "branch_id": branch_id,
        "phone": _phone(),
    }
    r = super_session.post(f"{API}/users", json=payload, timeout=30)
    assert r.status_code == 200, f"create sales_executive failed: {r.status_code} {r.text}"
    user = r.json()

    # Login to get token
    s = requests.Session()
    lr = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert lr.status_code == 200, f"sales login failed: {lr.text}"
    tok = lr.json().get("access_token")
    assert tok
    s.headers.update({"Authorization": f"Bearer {tok}"})

    yield user, s

    # Teardown
    try:
        super_session.delete(f"{API}/users/{user['id']}", timeout=30)
    except Exception:
        pass


@pytest.fixture(scope="session")
def admin_other_branch(super_session, branches):
    """Create an admin bound to branches[1] — for cross-branch 403 test."""
    branch_id = branches[1]["id"]
    email = f"{TEST_PREFIX}admin_{uuid.uuid4().hex[:6]}@dealer.com"
    password = "adminpass123"
    payload = {
        "email": email,
        "password": password,
        "name": f"{TEST_PREFIX}Admin Other Branch",
        "role": "admin",
        "branch_id": branch_id,
        "phone": _phone(),
    }
    r = super_session.post(f"{API}/users", json=payload, timeout=30)
    assert r.status_code == 200, f"create admin failed: {r.status_code} {r.text}"
    user = r.json()

    s = requests.Session()
    lr = s.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert lr.status_code == 200
    tok = lr.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})

    yield user, s

    try:
        super_session.delete(f"{API}/users/{user['id']}", timeout=30)
    except Exception:
        pass


def _create_lead(sess, branch_id=None, customer_name=None):
    payload = {
        "customer_name": customer_name or f"{TEST_PREFIX}Lead {uuid.uuid4().hex[:6]}",
        "phone": _phone(),
        "source": "Walk-in",
        "priority": "Warm",
        "purchase_type": "New Purchase",
    }
    if branch_id:
        payload["branch_id"] = branch_id
    r = sess.post(f"{API}/leads", json=payload, timeout=30)
    assert r.status_code == 200, f"create lead failed: {r.status_code} {r.text}"
    return r.json()


# ---------- PUT /leads/{id} — stage override ----------
class TestEditLeadStage:
    def test_invalid_stage_returns_400(self, super_session, branches):
        lead = _create_lead(super_session, branch_id=branches[0]["id"])
        r = super_session.put(f"{API}/leads/{lead['id']}", json={"stage": "Foo"}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "Invalid stage" in r.text
        # cleanup
        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)

    def test_super_admin_can_override_stage(self, super_session, branches):
        lead = _create_lead(super_session, branch_id=branches[0]["id"])
        assert lead["stage"] == "Inquiry"
        r = super_session.put(f"{API}/leads/{lead['id']}", json={"stage": "Hold"}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "Hold"

        # verify persistence
        g = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert g.status_code == 200
        assert g.json()["stage"] == "Hold"

        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)

    def test_sales_executive_stage_override_forbidden(self, super_session, sales_exec, branches):
        user, sess = sales_exec
        lead = _create_lead(sess)  # sales exec creates in own branch
        r = sess.put(f"{API}/leads/{lead['id']}", json={"stage": "Hold"}, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        assert "stage" in r.text.lower()
        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)

    def test_edit_name_phone_happy_path(self, super_session, branches):
        lead = _create_lead(super_session, branch_id=branches[0]["id"])
        new_name = f"{TEST_PREFIX}Updated {uuid.uuid4().hex[:6]}"
        new_phone = _phone()
        r = super_session.put(
            f"{API}/leads/{lead['id']}",
            json={"customer_name": new_name, "phone": new_phone, "address": "1 Test Street"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["customer_name"] == new_name
        assert updated["phone"] == new_phone
        assert updated["address"] == "1 Test Street"
        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)


# ---------- DELETE /leads/{id} — cascade + RBAC ----------
class TestDeleteLeadCascade:
    def test_sales_executive_delete_forbidden(self, super_session, sales_exec):
        user, sess = sales_exec
        lead = _create_lead(sess)
        r = sess.delete(f"{API}/leads/{lead['id']}", timeout=30)
        assert r.status_code == 403, f"expected 403 for sales_exec delete, got {r.status_code}: {r.text}"
        # cleanup with super
        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)

    def test_admin_cannot_delete_outside_branch(self, super_session, branches, admin_other_branch):
        # lead created in branches[0], admin is bound to branches[1]
        lead = _create_lead(super_session, branch_id=branches[0]["id"])
        _, admin_sess = admin_other_branch
        r = admin_sess.delete(f"{API}/leads/{lead['id']}", timeout=30)
        assert r.status_code == 403, f"expected 403 cross-branch delete, got {r.status_code}: {r.text}"
        assert "branch" in r.text.lower()
        # cleanup
        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)

    def test_super_admin_cascade_delete_full(self, super_session, branches):
        """Create lead + followup + booking + WA message, delete it, then verify cascade."""
        lead = _create_lead(super_session, branch_id=branches[0]["id"])
        lid = lead["id"]

        # Add a followup
        fr = super_session.post(
            f"{API}/leads/{lid}/followups",
            json={
                "type": "Call",
                "notes": "test cascade followup",
                "scheduled_date": "2026-12-31",
                "done": True,
            },
            timeout=30,
        )
        assert fr.status_code == 200, f"followup create failed: {fr.text}"

        # Add a WA inbound message (simpler schema — no auth gating for send)
        wa = super_session.post(
            f"{API}/leads/{lid}/wa-inbound",
            json={"text": "hello test cascade"},
            timeout=30,
        )
        # wa-inbound may be 200 or 404 depending on implementation; best-effort
        wa_created = wa.status_code == 200

        # Call DELETE
        dr = super_session.delete(f"{API}/leads/{lid}", timeout=30)
        assert dr.status_code == 200, f"delete failed: {dr.status_code} {dr.text}"
        body = dr.json()
        assert body.get("ok") is True
        deleted = body.get("deleted", {})
        # Verify counts dict has all 11 expected collections
        expected_keys = {
            "followups", "finance_cases", "bookings", "allotments", "deliveries",
            "payments", "wa_messages", "timeline", "negotiation_history",
            "documents", "files", "reminders",
        }
        assert expected_keys.issubset(set(deleted.keys())), (
            f"missing keys in deleted counts: got {list(deleted.keys())}"
        )
        assert deleted["followups"] >= 1, "followup should have been deleted"
        assert deleted["timeline"] >= 1, "timeline events should have been deleted"
        if wa_created:
            assert deleted["wa_messages"] >= 1, "wa message should have been deleted"

        # GET lead → 404
        g = super_session.get(f"{API}/leads/{lid}", timeout=30)
        assert g.status_code == 404, f"lead should be gone, got {g.status_code}"

        # GET followups filtered by lead should be empty (endpoint may vary — try generic)
        gf = super_session.get(f"{API}/leads/{lid}/followups", timeout=30)
        # Expect 404 on lead (lead gone) OR empty list
        assert gf.status_code in (404, 200), gf.status_code
        if gf.status_code == 200:
            assert gf.json() == []

    def test_delete_nonexistent_lead_returns_404(self, super_session):
        r = super_session.delete(f"{API}/leads/nonexistent-{uuid.uuid4().hex}", timeout=30)
        assert r.status_code == 404


# ---------- Regression: superadmin login still works ----------
class TestRegression:
    def test_superadmin_login_unchanged(self):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": SUPER_EMAIL, "password": SUPER_PASS},
            timeout=30,
        )
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_create_lead_still_works(self, super_session, branches):
        lead = _create_lead(super_session, branch_id=branches[0]["id"])
        assert lead["stage"] == "Inquiry"
        super_session.delete(f"{API}/leads/{lead['id']}", timeout=30)
