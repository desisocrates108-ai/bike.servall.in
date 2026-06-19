"""Iteration 10 — RBAC hardening + branch-filtered analytics + reminder (next_followup_time) + search scoping.

Covers:
- POST/PUT /api/users → super_admin only (admin gets 403)
- DELETE /api/users/{id} → super_admin only (admin gets 403)
- GET /api/audit-logs → super_admin only (admin gets 403)
- GET /api/users → admin still 200 (needed for dropdowns)
- GET /api/analytics/summary?branch_id=X → super_admin filters; admin pinned to own branch
- GET /api/analytics/performance?branch_id=X → super_admin filters by branch
- PUT /api/leads/{id} accepts next_followup_date/time/type and persists all three
- GET /api/leads?search=... scopes admin to own branch, super_admin sees all
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://leads-date-tracking.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------------- fixtures ----------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token():
    return _login("superadmin@dealer.com", "super123")


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@dealer.com", "admin123")


@pytest.fixture(scope="module")
def sales_token():
    return _login("sales1@dealer.com", "sales123")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------------- Users RBAC ----------------
class TestUsersRBAC:
    def test_admin_can_still_list_users(self, admin_token):
        r = requests.get(f"{API}/users", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_admin_cannot_create_user(self, admin_token):
        payload = {
            "email": "TEST_admin_create@x.com",
            "password": "abc12345",
            "name": "Should Not Create",
            "role": "sales_executive",
        }
        r = requests.post(f"{API}/users", headers=_h(admin_token), json=payload, timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_admin_cannot_update_user(self, admin_token):
        # fetch any existing sales user from admin's branch
        users = requests.get(f"{API}/users", headers=_h(admin_token), timeout=15).json()
        target = next((u for u in users if u["role"] == "sales_executive"), users[0])
        r = requests.put(f"{API}/users/{target['id']}", headers=_h(admin_token),
                         json={"name": target["name"]}, timeout=15)
        assert r.status_code == 403

    def test_admin_cannot_delete_user(self, admin_token):
        users = requests.get(f"{API}/users", headers=_h(admin_token), timeout=15).json()
        target = next((u for u in users if u["role"] == "sales_executive"), users[0])
        r = requests.delete(f"{API}/users/{target['id']}", headers=_h(admin_token), timeout=15)
        assert r.status_code == 403

    def test_super_admin_can_create_and_delete_user(self, super_token):
        import uuid
        unique_email = f"TEST_iter10_{uuid.uuid4().hex[:8]}@dealer.com"
        unique_phone = f"9{uuid.uuid4().int % 10**9:09d}"
        payload = {
            "email": unique_email,
            "password": "test1234",
            "name": "TEST Iter10",
            "role": "sales_executive",
            "phone": unique_phone,
        }
        r = requests.post(f"{API}/users", headers=_h(super_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # verify persisted via list
        ul = requests.get(f"{API}/users", headers=_h(super_token), timeout=15).json()
        assert any(u["id"] == uid and u["email"].lower() == unique_email.lower() for u in ul)
        # cleanup
        d = requests.delete(f"{API}/users/{uid}", headers=_h(super_token), timeout=15)
        assert d.status_code in (200, 204)


# ---------------- Audit logs RBAC ----------------
class TestAuditLogsRBAC:
    def test_admin_cannot_access_audit_logs(self, admin_token):
        r = requests.get(f"{API}/audit-logs", headers=_h(admin_token), timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"

    def test_super_admin_can_access_audit_logs(self, super_token):
        r = requests.get(f"{API}/audit-logs", headers=_h(super_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Branch filter analytics ----------------
class TestBranchFilteredAnalytics:
    def test_summary_super_admin_branch_filter(self, super_token):
        branches = requests.get(f"{API}/branches", headers=_h(super_token), timeout=15).json()
        assert len(branches) >= 2
        all_s = requests.get(f"{API}/analytics/summary", headers=_h(super_token), timeout=15).json()
        b1 = branches[0]["id"]
        b2 = branches[1]["id"]
        s1 = requests.get(f"{API}/analytics/summary", headers=_h(super_token),
                          params={"branch_id": b1}, timeout=15).json()
        s2 = requests.get(f"{API}/analytics/summary", headers=_h(super_token),
                          params={"branch_id": b2}, timeout=15).json()
        assert s1["total_leads"] <= all_s["total_leads"]
        assert s2["total_leads"] <= all_s["total_leads"]
        # A branch-filtered total must match lead count in that branch
        leads_b1 = requests.get(f"{API}/leads", headers=_h(super_token),
                                params={"branch_id": b1}, timeout=15).json()
        count_b1 = len(leads_b1) if isinstance(leads_b1, list) else leads_b1.get("total", len(leads_b1.get("items", [])))
        assert s1["total_leads"] == count_b1, \
            f"summary.total_leads={s1['total_leads']} vs /leads count={count_b1}"

    def test_summary_admin_pinned_to_own_branch(self, admin_token, super_token):
        # admin supplies another branch_id — backend must ignore and keep own-branch
        branches = requests.get(f"{API}/branches", headers=_h(super_token), timeout=15).json()
        me = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15).json()
        other = next(b for b in branches if b["id"] != me["branch_id"])
        r_own = requests.get(f"{API}/analytics/summary", headers=_h(admin_token), timeout=15).json()
        r_other = requests.get(f"{API}/analytics/summary", headers=_h(admin_token),
                               params={"branch_id": other["id"]}, timeout=15).json()
        assert r_own["total_leads"] == r_other["total_leads"], "admin must not be able to view other branch"

    def test_performance_super_admin_branch_filter(self, super_token):
        branches = requests.get(f"{API}/branches", headers=_h(super_token), timeout=15).json()
        b = branches[0]["id"]
        r = requests.get(f"{API}/analytics/performance", headers=_h(super_token),
                        params={"branch_id": b}, timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        # every exec returned must belong to branch b
        users = requests.get(f"{API}/users", headers=_h(super_token), timeout=15).json()
        by_id = {u["id"]: u for u in users}
        for row in rows:
            uid = row.get("user_id") or row.get("id")
            if uid and uid in by_id:
                assert by_id[uid].get("branch_id") == b, f"user {uid} not in branch {b}"


# ---------------- Lead reminder (next_followup_time) ----------------
class TestLeadReminderPersistence:
    def test_put_lead_saves_next_followup_fields(self, super_token):
        # fetch any lead
        resp = requests.get(f"{API}/leads", headers=_h(super_token), timeout=15).json()
        items = resp if isinstance(resp, list) else resp.get("items", [])
        assert items, "no leads available for test"
        lid = items[0]["id"]
        body = {
            "next_followup_date": "2026-03-15",
            "next_followup_time": "14:30",
            "next_followup_type": "Call",
        }
        r = requests.put(f"{API}/leads/{lid}", headers=_h(super_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        g = requests.get(f"{API}/leads/{lid}", headers=_h(super_token), timeout=15).json()
        assert g["next_followup_date"] == "2026-03-15"
        assert g["next_followup_time"] == "14:30"
        assert g["next_followup_type"] == "Call"


# ---------------- Global search scoping ----------------
class TestGlobalSearchScoping:
    def test_admin_search_scoped_to_own_branch(self, admin_token, super_token):
        me = requests.get(f"{API}/auth/me", headers=_h(admin_token), timeout=15).json()
        # search a very common substring
        r = requests.get(f"{API}/leads", headers=_h(admin_token),
                         params={"search": "a"}, timeout=15).json()
        items = r if isinstance(r, list) else r.get("items", [])
        assert items, "admin search returned no items for 'a'"
        for it in items:
            assert it.get("branch_id") == me["branch_id"], \
                f"admin search leaked cross-branch lead {it.get('id')} branch={it.get('branch_id')}"

    def test_super_admin_search_unscoped(self, super_token):
        # Super_admin search must return >= admin-branch search (i.e. not be narrower).
        me_admin_branch_count = None
        r = requests.get(f"{API}/leads", headers=_h(super_token),
                         params={"search": "a"}, timeout=15).json()
        items = r if isinstance(r, list) else r.get("items", [])
        # Compare with full unfiltered super_admin count
        all_leads = requests.get(f"{API}/leads", headers=_h(super_token), timeout=15).json()
        all_items = all_leads if isinstance(all_leads, list) else all_leads.get("items", [])
        all_branches = {x.get("branch_id") for x in all_items if x.get("branch_id")}
        search_branches = {x.get("branch_id") for x in items if x.get("branch_id")}
        # super_admin search must span as many branches as seed data has leads in
        assert search_branches == all_branches or (
            len(search_branches) >= 1 and len(all_branches) == 1
        ), f"search branches {search_branches} != all branches {all_branches}"
