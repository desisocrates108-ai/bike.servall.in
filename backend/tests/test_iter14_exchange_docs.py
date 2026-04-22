"""
Iteration 14 — Exchange Vehicle documents/images bucket tests.
Scope:
  (1) POST /api/leads/{lid}/exchange-photos?doc_type=other  -> lands in exchange.documents.other[]
  (2) Existing doc_type values (aadhaar, rc_book, front_photo, back_photo, photo) still work (regression)
  (3) DELETE removes from any bucket including other
"""
import io
import os
import uuid

import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

SUPER = {"email": "superadmin@dealer.com", "password": "super123"}


# ---------- helpers ----------
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
        "customer_name": f"TEST_IT14_Exch_{uuid.uuid4().hex[:6]}",
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


# ---------- (1) NEW: doc_type=other ----------
class TestOtherBucket:
    def test_upload_other_image(self, session, exchange_lead_id):
        r = _upload(session, exchange_lead_id, "other", fname="other_img.jpg", ctype="image/jpeg")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["doc_type"] == "other"
        fid = body["file_id"]
        exch = body["exchange"]
        assert fid in (exch.get("documents", {}).get("other") or [])
        # Verify persistence via lead GET
        lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
        assert fid in (lead.get("exchange", {}).get("documents", {}).get("other") or [])

    def test_upload_other_pdf(self, session, exchange_lead_id):
        r = _upload(session, exchange_lead_id, "other", fname="doc.pdf", ctype="application/pdf", payload=b"%PDF-1.4")
        assert r.status_code == 200, r.text
        assert r.json()["doc_type"] == "other"
        fid = r.json()["file_id"]
        lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
        assert fid in (lead.get("exchange", {}).get("documents", {}).get("other") or [])

    def test_other_multi_append(self, session, exchange_lead_id):
        # Upload 2 more files, expect all remain
        fids = []
        for i in range(2):
            r = _upload(session, exchange_lead_id, "other", fname=f"o{i}.jpg")
            assert r.status_code == 200
            fids.append(r.json()["file_id"])
        lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
        bucket = lead.get("exchange", {}).get("documents", {}).get("other") or []
        for fid in fids:
            assert fid in bucket


# ---------- (2) Regression: other doc_types ----------
@pytest.mark.parametrize("dt,bucket_path", [
    ("aadhaar", ("documents", "aadhaar")),
    ("rc_book", ("documents", "rc_book")),
    ("front_photo", ("documents", "front_photo")),
    ("back_photo", ("documents", "back_photo")),
])
def test_regression_doc_type_routing(session, exchange_lead_id, dt, bucket_path):
    r = _upload(session, exchange_lead_id, dt, fname=f"{dt}.jpg")
    assert r.status_code == 200, r.text
    assert r.json()["doc_type"] == dt
    fid = r.json()["file_id"]
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    bucket = lead.get("exchange", {})
    for k in bucket_path:
        bucket = (bucket or {}).get(k) if isinstance(bucket, dict) else bucket
    assert fid in (bucket or []), f"{dt} -> {bucket_path} missing fid"


def test_regression_default_photo_bucket(session, exchange_lead_id):
    # No doc_type → falls into exchange.photos[] (backward compat)
    r = _upload(session, exchange_lead_id, None, fname="legacy.jpg")
    assert r.status_code == 200, r.text
    assert r.json()["doc_type"] == "photo"
    fid = r.json()["file_id"]
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    assert fid in (lead.get("exchange", {}).get("photos") or [])


def test_invalid_doc_type_falls_back_to_photo(session, exchange_lead_id):
    r = _upload(session, exchange_lead_id, "not_a_bucket", fname="x.jpg")
    assert r.status_code == 200, r.text
    assert r.json()["doc_type"] == "photo"
    fid = r.json()["file_id"]
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    assert fid in (lead.get("exchange", {}).get("photos") or [])


# ---------- (3) DELETE from any bucket (including other) ----------
def test_delete_from_other_bucket(session, exchange_lead_id):
    r = _upload(session, exchange_lead_id, "other", fname="todel.jpg")
    fid = r.json()["file_id"]
    dr = session.delete(f"{BASE_URL}/api/leads/{exchange_lead_id}/exchange-photos/{fid}", timeout=15)
    assert dr.status_code == 200
    assert dr.json().get("ok") is True
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    assert fid not in (lead.get("exchange", {}).get("documents", {}).get("other") or [])


def test_delete_from_aadhaar_bucket(session, exchange_lead_id):
    r = _upload(session, exchange_lead_id, "aadhaar", fname="adel.jpg")
    fid = r.json()["file_id"]
    dr = session.delete(f"{BASE_URL}/api/leads/{exchange_lead_id}/exchange-photos/{fid}", timeout=15)
    assert dr.status_code == 200 and dr.json().get("ok") is True
    lead = session.get(f"{BASE_URL}/api/leads/{exchange_lead_id}", timeout=15).json()
    assert fid not in (lead.get("exchange", {}).get("documents", {}).get("aadhaar") or [])


def test_delete_nonexistent_returns_ok_false(session, exchange_lead_id):
    dr = session.delete(f"{BASE_URL}/api/leads/{exchange_lead_id}/exchange-photos/nonexistent-xyz", timeout=15)
    assert dr.status_code == 200
    assert dr.json().get("ok") is False
