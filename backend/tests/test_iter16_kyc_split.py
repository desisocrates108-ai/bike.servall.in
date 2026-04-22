"""
Iteration-16 — Unified KYC + Exchange documents tests.
Covers:
- Identity buckets (aadhaar/aadhaar_back/other) → lead.identity_docs.<bucket>[]
- Exchange buckets (rc_front/rc_back/rc_pdf/front_photo/back_photo) → lead.exchange.documents.<bucket>[]
- Stage gating: KYC required past Inquiry; Lost/Inquiry always allowed; Exchange needs RC + photos too
- DELETE endpoint scans identity_docs + exchange.documents + exchange.photos transparently
- Switching Exchange→New Purchase wipes lead.exchange but preserves identity_docs
"""
import io
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "superadmin@dealer.com", "password": "super123"}


# --------------------- helpers ---------------------
def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def jpg_bytes():
    # Minimal 1x1 JPEG (cleanly hex-encoded)
    hex_str = (
        "ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707"
        "07090908"
        "0a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837"
        "292c30313434341f27393d38323c2e333432ffc0000b08000100010101110000ff"
        "c4001f0000010501010101010100000000000000000102030405060708090a0bff"
        "c400b5100002010303020403050504040000017d01020300041105122131410613"
        "516107227114328191a1082342b1c11552d1f02433627282090a161718191a2526"
        "2728292a3435363738393a434445464748494a535455565758595a636465666768"
        "696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7"
        "a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3"
        "e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda0008010100003f00fbd0a28a280a"
        "ffd9"
    )
    return bytes.fromhex(hex_str)


def pdf_bytes():
    return b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


_BRANCH_CACHE = {"id": None}


def get_branch_id(tok):
    if _BRANCH_CACHE["id"]:
        return _BRANCH_CACHE["id"]
    r = requests.get(f"{API}/branches", headers=H(tok), timeout=20)
    if r.status_code == 200:
        items = r.json()
        if items:
            _BRANCH_CACHE["id"] = items[0]["id"]
            return _BRANCH_CACHE["id"]
    consts = requests.get(f"{API}/constants", headers=H(tok), timeout=20).json()
    branches = consts.get("branches") or []
    if branches:
        _BRANCH_CACHE["id"] = branches[0]["id"]
    return _BRANCH_CACHE["id"]


def create_lead(tok, purchase_type="New Purchase", suffix=""):
    body = {
        "customer_name": f"TEST_IT16_{purchase_type[:3]}_{suffix or uuid.uuid4().hex[:6]}",
        "phone": "9" + str(uuid.uuid4().int)[:9],
        "purchase_type": purchase_type,
        "source": "Walk-in",
        "branch_id": get_branch_id(tok),
    }
    r = requests.post(f"{API}/leads", headers=H(tok), json=body, timeout=20)
    assert r.status_code in (200, 201), r.text
    return r.json()


def upload(tok, lid, doc_type, content=None, fname=None, ctype="image/jpeg"):
    content = content or jpg_bytes()
    fname = fname or f"{doc_type}.jpg"
    r = requests.post(
        f"{API}/leads/{lid}/exchange-photos",
        headers=H(tok),
        params={"doc_type": doc_type},
        files={"file": (fname, content, ctype)},
        timeout=30,
    )
    return r


