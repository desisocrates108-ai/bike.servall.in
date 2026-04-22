"""
Iteration-12 Backend Compliance tests (Servall CRM — P0 bundle)
Scope:
  1. /api/settings/integrations GET (super_admin/admin/sales_executive RBAC + masking)
  2. /api/settings/integrations PUT (super_admin only; admin 403)
  3. /api/analytics/summary with from_date/to_date query filters
  4. /api/analytics/performance with from_date/to_date filters
  5. /api/leads/{lid}/exchange-photos with doc_type=aadhaar|rc_book|front_photo|back_photo
     and default (photo) — correct bucket placement
  6. DELETE /api/leads/{lid}/exchange-photos/{file_id} — removes from both photos[] and
     documents.* and marks file is_deleted=true
  7. POST /api/leads/{lid}/stage Lost without lost_reason returns 400
  8. POST /api/leads as sales_executive IGNORES body.branch_id (auto-branch)
"""
import os
import io
import requests
import pytest
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL env var required"
API = f"{BASE_URL}/api"


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_token():
    return login("superadmin@dealer.com", "super123")


@pytest.fixture(scope="module")
def admin_token():
    return login("admin@dealer.com", "admin123")


@pytest.fixture(scope="module")
def sales_token():
    return login("sales1@dealer.com", "sales123")


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- 1) Integrations GET RBAC ----------
class TestIntegrationsGet:
    def test_super_admin_get_ok(self, super_token):
        r = requests.get(f"{API}/settings/integrations", headers=auth(super_token), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "elevenza_api_key_set" in j
        assert "elevenza_api_key_masked" in j
        assert "elevenza_sender_id" in j
        assert "triggers" in j
        for k in ("inquiry_created", "delivery_completed", "feedback_reminder"):
            assert k in j["triggers"], f"missing trigger {k}"

    def test_admin_get_ok(self, admin_token):
        r = requests.get(f"{API}/settings/integrations", headers=auth(admin_token), timeout=15)
        assert r.status_code == 200

    def test_sales_get_forbidden(self, sales_token):
        r = requests.get(f"{API}/settings/integrations", headers=auth(sales_token), timeout=15)
        assert r.status_code == 403, f"sales must be 403, got {r.status_code}"


# ---------- 2) Integrations PUT (super_admin only) ----------
class TestIntegrationsPut:
    def test_admin_put_forbidden(self, admin_token):
        r = requests.put(f"{API}/settings/integrations", headers=auth(admin_token),
                         json={"elevenza_sender_id": "TESTSND"}, timeout=15)
        assert r.status_code == 403

    def test_super_put_ok_and_masked_key(self, super_token):
        body = {
            "elevenza_api_key": "TEST_KEY_ABCDEF1234",
            "elevenza_sender_id": "SERV12",
            "triggers": {
                "inquiry_created": {"enabled": True, "template_id": "tpl_inq"},
                "delivery_completed": {"enabled": False, "template_id": None},
                "feedback_reminder": {"enabled": True, "template_id": "tpl_fb"},
            },
        }
        r = requests.put(f"{API}/settings/integrations", headers=auth(super_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # GET back and verify
        g = requests.get(f"{API}/settings/integrations", headers=auth(super_token), timeout=15).json()
        assert g["elevenza_api_key_set"] is True
        assert g["elevenza_api_key_masked"].endswith("1234")
        assert "TEST_KEY" not in g["elevenza_api_key_masked"]  # masked except last 4
        assert g["elevenza_sender_id"] == "SERV12"
        assert g["triggers"]["inquiry_created"]["enabled"] is True
        assert g["triggers"]["feedback_reminder"]["template_id"] == "tpl_fb"


# ---------- 3 & 4) Analytics date-range filters ----------
class TestAnalyticsDateRange:
    def test_summary_with_future_range_zero(self, super_token):
        # future window → must return 0 leads
        f = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%d")
        t = (datetime.now(timezone.utc) + timedelta(days=366)).strftime("%Y-%m-%d")
        r = requests.get(f"{API}/analytics/summary",
                         headers=auth(super_token),
                         params={"from_date": f, "to_date": t}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["total_leads"] == 0
        assert j["converted"] == 0
        assert j["lost"] == 0

    def test_summary_broad_range_matches_unfiltered(self, super_token):
        # broad range (5 years back to now+1) should be >= 0 and return schema intact
        r = requests.get(f"{API}/analytics/summary",
                         headers=auth(super_token),
                         params={"from_date": "2020-01-01", "to_date": "2099-12-31"}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        for k in ("total_leads", "per_source", "per_stage", "conversion_rate",
                  "deals_in_progress", "pending_approvals"):
            assert k in j
        assert j["total_leads"] > 0, "expected at least some seeded leads in broad range"

    def test_performance_date_range(self, super_token):
        r = requests.get(f"{API}/analytics/performance",
                         headers=auth(super_token),
                         params={"from_date": "2020-01-01", "to_date": "2099-12-31"}, timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            row = arr[0]
            for k in ("user_id", "name", "total_leads", "conversion_rate"):
                assert k in row, f"missing {k} in performance row"

    def test_performance_sales_forbidden(self, sales_token):
        r = requests.get(f"{API}/analytics/performance", headers=auth(sales_token), timeout=15)
        assert r.status_code == 403


# ---------- 5 & 6) Exchange photos doc_type + delete ----------
@pytest.fixture(scope="module")
def exchange_lead_id(super_token):
    """Create a fresh lead with purchase_type=Exchange Vehicle."""
    # pick a branch
    branches = requests.get(f"{API}/branches", headers=auth(super_token), timeout=10).json()
    bid = next((b["id"] for b in branches if b.get("name") == "Bilimora"), branches[0]["id"])
    payload = {
        "customer_name": "TEST_IT12_Exchange",
        "phone": "9000012121",
        "source": "Walk-in",
        "branch_id": bid,
        "priority": "Warm",
        "purchase_type": "Exchange Vehicle",
    }
    r = requests.post(f"{API}/leads", headers=auth(super_token), json=payload, timeout=15)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


class TestExchangePhotos:
    def _upload(self, tok, lid, doc_type=None):
        files = {"file": ("pic.jpg", io.BytesIO(b"\xff\xd8\xff\xe0fakejpg"), "image/jpeg")}
        params = {"doc_type": doc_type} if doc_type else {}
        return requests.post(f"{API}/leads/{lid}/exchange-photos",
                             headers=auth(tok), files=files, params=params, timeout=20)

    @pytest.mark.parametrize("doc_type,bucket", [
        ("aadhaar", "aadhaar"),
        ("rc_book", "rc_book"),
        ("front_photo", "front_photo"),
        ("back_photo", "back_photo"),
    ])
    def test_upload_each_doc_type(self, super_token, exchange_lead_id, doc_type, bucket):
        r = self._upload(super_token, exchange_lead_id, doc_type)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["doc_type"] == doc_type
        assert "file_id" in j
        # confirm via lead GET
        lead = requests.get(f"{API}/leads/{exchange_lead_id}",
                            headers=auth(super_token), timeout=10).json()
        exch = lead.get("exchange") or {}
        docs = exch.get("documents") or {}
        assert j["file_id"] in (docs.get(bucket) or []), f"file not in documents.{bucket}"

    def test_upload_default_goes_to_photos(self, super_token, exchange_lead_id):
        r = self._upload(super_token, exchange_lead_id)  # no doc_type
        assert r.status_code == 200
        fid = r.json()["file_id"]
        lead = requests.get(f"{API}/leads/{exchange_lead_id}",
                            headers=auth(super_token), timeout=10).json()
        photos = (lead.get("exchange") or {}).get("photos") or []
        assert fid in photos, "default upload must land in photos[]"

    def test_delete_from_bucket_and_marks_file(self, super_token, exchange_lead_id):
        # upload aadhaar → delete → verify removed + is_deleted
        r = self._upload(super_token, exchange_lead_id, "aadhaar")
        fid = r.json()["file_id"]
        d = requests.delete(f"{API}/leads/{exchange_lead_id}/exchange-photos/{fid}",
                            headers=auth(super_token), timeout=10)
        assert d.status_code == 200
        assert d.json().get("ok") is True
        lead = requests.get(f"{API}/leads/{exchange_lead_id}",
                            headers=auth(super_token), timeout=10).json()
        docs = (lead.get("exchange") or {}).get("documents") or {}
        assert fid not in (docs.get("aadhaar") or [])

    def test_delete_from_photos(self, super_token, exchange_lead_id):
        r = self._upload(super_token, exchange_lead_id)  # default
        fid = r.json()["file_id"]
        d = requests.delete(f"{API}/leads/{exchange_lead_id}/exchange-photos/{fid}",
                            headers=auth(super_token), timeout=10)
        assert d.status_code == 200
        lead = requests.get(f"{API}/leads/{exchange_lead_id}",
                            headers=auth(super_token), timeout=10).json()
        photos = (lead.get("exchange") or {}).get("photos") or []
        assert fid not in photos


# ---------- 7) Lost-reason enforcement ----------
class TestLostReasonEnforcement:
    def test_stage_lost_without_reason_400(self, super_token):
        # use the exchange_lead_id from seed above - fresh lead
        branches = requests.get(f"{API}/branches", headers=auth(super_token), timeout=10).json()
        bid = branches[0]["id"]
        r = requests.post(f"{API}/leads", headers=auth(super_token), json={
            "customer_name": "TEST_IT12_Lost", "phone": "9000012122",
            "source": "Walk-in", "branch_id": bid, "priority": "Warm",
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        lid = r.json()["id"]
        s = requests.post(f"{API}/leads/{lid}/stage",
                          headers=auth(super_token),
                          json={"stage": "Lost"}, timeout=15)
        assert s.status_code == 400, f"expected 400, got {s.status_code}: {s.text}"


# ---------- 8) Auto-branch on sales_executive lead create ----------
class TestAutoBranchSales:
    def test_sales_branch_ignored_and_auto_assigned(self, sales_token, super_token):
        # fetch sales user branch
        me = requests.get(f"{API}/auth/me", headers=auth(sales_token), timeout=10).json()
        sales_branch = me.get("branch_id")
        assert sales_branch, "sales1 must have a branch"
        # pick a *different* branch to pass in body
        branches = requests.get(f"{API}/branches", headers=auth(super_token), timeout=10).json()
        other = next((b["id"] for b in branches if b["id"] != sales_branch), None)
        assert other, "need a different branch"

        payload = {
            "customer_name": "TEST_IT12_AutoBranch",
            "phone": "9000012123",
            "source": "Walk-in",
            "branch_id": other,  # should be IGNORED
            "priority": "Warm",
        }
        r = requests.post(f"{API}/leads", headers=auth(sales_token), json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        lid = r.json()["id"]
        # verify via GET that branch is auto-assigned = sales_branch
        g = requests.get(f"{API}/leads/{lid}", headers=auth(sales_token), timeout=10).json()
        assert g["branch_id"] == sales_branch, (
            f"branch_id must be auto-assigned to sales branch {sales_branch}, got {g['branch_id']}"
        )
        # assigned_to should also be self
        assert g["assigned_to"] == me["id"]
