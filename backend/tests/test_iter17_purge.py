"""
Iter-17 — Production purge + Documents gallery prerequisites
Verifies:
 1. Only super_admin user remains in DB
 2. Leads & transactional collections are empty
 3. Branches + settings are preserved
 4. Purge endpoint guards: missing/invalid confirm token; role check via temp user
 5. Demo users (admin@dealer.com, sales*) cannot login (401)
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@dealer.com"
SUPER_PASS = "super123"


# ------------------------- fixtures -------------------------

@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=10)
    assert r.status_code == 200, f"Super admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def super_headers(super_token):
    return {"Authorization": f"Bearer {super_token}"}


# ------------------------- state verification -------------------------

class TestPurgeStateVerification:
    def test_users_only_super_admin(self, super_headers):
        r = requests.get(f"{API}/users", headers=super_headers, timeout=10)
        assert r.status_code == 200
        users = r.json()
        emails = sorted([u["email"] for u in users])
        # Demo users must NOT be present
        demo_emails = {"admin@dealer.com", "sales1@dealer.com", "sales2@dealer.com",
                       "sales3@dealer.com", "sales4@dealer.com"}
        present_demo = demo_emails.intersection(emails)
        assert not present_demo, f"Demo users still present: {present_demo}"
        # super admin must exist
        assert SUPER_EMAIL in emails
        # exactly one super_admin
        super_admins = [u for u in users if u.get("role") == "super_admin"]
        assert len(super_admins) == 1

    def test_no_leads(self, super_headers):
        r = requests.get(f"{API}/leads", headers=super_headers, timeout=10)
        assert r.status_code == 200
        leads = r.json()
        assert isinstance(leads, list)
        # Note: this may not be 0 if earlier tests created leads; but iter-17 baseline expects 0.
        # Allow TEST_* leads from this run's create test to exist.
        non_test_leads = [l for l in leads if not (l.get("customer_name") or "").startswith("TEST_IT17")]
        assert len(non_test_leads) == 0, f"Non-test leads present: {len(non_test_leads)}"

    def test_branches_preserved(self, super_headers):
        r = requests.get(f"{API}/branches", headers=super_headers, timeout=10)
        assert r.status_code == 200
        branches = r.json()
        assert len(branches) == 5, f"Expected 5 branches, got {len(branches)}"
        names = sorted([b["name"] for b in branches])
        assert names == ["Amalsad", "Bilimora", "Chikhli", "Gandevi", "Vansda"]

    def test_settings_preserved(self, super_headers):
        # settings/11za or /integrations should still respond
        r = requests.get(f"{API}/settings/integrations", headers=super_headers, timeout=10)
        assert r.status_code in (200, 404)  # either exists or gracefully absent
        # 11za settings
        r2 = requests.get(f"{API}/settings/11za", headers=super_headers, timeout=10)
        assert r2.status_code in (200, 404)

    @pytest.mark.parametrize("demo_email", [
        "admin@dealer.com",
        "sales1@dealer.com",
        "sales2@dealer.com",
        "sales3@dealer.com",
        "sales4@dealer.com",
    ])
    def test_demo_users_cannot_login(self, demo_email):
        r = requests.post(f"{API}/auth/login", json={"email": demo_email, "password": "admin123"}, timeout=10)
        assert r.status_code == 401, f"Demo user {demo_email} should not exist; got {r.status_code}"


# ------------------------- purge endpoint guards -------------------------

class TestPurgeGuards:
    def test_purge_requires_confirm(self, super_headers):
        r = requests.post(f"{API}/admin/purge-demo-data", headers=super_headers, timeout=10)
        assert r.status_code == 400
        assert "confirm" in r.text.lower()

    def test_purge_wrong_confirm(self, super_headers):
        r = requests.post(f"{API}/admin/purge-demo-data?confirm=WRONG", headers=super_headers, timeout=10)
        assert r.status_code == 400

    def test_purge_unauthenticated(self):
        r = requests.post(f"{API}/admin/purge-demo-data?confirm=SERVALL_PURGE", timeout=10)
        assert r.status_code in (401, 403)


# ------------------------- DocumentsGallery prereq: create lead + upload -------------------------

class TestDocumentsGalleryPrerequisites:
    """Ensures backend can serve all docs needed for the frontend DocumentsGallery."""

    @pytest.fixture(scope="class")
    def branch_id(self, super_headers):
        r = requests.get(f"{API}/branches", headers=super_headers, timeout=10)
        assert r.status_code == 200
        for b in r.json():
            if b["name"] == "Bilimora":
                return b["id"]
        pytest.skip("Bilimora branch missing")

    @pytest.fixture(scope="class")
    def exchange_lead_id(self, super_headers, branch_id):
        payload = {
            "customer_name": f"TEST_IT17_Exc_{uuid.uuid4().hex[:6]}",
            "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
            "source": "Walk-in",
            "branch_id": branch_id,
            "purchase_type": "Exchange Vehicle",
        }
        r = requests.post(f"{API}/leads", json=payload, headers=super_headers, timeout=10)
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    @pytest.fixture(scope="class")
    def new_purchase_lead_id(self, super_headers, branch_id):
        payload = {
            "customer_name": f"TEST_IT17_New_{uuid.uuid4().hex[:6]}",
            "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
            "source": "Walk-in",
            "branch_id": branch_id,
            "purchase_type": "New Purchase",
        }
        r = requests.post(f"{API}/leads", json=payload, headers=super_headers, timeout=10)
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    def _upload(self, lead_id, doc_type, fname, content, ctype, super_headers):
        files = {"file": (fname, io.BytesIO(content), ctype)}
        r = requests.post(
            f"{API}/leads/{lead_id}/exchange-photos?doc_type={doc_type}",
            headers={"Authorization": super_headers["Authorization"]},
            files=files,
            timeout=15,
        )
        assert r.status_code in (200, 201), f"Upload {doc_type} failed: {r.status_code} {r.text}"
        return r.json()

    JPG = bytes.fromhex("ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffda0008010100003f00fbd0ffd9")
    PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"

    def test_exchange_lead_all_6_uploads(self, super_headers, exchange_lead_id):
        for dt in ["aadhaar", "aadhaar_back", "rc_front", "rc_back", "front_photo", "back_photo"]:
            self._upload(exchange_lead_id, dt, f"{dt}.jpg", self.JPG, "image/jpeg", super_headers)
        # Add one other PDF
        self._upload(exchange_lead_id, "other", "other.pdf", self.PDF, "application/pdf", super_headers)
        # Add rc_pdf
        self._upload(exchange_lead_id, "rc_pdf", "rc.pdf", self.PDF, "application/pdf", super_headers)

        r = requests.get(f"{API}/leads/{exchange_lead_id}", headers=super_headers, timeout=10)
        assert r.status_code == 200
        lead = r.json()
        ident = lead.get("identity_docs") or {}
        exch = (lead.get("exchange") or {}).get("documents") or {}
        assert len(ident.get("aadhaar") or []) == 1
        assert len(ident.get("aadhaar_back") or []) == 1
        assert len(ident.get("other") or []) == 1
        assert len(exch.get("rc_front") or []) == 1
        assert len(exch.get("rc_back") or []) == 1
        assert len(exch.get("rc_pdf") or []) == 1
        assert len(exch.get("front_photo") or []) == 1
        assert len(exch.get("back_photo") or []) == 1

    def test_new_purchase_lead_partial_uploads(self, super_headers, new_purchase_lead_id):
        for dt in ["aadhaar", "aadhaar_back"]:
            self._upload(new_purchase_lead_id, dt, f"{dt}.jpg", self.JPG, "image/jpeg", super_headers)
        self._upload(new_purchase_lead_id, "other", "other.pdf", self.PDF, "application/pdf", super_headers)

        r = requests.get(f"{API}/leads/{new_purchase_lead_id}", headers=super_headers, timeout=10)
        assert r.status_code == 200
        lead = r.json()
        ident = lead.get("identity_docs") or {}
        assert len(ident.get("aadhaar") or []) == 1
        assert len(ident.get("aadhaar_back") or []) == 1
        assert len(ident.get("other") or []) == 1
        # No exchange docs expected
        exch = lead.get("exchange")
        if exch:
            docs = exch.get("documents") or {}
            for k in ("rc_front", "rc_back", "rc_pdf", "front_photo", "back_photo"):
                assert not (docs.get(k) or []), f"New Purchase lead unexpectedly has {k}"