def get_lead(tok, lid):
    r = requests.get(f"{API}/leads/{lid}", headers=H(tok), timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


def stage(tok, lid, st, **extra):
    body = {"stage": st, **extra}
    return requests.post(f"{API}/leads/{lid}/stage", headers=H(tok), json=body, timeout=20)


# --------------------- fixtures ---------------------
@pytest.fixture(scope="module")
def tok():
    return login(SUPER["email"], SUPER["password"])


# --------------------- IDENTITY upload routing ---------------------
class TestIdentityRouting:
    def test_aadhaar_routes_to_identity_docs(self, tok):
        lead = create_lead(tok, "New Purchase", "id1")
        lid = lead["id"]
        r = upload(tok, lid, "aadhaar")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["doc_type"] == "aadhaar"
        assert body["identity_docs"].get("aadhaar"), body
        # Persisted at top-level
        fresh = get_lead(tok, lid)
        assert len(fresh.get("identity_docs", {}).get("aadhaar", [])) == 1
        assert "aadhaar" not in (fresh.get("exchange") or {}).get("documents", {})

    def test_aadhaar_back_routes_to_identity_docs(self, tok):
        lead = create_lead(tok, "New Purchase", "id2")
        lid = lead["id"]
        r = upload(tok, lid, "aadhaar_back")
        assert r.status_code == 200, r.text
        fresh = get_lead(tok, lid)
        assert len(fresh.get("identity_docs", {}).get("aadhaar_back", [])) == 1

    def test_other_routes_to_identity_docs(self, tok):
        lead = create_lead(tok, "Exchange Vehicle", "id3")
        lid = lead["id"]
        r = upload(tok, lid, "other", content=pdf_bytes(), fname="x.pdf", ctype="application/pdf")
        assert r.status_code == 200
        fresh = get_lead(tok, lid)
        assert len(fresh.get("identity_docs", {}).get("other", [])) == 1
        # NOT under exchange.documents
        assert "other" not in (fresh.get("exchange") or {}).get("documents", {})


# --------------------- EXCHANGE doc routing ---------------------
class TestExchangeRouting:
    @pytest.mark.parametrize("dt", ["rc_front", "rc_back", "front_photo", "back_photo"])
    def test_exchange_doc_buckets(self, tok, dt):
        lead = create_lead(tok, "Exchange Vehicle", f"ex_{dt}")
        lid = lead["id"]
        r = upload(tok, lid, dt)
        assert r.status_code == 200, r.text
        fresh = get_lead(tok, lid)
        docs = (fresh.get("exchange") or {}).get("documents") or {}
        assert len(docs.get(dt, [])) == 1, f"{dt} bucket missing → {docs}"

    def test_rc_pdf_bucket(self, tok):
        lead = create_lead(tok, "Exchange Vehicle", "rcpdf")
        lid = lead["id"]
        r = upload(tok, lid, "rc_pdf", content=pdf_bytes(), fname="rc.pdf", ctype="application/pdf")
        assert r.status_code == 200
        fresh = get_lead(tok, lid)
        assert len((fresh["exchange"]["documents"]).get("rc_pdf", [])) == 1


# --------------------- DELETE transparent ---------------------
class TestDeleteTransparent:
    def test_delete_from_identity(self, tok):
        lead = create_lead(tok, "New Purchase", "del1")
        lid = lead["id"]
        fid = upload(tok, lid, "aadhaar").json()["file_id"]
        r = requests.delete(f"{API}/leads/{lid}/exchange-photos/{fid}", headers=H(tok), timeout=20)
        assert r.status_code == 200, r.text
        fresh = get_lead(tok, lid)
        assert fid not in fresh.get("identity_docs", {}).get("aadhaar", [])

    def test_delete_from_exchange_docs(self, tok):
        lead = create_lead(tok, "Exchange Vehicle", "del2")
        lid = lead["id"]
        fid = upload(tok, lid, "rc_front").json()["file_id"]
        r = requests.delete(f"{API}/leads/{lid}/exchange-photos/{fid}", headers=H(tok), timeout=20)
        assert r.status_code == 200
        fresh = get_lead(tok, lid)
        assert fid not in (fresh.get("exchange") or {}).get("documents", {}).get("rc_front", [])


# --------------------- Stage gating ---------------------
class TestStageGate:
    def test_inquiry_to_lost_no_kyc(self, tok):
        lead = create_lead(tok, "New Purchase", "stl")
        lid = lead["id"]
        r = stage(tok, lid, "Lost", lost_reason="Price too high")
        assert r.status_code == 200, r.text

    def test_inquiry_stage_no_kyc(self, tok):
        lead = create_lead(tok, "New Purchase", "stinq")
        lid = lead["id"]
        r = stage(tok, lid, "Inquiry")
        assert r.status_code == 200, r.text

    def test_followup_blocked_no_kyc(self, tok):
        lead = create_lead(tok, "New Purchase", "stf1")
        lid = lead["id"]
        r = stage(tok, lid, "Follow-up")
        assert r.status_code == 400, r.text
        msg = r.json().get("detail", "")
        assert "KYC" in msg or "Aadhaar" in msg
        assert "Aadhaar Front" in msg
        assert "Aadhaar Back" in msg

    def test_followup_blocked_only_back_missing(self, tok):
        lead = create_lead(tok, "New Purchase", "stf2")
        lid = lead["id"]
        upload(tok, lid, "aadhaar")
        r = stage(tok, lid, "Follow-up")
        assert r.status_code == 400
        msg = r.json()["detail"]
        assert "Aadhaar Back" in msg
        assert "Aadhaar Front" not in msg

    def test_followup_passes_with_full_kyc_new(self, tok):
        # Need name + phone + brand/model — use existing brand from constants
        lead = create_lead(tok, "New Purchase", "stf3")
        lid = lead["id"]
        upload(tok, lid, "aadhaar")
        upload(tok, lid, "aadhaar_back")
        # Need brand_id for Follow-up
        brands = requests.get(f"{API}/brands", headers=H(tok), timeout=20).json()
        assert brands, "no brands seeded"
        pr = requests.put(f"{API}/leads/{lid}", headers=H(tok),
                          json={"brand_id": brands[0]["id"]}, timeout=20)
        assert pr.status_code == 200, pr.text
        r = stage(tok, lid, "Follow-up")
        assert r.status_code == 200, r.text

    def test_exchange_followup_blocked_missing_rc(self, tok):
        lead = create_lead(tok, "Exchange Vehicle", "stex1")
        lid = lead["id"]
        upload(tok, lid, "aadhaar")
        upload(tok, lid, "aadhaar_back")
        constants = requests.get(f"{API}/constants", headers=H(tok), timeout=20).json()
        brands = constants.get("brands") or []
        if brands:
            requests.put(f"{API}/leads/{lid}", headers=H(tok),
                         json={"brand_id": brands[0]["id"]}, timeout=20)
        r = stage(tok, lid, "Follow-up")
        assert r.status_code == 400, r.text
        msg = r.json()["detail"]
        assert "Exchange Vehicle requires" in msg
        for need in ["RC Front", "RC Back", "Vehicle Front Photo", "Vehicle Back Photo"]:
            assert need in msg, f"missing '{need}' in msg: {msg}"

    def test_exchange_followup_passes_full(self, tok):
        lead = create_lead(tok, "Exchange Vehicle", "stex2")
        lid = lead["id"]
        for dt in ("aadhaar", "aadhaar_back"):
            upload(tok, lid, dt)
        for dt in ("rc_front", "rc_back", "front_photo", "back_photo"):
            upload(tok, lid, dt)
        brands = requests.get(f"{API}/brands", headers=H(tok), timeout=20).json()
        assert brands, "no brands seeded"
        pr = requests.put(f"{API}/leads/{lid}", headers=H(tok),
                          json={"brand_id": brands[0]["id"]}, timeout=20)
        assert pr.status_code == 200, pr.text
        r = stage(tok, lid, "Follow-up")
        assert r.status_code == 200, r.text


# --------------------- Switch Exchange → New Purchase ---------------------
class TestPurchaseTypeSwitch:
    def test_switch_wipes_exchange_keeps_identity(self, tok):
        lead = create_lead(tok, "Exchange Vehicle", "sw1")
        lid = lead["id"]
        upload(tok, lid, "aadhaar")
        upload(tok, lid, "aadhaar_back")
        upload(tok, lid, "rc_front")
        upload(tok, lid, "front_photo")
        before = get_lead(tok, lid)
        assert before.get("exchange") is not None
        assert before.get("exchange", {}).get("documents", {}).get("rc_front")

        r = requests.put(f"{API}/leads/{lid}", headers=H(tok),
                         json={"purchase_type": "New Purchase"}, timeout=20)
        assert r.status_code == 200, r.text
        after = get_lead(tok, lid)
        assert after.get("purchase_type") == "New Purchase"
        # exchange wiped
        assert after.get("exchange") in (None, {}, {"documents": {}, "photos": []}), after.get("exchange")
        # identity preserved
        assert len(after.get("identity_docs", {}).get("aadhaar", [])) == 1
        assert len(after.get("identity_docs", {}).get("aadhaar_back", [])) == 1
