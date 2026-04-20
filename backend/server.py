from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
import uuid
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any, Dict

from fastapi import (
    FastAPI, APIRouter, Depends, HTTPException, Request, Response,
    UploadFile, File, Form, Query, Header
)
from fastapi.responses import Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ============================================================
# Config
# ============================================================

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = "twowheeler-crm"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Two-Wheeler Dealership CRM")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("crm")

# ============================================================
# Constants
# ============================================================

LEAD_SOURCES = ["Walk-in", "Tele-in", "Digital Marketing", "Social Media",
                "WhatsApp", "Email", "Referral", "Offline", "Cold Calling"]
PRIORITIES = ["Hot", "Warm", "Cold"]
STAGES = ["Inquiry", "Follow-up", "Interest", "Test Ride", "Deal",
          "Booking", "Delivery", "Registration", "Feedback", "Lost"]
PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque", "Finance"]
FOLLOWUP_TYPES = ["Call", "Visit", "WhatsApp"]
LOST_REASONS = ["Price Issue", "Competitor", "Stock Issue", "No Follow-up",
                "Not Interested", "Other"]
ROLES = ["super_admin", "admin", "sales_executive"]


# ============================================================
# Auth helpers
# ============================================================

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=3600 * 12, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=86400 * 7, path="/")


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return checker


# ============================================================
# Models (Pydantic)
# ============================================================

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "sales_executive"
    branch_id: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class BranchIn(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None


class BrandIn(BaseModel):
    name: str


class ModelIn(BaseModel):
    name: str
    brand_id: str


class VariantIn(BaseModel):
    name: str
    model_id: str


class ColorIn(BaseModel):
    name: str
    hex: Optional[str] = None


class ExchangeInfo(BaseModel):
    registration_number: Optional[str] = None
    model_year: Optional[int] = None
    tyre_condition: Optional[str] = None
    battery_condition: Optional[str] = None
    body_condition: Optional[str] = None
    expected_price: Optional[float] = None
    photos: List[str] = []
    rc_url: Optional[str] = None


class DealInfo(BaseModel):
    customer_expected_price: Optional[float] = None
    offered_price: Optional[float] = None
    discount: Optional[float] = None
    interest_level: Optional[str] = None  # Hot/Warm/Cold


class FinanceInfo(BaseModel):
    finance_company: Optional[str] = None
    down_payment: Optional[float] = None
    emi: Optional[float] = None
    tenure: Optional[int] = None


class LeadCreate(BaseModel):
    customer_name: str
    phone: str
    alt_phone: Optional[str] = None
    birthdate: Optional[str] = None
    address: Optional[str] = None
    source: str
    branch_id: str
    priority: str = "Warm"
    assigned_to: Optional[str] = None  # user id, if None auto-assign
    brand_id: Optional[str] = None
    model_id: Optional[str] = None
    variant_id: Optional[str] = None
    color_id: Optional[str] = None
    purchase_type: Optional[str] = "New Purchase"  # or "Exchange Vehicle"
    exchange: Optional[ExchangeInfo] = None
    deal: Optional[DealInfo] = None
    payment_mode: Optional[str] = None
    finance: Optional[FinanceInfo] = None
    next_followup_date: Optional[str] = None
    next_followup_type: Optional[str] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    alt_phone: Optional[str] = None
    birthdate: Optional[str] = None
    address: Optional[str] = None
    source: Optional[str] = None
    branch_id: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    brand_id: Optional[str] = None
    model_id: Optional[str] = None
    variant_id: Optional[str] = None
    color_id: Optional[str] = None
    purchase_type: Optional[str] = None
    exchange: Optional[ExchangeInfo] = None
    deal: Optional[DealInfo] = None
    payment_mode: Optional[str] = None
    finance: Optional[FinanceInfo] = None
    next_followup_date: Optional[str] = None
    next_followup_type: Optional[str] = None
    notes: Optional[str] = None


class StageChange(BaseModel):
    stage: str
    lost_reason: Optional[str] = None
    lost_reason_text: Optional[str] = None


class FollowupIn(BaseModel):
    type: str
    notes: Optional[str] = None
    scheduled_date: Optional[str] = None
    done: bool = False


# ============================================================
# Utility
# ============================================================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_user(u: dict) -> dict:
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u


async def add_timeline(lead_id: str, event: str, actor: dict, meta: Optional[dict] = None):
    await db.timeline.insert_one({
        "id": str(uuid.uuid4()),
        "lead_id": lead_id,
        "event": event,
        "meta": meta or {},
        "actor_id": actor.get("id"),
        "actor_name": actor.get("name"),
        "created_at": now_iso(),
    })


async def can_access_lead(user: dict, lead: dict) -> bool:
    if user["role"] == "super_admin":
        return True
    if user["role"] == "admin":
        return lead.get("branch_id") == user.get("branch_id")
    return lead.get("assigned_to") == user["id"]


# ============================================================
# Object storage
# ============================================================

_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ============================================================
# Auth endpoints
# ============================================================

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(403, "Account disabled")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ============================================================
# Users
# ============================================================

@api.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    query: Dict[str, Any] = {}
    if user["role"] == "admin":
        query = {"$or": [{"branch_id": user.get("branch_id")}, {"role": "admin"}]}
    elif user["role"] == "sales_executive":
        query = {"id": user["id"]}
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_roles("super_admin", "admin"))):
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role")
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already exists")
    if user["role"] == "admin" and body.role == "super_admin":
        raise HTTPException(403, "Cannot create super admin")
    branch_id = body.branch_id
    if user["role"] == "admin":
        branch_id = user.get("branch_id")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role,
        "branch_id": branch_id,
        "is_active": True,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return public_user(doc)


