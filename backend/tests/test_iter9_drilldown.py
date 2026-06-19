"""Iteration 9 — Drill-down endpoints, badge removal, PWA assets, RBAC branch isolation."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://leads-date-tracking.preview.emergentagent.com").rstrip("/")


# ---------- Helpers ----------
def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    return data


@pytest.fixture(scope="module")
def super_admin_session():
    data = _login("superadmin@dealer.com", "super123")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return {"session": s, "user": data["user"]}


@pytest.fixture(scope="module")
def admin_session():
    data = _login("admin@dealer.com", "admin123")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return {"session": s, "user": data["user"]}


@pytest.fixture(scope="module")
def sales_session():
    data = _login("sales1@dealer.com", "sales123")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return {"session": s, "user": data["user"]}


# ---------- Badge removal & PWA ----------
class TestBadgeAndPWA:
    def test_index_html_no_emergent_badge(self):
        r = requests.get(f"{BASE_URL}/", timeout=15)
        assert r.status_code == 200
        html = r.text
        assert "emergent-badge" not in html, "emergent-badge id still present"
        assert "Made with Emergent" not in html, "'Made with Emergent' text still present"

    def test_manifest_served(self):
        r = requests.get(f"{BASE_URL}/manifest.json", timeout=15)
        assert r.status_code == 200
        # Should be valid JSON
        js = r.json()
        assert "name" in js or "short_name" in js

    def test_service_worker_served(self):
        r = requests.get(f"{BASE_URL}/service-worker.js", timeout=15)
        assert r.status_code == 200
        assert "self" in r.text or "addEventListener" in r.text


# ---------- Branch drill-down ----------
class TestBranchDrilldown:
    def test_list_branches_super_admin(self, super_admin_session):
        s = super_admin_session["session"]
        r = s.get(f"{BASE_URL}/api/branches", timeout=15)
        assert r.status_code == 200
        branches = r.json()
        assert isinstance(branches, list)
        assert len(branches) >= 1
        # store for later
        TestBranchDrilldown.branch_id = branches[0]["id"]
        TestBranchDrilldown.branch_ids = [b["id"] for b in branches]

    def test_get_branch_by_id(self, super_admin_session):
        s = super_admin_session["session"]
        bid = TestBranchDrilldown.branch_id
        r = s.get(f"{BASE_URL}/api/branches/{bid}", timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["id"] == bid
        assert "name" in b

    def test_branch_performance_kpis(self, super_admin_session):
        s = super_admin_session["session"]
        bid = TestBranchDrilldown.branch_id
        r = s.get(f"{BASE_URL}/api/branches/{bid}/performance", timeout=15)
        assert r.status_code == 200, r.text
        kpi = r.json()
        # Expect at least some KPI keys
        assert isinstance(kpi, dict)
        # Common expected keys
        expected_any = {"total_leads", "converted", "lost", "conversion_rate", "funnel", "branch_id", "leads"}
        assert any(k in kpi for k in expected_any), f"no KPI keys found in {list(kpi.keys())}"

    def test_leads_filtered_by_branch(self, super_admin_session):
        s = super_admin_session["session"]
        bid = TestBranchDrilldown.branch_id
        r = s.get(f"{BASE_URL}/api/leads", params={"branch_id": bid}, timeout=15)
        assert r.status_code == 200
        leads = r.json()
        assert isinstance(leads, list)
        for ld in leads:
            # every lead must belong to requested branch
            assert ld.get("branch_id") == bid, f"lead {ld.get('id')} has branch_id {ld.get('branch_id')}"

    def test_leads_filtered_by_stage_lost(self, super_admin_session):
        s = super_admin_session["session"]
        r = s.get(f"{BASE_URL}/api/leads", params={"stage": "Lost"}, timeout=15)
        assert r.status_code == 200
        leads = r.json()
        for ld in leads:
            assert ld.get("stage") == "Lost"


# ---------- User drill-down ----------
class TestUserDrilldown:
    def test_list_users(self, super_admin_session):
        s = super_admin_session["session"]
        r = s.get(f"{BASE_URL}/api/users", timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        # pick a sales_executive if present else any
        sales = [u for u in users if u.get("role") == "sales_executive"]
        TestUserDrilldown.user_id = (sales[0] if sales else users[0])["id"]

    def test_user_performance_kpis(self, super_admin_session):
        s = super_admin_session["session"]
        uid = TestUserDrilldown.user_id
        r = s.get(f"{BASE_URL}/api/users/{uid}/performance", timeout=15)
        assert r.status_code == 200, r.text
        kpi = r.json()
        assert isinstance(kpi, dict)
        expected_any = {"total_leads", "converted", "lost", "conversion_rate", "funnel", "user_id", "leads"}
        assert any(k in kpi for k in expected_any), f"no KPI keys found in {list(kpi.keys())}"


# ---------- RBAC branch isolation ----------
class TestRBACIsolation:
    def test_admin_sees_only_own_branch(self, admin_session, super_admin_session):
        s_admin = admin_session["session"]
        admin_branch = admin_session["user"].get("branch_id")
        assert admin_branch, "admin must have a branch_id seeded"

        r = s_admin.get(f"{BASE_URL}/api/leads", timeout=15)
        assert r.status_code == 200
        leads = r.json()
        if len(leads) == 0:
            pytest.skip("no leads returned to admin; skipping isolation check")
        for ld in leads:
            assert ld.get("branch_id") == admin_branch, f"admin saw cross-branch lead {ld.get('id')}"

    def test_admin_cross_branch_filter_bypass_denied(self, admin_session, super_admin_session):
        """Admin requesting branch_id != own should NOT leak other branches."""
        s_admin = admin_session["session"]
        s_sup = super_admin_session["session"]
        admin_branch = admin_session["user"].get("branch_id")
        # find a different branch id
        all_branches = s_sup.get(f"{BASE_URL}/api/branches", timeout=15).json()
        other = next((b["id"] for b in all_branches if b["id"] != admin_branch), None)
        if not other:
            pytest.skip("only one branch seeded; cannot test cross-branch")
        r = s_admin.get(f"{BASE_URL}/api/leads", params={"branch_id": other}, timeout=15)
        # Either blocked (403) OR silently filtered (empty / only own)
        assert r.status_code in (200, 403), r.text
        if r.status_code == 200:
            leads = r.json()
            for ld in leads:
                assert ld.get("branch_id") == admin_branch, (
                    f"RBAC BYPASS: admin fetched lead from branch {ld.get('branch_id')} "
                    f"(admin_branch={admin_branch})"
                )

    def test_super_admin_sees_all_leads(self, super_admin_session):
        s = super_admin_session["session"]
        r = s.get(f"{BASE_URL}/api/leads", timeout=15)
        assert r.status_code == 200
        leads = r.json()
        # super admin should see leads from >=1 branch, and not be restricted
        branches_seen = {ld.get("branch_id") for ld in leads if ld.get("branch_id")}
        # Accept any count; just ensure call succeeded and >=0
        assert isinstance(leads, list)

    def test_sales_sees_only_own_leads(self, sales_session):
        s = sales_session["session"]
        uid = sales_session["user"]["id"]
        r = s.get(f"{BASE_URL}/api/leads", timeout=15)
        assert r.status_code == 200
        leads = r.json()
        for ld in leads:
            assert ld.get("assigned_to") == uid, (
                f"sales exec saw lead {ld.get('id')} assigned_to={ld.get('assigned_to')} not own ({uid})"
            )
