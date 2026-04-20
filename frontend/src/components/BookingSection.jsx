import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "../api";
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
  Calendar, Plus, Ban, CheckCircle2, AlertTriangle, Car,
  Hash, BadgeDollarSign,
} from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const Kv = ({ label, value }) => (
  <div>
    <div className="overline">{label}</div>
    <div className="mt-1 text-sm text-zinc-900">{value ?? "—"}</div>
  </div>
);

const Card = ({ title, children, right, tone }) => (
  <div className={`border rounded-sm p-5 mb-4 ${tone === "danger" ? "bg-rose-50 border-rose-200" : "bg-white border-zinc-200"}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

export default function BookingSection({ lead, constants, onReload }) {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "super_admin";

  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [allotment, setAllotment] = useState(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    booking_date: today(),
    expected_delivery_date: "",
    booking_amount: "",
    finance_company: "",
    down_payment: "",
    emi: "",
    loan_status: "",
    exchange_final_value: "",
    notes: "",
  });
  const [editForm, setEditForm] = useState(null);

  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", date: today(), mode: "Cash", notes: "" });

  const [allotOpen, setAllotOpen] = useState(false);
  const [allot, setAllot] = useState({ chassis_number: "", engine_number: "" });

  const loadAll = async () => {
    const bRes = await api.get(`/leads/${lead.id}/booking`);
    const b = bRes.data;
    setBooking(b);
    if (b) {
      const [pRes, aRes] = await Promise.all([
        api.get(`/bookings/${b.id}/payments`),
        api.get(`/bookings/${b.id}/allotment`),
      ]);
      setPayments(pRes.data);
      setAllotment(aRes.data);
    } else {
      setPayments([]);
      setAllotment(null);
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [lead?.id]);

  const deal = lead.deal || {};
  const finalPrice = deal.final_deal_price;

  const createBooking = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...createForm };
      ["booking_amount", "down_payment", "emi", "exchange_final_value"].forEach((k) => {
        payload[k] = payload[k] === "" || payload[k] == null ? null : Number(payload[k]);
      });
      if (payload.booking_amount == null) throw { response: { data: { detail: "Booking amount required" } } };
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      await api.post(`/leads/${lead.id}/booking`, payload);
      toast.success("Booking created");
      await loadAll();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    }
  };

  const saveEdit = async () => {
    try {
      const payload = { ...editForm };
      ["booking_amount", "down_payment", "emi", "exchange_final_value"].forEach((k) => {
        if (payload[k] === "" || payload[k] == null) payload[k] = null;
        else payload[k] = Number(payload[k]);
      });
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      await api.put(`/bookings/${booking.id}`, payload);
      toast.success("Booking updated");
      setEditForm(null);
      await loadAll();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const confirmBooking = async () => {
    try {
      await api.post(`/bookings/${booking.id}/confirm`);
      toast.success("Booking confirmed");
      await loadAll();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const cancelBooking = async () => {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      await api.post(`/bookings/${booking.id}/cancel`);
      toast.success("Booking cancelled");
      await loadAll();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const addPayment = async () => {
    try {
      const payload = { ...pay, amount: Number(pay.amount) };
      if (!payload.amount || payload.amount <= 0) {
        toast.error("Amount must be positive");
        return;
      }
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      await api.post(`/bookings/${booking.id}/payments`, payload);
      toast.success("Payment added");
      setPayOpen(false);
      setPay({ amount: "", date: today(), mode: "Cash", notes: "" });
      await loadAll();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const assignVehicle = async () => {
    try {
      if (!allot.chassis_number.trim()) {
        toast.error("Chassis number is required");
        return;
      }
      await api.post(`/bookings/${booking.id}/allotment`, allot);
      toast.success("Vehicle allotted");
      setAllotOpen(false);
      setAllot({ chassis_number: "", engine_number: "" });
      await loadAll();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  // ============ RENDER ============

  if (!finalPrice) {
    return (
      <Card title="Booking" tone="danger">
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            Set <span className="font-semibold">Final Deal Price</span> on the Deal tab before creating a booking.
          </div>
        </div>
      </Card>
    );
  }

  if (!booking) {
    return (
      <Card title="Create Booking" right={
        <span className="text-xs text-zinc-500">Final Deal Price: <span className="font-mono font-bold">₹{finalPrice}</span></span>
      }>
        <form onSubmit={createBooking} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="overline">Booking Date</Label>
            <Input type="date" value={createForm.booking_date} onChange={(e) => setCreateForm({ ...createForm, booking_date: e.target.value })} className="mt-2" data-testid="booking-date" />
          </div>
          <div>
            <Label className="overline">Expected Delivery Date *</Label>
            <Input type="date" required value={createForm.expected_delivery_date} onChange={(e) => setCreateForm({ ...createForm, expected_delivery_date: e.target.value })} className="mt-2" data-testid="booking-delivery-date" />
          </div>
          <div>
            <Label className="overline">Booking Amount *</Label>
            <Input type="number" required value={createForm.booking_amount} onChange={(e) => setCreateForm({ ...createForm, booking_amount: e.target.value })} className="mt-2" data-testid="booking-amount" />
          </div>
          <div>
            <Label className="overline">Loan Status</Label>
            <Select value={createForm.loan_status || "__NONE__"} onValueChange={(v) => setCreateForm({ ...createForm, loan_status: v === "__NONE__" ? "" : v })}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {constants?.loan_statuses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="overline">Finance Company</Label>
            <Input value={createForm.finance_company} onChange={(e) => setCreateForm({ ...createForm, finance_company: e.target.value })} className="mt-2" />
          </div>
          <div>
            <Label className="overline">Down Payment</Label>
            <Input type="number" value={createForm.down_payment} onChange={(e) => setCreateForm({ ...createForm, down_payment: e.target.value })} className="mt-2" />
          </div>
          <div>
            <Label className="overline">EMI</Label>
            <Input type="number" value={createForm.emi} onChange={(e) => setCreateForm({ ...createForm, emi: e.target.value })} className="mt-2" />
          </div>
          <div>
            <Label className="overline">Exchange Final Value</Label>
            <Input type="number" value={createForm.exchange_final_value} onChange={(e) => setCreateForm({ ...createForm, exchange_final_value: e.target.value })} className="mt-2" />
          </div>
          <div className="md:col-span-2">
            <Label className="overline">Notes</Label>
            <Textarea rows={2} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} className="mt-2" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm font-bold" data-testid="create-booking-btn">
              <Plus className="w-4 h-4 mr-1" /> Create Booking
            </Button>
          </div>
        </form>
      </Card>
    );
  }

  const statusColor = {
    Pending: "bg-amber-100 text-amber-700",
    Confirmed: "bg-emerald-100 text-emerald-700",
    Cancelled: "bg-rose-100 text-rose-700",
  };

  const isCancelled = booking.status === "Cancelled";
  const isConfirmed = booking.status === "Confirmed";

  return (
    <>
      <Card
        title="Booking"
        right={
          <div className="flex items-center gap-2">
            <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${statusColor[booking.status]}`}>
              {booking.status}
            </span>
            {!isCancelled && !isConfirmed && (
              <Button onClick={confirmBooking} size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" data-testid="confirm-booking-btn">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
              </Button>
            )}
            {!isCancelled && isManager && (
              <Button onClick={cancelBooking} size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700 hover:bg-rose-50" data-testid="cancel-booking-btn">
                <Ban className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Kv label="Final Deal Price" value={<span className="font-mono">₹{booking.final_deal_price}</span>} />
          <Kv label="Booking Amount" value={<span className="font-mono">₹{booking.booking_amount}</span>} />
          <Kv label="Total Paid" value={<span className="font-mono text-emerald-700">₹{booking.total_paid || 0}</span>} />
          <Kv label="Pending" value={<span className={`font-mono ${(booking.pending_amount || 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>₹{booking.pending_amount || 0}</span>} />
          <Kv label="Booking Date" value={<span className="font-mono">{booking.booking_date}</span>} />
          <Kv label="Expected Delivery" value={<span className="font-mono">{booking.expected_delivery_date}</span>} />
          <Kv label="Loan Status" value={booking.loan_status} />
          <Kv label="Finance Co." value={booking.finance_company} />
        </div>
        {booking.notes && <div className="text-sm text-zinc-700 border-t border-zinc-100 pt-3">{booking.notes}</div>}
        <div className="flex justify-end mt-3">
          <Button size="sm" variant="outline" className="rounded-sm" onClick={() => setEditForm({
            booking_date: booking.booking_date,
            expected_delivery_date: booking.expected_delivery_date,
            booking_amount: booking.booking_amount,
            finance_company: booking.finance_company || "",
            down_payment: booking.down_payment ?? "",
            emi: booking.emi ?? "",
            loan_status: booking.loan_status || "",
            exchange_final_value: booking.exchange_final_value ?? "",
            notes: booking.notes || "",
          })} data-testid="edit-booking-btn">
            Edit Booking
          </Button>
        </div>
      </Card>

      {editForm && (
        <Dialog open={!!editForm} onOpenChange={(v) => !v && setEditForm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit booking</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {isManager && (
                <div>
                  <Label className="overline">Booking Date</Label>
                  <Input type="date" value={editForm.booking_date} onChange={(e) => setEditForm({ ...editForm, booking_date: e.target.value })} className="mt-2" />
                </div>
              )}
              <div>
                <Label className="overline">Expected Delivery Date</Label>
                <Input type="date" value={editForm.expected_delivery_date} onChange={(e) => setEditForm({ ...editForm, expected_delivery_date: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label className="overline">Booking Amount</Label>
                <Input type="number" value={editForm.booking_amount} onChange={(e) => setEditForm({ ...editForm, booking_amount: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label className="overline">Loan Status</Label>
                <Select value={editForm.loan_status || "__NONE__"} onValueChange={(v) => setEditForm({ ...editForm, loan_status: v === "__NONE__" ? "" : v })}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__NONE__">—</SelectItem>
                    {constants?.loan_statuses?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="overline">Finance Company</Label>
                <Input value={editForm.finance_company} onChange={(e) => setEditForm({ ...editForm, finance_company: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label className="overline">Down Payment</Label>
                <Input type="number" value={editForm.down_payment} onChange={(e) => setEditForm({ ...editForm, down_payment: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label className="overline">EMI</Label>
                <Input type="number" value={editForm.emi} onChange={(e) => setEditForm({ ...editForm, emi: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label className="overline">Exchange Final Value</Label>
                <Input type="number" value={editForm.exchange_final_value} onChange={(e) => setEditForm({ ...editForm, exchange_final_value: e.target.value })} className="mt-2" />
              </div>
              <div className="md:col-span-2">
                <Label className="overline">Notes</Label>
                <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="mt-2" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditForm(null)}>Cancel</Button>
              <Button onClick={saveEdit} className="bg-zinc-900 hover:bg-zinc-800" data-testid="save-booking-btn">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card title="Payments" right={
        !isCancelled && (
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="add-payment-btn">
                <Plus className="w-4 h-4 mr-1" /> Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add payment</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="overline">Amount</Label>
                  <Input type="number" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="mt-2" data-testid="pay-amount" />
                </div>
                <div>
                  <Label className="overline">Date</Label>
                  <Input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} className="mt-2" />
                </div>
                <div>
                  <Label className="overline">Mode</Label>
                  <Select value={pay.mode} onValueChange={(v) => setPay({ ...pay, mode: v })}>
                    <SelectTrigger className="mt-2" data-testid="pay-mode"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {constants?.payment_modes?.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="overline">Notes</Label>
                  <Input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} className="mt-2" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                <Button onClick={addPayment} className="bg-zinc-900 hover:bg-zinc-800" data-testid="save-payment-btn">Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      }>
        {payments.length === 0 && <div className="text-sm text-zinc-400">No payments recorded.</div>}
        {payments.length > 0 && (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Notes</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} data-testid={`payment-${p.id}`}>
                  <td className="font-mono text-sm">{p.date}</td>
                  <td className="font-mono font-bold text-emerald-700">₹{p.amount}</td>
                  <td>{p.mode}</td>
                  <td className="text-zinc-600">{p.notes || "—"}</td>
                  <td className="text-zinc-500 text-xs">{p.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Vehicle Allotment"
        right={
          allotment ? (
            <span className="inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
              {allotment.status}
            </span>
          ) : (
            isConfirmed ? (
              <Dialog open={allotOpen} onOpenChange={setAllotOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 rounded-sm" data-testid="assign-vehicle-btn">
                    <Car className="w-4 h-4 mr-1" /> Assign Vehicle
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Assign vehicle</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="overline">Chassis Number *</Label>
                      <Input value={allot.chassis_number} onChange={(e) => setAllot({ ...allot, chassis_number: e.target.value })} className="mt-2 font-mono" data-testid="allot-chassis" />
                    </div>
                    <div>
                      <Label className="overline">Engine Number</Label>
                      <Input value={allot.engine_number} onChange={(e) => setAllot({ ...allot, engine_number: e.target.value })} className="mt-2 font-mono" data-testid="allot-engine" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAllotOpen(false)}>Cancel</Button>
                    <Button onClick={assignVehicle} className="bg-zinc-900 hover:bg-zinc-800" data-testid="save-allotment-btn">Allot</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : (
              <span className="text-xs text-zinc-500">Confirm booking first</span>
            )
          )
        }
      >
        {allotment ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="overline flex items-center gap-1"><Hash className="w-3 h-3" /> Chassis</div>
              <div className="mt-1 text-sm font-mono font-bold" data-testid="allot-chassis-display">{allotment.chassis_number}</div>
            </div>
            <div>
              <div className="overline">Engine</div>
              <div className="mt-1 text-sm font-mono">{allotment.engine_number || "—"}</div>
            </div>
            <Kv label="Allotted by" value={allotment.allotted_by_name} />
            <Kv label="Allotted at" value={allotment.allotted_at ? new Date(allotment.allotted_at).toLocaleString() : "—"} />
          </div>
        ) : (
          <div className="text-sm text-zinc-400">No vehicle assigned yet.</div>
        )}
      </Card>
    </>
  );
}
