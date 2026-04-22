"""Iteration 13 — GET /api/analytics/calendar tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "super": ("superadmin@dealer.com", "super123"),
    "admin": ("admin@dealer.com", "admin123"),
    "sales": ("sales1@dealer.com", "sales123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(*v) for k, v in CREDS.items()}


def _get(tok, params):
    return requests.get(
        f"{API}/analytics/calendar",
        headers={"Authorization": f"Bearer {tok}"},
        params=params, timeout=20,
    )


# ---------- Schema & basic 200 ----------
class TestCalendarSchema:
    def test_super_admin_200(self, tokens):
        r = _get(tokens["super"], {"year": 2026, "month": 4})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["year"] == 2026
        assert data["month"] == 4
        assert "days" in data and isinstance(data["days"], dict)
        # Each day (if present) has the 4 buckets
        for date_key, buckets in data["days"].items():
            assert date_key.startswith("2026-04-"), date_key
            for bkt in ("deliveries", "followups", "upcoming", "overdue"):
                assert bkt in buckets and isinstance(buckets[bkt], list)

    def test_admin_200(self, tokens):
        r = _get(tokens["admin"], {"year": 2026, "month": 4})
        assert r.status_code == 200
        assert "days" in r.json()

    def test_sales_200(self, tokens):
        r = _get(tokens["sales"], {"year": 2026, "month": 4})
        assert r.status_code == 200
        assert "days" in r.json()

    def test_current_month(self, tokens):
        # January 2026 — this is the current month per environment
        r = _get(tokens["super"], {"year": 2026, "month": 1})
        assert r.status_code == 200
        assert r.json()["month"] == 1


# ---------- Validation ----------
class TestCalendarValidation:
    @pytest.mark.parametrize("year,month", [
        (2023, 5),   # year too low
        (2036, 5),   # year too high
        (2026, 0),   # month too low
        (2026, 13),  # month too high
    ])
    def test_invalid_range_400(self, tokens, year, month):
        r = _get(tokens["super"], {"year": year, "month": month})
        assert r.status_code == 400, f"expected 400 got {r.status_code} for {year}/{month}"

    def test_missing_params_422(self, tokens):
        r = requests.get(
            f"{API}/analytics/calendar",
            headers={"Authorization": f"Bearer {tokens['super']}"}, timeout=10,
        )
        assert r.status_code in (400, 422)

    def test_unauth_401(self):
        r = requests.get(f"{API}/analytics/calendar", params={"year": 2026, "month": 4}, timeout=10)
        assert r.status_code in (401, 403)


# ---------- RBAC / scoping ----------
class TestCalendarScoping:
    def test_super_admin_branch_filter_accepted(self, tokens):
        # Get a branch id
        br = requests.get(f"{API}/branches", headers={"Authorization": f"Bearer {tokens['super']}"}, timeout=10)
        assert br.status_code == 200
        branches = br.json()
        if not branches:
            pytest.skip("no branches seeded")
        bid = branches[0]["id"]
        r = _get(tokens["super"], {"year": 2026, "month": 1, "branch_id": bid})
        assert r.status_code == 200

    def test_sales_scope_only_own_leads(self, tokens):
        # Pull sales leads and verify every lead_id in events belongs to their set
        leads_r = requests.get(
            f"{API}/leads", params={"page_size": 500},
            headers={"Authorization": f"Bearer {tokens['sales']}"}, timeout=15,
        )
        assert leads_r.status_code == 200
        my_ids = {l["id"] for l in leads_r.json()}
        # Check a few months
        for month in (1, 2, 3):
            r = _get(tokens["sales"], {"year": 2026, "month": month})
            assert r.status_code == 200
            for date_key, buckets in r.json()["days"].items():
                for bkt_name, items in buckets.items():
                    for it in items:
                        lid = it.get("lead_id")
                        if lid:
                            assert lid in my_ids, (
                                f"sales saw lead {lid} not in own set in {date_key}/{bkt_name}"
                            )

    def test_admin_scope_own_branch(self, tokens):
        # All lead_ids in admin response must belong to admin's branch
        me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tokens['admin']}"}, timeout=10)
        assert me.status_code == 200
        branch_id = me.json().get("branch_id")
        # list leads of that branch
        leads_r = requests.get(
            f"{API}/leads", params={"page_size": 500},
            headers={"Authorization": f"Bearer {tokens['admin']}"}, timeout=15,
        )
        branch_lead_ids = {l["id"] for l in leads_r.json()}
        r = _get(tokens["admin"], {"year": 2026, "month": 1})
        assert r.status_code == 200
        for date_key, buckets in r.json()["days"].items():
            for items in buckets.values():
                for it in items:
                    lid = it.get("lead_id")
                    if lid:
                        assert lid in branch_lead_ids, (
                            f"admin (branch={branch_id}) saw lead {lid} outside branch"
                        )


# ---------- Bucketing semantics ----------
class TestCalendarBucketing:
    def test_buckets_are_lists_of_dicts(self, tokens):
        r = _get(tokens["super"], {"year": 2026, "month": 1})
        assert r.status_code == 200
        for _, buckets in r.json()["days"].items():
            for bkt_name, items in buckets.items():
                assert isinstance(items, list)
                for it in items:
                    assert isinstance(it, dict)
                    # Common lead_id field expected for all non-empty events
                    assert "lead_id" in it or bkt_name == "deliveries"

    def test_no_cross_month_leakage(self, tokens):
        r = _get(tokens["super"], {"year": 2026, "month": 3})
        assert r.status_code == 200
        for date_key in r.json()["days"]:
            assert date_key.startswith("2026-03-"), f"leaked: {date_key}"