@api.put("/users/{uid}")
async def update_user(uid: str, body: UserUpdate, user: dict = Depends(require_roles("super_admin", "admin"))):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(404, "User not found")
    if user["role"] == "admin" and target.get("branch_id") != user.get("branch_id") and target["id"] != user["id"]:
        raise HTTPException(403, "Cannot edit users outside branch")
    updates: Dict[str, Any] = {}
    for field in ["name", "role", "branch_id", "is_active"]:
        v = getattr(body, field)
        if v is not None:
            updates[field] = v
    if body.password:
        updates["password_hash"] = hash_password(body.password)
    if updates:
        await db.users.update_one({"id": uid}, {"$set": updates})
    fresh = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    return fresh


@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("super_admin"))):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ============================================================
# Master data
# ============================================================

async def _list_collection(name: str):
    return await db[name].find({}, {"_id": 0}).sort("name", 1).to_list(1000)


# Branches
@api.get("/branches")
async def list_branches(user: dict = Depends(get_current_user)):
    return await _list_collection("branches")


@api.post("/branches")
async def create_branch(body: BranchIn, user: dict = Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "code": body.code,
           "address": body.address, "created_at": now_iso()}
    await db.branches.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/branches/{bid}")
async def delete_branch(bid: str, user: dict = Depends(require_roles("super_admin"))):
    await db.branches.delete_one({"id": bid})
    return {"ok": True}


# Brands
@api.get("/brands")
async def list_brands(user: dict = Depends(get_current_user)):
    return await _list_collection("brands")


@api.post("/brands")
async def create_brand(body: BrandIn, user: dict = Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "created_at": now_iso()}
    await db.brands.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/brands/{bid}")
async def delete_brand(bid: str, user: dict = Depends(require_roles("super_admin"))):
    await db.brands.delete_one({"id": bid})
    return {"ok": True}


