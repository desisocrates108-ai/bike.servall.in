"""Iteration 11 compliance tests:
- 5 branches seeded (Bilimora, Chikhli, Amalsad, Vansda, Gandevi)
- Default WA templates: Inquiry — send catalog, Delivery — thank you, Feedback — request
- Default automation rules: inquiry_created, delivery_completed, feedback_reminder
- Followup accepts call_recording_url/filename/call_duration
- Lead PUT persists registration object with status/rto/number_allotted/plate_fitted/…
"""
import os
import pytest
import requests
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@dealer.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def super_token():
    r = requests.post(f"{API}/auth/login", json={"email": "superadmin@dealer.com", "password": "super123"})
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- seed: branches ----
def test_branches_has_5_expected(admin_token):
    r = requests.get(f"{API}/branches", headers=h(admin_token))
    assert r.status_code == 200, r.text
    names = {b.get("name") for b in r.json()}
    expected = {"Bilimora", "Chikhli", "Amalsad", "Vansda", "Gandevi"}
    missing = expected - names
    assert not missing, f"Missing branches: {missing}. Found: {names}"


# ---- seed: WA templates ----
def test_wa_templates_defaults(admin_token):
    r = requests.get(f"{API}/wa-templates", headers=h(admin_token))
    assert r.status_code == 200, r.text
    names = {t.get("name") for t in r.json()}
    expected = {"Inquiry — send catalog", "Delivery — thank you", "Feedback — request"}
    missing = expected - names
    assert not missing, f"Missing WA templates: {missing}. Found: {names}"


# ---- seed: automation rules ----
def test_automation_rules_defaults(admin_token):
    r = requests.get(f"{API}/automation-rules", headers=h(admin_token))
    assert r.status_code == 200, r.text
    events = {rule.get("event") or rule.get("trigger_event") or rule.get("trigger") for rule in r.json()}
    expected = {"inquiry_created", "delivery_completed", "feedback_reminder"}
    missing = expected - events
    assert not missing, f"Missing automation rule events: {missing}. Found: {events}"


# ---- followup: call recording fields ----
def test_followup_call_recording_fields(admin_token):
    # Pick any lead visible to admin
    lr = requests.get(f"{API}/leads", headers=h(admin_token))
    assert lr.status_code == 200
    leads = lr.json()
    assert leads, "no leads to attach followup"
    lid = leads[0]["id"]
    body = {
        "type": "Call",
        "notes": "TEST_iter11_call",
        "scheduled_date": "2026-06-01",
        "call_recording_url": "https://example.com/r.mp3",
        "call_recording_filename": "r.mp3",
        "call_duration": 120,
    }
    r = requests.post(f"{API}/leads/{lid}/followups", headers=h(admin_token), json=body)
    assert r.status_code in (200, 201), r.text
    data = r.json()
    assert data.get("call_recording_url") == "https://example.com/r.mp3", data
    assert data.get("call_recording_filename") == "r.mp3", data
    assert data.get("call_duration") == 120, data


# ---- lead registration PUT/GET round-trip ----
def test_lead_registration_put_get(admin_token):
    lr = requests.get(f"{API}/leads", headers=h(admin_token))
    lid = lr.json()[0]["id"]
    reg = {
        "status": "Allotted",
        "number_allotted": "GJ-15-AB-1234",
        "rto_office": "Valsad RTO",
        "plate_fitted": False,
    }
    r = requests.put(f"{API}/leads/{lid}", headers=h(admin_token), json={"registration": reg})
    assert r.status_code == 200, r.text
    g = requests.get(f"{API}/leads/{lid}", headers=h(admin_token))
    assert g.status_code == 200, g.text
    got = g.json().get("registration") or {}
    assert got.get("status") == "Allotted", got
    assert got.get("number_allotted") == "GJ-15-AB-1234", got
    assert got.get("rto_office") == "Valsad RTO", got
    assert got.get("plate_fitted") is False, got


# ---- PWA sanity ----
def test_pwa_manifest_200():
    r = requests.get(f"{BASE_URL}/manifest.json")
    assert r.status_code == 200


def test_pwa_service_worker_200():
    r = requests.get(f"{BASE_URL}/service-worker.js")
    assert r.status_code == 200
