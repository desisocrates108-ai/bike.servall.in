"""
Iteration 20 backend tests — Phase 3 simplifications:
- /constants doc_types contains 'Bank Passbook' (NOT 'Bank Statement')
- /constants doc_requirements.Finance == ['Aadhaar Card', 'PAN Card', 'Bank Passbook']
- PUT /leads/{id} customer_type validation:
    * 'Random Buyer' → 400
    * 'Just Inquiry' on existing lead → 200, persisted
    * '' (empty) → 200, stored as null
- Regression: Iteration 19 customer_type tests (POST + invalid + omitted)
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


def _create_lead(sess, customer_type=None, name_suffix="Lead"):
    payload = {"customer_name": f"TEST_Iter20 {name_suffix}", "phone": _phone()}
    if customer_type is not None:
        payload["customer_type"] = customer_type
    r = sess.post(f"{API}/leads", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    lead = r.json()
    CREATED_LEAD_IDS.append(lead["id"])
    return lead


# ----------------------------------------------------------------------------
# 1. /constants — doc_types & doc_requirements simplification
# ----------------------------------------------------------------------------
class TestConstantsDocs:
    def test_doc_types_has_bank_passbook(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "doc_types" in data, "doc_types missing in constants"
        dt = data["doc_types"]
        assert "Bank Passbook" in dt, f"'Bank Passbook' missing in doc_types: {dt}"
        assert "Bank Statement" not in dt, f"'Bank Statement' should be removed: {dt}"

    def test_doc_requirements_finance_simplified(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "doc_requirements" in data
        finance = data["doc_requirements"].get("Finance")
        assert finance == ["Aadhaar Card", "PAN Card", "Bank Passbook"], (
            f"Finance docs mismatch: {finance}"
        )


# ----------------------------------------------------------------------------
# 2. PUT /leads/{id} customer_type validation
# ----------------------------------------------------------------------------
class TestPutLeadCustomerType:
    def test_put_invalid_customer_type_400(self, super_session):
        lead = _create_lead(super_session, customer_type="Instant Buyer", name_suffix="PutInvalid")
        r = super_session.put(
            f"{API}/leads/{lead['id']}",
            json={"customer_type": "Random Buyer"},
            timeout=30,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "Invalid customer_type" in detail, f"expected error msg, got: {detail}"

        # GET to ensure value not corrupted
        gr = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert gr.status_code == 200
        assert gr.json().get("customer_type") == "Instant Buyer"

    def test_put_valid_customer_type_change_persists(self, super_session):
        lead = _create_lead(super_session, customer_type="Instant Buyer", name_suffix="PutValid")
        r = super_session.put(
            f"{API}/leads/{lead['id']}",
            json={"customer_type": "Just Inquiry"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("customer_type") == "Just Inquiry", f"resp ct={body.get('customer_type')}"

        gr = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert gr.status_code == 200
        assert gr.json().get("customer_type") == "Just Inquiry"

    def test_put_empty_customer_type_stored_as_null(self, super_session):
        lead = _create_lead(super_session, customer_type="Token Finance Buyer", name_suffix="PutEmpty")
        r = super_session.put(
            f"{API}/leads/{lead['id']}",
            json={"customer_type": ""},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("customer_type") in (None, ""), (
            f"expected null/empty, got {body.get('customer_type')}"
        )

        gr = super_session.get(f"{API}/leads/{lead['id']}", timeout=30)
        assert gr.status_code == 200
        ct = gr.json().get("customer_type")
        assert ct in (None, ""), f"persisted ct should be null/empty, got {ct}"


# ----------------------------------------------------------------------------
# 3. Regression — Iteration 19 customer_type POST behaviour
# ----------------------------------------------------------------------------
class TestRegressionIter19:
    def test_constants_customer_types_unchanged(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200
        ct = r.json().get("customer_types")
        assert ct == ["Instant Buyer", "Token Finance Buyer", "Just Inquiry"], f"got: {ct}"

    def test_post_just_inquiry_routes_to_followup(self, super_session):
        lead = _create_lead(super_session, customer_type="Just Inquiry", name_suffix="RegJI")
        assert lead.get("stage") == "Follow-up"
        assert lead.get("customer_type") == "Just Inquiry"

    def test_post_instant_buyer_routes_to_inquiry(self, super_session):
        lead = _create_lead(super_session, customer_type="Instant Buyer", name_suffix="RegIB")
        assert lead.get("stage") == "Inquiry"
        assert lead.get("customer_type") == "Instant Buyer"

    def test_post_token_finance_buyer_routes_to_inquiry(self, super_session):
        lead = _create_lead(super_session, customer_type="Token Finance Buyer", name_suffix="RegTFB")
        assert lead.get("stage") == "Inquiry"
        assert lead.get("customer_type") == "Token Finance Buyer"

    def test_post_invalid_customer_type_400(self, super_session):
        payload = {
            "customer_name": "TEST_Iter20 RegInvalid",
            "phone": _phone(),
            "customer_type": "Random Buyer",
        }
        r = super_session.post(f"{API}/leads", json=payload, timeout=30)
        assert r.status_code == 400, r.text
        assert "Invalid customer_type" in r.json().get("detail", "")


# ----------------------------------------------------------------------------
# 4. Cleanup — direct mongo deletion since /api/leads has no DELETE
# ----------------------------------------------------------------------------
class TestZCleanup:
    def test_cleanup_test_iter20_leads(self, super_session):
        # Try search-based GET, then direct mongo via shell as fallback
        try:
            leads = super_session.get(f"{API}/leads", params={"search": "TEST_Iter20"}, timeout=30).json()
            print(f"Found {len(leads)} TEST_Iter20 leads to clean (mongo cleanup needed)")
        except Exception as e:
            print(f"cleanup search failed: {e}")
        # Direct mongo cleanup
        try:
            from pymongo import MongoClient
            mongo_url = os.environ["MONGO_URL"]
            db_name = os.environ["DB_NAME"]
            client = MongoClient(mongo_url)
            db = client[db_name]
            result = db.leads.delete_many({"customer_name": {"$regex": "^TEST_Iter20"}})
            print(f"Deleted {result.deleted_count} TEST_Iter20 leads via mongo")
            client.close()
        except Exception as e:
            print(f"mongo cleanup failed: {e}")
        assert True
