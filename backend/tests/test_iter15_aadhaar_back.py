"""
Iteration 15 — Aadhaar split into Aadhaar Front + Aadhaar Back (5 mandatory slots).
Scope:
  (1) POST /api/leads/{lid}/exchange-photos?doc_type=aadhaar_back lands in exchange.documents.aadhaar_back[]
  (2) Regression — all existing doc_types (photo, aadhaar, rc_book, front_photo, back_photo, other) still route correctly.
  (3) DELETE from aadhaar_back bucket works.
"""
import io
import os
import uuid

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

SUPER = {"email": "superadmin@dealer.com", "password": "super123"}


def _login(s, creds):
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return r.json()


def _pick_ids(s):
    branches = s.get(f"{BASE_URL}/api/branches", timeout=15).json()
    brands = s.get(f"{BASE_URL}/api/brands", timeout=15).json()
    models = s.get(f"{BASE_URL}/api/models", timeout=15).json()
    variants = s.get(f"{BASE_URL}/api/variants", timeout=15).json()
    colors = s.get(f"{BASE_URL}/api/colors", timeout=15).json()
    branch_id = branches[0]["id"]
    brand_id = brands[0]["id"]
    model = next((m for m in models if m.get("brand_id") == brand_id), models[0])
    model_id = model["id"]
    variant = next((v for v in variants if v.get("model_id") == model_id), None)
    variant_id = variant["id"] if variant else None
    color_id = colors[0]["id"]
    return branch_id, brand_id, model_id, variant_id, color_id


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    _login(s, SUPER)
    yield s
    s.close()


@pytest.fixture(scope="module")
def exchange_lead_id(session):
    branch_id, brand_id, model_id, variant_id, color_id = _pick_ids(session)
    payload = {
        "customer_name": f"TEST_IT15_Exch_{uuid.uuid4().hex[:6]}",
        "phone": f"9{uuid.uuid4().int % 1000000000:09d}",
        "source": "Walk-in",
        "branch_id": branch_id,
        "brand_id": brand_id,
        "model_id": model_id,
        "variant_id": variant_id,
        "color_id": color_id,
        "purchase_type": "Exchange Vehicle",
        "priority": "Warm",
    }
    r = session.post(f"{BASE_URL}/api/leads", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _upload(session, lid, doc_type, fname="f.jpg", ctype="image/jpeg", payload=b"BINDATA"):
    s = requests.Session()
    s.headers.update({"Authorization": session.headers["Authorization"]})
    url = f"{BASE_URL}/api/leads/{lid}/exchange-photos"
    params = {} if doc_type is None else {"doc_type": doc_type}
    files = {"file": (fname, io.BytesIO(payload), ctype)}
    return s.post(url, params=params, files=files, timeout=30)


# ---------- (1) NEW: doc_type=aadhaar_back ----------
class TestAadhaarBackBucket:
    def test_upload_aadhaar_back_image(self, session, exchange_lead_id):
        r = _upload(session, exchange_lead_id, "aadhaar_back", fname="ab_img.jpg", ctype="image/jpeg")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["doc_type"] == "aadhaar_back"
        fid = body["file_id"]
        assert fid in (body["exchange"].get("documents", {}).get("aadhaar_back") or [])
        # Verify via GET
        lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
        assert fid in (lead.get("exchange", {}).get("documents", {}).get("aadhaar_back") or [])

    def test_upload_aadhaar_back_pdf(self, session, exchange_lead_id):
        r = _upload(session, exchange_lead_id, "aadhaar_back", fname="ab.pdf", ctype="application/pdf", payload=b"%PDF-1.4")
        assert r.status_code == 200, r.text
        assert r.json()["doc_type"] == "aadhaar_back"
        fid = r.json()["file_id"]
        lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
        assert fid in (lead.get("exchange", {}).get("documents", {}).get("aadhaar_back") or [])

    def test_aadhaar_and_aadhaar_back_are_separate_buckets(self, session, exchange_lead_id):
        """Front and back should land in distinct buckets."""
        rf = _upload(session, exchange_lead_id, "aadhaar", fname="front_ab.jpg")
        assert rf.status_code == 200
        ff = rf.json()["file_id"]
        rb = _upload(session, exchange_lead_id, "aadhaar_back", fname="back_ab.jpg")
        assert rb.status_code == 200
        fb = rb.json()["file_id"]
        assert ff != fb
        lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
        docs = lead.get("exchange", {}).get("documents", {})
        assert ff in (docs.get("aadhaar") or [])
        assert ff not in (docs.get("aadhaar_back") or [])
        assert fb in (docs.get("aadhaar_back") or [])
        assert fb not in (docs.get("aadhaar") or [])


# ---------- (2) Regression: all other doc_types ----------
@pytest.mark.parametrize("dt", ["aadhaar", "rc_book", "front_photo", "back_photo", "other"])
def test_regression_doc_type_routing(session, exchange_lead_id, dt):
    r = _upload(session, exchange_lead_id, dt, fname=f"{dt}.jpg")
    assert r.status_code == 200, r.text
    assert r.json()["doc_type"] == dt
    fid = r.json()["file_id"]
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    bucket = (lead.get("exchange", {}).get("documents", {}) or {}).get(dt) or []
    assert fid in bucket


def test_regression_default_photo_bucket(session, exchange_lead_id):
    r = _upload(session, exchange_lead_id, None, fname="legacy.jpg")
    assert r.status_code == 200
    assert r.json()["doc_type"] == "photo"
    fid = r.json()["file_id"]
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    assert fid in (lead.get("exchange", {}).get("photos") or [])


def test_invalid_doc_type_falls_back_to_photo(session, exchange_lead_id):
    r = _upload(session, exchange_lead_id, "not_a_bucket", fname="x.jpg")
    assert r.status_code == 200
    assert r.json()["doc_type"] == "photo"


# ---------- (3) DELETE from aadhaar_back ----------
def test_delete_from_aadhaar_back_bucket(session, exchange_lead_id):
    r = _upload(session, exchange_lead_id, "aadhaar_back", fname="todel_ab.jpg")
    fid = r.json()["file_id"]
    dr = session.delete(f"{BASE_URL}/api/leads/{exchange_lead_id}/exchange-photos/{fid}", timeout=15)
    assert dr.status_code == 200
    assert dr.json().get("ok") is True
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    assert fid not in (lead.get("exchange", {}).get("documents", {}).get("aadhaar_back") or [])