# Models
@api.get("/models")
async def list_models(brand_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if brand_id:
        q["brand_id"] = brand_id
    return await db.vehicle_models.find(q, {"_id": 0}).sort("name", 1).to_list(1000)


@api.post("/models")
async def create_model(body: ModelIn, user: dict = Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "brand_id": body.brand_id, "created_at": now_iso()}
    await db.vehicle_models.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/models/{mid}")
async def delete_model(mid: str, user: dict = Depends(require_roles("super_admin"))):
    await db.vehicle_models.delete_one({"id": mid})
    return {"ok": True}


# Variants
@api.get("/variants")
async def list_variants(model_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if model_id:
        q["model_id"] = model_id
    return await db.variants.find(q, {"_id": 0}).sort("name", 1).to_list(1000)


@api.post("/variants")
async def create_variant(body: VariantIn, user: dict = Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "model_id": body.model_id, "created_at": now_iso()}
    await db.variants.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/variants/{vid}")
async def delete_variant(vid: str, user: dict = Depends(require_roles("super_admin"))):
    await db.variants.delete_one({"id": vid})
    return {"ok": True}


# Colors
@api.get("/colors")
async def list_colors(user: dict = Depends(get_current_user)):
    return await _list_collection("colors")


@api.post("/colors")
async def create_color(body: ColorIn, user: dict = Depends(require_roles("super_admin"))):
    doc = {"id": str(uuid.uuid4()), "name": body.name, "hex": body.hex, "created_at": now_iso()}
    await db.colors.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api.delete("/colors/{cid}")
async def delete_color(cid: str, user: dict = Depends(require_roles("super_admin"))):
    await db.colors.delete_one({"id": cid})
    return {"ok": True}


# ============================================================
# Leads
# ============================================================

async def round_robin_assign(branch_id: str) -> Optional[str]:
    execs = await db.users.find(
        {"role": "sales_executive", "branch_id": branch_id, "is_active": True},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", 1).to_list(1000)
    if not execs:
        return None
    counter = await db.rr_counters.find_one({"branch_id": branch_id})
    idx = ((counter or {}).get("idx", -1) + 1) % len(execs)
    await db.rr_counters.update_one(
        {"branch_id": branch_id},
        {"$set": {"idx": idx}},
        upsert=True,
    )
    return execs[idx]["id"]


@api.get("/leads")
async def list_leads(
    source: Optional[str] = None,
    stage: Optional[str] = None,
    assigned_to: Optional[str] = None,
    branch_id: Optional[str] = None,
    priority: Optional[str] = None,
    followup_due_today: Optional[bool] = False,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if user["role"] == "sales_executive":
        q["assigned_to"] = user["id"]
    elif user["role"] == "admin":
        q["branch_id"] = user.get("branch_id")
    if source: q["source"] = source
    if stage: q["stage"] = stage
    if assigned_to: q["assigned_to"] = assigned_to
    if branch_id and user["role"] == "super_admin": q["branch_id"] = branch_id
    if priority: q["priority"] = priority
    if followup_due_today:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        q["next_followup_date"] = today
    if search:
        q["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    leads = await db.leads.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return leads


@api.post("/leads")
async def create_lead(body: LeadCreate, user: dict = Depends(get_current_user)):
    if body.source not in LEAD_SOURCES:
        raise HTTPException(400, "Invalid source")
    if body.priority not in PRIORITIES:
        raise HTTPException(400, "Invalid priority")
    branch = await db.branches.find_one({"id": body.branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(400, "Invalid branch")
    assigned_to = body.assigned_to
    if user["role"] == "sales_executive":
        assigned_to = user["id"]
    elif not assigned_to:
        assigned_to = await round_robin_assign(body.branch_id)

    lead_id = str(uuid.uuid4())
    doc = body.model_dump()
    doc.update({
        "id": lead_id,
        "assigned_to": assigned_to,
        "stage": "Inquiry",
        "created_by": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "followup_count": 0,
        "documents": [],
        "lost_reason": None,
        "lost_reason_text": None,
    })
    await db.leads.insert_one(doc)
    await add_timeline(lead_id, "Lead Created", user, {"source": body.source})
    if assigned_to:
        await add_timeline(lead_id, "Lead Assigned", user, {"assigned_to": assigned_to})
    return await db.leads.find_one({"id": lead_id}, {"_id": 0})


@api.get("/leads/{lid}")
async def get_lead(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")
    return lead


@api.put("/leads/{lid}")
async def update_lead(lid: str, body: LeadUpdate, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")

    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "assigned_to" in updates and user["role"] == "sales_executive":
        del updates["assigned_to"]
    if updates:
        updates["updated_at"] = now_iso()
        await db.leads.update_one({"id": lid}, {"$set": updates})
        await add_timeline(lid, "Deal Updated", user, {"fields": list(updates.keys())})
        if "assigned_to" in updates:
            await add_timeline(lid, "Lead Assigned", user, {"assigned_to": updates["assigned_to"]})
    return await db.leads.find_one({"id": lid}, {"_id": 0})


@api.post("/leads/{lid}/stage")
async def change_stage(lid: str, body: StageChange, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")
    if body.stage not in STAGES:
        raise HTTPException(400, "Invalid stage")

    # Validation rules
    deal = lead.get("deal") or {}
    if body.stage == "Deal":
        if not (deal.get("offered_price") and deal.get("customer_expected_price")):
            raise HTTPException(400, "Fill customer expected price and offered price before moving to Deal")
    if body.stage == "Booking":
        if not lead.get("payment_mode"):
            raise HTTPException(400, "Set payment mode before Booking")
    if body.stage == "Delivery":
        # must have passed Booking stage (set stage to Booking at least once)
        pass
    if body.stage == "Registration":
        docs = lead.get("documents") or []
        if len(docs) == 0:
            raise HTTPException(400, "Upload at least one document before Registration")
    if body.stage == "Lost":
        if not body.lost_reason:
            raise HTTPException(400, "Lost reason is required")

    upd: Dict[str, Any] = {"stage": body.stage, "updated_at": now_iso()}
    if body.stage == "Lost":
        upd["lost_reason"] = body.lost_reason
        upd["lost_reason_text"] = body.lost_reason_text
    await db.leads.update_one({"id": lid}, {"$set": upd})
    await add_timeline(lid, "Stage Changed", user,
                       {"from": lead.get("stage"), "to": body.stage,
                        "lost_reason": body.lost_reason})
    return await db.leads.find_one({"id": lid}, {"_id": 0})


@api.post("/leads/{lid}/assign")
async def assign_lead(lid: str, assigned_to: str = Query(...),
                      user: dict = Depends(require_roles("super_admin", "admin"))):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    target = await db.users.find_one({"id": assigned_to}, {"_id": 0})
    if not target:
        raise HTTPException(400, "Invalid user")
    if user["role"] == "admin" and lead.get("branch_id") != user.get("branch_id"):
        raise HTTPException(403, "Cannot assign leads outside your branch")
    await db.leads.update_one({"id": lid}, {"$set": {"assigned_to": assigned_to, "updated_at": now_iso()}})
    await add_timeline(lid, "Lead Assigned", user, {"assigned_to": assigned_to})
    return await db.leads.find_one({"id": lid}, {"_id": 0})


# ============================================================
# Follow-ups
# ============================================================

@api.get("/leads/{lid}/followups")
async def list_followups(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")
    items = await db.followups.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/leads/{lid}/followups")
async def add_followup(lid: str, body: FollowupIn, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")
    if body.type not in FOLLOWUP_TYPES:
        raise HTTPException(400, "Invalid follow-up type")
    doc = {
        "id": str(uuid.uuid4()),
        "lead_id": lid,
        "type": body.type,
        "notes": body.notes,
        "scheduled_date": body.scheduled_date,
        "done": body.done,
        "created_by": user["id"],
        "created_by_name": user["name"],
        "created_at": now_iso(),
    }
    await db.followups.insert_one(doc)
    await db.leads.update_one(
        {"id": lid},
        {"$set": {
            "next_followup_date": body.scheduled_date,
            "next_followup_type": body.type,
            "updated_at": now_iso(),
        },
         "$inc": {"followup_count": 1}},
    )
    await add_timeline(lid, "Follow-up Added", user, {"type": body.type, "scheduled_date": body.scheduled_date})
    return {k: v for k, v in doc.items() if k != "_id"}


# ============================================================
# Timeline
# ============================================================

@api.get("/leads/{lid}/timeline")
async def get_timeline(lid: str, user: dict = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")
    items = await db.timeline.find({"lead_id": lid}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


# ============================================================
# Files
# ============================================================

@api.post("/leads/{lid}/documents")
async def upload_document(
    lid: str,
    file: UploadFile = File(...),
    doc_type: str = Form("other"),
    user: dict = Depends(get_current_user),
):
    lead = await db.leads.find_one({"id": lid}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not await can_access_lead(user, lead):
        raise HTTPException(403, "Access denied")

    ext = (file.filename or "bin").split(".")[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/leads/{lid}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")

    file_id = str(uuid.uuid4())
    frec = {
        "id": file_id,
        "lead_id": lid,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size"),
        "doc_type": doc_type,
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(frec)
    await db.leads.update_one(
        {"id": lid},
        {"$push": {"documents": {"id": file_id, "doc_type": doc_type,
                                 "filename": file.filename, "storage_path": result["path"],
                                 "content_type": file.content_type}},
         "$set": {"updated_at": now_iso()}},
    )
    await add_timeline(lid, "Documents Uploaded", user, {"doc_type": doc_type, "filename": file.filename})
    return {k: v for k, v in frec.items() if k != "_id"}


@api.get("/files/{fid}")
async def download_file(fid: str, request: Request,
                        authorization: Optional[str] = Header(None),
                        auth: Optional[str] = Query(None)):
    # Auth via header, cookie, or query token
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    else:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")

    rec = await db.files.find_one({"id": fid, "is_deleted": False}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    data, ctype = get_object(rec["storage_path"])
    return FastResponse(content=data, media_type=rec.get("content_type") or ctype)


# ============================================================
# Analytics
# ============================================================

@api.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(get_current_user)):
    base: Dict[str, Any] = {}
    if user["role"] == "sales_executive":
        base["assigned_to"] = user["id"]
    elif user["role"] == "admin":
        base["branch_id"] = user.get("branch_id")

    total = await db.leads.count_documents(base)

    # per source
    pipeline = [{"$match": base}, {"$group": {"_id": "$source", "count": {"$sum": 1}}}]
    per_source = {}
    async for row in db.leads.aggregate(pipeline):
        per_source[row["_id"] or "Unknown"] = row["count"]

    # per stage
    pipeline2 = [{"$match": base}, {"$group": {"_id": "$stage", "count": {"$sum": 1}}}]
    per_stage = {}
    async for row in db.leads.aggregate(pipeline2):
        per_stage[row["_id"] or "Unknown"] = row["count"]

    converted = await db.leads.count_documents({**base, "stage": {"$in": ["Delivery", "Registration", "Feedback"]}})
    lost = await db.leads.count_documents({**base, "stage": "Lost"})

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    due_today = await db.leads.count_documents({**base, "next_followup_date": today})

    return {
        "total_leads": total,
        "per_source": per_source,
        "per_stage": per_stage,
        "converted": converted,
        "lost": lost,
        "followups_due_today": due_today,
    }


# ============================================================
# Seed & startup
# ============================================================

async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.leads.create_index("id", unique=True)
    await db.leads.create_index("assigned_to")
    await db.leads.create_index("branch_id")
    await db.timeline.create_index("lead_id")
    await db.followups.create_index("lead_id")

    # Branches
    branch_defs = [
        {"name": "Bilimora", "code": "BLM"},
        {"name": "Chikhli", "code": "CHK"},
        {"name": "Gandevi", "code": "GND"},
    ]
    branches = {}
    for b in branch_defs:
        existing = await db.branches.find_one({"name": b["name"]}, {"_id": 0})
        if existing:
            branches[b["name"]] = existing
        else:
            doc = {"id": str(uuid.uuid4()), "name": b["name"], "code": b["code"],
                   "address": None, "created_at": now_iso()}
            await db.branches.insert_one(doc)
            branches[b["name"]] = doc

    # Brands & Models & Variants
    brand_defs = {
        "Honda": {
            "Activa 6G": ["Standard", "DLX", "Smart"],
            "Shine": ["Drum", "Disc"],
            "Dio": ["Standard", "DLX"],
        },
        "Hero": {
            "Splendor Plus": ["Kick", "Self", "iSmart"],
            "HF Deluxe": ["Kick", "Self"],
        },
        "TVS": {
            "Jupiter": ["Standard", "ZX", "Classic"],
            "Apache RTR 160": ["Drum", "Disc"],
        },
        "Suzuki": {
            "Access 125": ["Standard", "Special Edition"],
            "Burgman Street": ["125", "EX"],
        },
    }
    for bname, models in brand_defs.items():
        bdoc = await db.brands.find_one({"name": bname}, {"_id": 0})
        if not bdoc:
            bdoc = {"id": str(uuid.uuid4()), "name": bname, "created_at": now_iso()}
            await db.brands.insert_one(bdoc)
        for mname, variants in models.items():
            mdoc = await db.vehicle_models.find_one({"name": mname, "brand_id": bdoc["id"]}, {"_id": 0})
            if not mdoc:
                mdoc = {"id": str(uuid.uuid4()), "name": mname, "brand_id": bdoc["id"], "created_at": now_iso()}
                await db.vehicle_models.insert_one(mdoc)
            for vname in variants:
                if not await db.variants.find_one({"name": vname, "model_id": mdoc["id"]}):
                    await db.variants.insert_one({
                        "id": str(uuid.uuid4()), "name": vname,
                        "model_id": mdoc["id"], "created_at": now_iso()
                    })

    # Colors
    color_defs = [
        ("Pearl White", "#F5F5F5"),
        ("Matte Black", "#222222"),
        ("Racing Red", "#E11D48"),
        ("Ocean Blue", "#1E40AF"),
        ("Silver", "#C0C0C0"),
    ]
    for cname, hex_code in color_defs:
        if not await db.colors.find_one({"name": cname}):
            await db.colors.insert_one({
                "id": str(uuid.uuid4()), "name": cname, "hex": hex_code,
                "created_at": now_iso()
            })

    # Users
    user_defs = [
        {"email": "superadmin@dealer.com", "password": "super123", "name": "Super Admin",
         "role": "super_admin", "branch": None},
        {"email": "admin@dealer.com", "password": "admin123", "name": "Ravi Admin",
         "role": "admin", "branch": "Bilimora"},
        {"email": "sales1@dealer.com", "password": "sales123", "name": "Priya Sales",
         "role": "sales_executive", "branch": "Bilimora"},
        {"email": "sales2@dealer.com", "password": "sales123", "name": "Amit Sales",
         "role": "sales_executive", "branch": "Bilimora"},
        {"email": "sales3@dealer.com", "password": "sales123", "name": "Neha Sales",
         "role": "sales_executive", "branch": "Chikhli"},
        {"email": "sales4@dealer.com", "password": "sales123", "name": "Vikram Sales",
         "role": "sales_executive", "branch": "Gandevi"},
    ]
    for u in user_defs:
        existing = await db.users.find_one({"email": u["email"]})
        branch_id = branches[u["branch"]]["id"] if u["branch"] else None
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "name": u["name"],
                "role": u["role"],
                "branch_id": branch_id,
                "is_active": True,
                "created_at": now_iso(),
            })
        else:
            # Ensure password matches seed
            if not verify_password(u["password"], existing["password_hash"]):
                await db.users.update_one(
                    {"email": u["email"]},
                    {"$set": {"password_hash": hash_password(u["password"]),
                              "role": u["role"], "branch_id": branch_id,
                              "is_active": True, "name": u["name"]}}
                )

    # Sample leads
    count = await db.leads.count_documents({})
    if count == 0:
        sales_exec = await db.users.find_one({"email": "sales1@dealer.com"}, {"_id": 0})
        honda = await db.brands.find_one({"name": "Honda"}, {"_id": 0})
        activa = await db.vehicle_models.find_one({"name": "Activa 6G"}, {"_id": 0})
        sample_leads = [
            {"customer_name": "Rakesh Patel", "phone": "9876543210", "source": "Walk-in",
             "priority": "Hot", "stage": "Interest"},
            {"customer_name": "Meera Shah", "phone": "9876501234", "source": "WhatsApp",
             "priority": "Warm", "stage": "Follow-up"},
            {"customer_name": "Arjun Desai", "phone": "9845012345", "source": "Digital Marketing",
             "priority": "Cold", "stage": "Inquiry"},
            {"customer_name": "Kavita Joshi", "phone": "9812345678", "source": "Referral",
             "priority": "Hot", "stage": "Test Ride"},
            {"customer_name": "Sanjay Modi", "phone": "9823456789", "source": "Tele-in",
             "priority": "Warm", "stage": "Deal",
             "deal_c": 78000, "deal_o": 75000},
        ]
        for s in sample_leads:
            lid = str(uuid.uuid4())
            await db.leads.insert_one({
                "id": lid,
                "customer_name": s["customer_name"],
                "phone": s["phone"],
                "alt_phone": None, "birthdate": None, "address": "Gujarat",
                "source": s["source"],
                "branch_id": branches["Bilimora"]["id"],
                "priority": s["priority"],
                "assigned_to": sales_exec["id"] if sales_exec else None,
                "brand_id": honda["id"] if honda else None,
                "model_id": activa["id"] if activa else None,
                "variant_id": None, "color_id": None,
                "purchase_type": "New Purchase",
                "exchange": None,
                "deal": {"customer_expected_price": s.get("deal_c"),
                         "offered_price": s.get("deal_o"),
                         "discount": None, "interest_level": s["priority"]},
                "payment_mode": None, "finance": None,
                "next_followup_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "next_followup_type": "Call",
                "notes": "Sample lead",
                "stage": s["stage"],
                "created_by": sales_exec["id"] if sales_exec else None,
                "created_at": now_iso(),
                "updated_at": now_iso(),
                "followup_count": 0,
                "documents": [],
                "lost_reason": None, "lost_reason_text": None,
            })
            await db.timeline.insert_one({
                "id": str(uuid.uuid4()), "lead_id": lid,
                "event": "Lead Created", "meta": {"source": s["source"]},
                "actor_id": sales_exec["id"] if sales_exec else None,
                "actor_name": sales_exec["name"] if sales_exec else "System",
                "created_at": now_iso(),
            })


@app.on_event("startup")
async def on_startup():
    try:
        await seed_data()
        logger.info("Seed complete")
    except Exception as e:
        logger.exception(f"Seed failed: {e}")
    try:
        init_storage()
        logger.info("Object storage initialized")
    except Exception as e:
        logger.error(f"Storage init error: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ============================================================
# Constants endpoint
# ============================================================

@api.get("/constants")
async def get_constants():
    return {
        "lead_sources": LEAD_SOURCES,
        "priorities": PRIORITIES,
        "stages": STAGES,
        "payment_modes": PAYMENT_MODES,
        "followup_types": FOLLOWUP_TYPES,
        "lost_reasons": LOST_REASONS,
        "roles": ROLES,
    }


@api.get("/")
async def root():
    return {"service": "twowheeler-crm", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
