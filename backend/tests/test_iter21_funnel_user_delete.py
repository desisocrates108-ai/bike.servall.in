"""
Iteration 21 backend tests:
- /constants stages = exactly 8-stage list
- DELETE /users/{id} (super_admin) on different user → 200 ok
- DELETE /users/{id} (super_admin) on SELF → 400
- DELETE /users/{id} (branch admin) → 403
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SUPER_EMAIL = "superadmin@dealer.com"
SUPER_PASS = "super123"

EXPECTED_STAGES = ["Inquiry", "Follow-up", "Hold", "Booking", "Delivery",
                   "Allotment", "Feedback", "Lost"]


@pytest.fixture(scope="session")
def super_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASS}, timeout=30)
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    if tok:
        s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="session")
def super_me(super_session):
    r = super_session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 200
    return r.json()


def _phone():
    return f"9{uuid.uuid4().int % 10**9:09d}"


# ----------------------------------------------------------------------------
# 1. /constants — stages must equal exactly the 8-stage new list
# ----------------------------------------------------------------------------
class TestConstantsStages:
    def test_stages_is_exact_8_list(self, super_session):
        r = super_session.get(f"{API}/constants", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        stages = data.get("stages")
        assert stages == EXPECTED_STAGES, f"stages mismatch. got={stages}"
        # Make sure old removed stages are NOT present
        for old in ["Interest", "Test Ride", "Deal", "Registration", "RTO", "Delivered"]:
            assert old not in stages, f"legacy stage '{old}' should not be in /constants stages"


# ----------------------------------------------------------------------------
# 2. DELETE /users/{id}
# ----------------------------------------------------------------------------
class TestDeleteUser:
    def test_super_admin_delete_other_user_succeeds(self, super_session):
        # create temp sales_executive
        # need a branch_id
        branches = super_session.get(f"{API}/branches", timeout=30).json()
        branch_id = branches[0]["id"] if branches else None
        payload = {
            "email": f"TEST_Iter21_{uuid.uuid4().hex[:8]}@dealer.com",
            "password": "test1234",
            "name": f"TEST_Iter21 SE {uuid.uuid4().hex[:6]}",
            "phone": _phone(),
            "role": "sales_executive",
            "branch_id": branch_id,
        }
        r = super_session.post(f"{API}/users", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        new_uid = r.json()["id"]

        # delete it
        d = super_session.delete(f"{API}/users/{new_uid}", timeout=30)
        assert d.status_code == 200, d.text
        body = d.json()
        assert body.get("ok") is True, f"expected ok:true, got {body}"

        # verify it's gone from /api/users list
        listing = super_session.get(f"{API}/users", timeout=30).json()
        ids = [u["id"] for u in listing]
        assert new_uid not in ids, f"deleted user {new_uid} still in /api/users list"

    def test_super_admin_cannot_delete_self(self, super_session, super_me):
        d = super_session.delete(f"{API}/users/{super_me['id']}", timeout=30)
        assert d.status_code == 400, f"expected 400 self-delete, got {d.status_code}: {d.text}"
        detail = (d.json() or {}).get("detail", "")
        assert "Cannot delete yourself" in detail, f"unexpected detail: {detail}"

        # make sure self still exists
        me2 = super_session.get(f"{API}/auth/me", timeout=30)
        assert me2.status_code == 200
        assert me2.json().get("id") == super_me["id"]

    def test_branch_admin_delete_returns_403(self, super_session):
        # create temp branch admin
        branches = super_session.get(f"{API}/branches", timeout=30).json()
        branch_id = branches[0]["id"] if branches else None
        admin_email = f"TEST_Iter21_admin_{uuid.uuid4().hex[:8]}@dealer.com"
        admin_pass = "admin1234"
        payload = {
            "email": admin_email,
            "password": admin_pass,
            "name": f"TEST_Iter21 Admin {uuid.uuid4().hex[:6]}",
            "phone": _phone(),
            "role": "admin",
            "branch_id": branch_id,
        }
        r = super_session.post(f"{API}/users", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        admin_uid = r.json()["id"]

        # create a sales_executive that the admin will try to delete
        se_payload = {
            "email": f"TEST_Iter21_se_{uuid.uuid4().hex[:8]}@dealer.com",
            "password": "test1234",
            "name": f"TEST_Iter21 SE {uuid.uuid4().hex[:6]}",
            "phone": _phone(),
            "role": "sales_executive",
            "branch_id": branch_id,
        }
        rs = super_session.post(f"{API}/users", json=se_payload, timeout=30)
        assert rs.status_code == 200, rs.text
        se_uid = rs.json()["id"]

        # login as admin (separate session)
        admin_sess = requests.Session()
        lr = admin_sess.post(f"{API}/auth/login", json={"email": admin_email, "password": admin_pass}, timeout=30)
        assert lr.status_code == 200, lr.text
        atok = lr.json().get("access_token")
        if atok:
            admin_sess.headers.update({"Authorization": f"Bearer {atok}"})

        # admin attempts delete → 403
        d = admin_sess.delete(f"{API}/users/{se_uid}", timeout=30)
        assert d.status_code == 403, f"expected 403, got {d.status_code}: {d.text}"

        # cleanup — super deletes both
        super_session.delete(f"{API}/users/{se_uid}", timeout=30)
        super_session.delete(f"{API}/users/{admin_uid}", timeout=30)


# ----------------------------------------------------------------------------
# 3. Cleanup — direct mongo delete_many on TEST_Iter21 prefix
# ----------------------------------------------------------------------------
class TestZCleanup:
    def test_cleanup_test_iter21_users(self, super_session):
        try:
            from pymongo import MongoClient
            mongo_url = os.environ["MONGO_URL"]
            db_name = os.environ["DB_NAME"]
            client = MongoClient(mongo_url)
            db = client[db_name]
            r1 = db.users.delete_many({"name": {"$regex": "^TEST_Iter21"}})
            r2 = db.users.delete_many({"email": {"$regex": "^TEST_Iter21"}})
            print(f"cleanup deleted users by name={r1.deleted_count} email={r2.deleted_count}")
            client.close()
        except Exception as e:
            print(f"mongo cleanup failed: {e}")
        assert True
