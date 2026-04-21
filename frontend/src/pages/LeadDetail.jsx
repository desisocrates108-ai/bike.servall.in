import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { priorityClass, stageClass } from "../lib/labels";
import {
  ArrowLeft, Phone, MapPin, Calendar, Upload, FileText, Clock, User,
  PhoneCall, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "../components/ui/dialog";
import BookingSection from "../components/BookingSection";
import ExchangeSection from "../components/ExchangeSection";
import DeliverySection from "../components/DeliverySection";
import DocumentsSection from "../components/DocumentsSection";
import WhatsappSection from "../components/WhatsappSection";
import { toast } from "sonner";

const Kv = ({ label, value }) => (
  <div>
    <div className="overline">{label}</div>
    <div className="mt-1 text-sm text-zinc-900">{value ?? "—"}</div>
  </div>
);

const Card = ({ title, children, right }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-5 mb-4">
    <div className="flex items-center justify-between mb-4">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

const today = () => new Date().toISOString().slice(0, 10);

export default function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [negotiations, setNegotiations] = useState([]);
  const [constants, setConstants] = useState(null);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  const [colors, setColors] = useState([]);

  const [newFu, setNewFu] = useState({
    type: "Call",
    notes: "",
    scheduled_date: today(),
    scheduled_time: "",
    call_status: "",
    customer_response: "",
    outcome_tag: "",
    lead_temperature: "",
    loss_reason: "",
    loss_reason_text: "",
    call_duration: "",
    done: true,
  });

  const [dealForm, setDealForm] = useState({
    customer_expected_price: "",
    offered_price: "",
    discount: "",
    ex_showroom_price: "",
    final_deal_price: "",
    interest_level: "",
    deal_status: "",
    payment_mode: "",
  });

  const [stageDialog, setStageDialog] = useState(false);
  const [nextStage, setNextStage] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostText, setLostText] = useState("");

  const [approveDialog, setApproveDialog] = useState(false);
  const [approveAction, setApproveAction] = useState(true);
  const [approveRemarks, setApproveRemarks] = useState("");

  const reload = async () => {
    const [ld, tl, fu, ng] = await Promise.all([
      api.get(`/leads/${id}`),
      api.get(`/leads/${id}/timeline`),
      api.get(`/leads/${id}/followups`),
      api.get(`/leads/${id}/negotiations`),
    ]);
    setLead(ld.data);
    setTimeline(tl.data);
    setFollowups(fu.data);
    setNegotiations(ng.data);
    const d = ld.data.deal || {};
    setDealForm({
      customer_expected_price: d.customer_expected_price ?? "",
      offered_price: d.offered_price ?? "",
      discount: d.discount ?? "",
      ex_showroom_price: d.ex_showroom_price ?? "",
      final_deal_price: d.final_deal_price ?? "",
      interest_level: d.interest_level ?? "",
      deal_status: d.deal_status ?? "",
      payment_mode: ld.data.payment_mode ?? "",
    });
  };

  useEffect(() => {
    reload();
    api.get("/constants").then((r) => setConstants(r.data));
    api.get("/branches").then((r) => setBranches(r.data));
    api.get("/users").then((r) => setUsers(r.data));
    api.get("/brands").then((r) => setBrands(r.data));
    api.get("/colors").then((r) => setColors(r.data));
    // eslint-disable-next-line
  }, [id]);

  useEffect(() => {
    if (lead?.brand_id) api.get("/models", { params: { brand_id: lead.brand_id } }).then((r) => setModels(r.data));
    if (lead?.model_id) api.get("/variants", { params: { model_id: lead.model_id } }).then((r) => setVariants(r.data));
  }, [lead?.brand_id, lead?.model_id]);

  const branchMap = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, b])), [branches]);
  const userMap = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const brandMap = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b])), [brands]);
  const modelMap = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m])), [models]);
  const variantMap = useMemo(() => Object.fromEntries(variants.map((v) => [v.id, v])), [variants]);
  const colorMap = useMemo(() => Object.fromEntries(colors.map((c) => [c.id, c])), [colors]);

  const isMissed = (fu) =>
    !fu.done && fu.scheduled_date && fu.scheduled_date < today();

  const threshold = constants?.config?.discount_approval_threshold || 0;

  const submitFu = async (e) => {
    e.preventDefault();
    if (!newFu.notes?.trim()) {
      toast.error("Notes are mandatory");
      return;
    }
    try {
      const payload = { ...newFu };
      if (newFu.call_duration !== "" && newFu.call_duration != null)
        payload.call_duration = Number(newFu.call_duration);
      else delete payload.call_duration;
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });
      await api.post(`/leads/${id}/followups`, payload);
      toast.success("Follow-up logged");
      setNewFu({
        type: "Call", notes: "", scheduled_date: today(), scheduled_time: "",
        call_status: "", customer_response: "", outcome_tag: "",
        lead_temperature: "", loss_reason: "", loss_reason_text: "",
        call_duration: "", done: true,
      });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const submitStage = async () => {
    try {
      await api.post(`/leads/${id}/stage`, {
        stage: nextStage,
        lost_reason: nextStage === "Lost" ? lostReason : null,
        lost_reason_text: nextStage === "Lost" ? lostText : null,
      });
      toast.success(`Moved to ${nextStage}`);
      setStageDialog(false);
      setNextStage("");
      setLostReason("");
      setLostText("");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const saveDeal = async () => {
    try {
      const n = (v) => v === "" || v == null ? null : Number(v);
      const payload = {
        deal: {
          customer_expected_price: n(dealForm.customer_expected_price),
          offered_price: n(dealForm.offered_price),
          discount: n(dealForm.discount),
          ex_showroom_price: n(dealForm.ex_showroom_price),
          final_deal_price: n(dealForm.final_deal_price),
          interest_level: dealForm.interest_level || null,
          deal_status: dealForm.deal_status || null,
        },
        payment_mode: dealForm.payment_mode || null,
      };
      await api.put(`/leads/${id}`, payload);
      toast.success("Deal saved");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const requestApproval = async () => {
    try {
      await api.post(`/leads/${id}/deal/request-approval`);
      toast.success("Approval requested");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const submitApproval = async () => {
    try {
      await api.post(`/leads/${id}/deal/approve`, { approve: approveAction, remarks: approveRemarks });
      toast.success(approveAction ? "Deal approved" : "Deal rejected");
      setApproveDialog(false);
      setApproveRemarks("");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const uploadFile = async (file, docType) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("doc_type", docType);
    try {
      await api.post(`/leads/${id}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Uploaded");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  if (!lead) return <div className="p-10 text-zinc-500">Loading...</div>;

  const deal = lead.deal || {};
  const exch = lead.exchange || {};
  const fin = lead.finance || {};
  const effDiscount =
    dealForm.discount !== "" && dealForm.discount != null
      ? Number(dealForm.discount)
      : (dealForm.offered_price && dealForm.customer_expected_price
          ? Number(dealForm.customer_expected_price) - Number(dealForm.offered_price)
          : 0);
  const needsApproval = effDiscount >= threshold && threshold > 0;
  const isManager = user?.role === "admin" || user?.role === "super_admin";

  const responseColor = {
    Interested: "text-emerald-700", "Not Interested": "text-rose-700",
    "Call Later": "text-amber-700", "Not Reachable": "text-zinc-500",
    "Switched Off": "text-zinc-500",
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px]">
      <button onClick={() => nav("/leads")} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4" data-testid="back-to-leads">
        <ArrowLeft className="w-4 h-4" /> Back to leads
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="overline mb-2">Lead</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight" data-testid="lead-customer-name">
            {lead.customer_name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-zinc-600">
            <span className="inline-flex items-center gap-1"><Phone className="w-4 h-4" /> <span className="font-mono">{lead.phone}</span></span>
            {lead.address && <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" /> {lead.address}</span>}
            <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" /> Created {new Date(lead.created_at).toLocaleDateString()}</span>
            {lead.at_risk && (
              <span className="inline-flex items-center gap-1 text-rose-700 font-semibold"><AlertTriangle className="w-4 h-4" /> At Risk</span>
            )}
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            <span className={`inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${stageClass(lead.stage)}`} data-testid="lead-stage-badge">{lead.stage}</span>
            <span className={`inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider border ${priorityClass(lead.priority)}`}>{lead.priority}</span>
            <span className="inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700">{lead.source}</span>
            {deal.approval_status && (
              <span className={`inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${
                deal.approval_status === "Approved" ? "bg-emerald-100 text-emerald-700" :
                deal.approval_status === "Rejected" ? "bg-rose-100 text-rose-700" :
                "bg-amber-100 text-amber-700"
              }`}>
                Approval: {deal.approval_status}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={stageDialog} onOpenChange={setStageDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-sm bg-brand hover:bg-brand-dark font-bold" data-testid="change-stage-btn">
                Change Stage
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Change Stage</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="overline">New Stage</Label>
                  <Select value={nextStage} onValueChange={setNextStage}>
                    <SelectTrigger className="mt-2" data-testid="next-stage-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {constants?.stages?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {nextStage === "Lost" && (
                  <>
                    <div>
                      <Label className="overline">Lost Reason</Label>
                      <Select value={lostReason} onValueChange={setLostReason}>
                        <SelectTrigger className="mt-2" data-testid="lost-reason-select"><SelectValue placeholder="Pick reason" /></SelectTrigger>
                        <SelectContent>
                          {constants?.lost_reasons?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {lostReason === "Other" && (
                      <Textarea value={lostText} onChange={(e) => setLostText(e.target.value)} placeholder="Describe..." />
                    )}
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStageDialog(false)}>Cancel</Button>
                <Button onClick={submitStage} disabled={!nextStage} className="bg-brand hover:bg-brand-dark" data-testid="confirm-stage-btn">
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="rounded-none border-b border-zinc-200 bg-transparent p-0 h-auto w-full justify-start gap-6 overflow-x-auto">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="followups" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-followups">Follow-ups ({followups.length})</TabsTrigger>
          <TabsTrigger value="deal" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-deal">Deal</TabsTrigger>
          <TabsTrigger value="booking" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-booking">Booking</TabsTrigger>
          {lead.purchase_type === "Exchange Vehicle" && (
            <TabsTrigger value="exchange" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-exchange">Exchange</TabsTrigger>
          )}
          <TabsTrigger value="delivery" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-delivery">Delivery</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-documents">Documents ({(lead.documents || []).length})</TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Customer">
              <div className="grid grid-cols-2 gap-4">
                <Kv label="Name" value={lead.customer_name} />
                <Kv label="Phone" value={<span className="font-mono">{lead.phone}</span>} />
                <Kv label="Alt Phone" value={lead.alt_phone} />
                <Kv label="Birthdate" value={lead.birthdate} />
                <div className="col-span-2"><Kv label="Address" value={lead.address} /></div>
              </div>
            </Card>

            <Card title="Lead">
              <div className="grid grid-cols-2 gap-4">
                <Kv label="Source" value={lead.source} />
                <Kv label="Branch" value={branchMap[lead.branch_id]?.name} />
                <Kv label="Sales Exec" value={userMap[lead.assigned_to]?.name} />
                <Kv label="Follow-up Count" value={<span className="font-mono">{lead.followup_count || 0}</span>} />
                <Kv label="Next Follow-up" value={<span className="font-mono">{lead.next_followup_date || "—"} {lead.next_followup_time || ""} {lead.next_followup_type ? `(${lead.next_followup_type})` : ""}</span>} />
                <Kv label="Last Follow-up" value={lead.last_followup_at ? new Date(lead.last_followup_at).toLocaleString() : "—"} />
                <Kv label="Missed" value={<span className="font-mono text-rose-700">{lead.missed_followups || 0}</span>} />
                <Kv label="Priority" value={lead.priority} />
              </div>
            </Card>

            <Card title="Vehicle">
              <div className="grid grid-cols-2 gap-4">
                <Kv label="Brand" value={brandMap[lead.brand_id]?.name} />
                <Kv label="Model" value={modelMap[lead.model_id]?.name} />
                <Kv label="Variant" value={variantMap[lead.variant_id]?.name} />
                <Kv label="Color" value={colorMap[lead.color_id]?.name} />
                <Kv label="Purchase Type" value={lead.purchase_type} />
              </div>
            </Card>

            {lead.purchase_type === "Exchange Vehicle" && (
              <Card title="Exchange Vehicle">
                <div className="grid grid-cols-2 gap-4">
                  <Kv label="Reg No." value={<span className="font-mono">{exch.registration_number}</span>} />
                  <Kv label="Model Year" value={exch.model_year} />
                  <Kv label="Tyre" value={exch.tyre_condition} />
                  <Kv label="Battery" value={exch.battery_condition} />
                  <Kv label="Body" value={exch.body_condition} />
                  <Kv label="Expected Price" value={exch.expected_price != null ? <span className="font-mono">₹{exch.expected_price}</span> : null} />
                </div>
              </Card>
            )}

            {lead.stage === "Lost" && (
              <Card title="Lost Reason">
                <div className="text-sm">{lead.lost_reason || "—"}</div>
                {lead.lost_reason_text && <div className="text-sm text-zinc-600 mt-2">{lead.lost_reason_text}</div>}
              </Card>
            )}

            {lead.notes && (
              <Card title="Notes">
                <div className="text-sm text-zinc-700 whitespace-pre-wrap">{lead.notes}</div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="followups" className="pt-6">
          <Card title="Log a follow-up" right={<span className="text-xs text-zinc-500">Notes are mandatory</span>}>
            <form onSubmit={submitFu} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label className="overline">Type</Label>
                <Select value={newFu.type} onValueChange={(v) => setNewFu((s) => ({ ...s, type: v }))}>
                  <SelectTrigger className="mt-2" data-testid="fu-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {constants?.followup_types?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Call Status</Label>
                <Select value={newFu.call_status || "__NONE__"} onValueChange={(v) => setNewFu((s) => ({ ...s, call_status: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2" data-testid="fu-call-status"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.call_statuses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Customer Response</Label>
                <Select value={newFu.customer_response || "__NONE__"} onValueChange={(v) => setNewFu((s) => ({ ...s, customer_response: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2" data-testid="fu-customer-response"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.customer_responses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Outcome</Label>
                <Select value={newFu.outcome_tag || "__NONE__"} onValueChange={(v) => setNewFu((s) => ({ ...s, outcome_tag: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2" data-testid="fu-outcome"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.outcome_tags?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Lead Temperature</Label>
                <Select value={newFu.lead_temperature || "__NONE__"} onValueChange={(v) => setNewFu((s) => ({ ...s, lead_temperature: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2" data-testid="fu-temperature"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.priorities?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Call Duration (sec)</Label>
                <Input type="number" value={newFu.call_duration} onChange={(e) => setNewFu((s) => ({ ...s, call_duration: e.target.value }))} className="mt-2" data-testid="fu-duration" />
              </div>
              <div>
                <Label className="overline">Next Follow-up Date *</Label>
                <Input type="date" required value={newFu.scheduled_date} onChange={(e) => setNewFu((s) => ({ ...s, scheduled_date: e.target.value }))} className="mt-2" data-testid="fu-date" />
              </div>
              <div>
                <Label className="overline">Next Follow-up Time</Label>
                <Input type="time" value={newFu.scheduled_time} onChange={(e) => setNewFu((s) => ({ ...s, scheduled_time: e.target.value }))} className="mt-2" data-testid="fu-time" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <Label className="overline">Notes *</Label>
                <Textarea required rows={2} value={newFu.notes} onChange={(e) => setNewFu((s) => ({ ...s, notes: e.target.value }))} className="mt-2" data-testid="fu-notes" />
              </div>
              {newFu.outcome_tag === "Lost" && (
                <div className="md:col-span-2 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="overline">Loss Reason</Label>
                    <Select value={newFu.loss_reason || "__NONE__"} onValueChange={(v) => setNewFu((s) => ({ ...s, loss_reason: v === "__NONE__" ? "" : v }))}>
                      <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__NONE__">—</SelectItem>
                        {constants?.deal_loss_reasons?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {newFu.loss_reason === "Other" && (
                    <div>
                      <Label className="overline">Details</Label>
                      <Input value={newFu.loss_reason_text} onChange={(e) => setNewFu((s) => ({ ...s, loss_reason_text: e.target.value }))} className="mt-2" />
                    </div>
                  )}
                </div>
              )}
              <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                <Button type="submit" className="bg-brand hover:bg-brand-dark rounded-sm font-bold" data-testid="add-fu-btn">
                  <PhoneCall className="w-4 h-4 mr-1" /> Log Follow-up
                </Button>
              </div>
            </form>
          </Card>

          <div className="bg-white border border-zinc-200 rounded-sm">
            {followups.length === 0 && <div className="p-6 text-sm text-zinc-400">No follow-ups logged yet.</div>}
            {followups.map((f) => (
              <div key={f.id} className={`p-4 border-b border-zinc-100 last:border-0 ${isMissed(f) ? "bg-rose-50" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="overline">{f.type}</span>
                      {f.call_status && (
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${f.call_status === "Connected" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                          {f.call_status}
                        </span>
                      )}
                      {f.customer_response && (
                        <span className={`text-xs font-semibold ${responseColor[f.customer_response] || "text-zinc-600"}`}>
                          {f.customer_response}
                        </span>
                      )}
                      {f.outcome_tag && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-blue-100 text-blue-700">
                          {f.outcome_tag}
                        </span>
                      )}
                      {f.call_duration && (
                        <span className="text-xs font-mono text-zinc-500">{f.call_duration}s</span>
                      )}
                      {isMissed(f) && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-rose-600 text-white">Missed</span>
                      )}
                    </div>
                    <div className="text-sm mt-1">{f.notes || <span className="text-zinc-400">(No notes)</span>}</div>
                    <div className="text-xs text-zinc-500 mt-2">
                      <User className="w-3 h-3 inline mr-1" />{f.created_by_name} · {new Date(f.created_at).toLocaleString()}
                      {f.scheduled_date && <span className="ml-3 font-mono">Next: {f.scheduled_date} {f.scheduled_time || ""}</span>}
                    </div>
                  </div>
                  {f.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-zinc-400" />}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deal" className="pt-6">
          <Card
            title="Deal & Pricing"
            right={
              isManager && deal.approval_required && deal.approval_status === "Pending" ? (
                <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" data-testid="approve-deal-btn">
                      <ShieldCheck className="w-4 h-4 mr-1" /> Review Approval
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Review discount approval</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="bg-zinc-50 p-4 rounded-sm text-sm">
                        <div>Discount: <span className="font-mono font-bold">₹{deal.discount}</span></div>
                        <div>Final Deal Price: <span className="font-mono font-bold">₹{deal.final_deal_price}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setApproveAction(true)}
                          className={`flex-1 py-2 rounded-sm border text-sm font-bold ${approveAction ? "bg-emerald-600 text-white border-emerald-600" : "border-zinc-300"}`}
                          data-testid="approve-yes"
                        >
                          <CheckCircle2 className="w-4 h-4 inline mr-1" /> Approve
                        </button>
                        <button
                          onClick={() => setApproveAction(false)}
                          className={`flex-1 py-2 rounded-sm border text-sm font-bold ${!approveAction ? "bg-rose-600 text-white border-rose-600" : "border-zinc-300"}`}
                          data-testid="approve-no"
                        >
                          <XCircle className="w-4 h-4 inline mr-1" /> Reject
                        </button>
                      </div>
                      <Textarea
                        value={approveRemarks}
                        onChange={(e) => setApproveRemarks(e.target.value)}
                        placeholder="Remarks (optional)"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setApproveDialog(false)}>Cancel</Button>
                      <Button onClick={submitApproval} className="bg-brand hover:bg-brand-dark" data-testid="confirm-approval-btn">Submit</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="overline">Ex-showroom Price</Label>
                <Input type="number" value={dealForm.ex_showroom_price} onChange={(e) => setDealForm((s) => ({ ...s, ex_showroom_price: e.target.value }))} className="mt-2" data-testid="deal-ex-showroom" />
              </div>
              <div>
                <Label className="overline">Customer Expected</Label>
                <Input type="number" value={dealForm.customer_expected_price} onChange={(e) => setDealForm((s) => ({ ...s, customer_expected_price: e.target.value }))} className="mt-2" data-testid="deal-customer-expected" />
              </div>
              <div>
                <Label className="overline">Dealer Offered</Label>
                <Input type="number" value={dealForm.offered_price} onChange={(e) => setDealForm((s) => ({ ...s, offered_price: e.target.value }))} className="mt-2" data-testid="deal-offered" />
              </div>
              <div>
                <Label className="overline">Discount</Label>
                <Input type="number" value={dealForm.discount} onChange={(e) => setDealForm((s) => ({ ...s, discount: e.target.value }))} className="mt-2" data-testid="deal-discount" />
                {effDiscount > 0 && (
                  <div className={`text-xs mt-1 ${needsApproval ? "text-amber-700" : "text-zinc-500"}`}>
                    Effective: ₹{effDiscount} {needsApproval && `· Requires manager approval (threshold ₹${threshold})`}
                  </div>
                )}
              </div>
              <div>
                <Label className="overline">Final Deal Price *</Label>
                <Input type="number" value={dealForm.final_deal_price} onChange={(e) => setDealForm((s) => ({ ...s, final_deal_price: e.target.value }))} className="mt-2" data-testid="deal-final-price" />
              </div>
              <div>
                <Label className="overline">Payment Mode</Label>
                <Select value={dealForm.payment_mode || "__NONE__"} onValueChange={(v) => setDealForm((s) => ({ ...s, payment_mode: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2" data-testid="deal-payment-mode"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.payment_modes?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Interest Level</Label>
                <Select value={dealForm.interest_level || "__NONE__"} onValueChange={(v) => setDealForm((s) => ({ ...s, interest_level: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.priorities?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Deal Status</Label>
                <Select value={dealForm.deal_status || "__NONE__"} onValueChange={(v) => setDealForm((s) => ({ ...s, deal_status: v === "__NONE__" ? "" : v }))}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.deal_statuses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100">
              <div className="text-xs text-zinc-500">
                {deal.approved_by_name && (
                  <>Approved by <span className="font-semibold">{deal.approved_by_name}</span> · {deal.approved_at ? new Date(deal.approved_at).toLocaleString() : ""}
                  {deal.approval_remarks && <> · {deal.approval_remarks}</>}</>
                )}
              </div>
              <div className="flex gap-2">
                {needsApproval && deal.approval_status !== "Approved" && deal.approval_status !== "Pending" && (
                  <Button onClick={requestApproval} variant="outline" className="rounded-sm" data-testid="request-approval-btn">
                    Request Approval
                  </Button>
                )}
                <Button onClick={saveDeal} className="bg-brand hover:bg-brand-dark rounded-sm font-bold" data-testid="save-deal-btn">
                  Save Deal
                </Button>
              </div>
            </div>
          </Card>

          {lead.payment_mode === "Finance" && (
            <Card title="Finance Details">
              <div className="grid grid-cols-2 gap-4">
                <Kv label="Finance Co." value={fin.finance_company} />
                <Kv label="Down Payment" value={fin.down_payment != null ? <span className="font-mono">₹{fin.down_payment}</span> : null} />
                <Kv label="EMI" value={fin.emi != null ? <span className="font-mono">₹{fin.emi}</span> : null} />
                <Kv label="Tenure" value={fin.tenure ? <span className="font-mono">{fin.tenure} mo</span> : null} />
              </div>
            </Card>
          )}

          <Card title="Negotiation history">
            {negotiations.length === 0 && <div className="text-sm text-zinc-400">No negotiations logged yet.</div>}
            <div className="space-y-3">
              {negotiations.map((n) => (
                <div key={n.id} className="border-l-2 border-zinc-900 pl-3 py-1" data-testid={`nego-${n.id}`}>
                  <div className="text-xs text-zinc-500">
                    <User className="w-3 h-3 inline mr-1" />{n.changed_by_name} · {new Date(n.created_at).toLocaleString()}
                  </div>
                  <div className="text-sm mt-1 font-mono">
                    {Object.entries(n.changes || {}).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-zinc-500">{k}:</span>{" "}
                        <span className="text-rose-600">{JSON.stringify(v.from)}</span>{" → "}
                        <span className="text-emerald-700">{JSON.stringify(v.to)}</span>
                      </div>
                    ))}
                  </div>
                  {n.note && <div className="text-xs text-zinc-600 mt-1">{n.note}</div>}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="booking" className="pt-6">
          <BookingSection lead={lead} constants={constants} onReload={reload} />
        </TabsContent>

        <TabsContent value="exchange" className="pt-6">
          <ExchangeSection lead={lead} constants={constants} onReload={reload} />
        </TabsContent>

        <TabsContent value="delivery" className="pt-6">
          <DeliverySection lead={lead} constants={constants} onReload={reload} />
        </TabsContent>

        <TabsContent value="documents" className="pt-6">
          <DocumentsSection lead={lead} constants={constants} onReload={reload} />
        </TabsContent>

        <TabsContent value="whatsapp" className="pt-6">
          <WhatsappSection lead={lead} constants={constants} onReload={reload} />
        </TabsContent>

        <TabsContent value="timeline" className="pt-6">
          <div className="bg-white border border-zinc-200 rounded-sm">
            {timeline.length === 0 && <div className="p-6 text-sm text-zinc-400">No activity yet.</div>}
            {timeline.map((t) => (
              <div key={t.id} className="p-4 border-b border-zinc-100 last:border-0 flex items-start gap-3">
                <div className="w-8 h-8 rounded-sm bg-zinc-900 text-white flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{t.event}</div>
                  {Object.keys(t.meta || {}).length > 0 && (
                    <div className="text-xs text-zinc-500 mt-1 font-mono">{JSON.stringify(t.meta)}</div>
                  )}
                  <div className="text-xs text-zinc-500 mt-1">{t.actor_name} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
