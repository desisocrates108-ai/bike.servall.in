"""
Iteration 19 backend tests — customer_type (Lead intent selector)
- POST /leads with customer_type=Just Inquiry → stage=Follow-up
- POST /leads with customer_type=Instant Buyer → stage=Inquiry, persisted
- POST /leads with customer_type=Token Finance Buyer → stage=Inquiry, persisted
- POST /leads with invalid customer_type → 400
- POST /leads omitting customer_type → stage=Inquiry, customer_type=None
- GET /constants includes customer_types array (3 values)
- Cleanup TEST_ leads
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@dealer.com"
SUPER_PASS = "super123"

CREATED_LEAD_IDS = []


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


# ----------------------------------------------------------------------------
# 1. /constants includes customer_types
# ----------------------------------------------------------------------------
class TestConstantsCustomerTypes:
    def test_constants_have_customer_types(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "customer_types" in data, "customer_types missing in constants"
        ct = data["customer_types"]
        assert isinstance(ct, list)
        assert ct == ["Instant Buyer", "Token Finance Buyer", "Just Inquiry"], f"got: {ct}"


# ----------------------------------------------------------------------------
# 2. POST /leads stage routing per customer_type
# ----------------------------------------------------------------------------
class TestLeadCreateCustomerType:
    def test_just_inquiry_starts_at_followup(self, super_session):
        payload = {
            "customer_name": "TEST_Iter19 JustInquiry",
            "phone": _phone(),
            "customer_type": "Just Inquiry",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        lead = r.json()
        CREATED_LEAD_IDS.append(lead["id"])
        assert lead.get("stage") == "Follow-up", f"expected Follow-up, got {lead.get('stage')}"
        assert lead.get("customer_type") == "Just Inquiry"

        # Verify persistence via GET
        gr = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert gr.status_code == 200
        gdata = gr.json()
        assert gdata["stage"] == "Follow-up"
        assert gdata["customer_type"] == "Just Inquiry"

    def test_instant_buyer_starts_at_inquiry(self, super_session):
        payload = {
            "customer_name": "TEST_Iter19 InstantBuyer",
            "phone": _phone(),
            "customer_type": "Instant Buyer",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        lead = r.json()
        CREATED_LEAD_IDS.append(lead["id"])
        assert lead.get("stage") == "Inquiry"
        assert lead.get("customer_type") == "Instant Buyer"

        gr = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert gr.status_code == 200
        assert gr.json()["customer_type"] == "Instant Buyer"

    def test_token_finance_buyer_starts_at_inquiry(self, super_session):
        payload = {
            "customer_name": "TEST_Iter19 TokenFinance",
            "phone": _phone(),
            "customer_type": "Token Finance Buyer",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        lead = r.json()
        CREATED_LEAD_IDS.append(lead["id"])
        assert lead.get("stage") == "Inquiry"
        assert lead.get("customer_type") == "Token Finance Buyer"

        gr = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert gr.status_code == 200
        assert gr.json()["customer_type"] == "Token Finance Buyer"

    def test_invalid_customer_type_rejected(self, super_session):
        payload = {
            "customer_name": "TEST_Iter19 InvalidCT",
            "phone": _phone(),
            "customer_type": "Random Buyer",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "Invalid customer_type" in detail, f"expected error message, got: {detail}"

    def test_omitted_customer_type_defaults_inquiry(self, super_session):
        payload = {
            "customer_name": "TEST_Iter19 NoCT",
            "phone": _phone(),
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        lead = r.json()
        CREATED_LEAD_IDS.append(lead["id"])
        assert lead.get("stage") == "Inquiry"
        assert lead.get("customer_type") in (None, ""), f"expected None/empty, got {lead.get('customer_type')}"

    def test_empty_customer_type_defaults_inquiry(self, super_session):
        payload = {
            "customer_name": "TEST_Iter19 EmptyCT",
            "phone": _phone(),
            "customer_type": "",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        lead = r.json()
        CREATED_LEAD_IDS.append(lead["id"])
        assert lead.get("stage") == "Inquiry"
        assert lead.get("customer_type") in (None, "")


# ----------------------------------------------------------------------------
# 3. Cleanup
# ----------------------------------------------------------------------------
class TestZCleanup:
    def test_cleanup_created_leads(self, super_session):
        for lid in CREATED_LEAD_IDS:
            try:
                super_session.delete(f"{API}/leads/{lid}", timeout=30)
            except Exception:
                pass
        # Belt-and-suspenders search
        try:
            leads = super_session.get(f"{API}/leads", params={"search": "TEST_Iter19"}, timeout=30).json()
            for ld in leads:
                try:
                    super_session.delete(f"{API}/leads/{ld['id']}", timeout=30)
                except Exception:
                    pass
        except Exception:
            pass
        assert True
