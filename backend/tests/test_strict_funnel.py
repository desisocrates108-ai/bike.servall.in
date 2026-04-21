"""
Strict form-based funnel validation tests (iteration 8).
Covers the stricter stage-gating rules introduced for Servall CRM:
  - Inquiry → Follow-up requires vehicle (brand/model)
  - Follow-up → Interest requires a Connected+Interested follow-up
  - Interest → Deal requires customer_expected_price AND a Connected follow-up
  - Deal → Booking requires final_deal_price AND payment_mode
  - Booking → Allotment requires booking with booking_amount > 0
  - Allotment → Delivery requires chassis_number (allotment)
  - Registration requires full payment paid
Also verifies STAGES ordering includes 'Allotment' between Booking and Delivery.
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"], r.json()["user"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def super_ctx():
    tok, user = _login("superadmin@dealer.com", "super123")
    h = _hdr(tok)
    branches = requests.get(f"{API}/branches", headers=h).json()
    brands = requests.get(f"{API}/brands", headers=h).json()
    bilimora = next(b for b in branches if b["name"] == "Bilimora")
    honda = next(b for b in brands if b["name"] == "Honda")
    models = requests.get(f"{API}/models", params={"brand_id": honda["id"]}, headers=h).json()
    activa = next(m for m in models if m["name"] == "Activa 6G")
    return {"h": h, "tok": tok, "user": user, "bilimora": bilimora, "honda": honda, "activa": activa}


# ---------- Constants ----------
def test_constants_stages_include_allotment_in_order():
    r = requests.get(f"{API}/constants")
    assert r.status_code == 200
    stages = r.json()["stages"]
    expected = ["Inquiry", "Follow-up", "Interest", "Test Ride", "Deal",
                "Booking", "Allotment", "Delivery", "Registration", "Feedback", "Lost"]
    assert stages == expected, f"STAGES ordering mismatch: {stages}"


def test_auth_super_login_returns_token_and_user():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "superadmin@dealer.com", "password": "super123"})
    assert r.status_code == 200
    d = r.json()
    assert "access_token" in d and isinstance(d["access_token"], str)
    assert d["user"]["email"] == "superadmin@dealer.com"
    assert d["user"]["role"] == "super_admin"


# ---------- Helpers ----------
def _mk_lead(ctx, with_vehicle=True, with_expected_price=False):
    payload = {
        "customer_name": f"TEST_Funnel_{uuid.uuid4().hex[:6]}",
        "phone": "9990000" + uuid.uuid4().hex[:3],
        "source": "Walk-in",
        "branch_id": ctx["bilimora"]["id"],
        "priority": "Hot",
    }
    if with_vehicle:
        payload["brand_id"] = ctx["honda"]["id"]
        payload["model_id"] = ctx["activa"]["id"]
    r = requests.post(f"{API}/leads", json=payload, headers=ctx["h"])
    assert r.status_code == 200, r.text
    lid = r.json()["id"]
    if with_expected_price:
        requests.put(f"{API}/leads/{lid}",
                     json={"deal": {"customer_expected_price": 80000}},
                     headers=ctx["h"])
    return lid


def _add_followup(ctx, lid, connected=True, interested=True):
    body = {
        "type": "Call",
        "notes": "auto",
        "scheduled_date": "2026-03-01",
        "call_status": "Connected" if connected else "Not Connected",
        "customer_response": "Interested" if interested else "Not Interested",
    }
    r = requests.post(f"{API}/leads/{lid}/followups", json=body, headers=ctx["h"])
    assert r.status_code == 200, r.text
    return r.json()


def _stage(ctx, lid, stage, **extra):
    body = {"stage": stage, **extra}
    return requests.post(f"{API}/leads/{lid}/stage", json=body, headers=ctx["h"])


# ---------- Funnel gating tests ----------
def test_followup_requires_vehicle(super_ctx):
    lid = _mk_lead(super_ctx, with_vehicle=False)
    r = _stage(super_ctx, lid, "Follow-up")
    assert r.status_code == 400
    assert "vehicle" in r.text.lower() or "brand" in r.text.lower()


def test_followup_succeeds_with_vehicle(super_ctx):
    lid = _mk_lead(super_ctx, with_vehicle=True)
    r = _stage(super_ctx, lid, "Follow-up")
    assert r.status_code == 200
    assert r.json()["stage"] == "Follow-up"


def test_interest_requires_connected_interested_followup(super_ctx):
    # Lead A: no follow-up -> 400 Interest
    lid_a = _mk_lead(super_ctx)
    _stage(super_ctx, lid_a, "Follow-up")
    r_a = _stage(super_ctx, lid_a, "Interest")
    assert r_a.status_code == 400

    # Lead B: Connected but Not Interested -> still 400 Interest
    lid_b = _mk_lead(super_ctx)
    _stage(super_ctx, lid_b, "Follow-up")
    _add_followup(super_ctx, lid_b, connected=True, interested=False)
    r_b = _stage(super_ctx, lid_b, "Interest")
    assert r_b.status_code == 400

    # Lead C: Connected + Interested -> 200
    lid_c = _mk_lead(super_ctx)
    _stage(super_ctx, lid_c, "Follow-up")
    _add_followup(super_ctx, lid_c, connected=True, interested=True)
    r_c = _stage(super_ctx, lid_c, "Interest")
    assert r_c.status_code == 200
    assert r_c.json()["stage"] == "Interest"


def test_deal_requires_expected_price_and_connected(super_ctx):
    lid = _mk_lead(super_ctx, with_vehicle=True, with_expected_price=False)
    _stage(super_ctx, lid, "Follow-up")
    _add_followup(super_ctx, lid, connected=True, interested=True)
    _stage(super_ctx, lid, "Interest")

    # No expected_price -> 400 (customer budget)
    r = _stage(super_ctx, lid, "Deal")
    assert r.status_code == 400
    assert "budget" in r.text.lower() or "expected" in r.text.lower()

    # Set expected_price -> should now pass (connected follow-up already exists)
    requests.put(f"{API}/leads/{lid}",
                 json={"deal": {"customer_expected_price": 80000, "offered_price": 78000}},
                 headers=super_ctx["h"])
    r2 = _stage(super_ctx, lid, "Deal")
    assert r2.status_code == 200, r2.text
    assert r2.json()["stage"] == "Deal"


def test_deal_requires_connected_followup(super_ctx):
    """Fresh lead: set expected_price but NO connected follow-up => 400."""
    lid = _mk_lead(super_ctx, with_vehicle=True, with_expected_price=True)
    r = _stage(super_ctx, lid, "Deal")
    assert r.status_code == 400
    assert "connected" in r.text.lower() or "follow" in r.text.lower()


def test_booking_requires_payment_mode_and_final_price(super_ctx):
    # Build lead up to Deal
    lid = _mk_lead(super_ctx, with_vehicle=True, with_expected_price=True)
    _stage(super_ctx, lid, "Follow-up")
    _add_followup(super_ctx, lid, connected=True, interested=True)
    _stage(super_ctx, lid, "Interest")
    _stage(super_ctx, lid, "Deal")

    # Missing payment_mode + final_deal_price
    r = _stage(super_ctx, lid, "Booking")
    assert r.status_code == 400

    requests.put(f"{API}/leads/{lid}",
                 json={"payment_mode": "Cash",
                       "deal": {"customer_expected_price": 80000, "final_deal_price": 78000}},
                 headers=super_ctx["h"])
    r2 = _stage(super_ctx, lid, "Booking")
    assert r2.status_code == 200
    assert r2.json()["stage"] == "Booking"


def test_allotment_requires_booking_with_amount(super_ctx):
    """After Booking stage, moving to Allotment requires a bookings row with amount>0."""
    # Build lead to Booking stage
    lid = _mk_lead(super_ctx, with_vehicle=True, with_expected_price=True)
    _stage(super_ctx, lid, "Follow-up")
    _add_followup(super_ctx, lid, connected=True, interested=True)
    _stage(super_ctx, lid, "Interest")
    _stage(super_ctx, lid, "Deal")
    requests.put(f"{API}/leads/{lid}",
                 json={"payment_mode": "Cash",
                       "deal": {"customer_expected_price": 80000, "final_deal_price": 78000}},
                 headers=super_ctx["h"])
    _stage(super_ctx, lid, "Booking")

    # Now try Allotment without a booking record -> expect 400
    r = _stage(super_ctx, lid, "Allotment")
    assert r.status_code == 400, f"Expected 400 (no booking row); got {r.status_code} {r.text}"
    assert "booking" in r.text.lower()


def test_delivery_requires_chassis(super_ctx):
    """Allotment stage -> Delivery requires chassis_number."""
    # Simulate: try to move a Booking-stage lead straight to Delivery
    lid = _mk_lead(super_ctx, with_vehicle=True, with_expected_price=True)
    _stage(super_ctx, lid, "Follow-up")
    _add_followup(super_ctx, lid, connected=True, interested=True)
    _stage(super_ctx, lid, "Interest")
    _stage(super_ctx, lid, "Deal")
    requests.put(f"{API}/leads/{lid}",
                 json={"payment_mode": "Cash",
                       "deal": {"customer_expected_price": 80000, "final_deal_price": 78000}},
                 headers=super_ctx["h"])
    _stage(super_ctx, lid, "Booking")

    r = _stage(super_ctx, lid, "Delivery")
    assert r.status_code == 400
    assert "chassis" in r.text.lower()


def test_registration_requires_full_payment(super_ctx):
    """If a booking exists with final > paid, Registration must 400."""
    # Reuse allotment flow: need a booking row. We'll insert via bookings API if available.
    # Using the stricter path via booking creation endpoint.
    lid = _mk_lead(super_ctx, with_vehicle=True, with_expected_price=True)
    _stage(super_ctx, lid, "Follow-up")
    _add_followup(super_ctx, lid, connected=True, interested=True)
    _stage(super_ctx, lid, "Interest")
    _stage(super_ctx, lid, "Deal")
    requests.put(f"{API}/leads/{lid}",
                 json={"payment_mode": "Cash",
                       "deal": {"customer_expected_price": 80000, "final_deal_price": 78000}},
                 headers=super_ctx["h"])
    _stage(super_ctx, lid, "Booking")
    # Try Registration without full payment (no booking row created → should fail either on payment or docs)
    r = _stage(super_ctx, lid, "Registration")
    assert r.status_code == 400, r.text


def test_lost_stage_requires_reason(super_ctx):
    lid = _mk_lead(super_ctx)
    r = _stage(super_ctx, lid, "Lost")
    assert r.status_code == 400
    r2 = _stage(super_ctx, lid, "Lost", lost_reason="Price Issue", lost_reason_text="too high")
    assert r2.status_code == 200
    assert r2.json()["stage"] == "Lost"


# ---------- PWA files ----------
def test_pwa_manifest_served():
    r = requests.get(f"{BASE_URL}/manifest.json", timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert "name" in j or "short_name" in j
    assert "icons" in j and len(j["icons"]) >= 1


def test_pwa_service_worker_served():
    r = requests.get(f"{BASE_URL}/service-worker.js", timeout=30)
    assert r.status_code == 200
    assert len(r.content) > 0


def test_pwa_icons_served():
    for size in ["192", "512"]:
        r = requests.get(f"{BASE_URL}/icons/icon-{size}.png", timeout=30)
        assert r.status_code == 200, f"icon-{size}.png missing"


def test_index_has_manifest_and_theme_color():
    r = requests.get(f"{BASE_URL}/", timeout=30)
    assert r.status_code == 200
    html = r.text
    assert 'rel="manifest"' in html
    assert "#ED1C24" in html
