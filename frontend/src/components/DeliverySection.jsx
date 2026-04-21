import React, { useEffect, useMemo, useState } from "react";
import { api, API, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "./ui/dialog";
import { toast } from "sonner";
import {
  Truck, CheckCircle2, XCircle, AlertTriangle, Printer, KeyRound, Plus,
  PackageCheck, Gift, MessageSquare,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const Card = ({ title, children, right, tone }) => (
  <div className={`border rounded-sm p-5 mb-4 ${tone === "danger" ? "bg-rose-50 border-rose-200" : "bg-white border-zinc-200"}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

const Kv = ({ label, value }) => (
  <div>
    <div className="overline">{label}</div>
    <div className="mt-1 text-sm text-zinc-900">{value ?? "—"}</div>
  </div>
);

const CheckRow = ({ label, on, onToggle, disabled }) => (
  <label className={`flex items-center gap-3 p-3 border rounded-sm ${on ? "bg-emerald-50 border-emerald-200" : "bg-zinc-50 border-zinc-200"} ${disabled ? "opacity-60" : "cursor-pointer"}`}>
    <input type="checkbox" checked={!!on} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} />
    {on ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-zinc-400" />}
    <span className="text-sm font-medium">{label}</span>
  </label>
);

export default function DeliverySection({ lead, constants, onReload }) {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "super_admin";

  const [delivery, setDelivery] = useState(null);
  const [booking, setBooking] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createForm, setCreateForm] = useState({
    delivery_date: today(),
    time_slot: "",
    instant_bypass: false,
    bypass_reason: "",
    notes: "",
  });

  const [accessory, setAccessory] = useState({ name: "Helmet", quantity: 1, value: 0 });
  const [otpDialog, setOtpDialog] = useState(false);
  const [otp, setOtp] = useState("");
  const [lastOtp, setLastOtp] = useState(null);

  const reload = async () => {
    setLoading(true);
    const [dRes, bRes, lRes] = await Promise.all([
      api.get(`/leads/${lead.id}/delivery`),
      api.get(`/leads/${lead.id}/booking`),
      api.get(`/leads/${lead.id}/whatsapp-logs`),
    ]);
    setDelivery(dRes.data);
    setBooking(bRes.data);
    setLogs(lRes.data);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lead?.id]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...createForm };
      if (!payload.instant_bypass) { payload.bypass_reason = null; }
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      await api.post(`/leads/${lead.id}/delivery`, payload);
      toast.success("Delivery scheduled");
      await reload();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const updateChecklist = async (key, val) => {
    const nextChecklist = { ...(delivery.checklist || {}), [key]: val };
    try {
      await api.put(`/deliveries/${delivery.id}`, { checklist: nextChecklist });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const addAccessory = async () => {
    if (!accessory.name.trim()) return;
    const next = [...(delivery.accessories || []), {
      name: accessory.name,
      quantity: Number(accessory.quantity || 1),
      value: Number(accessory.value || 0),
    }];
    try {
      await api.put(`/deliveries/${delivery.id}`, { accessories: next });
      setAccessory({ name: "Helmet", quantity: 1, value: 0 });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const removeAccessory = async (idx) => {
    const next = (delivery.accessories || []).filter((_, i) => i !== idx);
    try {
      await api.put(`/deliveries/${delivery.id}`, { accessories: next });
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const genOtp = async () => {
    try {
      const { data } = await api.post(`/deliveries/${delivery.id}/otp-generate`);
      setLastOtp(data.otp);
      setOtpDialog(true);
      toast.success("OTP generated (valid 10 min)");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const verifyOtp = async () => {
    try {
      await api.post(`/deliveries/${delivery.id}/otp-verify`, null, { params: { otp } });
      toast.success("OTP verified");
      setOtpDialog(false);
      setOtp("");
      setLastOtp(null);
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const complete = async () => {
    try {
      await api.post(`/deliveries/${delivery.id}/complete`);
      toast.success("Delivery completed!");
      reload();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const printChallan = () => {
    const url = `${API}/deliveries/${delivery.id}/challan?auth=${encodeURIComponent(localStorage.getItem("access_token") || "")}`;
    window.open(url, "_blank");
  };

  if (loading) return <div className="text-sm text-zinc-400">Loading delivery...</div>;

  const pending = booking ? (booking.pending_amount || 0) : 0;

  if (!delivery) {
    const canCreate = booking && booking.status === "Confirmed";
    return (
      <Card
        title="Schedule Delivery"
        right={!canCreate && <span className="text-xs text-zinc-500">Confirmed booking + allotment required (or admin bypass)</span>}
      >
        {pending > 0 && (
          <div className="mb-3 p-3 border border-amber-200 bg-amber-50 rounded-sm text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700" /> Pending amount ₹{pending}. Collect before delivery can complete.
          </div>
        )}
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="overline">Delivery Date *</Label>
            <Input type="date" required value={createForm.delivery_date} onChange={(e) => setCreateForm({ ...createForm, delivery_date: e.target.value })} className="mt-2" data-testid="dlv-date" />
          </div>
          <div>
            <Label className="overline">Time Slot</Label>
            <Input placeholder="e.g. 10:00-12:00" value={createForm.time_slot} onChange={(e) => setCreateForm({ ...createForm, time_slot: e.target.value })} className="mt-2" data-testid="dlv-slot" />
          </div>
          <div className="md:col-span-2 p-3 border border-zinc-200 rounded-sm">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.instant_bypass}
                onChange={(e) => setCreateForm({ ...createForm, instant_bypass: e.target.checked })}
                disabled={!isManager}
                data-testid="dlv-bypass"
              />
              <span className={!isManager ? "text-zinc-400" : ""}>Instant delivery (bypass booking/allotment)</span>
              {!isManager && <span className="text-xs text-zinc-400">— admin only</span>}
            </label>
            {createForm.instant_bypass && (
              <div className="mt-2">
                <Label className="overline">Reason *</Label>
                <Input value={createForm.bypass_reason} onChange={(e) => setCreateForm({ ...createForm, bypass_reason: e.target.value })} className="mt-2" data-testid="dlv-bypass-reason" />
              </div>
            )}
          </div>
          <div className="md:col-span-2">
            <Label className="overline">Notes</Label>
            <Textarea rows={2} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} className="mt-2" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm font-bold" data-testid="create-delivery-btn">
              <Truck className="w-4 h-4 mr-1" /> Schedule Delivery
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  const checklist = delivery.checklist || {};
  const allChecked = Object.values(checklist).every(Boolean);
  const canComplete = allChecked && delivery.otp_verified && pending === 0 && delivery.status !== "Delivered";
  const isDelivered = delivery.status === "Delivered";

  const statusClass = {
    Scheduled: "bg-blue-100 text-blue-700",
    Ready: "bg-amber-100 text-amber-700",
    Delivered: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-rose-100 text-rose-700",
  };

  return (
    <>
      <Card
        title="Delivery"
        right={
          <div className="flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${statusClass[delivery.status]}`}>
              {delivery.status}
            </span>
            {isDelivered && (
              <Button size="sm" onClick={printChallan} className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="print-challan-btn">
                <Printer className="w-4 h-4 mr-1" /> Challan
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Kv label="Delivery Date" value={<span className="font-mono">{delivery.delivery_date}</span>} />
          <Kv label="Time Slot" value={delivery.time_slot} />
          <Kv label="Chassis" value={<span className="font-mono">{delivery.chassis_number || "—"}</span>} />
          <Kv label="Engine" value={<span className="font-mono">{delivery.engine_number || "—"}</span>} />
          <Kv label="Final Price" value={booking ? <span className="font-mono">₹{booking.final_deal_price}</span> : "—"} />
          <Kv label="Paid" value={booking ? <span className="font-mono text-emerald-700">₹{booking.total_paid || 0}</span> : "—"} />
          <Kv label="Pending" value={<span className={`font-mono ${pending > 0 ? "text-rose-700" : "text-emerald-700"}`}>₹{pending}</span>} />
          <Kv label="OTP Verified" value={delivery.otp_verified ? <span className="text-emerald-700 font-semibold">✓ Yes</span> : <span className="text-rose-700">No</span>} />
        </div>
        {delivery.instant_bypass && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-800">
            <AlertTriangle className="w-3 h-3 inline mr-1" /> Instant delivery: {delivery.bypass_reason}
          </div>
        )}
      </Card>

      <Card title="Pre-delivery checklist">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CheckRow
            label="Payment Completed"
            on={checklist.payment_completed}
            onToggle={(v) => updateChecklist("payment_completed", v)}
            disabled={isDelivered || pending > 0}
          />
          <CheckRow
            label="Documents Verified"
            on={checklist.documents_verified}
            onToggle={(v) => updateChecklist("documents_verified", v)}
            disabled={isDelivered}
          />
          <CheckRow
            label="Vehicle Ready (PDI Done)"
            on={checklist.vehicle_ready}
            onToggle={(v) => updateChecklist("vehicle_ready", v)}
            disabled={isDelivered}
          />
          <CheckRow
            label="Accessories Ready"
            on={checklist.accessories_ready}
            onToggle={(v) => updateChecklist("accessories_ready", v)}
            disabled={isDelivered}
          />
        </div>
      </Card>

      <Card
        title="Accessories"
        right={
          !isDelivered && (
            <div className="flex gap-2">
              <Select value={accessory.name} onValueChange={(v) => setAccessory({ ...accessory, name: v })}>
                <SelectTrigger className="w-40 h-9" data-testid="acc-name"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {constants?.default_accessories?.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" className="w-16 h-9" value={accessory.quantity} onChange={(e) => setAccessory({ ...accessory, quantity: e.target.value })} data-testid="acc-qty" />
              <Input type="number" placeholder="value" className="w-24 h-9" value={accessory.value} onChange={(e) => setAccessory({ ...accessory, value: e.target.value })} data-testid="acc-value" />
              <Button size="sm" onClick={addAccessory} className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="add-acc-btn">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )
        }
      >
        {(delivery.accessories || []).length === 0 && <div className="text-sm text-zinc-400">No accessories added.</div>}
        {(delivery.accessories || []).length > 0 && (
          <table className="data-table w-full">
            <thead><tr><th>Item</th><th>Qty</th><th style={{ textAlign: "right" }}>Value</th><th></th></tr></thead>
            <tbody>
              {(delivery.accessories || []).map((a, i) => (
                <tr key={i}>
                  <td><Gift className="w-3 h-3 inline mr-1 text-zinc-500" /> {a.name}</td>
                  <td className="font-mono">{a.quantity}</td>
                  <td className="font-mono" style={{ textAlign: "right" }}>₹{a.value}</td>
                  <td>{!isDelivered && <button onClick={() => removeAccessory(i)} className="text-xs text-rose-600 hover:underline">remove</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {!isDelivered && (
        <Card title="Customer confirmation" right={
          <Button size="sm" onClick={genOtp} variant="outline" className="rounded-sm" data-testid="gen-otp-btn">
            <KeyRound className="w-4 h-4 mr-1" /> Generate OTP
          </Button>
        }>
          <div className="text-sm text-zinc-600">
            {delivery.otp_verified ? (
              <span className="text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 inline mr-1" /> Customer verified via OTP
              </span>
            ) : (
              "Generate an OTP, share with the customer, then verify to confirm receipt."
            )}
          </div>
        </Card>
      )}

      {!isDelivered && (
        <div className="flex justify-end">
          <Button
            onClick={complete}
            disabled={!canComplete}
            className="bg-emerald-600 hover:bg-emerald-700 rounded-sm font-bold"
            data-testid="complete-delivery-btn"
          >
            <PackageCheck className="w-4 h-4 mr-2" /> Complete Delivery
          </Button>
        </div>
      )}

      <Card title={`WhatsApp messages (${logs.length})`}>
        {logs.length === 0 && <div className="text-sm text-zinc-400">No messages logged.</div>}
        {logs.map((l) => (
          <div key={l.id} className="p-3 border-b border-zinc-100 last:border-0" data-testid={`wa-log-${l.id}`}>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <MessageSquare className="w-3 h-3" /> {l.intent} · {new Date(l.created_at).toLocaleString()} ·
              <span className="font-mono">{l.status}</span>
            </div>
            <div className="text-sm mt-1 font-mono text-zinc-700">
              {JSON.stringify(l.payload)}
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={otpDialog} onOpenChange={setOtpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Customer OTP</DialogTitle></DialogHeader>
          {lastOtp && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm text-center">
              <div className="overline">Share with customer</div>
              <div className="font-mono text-3xl font-bold tracking-widest mt-1" data-testid="otp-display">{lastOtp}</div>
              <div className="text-xs text-zinc-500 mt-1">Valid for 10 minutes · also logged to WhatsApp</div>
            </div>
          )}
          <div>
            <Label className="overline">Enter OTP read by customer</Label>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" className="mt-2 font-mono text-center tracking-widest" data-testid="otp-input" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpDialog(false)}>Close</Button>
            <Button onClick={verifyOtp} className="bg-zinc-900 hover:bg-zinc-800" data-testid="verify-otp-btn">Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
