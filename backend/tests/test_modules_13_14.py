"""
Modules 13 (Advanced User & Role Mgmt) and 14 (Advanced Branch/POS Mgmt)
Backend pytest suite for the Two-Wheeler Dealership CRM.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://servall-mobile.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "superadmin@dealer.com", "password": "super123"}
ADMIN = {"email": "admin@dealer.com", "password": "admin123"}
SALES1 = {"email": "sales1@dealer.com", "password": "sales123"}  # Bilimora
SALES4 = {"email": "sales4@dealer.com", "password": "sales123"}  # Gandevi

PREFIX = "TEST_M1314_"


def _login(cred):
    r = requests.post(f"{API}/auth/login", json=cred, timeout=20)
    assert r.status_code == 200, f"login failed {cred['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- fixtures ----------------

@pytest.fixture(scope="session")
def super_tok():
    return _login(SUPER)


@pytest.fixture(scope="session")
def admin_tok():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def sales1_tok():
    return _login(SALES1)


@pytest.fixture(scope="session")
def branches(super_tok):
    r = requests.get(f"{API}/branches", headers=_hdr(super_tok), timeout=20)
    assert r.status_code == 200, r.text
    items = r.json()
    # Map by name
    return {b["name"]: b for b in items}


@pytest.fixture(scope="session")
def admin_user(super_tok):
    r = requests.get(f"{API}/users", headers=_hdr(super_tok), params={"role": "admin"}, timeout=20)
    assert r.status_code == 200
    admins = r.json()
    assert admins, "expected seeded admin user"
    return admins[0]


@pytest.fixture(scope="session")
def sales_user(super_tok):
    r = requests.get(f"{API}/users", headers=_hdr(super_tok), params={"role": "sales_executive"}, timeout=20)
    assert r.status_code == 200
    sales = r.json()
    assert sales, "expected seeded sales users"
    return sales[0]


# ---------------- Module 13: Users ----------------

class TestUsersExtendedFields:
    def test_list_users_filters(self, super_tok):
        # role filter
        r = requests.get(f"{API}/users", headers=_hdr(super_tok), params={"role": "sales_executive"}, timeout=20)
        assert r.status_code == 200
        assert all(u["role"] == "sales_executive" for u in r.json())

        # status filter active
        r2 = requests.get(f"{API}/users", headers=_hdr(super_tok), params={"status": "active"}, timeout=20)
        assert r2.status_code == 200
        assert all(u.get("is_active") is True for u in r2.json())

        # search filter
        r3 = requests.get(f"{API}/users", headers=_hdr(super_tok), params={"q": "admin"}, timeout=20)
        assert r3.status_code == 200
        assert len(r3.json()) >= 1

    def test_create_user_duplicate_phone_400(self, super_tok, admin_user, branches):
        bid = branches["Bilimora"]["id"]
        phone = f"9{int(time.time())%100000000:08d}"
        payload1 = {
            "email": f"{PREFIX}u1_{uuid.uuid4().hex[:6]}@t.com",
            "password": "pass1234",
            "name": f"{PREFIX}User1",
            "phone": phone,
            "role": "sales_executive",
            "branch_id": bid,
            "reporting_manager_id": admin_user["id"],
            "joining_date": "2025-03-01",
        }
        r = requests.post(f"{API}/users", headers=_hdr(super_tok), json=payload1, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["phone"] == phone
        assert d["reporting_manager_id"] == admin_user["id"]
        assert d["joining_date"] == "2025-03-01"
        assert d["is_active"] is True

        # dup phone
        payload2 = dict(payload1)
        payload2["email"] = f"{PREFIX}u2_{uuid.uuid4().hex[:6]}@t.com"
        r2 = requests.post(f"{API}/users", headers=_hdr(super_tok), json=payload2, timeout=20)
        assert r2.status_code == 400, r2.text

    def test_create_user_reporting_manager_must_be_admin(self, super_tok, sales_user, branches):
        bid = branches["Bilimora"]["id"]
        payload = {
            "email": f"{PREFIX}badmgr_{uuid.uuid4().hex[:6]}@t.com",
            "password": "pass1234",
            "name": f"{PREFIX}BadMgr",
            "phone": f"8{int(time.time()*1000)%100000000:08d}",
            "role": "sales_executive",
            "branch_id": bid,
            "reporting_manager_id": sales_user["id"],
        }
        r = requests.post(f"{API}/users", headers=_hdr(super_tok), json=payload, timeout=20)
        assert r.status_code == 400, r.text

    def test_update_toggle_active_and_phone_uniqueness(self, super_tok, admin_user, branches):
        bid = branches["Bilimora"]["id"]
        # Create 2 users
        phone_a = f"7{int(time.time()*1000)%100000000:08d}"
        pa = {
            "email": f"{PREFIX}a_{uuid.uuid4().hex[:6]}@t.com", "password": "pass1234",
            "name": f"{PREFIX}A", "phone": phone_a, "role": "sales_executive",
            "branch_id": bid, "reporting_manager_id": admin_user["id"],
        }
        time.sleep(0.005)
        phone_b = f"7{(int(time.time()*1000)+5)%100000000:08d}"
        pb = dict(pa)
        pb["email"] = f"{PREFIX}b_{uuid.uuid4().hex[:6]}@t.com"
        pb["phone"] = phone_b
        ra = requests.post(f"{API}/users", headers=_hdr(super_tok), json=pa, timeout=20)
        rb = requests.post(f"{API}/users", headers=_hdr(super_tok), json=pb, timeout=20)
        assert ra.status_code == 200 and rb.status_code == 200, (ra.text, rb.text)
        uid_a = ra.json()["id"]
        uid_b = rb.json()["id"]

        # Toggle is_active=False
        r1 = requests.put(f"{API}/users/{uid_a}", headers=_hdr(super_tok), json={"is_active": False}, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json()["is_active"] is False

        # Update A's phone to B's phone -> 400
        r2 = requests.put(f"{API}/users/{uid_a}", headers=_hdr(super_tok), json={"phone": phone_b}, timeout=20)
        assert r2.status_code == 400, r2.text

        # Re-activate
        r3 = requests.put(f"{API}/users/{uid_a}", headers=_hdr(super_tok), json={"is_active": True}, timeout=20)
        assert r3.status_code == 200 and r3.json()["is_active"] is True

    def test_user_performance_counters(self, super_tok, admin_user):
        r = requests.get(f"{API}/users/{admin_user['id']}/performance", headers=_hdr(super_tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["leads_total", "leads_lost", "leads_delivered", "leads_pending",
                  "followups_total", "conversion_rate_pct"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["leads_total"], int)

    def test_user_performance_sales_executive_self_only(self, sales1_tok, super_tok, admin_user):
        me = requests.get(f"{API}/auth/me", headers=_hdr(sales1_tok), timeout=20).json()
        # self should work
        r1 = requests.get(f"{API}/users/{me['id']}/performance", headers=_hdr(sales1_tok), timeout=20)
        assert r1.status_code == 200
        # another user -> 403
        r2 = requests.get(f"{API}/users/{admin_user['id']}/performance", headers=_hdr(sales1_tok), timeout=20)
        assert r2.status_code == 403


# ---------------- Module 14: Branches ----------------

class TestBranchesCRUD:
    def test_branch_duplicate_code_400(self, super_tok, branches):
        existing_code = branches["Bilimora"].get("code") or "BLM"
        # try create with duplicate code
        r = requests.post(f"{API}/branches", headers=_hdr(super_tok),
                          json={"name": f"{PREFIX}Dup", "code": existing_code, "city": "X"}, timeout=20)
        assert r.status_code == 400, r.text

    def test_branch_assigned_admin_must_be_admin(self, super_tok, sales_user):
        r = requests.post(f"{API}/branches", headers=_hdr(super_tok), json={
            "name": f"{PREFIX}Br_{uuid.uuid4().hex[:4]}",
            "code": f"{PREFIX[:5]}{uuid.uuid4().hex[:4]}",
            "city": "Test",
            "assigned_admin_id": sales_user["id"],
        }, timeout=20)
        assert r.status_code == 400, r.text

    def test_branch_delete_blocked_when_linked(self, super_tok, branches):
        bid = branches["Bilimora"]["id"]
        r = requests.delete(f"{API}/branches/{bid}", headers=_hdr(super_tok), timeout=20)
        assert r.status_code == 400, r.text
        assert "linked" in r.text.lower() or "cannot delete" in r.text.lower()

    def test_branch_performance(self, super_tok, branches):
        bid = branches["Bilimora"]["id"]
        r = requests.get(f"{API}/branches/{bid}/performance", headers=_hdr(super_tok), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["leads_total", "leads_lost", "leads_delivered", "conversion_rate_pct", "active_users", "revenue"]:
            assert k in d, f"missing {k}"

    def test_branches_compare_super_only(self, super_tok, admin_tok):
        r = requests.get(f"{API}/branches-compare", headers=_hdr(super_tok), timeout=20)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1
        for row in arr:
            for k in ["leads_total", "leads_lost", "leads_delivered", "conversion_rate_pct", "revenue"]:
                assert k in row
        # admin -> 403
        r2 = requests.get(f"{API}/branches-compare", headers=_hdr(admin_tok), timeout=20)
        assert r2.status_code == 403


# ---------------- Inactive branch logic ----------------

class TestBranchInactiveLogic:
    def test_inactive_branch_blocks_login_and_allow_flag(self, super_tok, branches):
        bid = branches["Bilimora"]["id"]
        try:
            # Case 1: is_active=false, allow_login_when_inactive=false -> 403 for bilimora users
            r1 = requests.put(f"{API}/branches/{bid}", headers=_hdr(super_tok),
                              json={"is_active": False, "allow_login_when_inactive": False}, timeout=20)
            assert r1.status_code == 200, r1.text

            r_login = requests.post(f"{API}/auth/login", json=SALES1, timeout=20)
            assert r_login.status_code == 403, r_login.text
            assert "inactive" in r_login.text.lower()

            # Case 2: allow_login_when_inactive=True -> login succeeds
            r2 = requests.put(f"{API}/branches/{bid}", headers=_hdr(super_tok),
                              json={"allow_login_when_inactive": True}, timeout=20)
            assert r2.status_code == 200

            r_login2 = requests.post(f"{API}/auth/login", json=SALES1, timeout=20)
            assert r_login2.status_code == 200, r_login2.text

            # Case 3: new lead creation still blocked while is_active=false
            sales_tok = r_login2.json()["access_token"]
            # Fetch a valid variant/color to pass validation; use minimal payload
            lead_payload = {
                "customer_name": f"{PREFIX}LeadBlock",
                "phone": "9999999999",
                "branch_id": bid,
                "source": "Walk-in",
                "priority": "Warm",
                "purchase_type": "new",
            }
            r_lead = requests.post(f"{API}/leads", headers=_hdr(sales_tok), json=lead_payload, timeout=20)
            assert r_lead.status_code == 403, r_lead.text
            assert "inactive" in r_lead.text.lower()
        finally:
            # Restore
            requests.put(f"{API}/branches/{bid}", headers=_hdr(super_tok),
                         json={"is_active": True, "allow_login_when_inactive": True}, timeout=20)


# ---------------- Audit logs ----------------

class TestAuditLogs:
    def test_login_audit_write(self, super_tok):
        # Trigger a login_failed event
        bad = requests.post(f"{API}/auth/login", json={"email": "superadmin@dealer.com", "password": "WRONG"}, timeout=20)
        assert bad.status_code == 401
        # Trigger a successful login
        _ = _login(SUPER)
        time.sleep(0.3)
        r = requests.get(f"{API}/audit-logs", headers=_hdr(super_tok),
                         params={"action": "login", "limit": 5}, timeout=20)
        assert r.status_code == 200
        assert any(a["action"] == "login" for a in r.json())

        r2 = requests.get(f"{API}/audit-logs", headers=_hdr(super_tok),
                          params={"action": "login_failed", "limit": 5}, timeout=20)
        assert r2.status_code == 200
        assert any(a["action"] == "login_failed" for a in r2.json())

    def test_logout_audit_write(self, super_tok):
        tok = _login(SUPER)
        r = requests.post(f"{API}/auth/logout", headers=_hdr(tok), timeout=20)
        assert r.status_code == 200
        time.sleep(0.3)
        r2 = requests.get(f"{API}/audit-logs", headers=_hdr(super_tok),
                         params={"action": "logout", "limit": 5}, timeout=20)
        assert r2.status_code == 200
        assert any(a["action"] == "logout" for a in r2.json())

    def test_lead_and_followup_audit(self, super_tok, branches):
        bid = branches["Bilimora"]["id"]
        payload = {
            "customer_name": f"{PREFIX}LeadAudit_{uuid.uuid4().hex[:4]}",
            "phone": f"7{int(time.time()*1000)%100000000:08d}",
            "branch_id": bid,
            "source": "Walk-in",
            "priority": "Warm",
            "purchase_type": "new",
        }
        r = requests.post(f"{API}/leads", headers=_hdr(super_tok), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        lid = r.json()["id"]

        # update
        ru = requests.put(f"{API}/leads/{lid}", headers=_hdr(super_tok),
                          json={"priority": "Hot"}, timeout=20)
        assert ru.status_code == 200

        # followup
        rf = requests.post(f"{API}/leads/{lid}/followups", headers=_hdr(super_tok),
                           json={"type": "Call", "channel": "Call",
                                 "scheduled_date": "2026-02-01",
                                 "scheduled_time": "10:00",
                                 "notes": "test"}, timeout=20)
        assert rf.status_code == 200, rf.text

        # stage change -> Lost -> lead_lost
        rs = requests.post(f"{API}/leads/{lid}/stage", headers=_hdr(super_tok),
                           json={"stage": "Lost", "lost_reason": "Budget"}, timeout=20)
        assert rs.status_code == 200, rs.text

        time.sleep(0.5)
        r_audit = requests.get(f"{API}/audit-logs", headers=_hdr(super_tok),
                               params={"entity_id": lid, "limit": 50}, timeout=20)
        assert r_audit.status_code == 200
        actions = {a["action"] for a in r_audit.json()}
        assert "lead_created" in actions
        assert "lead_updated" in actions
        assert "lead_lost" in actions or "stage_changed" in actions

        # followup audit
        r_fa = requests.get(f"{API}/audit-logs", headers=_hdr(super_tok),
                            params={"action": "followup_created", "limit": 5}, timeout=20)
        assert r_fa.status_code == 200
        assert any(a["action"] == "followup_created" for a in r_fa.json())

    def test_admin_scoped_audit_logs(self, admin_tok):
        r = requests.get(f"{API}/audit-logs", headers=_hdr(admin_tok), params={"limit": 200}, timeout=20)
        assert r.status_code == 200
        # admin should see only own-branch entries (branch_id match), but some legacy rows may be null
        # Best-effort: ensure no other-branch entries are present if branch_id exists
        me = requests.get(f"{API}/auth/me", headers=_hdr(admin_tok), timeout=20).json()
        my_branch = me.get("branch_id")
        for row in r.json():
            bid = row.get("branch_id")
            if bid is not None:
                assert bid == my_branch, f"admin saw other branch: {bid}"

    def test_sales_executive_denied_audit(self, sales1_tok):
        r = requests.get(f"{API}/audit-logs", headers=_hdr(sales1_tok), timeout=20)
        assert r.status_code == 403

    def test_audit_filters(self, super_tok):
        r = requests.get(f"{API}/audit-logs", headers=_hdr(super_tok),
                         params={"action": "login", "limit": 3}, timeout=20)
        assert r.status_code == 200
        for row in r.json():
            assert row["action"] == "login"


# ---------------- Permissions catalog ----------------

class TestPermissionsCatalog:
    def test_permissions_modules(self, super_tok, admin_tok, sales1_tok):
        r = requests.get(f"{API}/permissions/modules", headers=_hdr(super_tok), timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "modules" in d and "actions" in d
        assert isinstance(d["modules"], list) and len(d["modules"]) > 0
        assert isinstance(d["actions"], list) and len(d["actions"]) > 0

        r2 = requests.get(f"{API}/permissions/modules", headers=_hdr(admin_tok), timeout=20)
        assert r2.status_code == 200

        r3 = requests.get(f"{API}/permissions/modules", headers=_hdr(sales1_tok), timeout=20)
        assert r3.status_code == 403
