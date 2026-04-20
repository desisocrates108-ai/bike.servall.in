import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { priorityClass, stageClass } from "../lib/labels";
import { ArrowLeft, Phone, MapPin, Calendar, Upload, FileText, Clock, User } from "lucide-react";
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

export default function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [constants, setConstants] = useState(null);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  const [colors, setColors] = useState([]);

  const [newFu, setNewFu] = useState({ type: "Call", notes: "", scheduled_date: "" });
  const [stageDialog, setStageDialog] = useState(false);
  const [nextStage, setNextStage] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostText, setLostText] = useState("");

  const reload = async () => {
    const [ld, tl, fu] = await Promise.all([
      api.get(`/leads/${id}`),
      api.get(`/leads/${id}/timeline`),
      api.get(`/leads/${id}/followups`),
    ]);
    setLead(ld.data);
    setTimeline(tl.data);
    setFollowups(fu.data);
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

  const submitFu = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/leads/${id}/followups`, newFu);
      toast.success("Follow-up added");
      setNewFu({ type: "Call", notes: "", scheduled_date: "" });
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

  return (
    <div className="p-6 md:p-10 max-w-[1400px]">
      <button
        onClick={() => nav("/leads")}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 mb-4"
        data-testid="back-to-leads"
      >
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
          </div>
          <div className="flex gap-2 mt-4">
            <span className={`inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider ${stageClass(lead.stage)}`} data-testid="lead-stage-badge">{lead.stage}</span>
            <span className={`inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider border ${priorityClass(lead.priority)}`}>{lead.priority}</span>
            <span className="inline-block px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-100 text-zinc-700">{lead.source}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={stageDialog} onOpenChange={setStageDialog}>
            <DialogTrigger asChild>
              <Button className="rounded-sm bg-zinc-900 hover:bg-zinc-800 font-bold" data-testid="change-stage-btn">
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
                <Button onClick={submitStage} disabled={!nextStage} className="bg-zinc-900 hover:bg-zinc-800" data-testid="confirm-stage-btn">
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="rounded-none border-b border-zinc-200 bg-transparent p-0 h-auto w-full justify-start gap-6">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="followups" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-followups">Follow-ups ({followups.length})</TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-zinc-900 data-[state=active]:shadow-none px-0 pb-2" data-testid="tab-documents">Documents ({(lead.documents || []).length})</TabsTrigger>
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
                <div className="col-span-2">
                  <Kv label="Address" value={lead.address} />
                </div>
              </div>
            </Card>

            <Card title="Lead">
              <div className="grid grid-cols-2 gap-4">
                <Kv label="Source" value={lead.source} />
                <Kv label="Branch" value={branchMap[lead.branch_id]?.name} />
                <Kv label="Sales Exec" value={userMap[lead.assigned_to]?.name} />
                <Kv label="Follow-up Count" value={<span className="font-mono">{lead.followup_count || 0}</span>} />
                <Kv label="Next Follow-up" value={<span className="font-mono">{lead.next_followup_date || "—"} {lead.next_followup_type ? `(${lead.next_followup_type})` : ""}</span>} />
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

            <Card title="Deal">
              <div className="grid grid-cols-2 gap-4">
                <Kv label="Customer Expected" value={deal.customer_expected_price != null ? <span className="font-mono">₹{deal.customer_expected_price}</span> : null} />
                <Kv label="Offered Price" value={deal.offered_price != null ? <span className="font-mono">₹{deal.offered_price}</span> : null} />
                <Kv label="Discount" value={deal.discount != null ? <span className="font-mono">₹{deal.discount}</span> : null} />
                <Kv label="Interest Level" value={deal.interest_level} />
                <Kv label="Payment Mode" value={lead.payment_mode} />
                {lead.payment_mode === "Finance" && (
                  <>
                    <Kv label="Finance Co." value={fin.finance_company} />
                    <Kv label="Down Payment" value={fin.down_payment != null ? <span className="font-mono">₹{fin.down_payment}</span> : null} />
                    <Kv label="EMI" value={fin.emi != null ? <span className="font-mono">₹{fin.emi}</span> : null} />
                    <Kv label="Tenure" value={fin.tenure ? <span className="font-mono">{fin.tenure} mo</span> : null} />
                  </>
                )}
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
          <Card title="Log a follow-up">
            <form onSubmit={submitFu} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={newFu.type} onValueChange={(v) => setNewFu((s) => ({ ...s, type: v }))}>
                <SelectTrigger data-testid="fu-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {constants?.followup_types?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={newFu.scheduled_date} onChange={(e) => setNewFu((s) => ({ ...s, scheduled_date: e.target.value }))} data-testid="fu-date" />
              <Input placeholder="Notes..." value={newFu.notes} onChange={(e) => setNewFu((s) => ({ ...s, notes: e.target.value }))} className="md:col-span-1" />
              <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm font-bold" data-testid="add-fu-btn">Add Follow-up</Button>
            </form>
          </Card>

          <div className="bg-white border border-zinc-200 rounded-sm">
            {followups.length === 0 && <div className="p-6 text-sm text-zinc-400">No follow-ups logged yet.</div>}
            {followups.map((f) => (
              <div key={f.id} className="p-4 border-b border-zinc-100 last:border-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="overline">{f.type}</span>
                      {f.scheduled_date && <span className="text-xs font-mono text-zinc-500">{f.scheduled_date}</span>}
                    </div>
                    <div className="text-sm mt-1">{f.notes || <span className="text-zinc-400">(No notes)</span>}</div>
                    <div className="text-xs text-zinc-500 mt-2"><User className="w-3 h-3 inline mr-1" />{f.created_by_name} · {new Date(f.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="pt-6">
          <Card title="Upload document">
            <div className="flex flex-wrap gap-3">
              {["ID Proof", "Address Proof", "RC", "Finance Document", "Booking Receipt", "Vehicle Photo", "Other"].map((t) => (
                <label
                  key={t}
                  className="inline-flex items-center gap-2 cursor-pointer border border-dashed border-zinc-300 rounded-sm px-3 py-2 text-sm hover:border-zinc-500"
                  data-testid={`upload-${t.toLowerCase().replace(/[ /]/g, "-")}`}
                >
                  <Upload className="w-4 h-4" /> {t}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], t)}
                  />
                </label>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(lead.documents || []).length === 0 && <div className="text-sm text-zinc-400">No documents uploaded.</div>}
            {(lead.documents || []).map((d) => (
              <a
                key={d.id}
                href={`${API}/files/${d.id}?auth=${encodeURIComponent(localStorage.getItem("access_token") || "")}`}
                target="_blank"
                rel="noreferrer"
                className="bg-white border border-zinc-200 rounded-sm p-4 hover:border-zinc-400 transition-colors block"
                data-testid={`doc-${d.id}`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-zinc-500" strokeWidth={1.5} />
                  <div className="overline">{d.doc_type}</div>
                </div>
                <div className="text-sm mt-1 truncate">{d.filename}</div>
              </a>
            ))}
          </div>
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
