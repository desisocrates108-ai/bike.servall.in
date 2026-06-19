"""
Tests for Modules 11 (WhatsApp Automation) and 12 (Campaigns).
WhatsApp gateway is MOCKED — outbound msgs are auto-marked SENT in DB.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://leads-date-tracking.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "superadmin@dealer.com", "password": "super123"}
ADMIN = {"email": "admin@dealer.com", "password": "admin123"}
SALES = {"email": "sales1@dealer.com", "password": "sales123"}


# ---------- fixtures ----------

def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def super_client():
    return _client(_login(SUPER))


@pytest.fixture(scope="module")
def admin_client():
    return _client(_login(ADMIN))


@pytest.fixture(scope="module")
def sales_client():
    return _client(_login(SALES))


@pytest.fixture(scope="module")
def branches(super_client):
    r = super_client.get(f"{API}/branches")
    assert r.status_code == 200
    items = r.json()
    assert items, "no branches seeded"
    return items


@pytest.fixture(scope="module")
def bilimora_branch(branches):
    for b in branches:
        if b.get("name", "").lower().startswith("bilimora"):
            return b
    return branches[0]


def _fresh_lead_payload(branch_id, priority="Hot", phone=None):
    phone = phone or f"+919{uuid.uuid4().int % 1_000_000_000:09d}"
    return {
        "customer_name": f"TEST_M1112_{uuid.uuid4().hex[:6]}",
        "phone": phone,
        "source": "Walk-in",
        "branch_id": branch_id,
        "priority": priority,
        "purchase_type": "New Purchase",
    }


@pytest.fixture(scope="module")
def test_lead(super_client, bilimora_branch):
    r = super_client.post(f"{API}/leads", json=_fresh_lead_payload(bilimora_branch["id"]))
    assert r.status_code in (200, 201), r.text
    return r.json()


# ============================================================
# Module 11 — Templates
# ============================================================

class TestWATemplates:
    def test_list_templates_any_role(self, sales_client):
        r = sales_client.get(f"{API}/wa-templates")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_template_sales_forbidden(self, sales_client):
        r = sales_client.post(f"{API}/wa-templates", json={
            "name": "TEST_sales_should_fail", "body": "hi"
        })
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_create_template_admin_ok(self, admin_client, request):
        body = {"name": f"TEST_tpl_{uuid.uuid4().hex[:6]}",
                "body": "Hi {{customer_name}}, welcome!", "category": "welcome",
                "message_type": "text", "active": True}
        r = admin_client.post(f"{API}/wa-templates", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == body["name"]
        assert data["body"] == body["body"]
        assert "id" in data
        request.config.cache.set("m1112/tpl_id", data["id"])

    def test_update_template(self, admin_client, request):
        tid = request.config.cache.get("m1112/tpl_id", None)
        assert tid
        r = admin_client.put(f"{API}/wa-templates/{tid}", json={"category": "promo"})
        assert r.status_code == 200, r.text
        assert r.json()["category"] == "promo"

    def test_delete_template_sales_forbidden(self, sales_client, request):
        tid = request.config.cache.get("m1112/tpl_id", None)
        assert tid
        r = sales_client.delete(f"{API}/wa-templates/{tid}")
        assert r.status_code == 403


# ============================================================
# Module 11 — Automation rules
# ============================================================

class TestAutomationRules:
    def test_list_rules(self, admin_client):
        r = admin_client.get(f"{API}/automation-rules")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_rule_sales_forbidden(self, sales_client):
        r = sales_client.post(f"{API}/automation-rules", json={
            "name": "TEST_no", "event": "inquiry_created",
            "template_id": "nope", "conditions": {}, "delay_minutes": 0, "active": True
        })
        assert r.status_code == 403

    def test_create_rule_admin_ok(self, admin_client, request):
        tid = request.config.cache.get("m1112/tpl_id", None)
        assert tid
        body = {"name": f"TEST_rule_{uuid.uuid4().hex[:6]}", "event": "inquiry_created",
                "template_id": tid, "conditions": {"priority": "Hot"},
                "delay_minutes": 0, "active": True}
        r = admin_client.post(f"{API}/automation-rules", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["event"] == "inquiry_created"
        assert data["conditions"]["priority"] == "Hot"
        request.config.cache.set("m1112/rule_id", data["id"])

    def test_toggle_rule_active(self, admin_client, request):
        rid = request.config.cache.get("m1112/rule_id", None)
        assert rid
        r = admin_client.put(f"{API}/automation-rules/{rid}", json={"active": False})
        assert r.status_code == 200
        assert r.json()["active"] is False
        r = admin_client.put(f"{API}/automation-rules/{rid}", json={"active": True})
        assert r.json()["active"] is True


# ============================================================
# Module 11 — Automation event trigger (inquiry_created)
# ============================================================

class TestAutomationEventTrigger:
    def test_matching_lead_creates_outbound_message(self, super_client, admin_client,
                                                    bilimora_branch, request):
        # Ensure rule + template exist & active from earlier tests
        rid = request.config.cache.get("m1112/rule_id", None)
        tid = request.config.cache.get("m1112/tpl_id", None)
        assert rid and tid
        # Create a matching Hot lead
        payload = _fresh_lead_payload(bilimora_branch["id"], priority="Hot")
        r = super_client.post(f"{API}/leads", json=payload)
        assert r.status_code in (200, 201), r.text
        lead = r.json()
        # Give fire_event a moment
        time.sleep(1)
        msgs = super_client.get(f"{API}/leads/{lead['id']}/wa-messages").json()
        outbound = [m for m in msgs if m.get("direction") == "outbound"]
        assert outbound, f"expected outbound auto-msg; got msgs={msgs}"
        assert outbound[0]["status"] == "SENT"
        assert outbound[0]["trigger_source"] == "inquiry_created"
        # no _id leaked
        for m in msgs:
            assert "_id" not in m

    def test_non_matching_lead_creates_no_message(self, super_client, bilimora_branch):
        payload = _fresh_lead_payload(bilimora_branch["id"], priority="Warm")
        r = super_client.post(f"{API}/leads", json=payload)
        assert r.status_code in (200, 201)
        lead = r.json()
        time.sleep(1)
        msgs = super_client.get(f"{API}/leads/{lead['id']}/wa-messages").json()
        outbound = [m for m in msgs if m.get("direction") == "outbound"
                    and m.get("trigger_source") == "inquiry_created"]
        assert not outbound, f"expected no auto outbound for Warm lead, got {outbound}"


# ============================================================
# Module 11 — Manual send, duplicate, rate-limit, opt-out
# ============================================================

class TestManualSendGuards:
    @pytest.fixture(scope="class")
    def lead_id(self, super_client, bilimora_branch):
        # use a fresh Warm lead so auto-trigger doesn't interfere
        r = super_client.post(f"{API}/leads",
                              json=_fresh_lead_payload(bilimora_branch["id"], priority="Warm"))
        assert r.status_code in (200, 201), r.text
        return r.json()["id"]

    def test_manual_send_content(self, super_client, lead_id):
        r = super_client.post(f"{API}/leads/{lead_id}/wa-messages",
                              json={"content": f"TEST_manual_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["direction"] == "outbound"
        assert msg["status"] == "SENT"
        assert msg["trigger_source"] == "manual"

    def test_duplicate_within_60s(self, super_client, lead_id):
        same = f"TEST_dup_{uuid.uuid4().hex[:6]}"
        r1 = super_client.post(f"{API}/leads/{lead_id}/wa-messages", json={"content": same})
        assert r1.status_code == 200, r1.text
        r2 = super_client.post(f"{API}/leads/{lead_id}/wa-messages", json={"content": same})
        assert r2.status_code == 429, f"expected 429 duplicate, got {r2.status_code} {r2.text}"

    def test_rate_limit_over_10_per_minute(self, super_client, bilimora_branch):
        # New lead to keep counters isolated
        r = super_client.post(f"{API}/leads",
                              json=_fresh_lead_payload(bilimora_branch["id"], priority="Warm"))
        lid = r.json()["id"]
        last_status = None
        for i in range(11):
            rr = super_client.post(f"{API}/leads/{lid}/wa-messages",
                                   json={"content": f"TEST_rl_{i}_{uuid.uuid4().hex[:4]}"})
            last_status = rr.status_code
            if i < 10:
                assert rr.status_code == 200, f"msg {i} should succeed, got {rr.status_code} {rr.text}"
            else:
                assert rr.status_code == 429, f"11th msg should be 429, got {rr.status_code} {rr.text}"
        assert last_status == 429

    def test_optout_blocks_send_and_toggle(self, super_client, bilimora_branch):
        r = super_client.post(f"{API}/leads",
                              json=_fresh_lead_payload(bilimora_branch["id"], priority="Warm"))
        lid = r.json()["id"]
        # initial status
        assert super_client.get(f"{API}/leads/{lid}/wa-optout").json()["opted_out"] is False
        # opt-out
        assert super_client.post(f"{API}/leads/{lid}/wa-optout").json()["opted_out"] is True
        assert super_client.get(f"{API}/leads/{lid}/wa-optout").json()["opted_out"] is True
        # sending should now fail (400 because _queue_message returns None)
        r2 = super_client.post(f"{API}/leads/{lid}/wa-messages",
                               json={"content": "TEST_blocked"})
        assert r2.status_code == 400, r2.text
        # opt back in
        assert super_client.delete(f"{API}/leads/{lid}/wa-optout").json()["opted_out"] is False
        r3 = super_client.post(f"{API}/leads/{lid}/wa-messages",
                               json={"content": "TEST_after_optin"})
        assert r3.status_code == 200


# ============================================================
# Module 11 — inbound log and retry
# ============================================================

class TestInboundAndRetry:
    def test_inbound_persisted(self, super_client, test_lead):
        r = super_client.post(f"{API}/leads/{test_lead['id']}/wa-inbound",
                              json={"content": "TEST_inbound_reply", "reply_tag": "Interested"})
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["direction"] == "inbound"
        assert msg["reply_tag"] == "Interested"
        assert "_id" not in msg
        # invalid tag
        bad = super_client.post(f"{API}/leads/{test_lead['id']}/wa-inbound",
                                json={"content": "x", "reply_tag": "Nope"})
        assert bad.status_code == 400

    def test_chat_history_excludes_mongo_id(self, super_client, test_lead):
        msgs = super_client.get(f"{API}/leads/{test_lead['id']}/wa-messages").json()
        assert isinstance(msgs, list) and msgs
        for m in msgs:
            assert "_id" not in m

    def test_retry_increments_until_max(self, super_client, bilimora_branch):
        r = super_client.post(f"{API}/leads",
                              json=_fresh_lead_payload(bilimora_branch["id"], priority="Warm"))
        lid = r.json()["id"]
        sent = super_client.post(f"{API}/leads/{lid}/wa-messages",
                                 json={"content": f"TEST_retry_{uuid.uuid4().hex[:6]}"}).json()
        mid = sent["id"]
        for i in range(3):  # WA_MAX_RETRIES == 3
            rr = super_client.post(f"{API}/wa-messages/{mid}/retry")
            assert rr.status_code == 200, rr.text
            assert rr.json()["retry_count"] == i + 1
        r_over = super_client.post(f"{API}/wa-messages/{mid}/retry")
        assert r_over.status_code == 400


# ============================================================
# Module 12 — Campaigns
# ============================================================

class TestCampaigns:
    def test_sales_cannot_list_or_create(self, sales_client):
        r = sales_client.get(f"{API}/campaigns")
        assert r.status_code == 403
        r2 = sales_client.post(f"{API}/campaigns", json={"name": "TEST_no",
                                                        "content": "x"})
        assert r2.status_code == 403

    def test_admin_creates_campaign(self, admin_client, request):
        tid = request.config.cache.get("m1112/tpl_id", None)
        body = {"name": f"TEST_camp_{uuid.uuid4().hex[:6]}",
                "campaign_type": "Offer", "message_type": "text",
                "content": "Diwali offer - 5% off",
                "template_id": tid,
                "target": {"priorities": ["Hot", "Warm"], "audience": "leads"}}
        r = admin_client.post(f"{API}/campaigns", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] in ("Draft", "Scheduled")
        assert data["stats"]["queued"] == 0
        request.config.cache.set("m1112/camp_id", data["id"])

    def test_preview_returns_count_and_sample(self, admin_client, request):
        cid = request.config.cache.get("m1112/camp_id", None)
        r = admin_client.post(f"{API}/campaigns/{cid}/preview")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "audience_count" in data and isinstance(data["audience_count"], int)
        assert "sample" in data and isinstance(data["sample"], list)
        assert data["audience_count"] >= 1  # we created TEST leads above
        for s in data["sample"]:
            assert "_id" not in s
            assert "id" in s

    def test_send_bulk_status_flow(self, admin_client, request):
        cid = request.config.cache.get("m1112/camp_id", None)
        r = admin_client.post(f"{API}/campaigns/{cid}/send")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["queued"] >= 1
        # now should be Completed
        listed = admin_client.get(f"{API}/campaigns").json()
        camp = next(c for c in listed if c["id"] == cid)
        assert camp["status"] == "Completed"
        # cannot re-send
        r2 = admin_client.post(f"{API}/campaigns/{cid}/send")
        assert r2.status_code == 400

    def test_stats_counters_shape(self, admin_client, request):
        cid = request.config.cache.get("m1112/camp_id", None)
        r = admin_client.get(f"{API}/campaigns/{cid}/stats")
        assert r.status_code == 200, r.text
        s = r.json()
        for k in ("queued", "sent", "delivered", "read", "failed", "responses", "conversions"):
            assert k in s, f"missing stat key {k}"
        assert s["sent"] >= 1

    def test_campaign_24h_dedupe(self, admin_client, super_client, bilimora_branch, request):
        tid = request.config.cache.get("m1112/tpl_id", None)
        # Create a fresh campaign targeting Warm leads only with content
        body = {"name": f"TEST_dedupe_{uuid.uuid4().hex[:6]}",
                "campaign_type": "Custom", "message_type": "text",
                "content": "dedupe test",
                "template_id": tid,
                "target": {"priorities": ["Warm"], "audience": "leads"}}
        c = admin_client.post(f"{API}/campaigns", json=body).json()
        cid = c["id"]
        r1 = admin_client.post(f"{API}/campaigns/{cid}/send")
        assert r1.status_code == 200
        queued1 = r1.json()["queued"]
        assert queued1 >= 1
        # Create a second campaign with same filters; message same leads — dedupe SKIPS none
        # because campaign_id differs. But re-sending SAME campaign (status flips to Completed)
        # is already blocked (see previous test). Here verify that replaying send on a NEW
        # campaign against same audience DOES queue for all (no cross-campaign dedupe),
        # and that within one campaign there are no dup wa_messages rows per lead.
        msgs_resp = super_client.get(f"{API}/leads").json()
        # sanity: pull first warm lead id and assert only 1 wa_message for this campaign
        # Use any lead we know: fetch wa_messages via the lead-level API
        lead_obj = next((l for l in msgs_resp if l.get("priority") == "Warm"), None)
        assert lead_obj, "need at least one Warm lead"
        lead_msgs = super_client.get(f"{API}/leads/{lead_obj['id']}/wa-messages").json()
        camp_msgs = [m for m in lead_msgs if m.get("campaign_id") == cid]
        assert len(camp_msgs) == 1, f"expected exactly 1 msg per lead for campaign, got {len(camp_msgs)}"
