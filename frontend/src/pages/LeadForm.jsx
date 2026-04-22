import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import PageHeader from "../components/PageHeader";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";

const Section = ({ title, desc, children }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-6 mb-4">
    <div className="mb-4">
      <div className="overline">{title}</div>
      {desc && <div className="text-sm text-zinc-500 mt-1">{desc}</div>}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </div>
);

const Field = ({ label, children, full }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <Label className="overline">{label}</Label>
    <div className="mt-2">{children}</div>
  </div>
);

export default function LeadForm() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [constants, setConstants] = useState(null);
  const [branches, setBranches] = useState([]);
  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  const [colors, setColors] = useState([]);
  const [users, setUsers] = useState([]);

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    alt_phone: "",
    birthdate: "",
    address: "",
    source: "",
    branch_id: user?.branch_id || "",
    priority: "Warm",
    assigned_to: user?.role === "sales_executive" ? user.id : "",
    brand_id: "",
    model_id: "",
    variant_id: "",
    color_id: "",
    purchase_type: "New Purchase",
    exchange: {
      registration_number: "", model_year: "", tyre_condition: "",
      battery_condition: "", body_condition: "", expected_price: "",
    },
    deal: { customer_expected_price: "", offered_price: "", discount: "", interest_level: "Warm" },
    payment_mode: "",
    finance: { finance_company: "", down_payment: "", emi: "", tenure: "" },
    next_followup_date: "",
    next_followup_type: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/constants").then((r) => setConstants(r.data));
    api.get("/branches").then((r) => setBranches(r.data));
    api.get("/brands").then((r) => setBrands(r.data));
    api.get("/colors").then((r) => setColors(r.data));
    api.get("/users").then((r) => setUsers(r.data));
  }, []);

  useEffect(() => {
    if (form.brand_id) {
      api.get("/models", { params: { brand_id: form.brand_id } }).then((r) => setModels(r.data));
    } else setModels([]);
  }, [form.brand_id]);

  useEffect(() => {
    if (form.model_id) {
      api.get("/variants", { params: { model_id: form.model_id } }).then((r) => setVariants(r.data));
    } else setVariants([]);
  }, [form.model_id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setNested = (parent, k, v) => setForm((f) => ({ ...f, [parent]: { ...f[parent], [k]: v } }));

  const branchExecs = useMemo(
    () => users.filter((u) => u.role === "sales_executive" && (!form.branch_id || u.branch_id === form.branch_id)),
    [users, form.branch_id]
  );

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = JSON.parse(JSON.stringify(form));
      // Cast numbers
      const numFields = {
        deal: ["customer_expected_price", "offered_price", "discount"],
        finance: ["down_payment", "emi", "tenure"],
        exchange: ["model_year", "expected_price"],
      };
      for (const [p, keys] of Object.entries(numFields)) {
        for (const k of keys) {
          if (payload[p] && payload[p][k] !== "" && payload[p][k] != null)
            payload[p][k] = Number(payload[p][k]);
          else if (payload[p]) payload[p][k] = null;
        }
      }
      if (payload.purchase_type !== "Exchange Vehicle") payload.exchange = null;
      if (payload.payment_mode !== "Finance") payload.finance = null;
      if (!payload.assigned_to) delete payload.assigned_to;
      // Remove empty optional strings
      ["alt_phone", "birthdate", "address", "brand_id", "model_id", "variant_id", "color_id",
        "next_followup_date", "next_followup_type", "notes", "payment_mode"].forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });

      const { data } = await api.post("/leads", payload);
      toast.success("Lead created");
      nav(`/leads/${data.id}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t("nav.new_lead")} subtitle="Capture a new inquiry" sticky />
      <div className="p-3 sm:p-6 max-w-[1200px] mx-auto w-full">

      <form onSubmit={submit}>
        <Section title="Customer" desc="Basic details about the customer.">
          <Field label="Customer Name *">
            <Input required value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} data-testid="customer-name-input" />
          </Field>
          <Field label="Phone *">
            <Input required value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="customer-phone-input" />
          </Field>
          <Field label="Alternate Phone">
            <Input value={form.alt_phone} onChange={(e) => set("alt_phone", e.target.value)} />
          </Field>
          <Field label="Birthdate">
            <Input type="date" value={form.birthdate} onChange={(e) => set("birthdate", e.target.value)} />
          </Field>
          <Field label="Address" full>
            <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </Section>

        <Section title="Lead Meta">
          <Field label="Lead Source *">
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger data-testid="source-select"><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {constants?.lead_sources?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Branch (POS) *">
            {user?.role === "sales_executive" ? (
              <div className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-sm text-sm text-zinc-600" data-testid="branch-auto-label">
                {branches.find((b) => b.id === user.branch_id)?.name || "Auto-assigned to your branch"}
                <span className="ml-2 text-[10px] uppercase font-bold text-emerald-700">· Auto</span>
              </div>
            ) : (
              <Select value={form.branch_id} onValueChange={(v) => set("branch_id", v)} disabled={user?.role === "admin"}>
                <SelectTrigger data-testid="branch-select"><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger data-testid="priority-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {constants?.priorities?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {user?.role !== "sales_executive" && (
            <Field label="Assign To">
              <Select value={form.assigned_to || "__AUTO__"} onValueChange={(v) => set("assigned_to", v === "__AUTO__" ? "" : v)}>
                <SelectTrigger data-testid="assign-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__AUTO__">Auto-assign (round-robin)</SelectItem>
                  {branchExecs.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </Section>

        <Section title="Vehicle" desc="Pick the brand, model, variant and color.">
          <Field label="Brand">
            <Select value={form.brand_id || "__NONE__"} onValueChange={(v) => { set("brand_id", v === "__NONE__" ? "" : v); set("model_id", ""); set("variant_id", ""); }}>
              <SelectTrigger data-testid="brand-select"><SelectValue placeholder="Select brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Model">
            <Select value={form.model_id || "__NONE__"} onValueChange={(v) => { set("model_id", v === "__NONE__" ? "" : v); set("variant_id", ""); }} disabled={!form.brand_id}>
              <SelectTrigger data-testid="model-select"><SelectValue placeholder="Select model" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Variant">
            <Select value={form.variant_id || "__NONE__"} onValueChange={(v) => set("variant_id", v === "__NONE__" ? "" : v)} disabled={!form.model_id}>
              <SelectTrigger data-testid="variant-select"><SelectValue placeholder="Select variant" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Color">
            <Select value={form.color_id || "__NONE__"} onValueChange={(v) => set("color_id", v === "__NONE__" ? "" : v)}>
              <SelectTrigger data-testid="color-select"><SelectValue placeholder="Select color" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {colors.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Purchase Type" full>
            <div className="flex gap-2">
              {["New Purchase", "Exchange Vehicle"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("purchase_type", t)}
                  className={`px-4 py-2 rounded-sm border text-sm font-medium ${form.purchase_type === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-300 hover:border-zinc-500"}`}
                  data-testid={`purchase-type-${t.toLowerCase().replace(" ", "-")}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {form.purchase_type === "Exchange Vehicle" && (
          <Section title="Exchange Vehicle" desc="Details of the vehicle being exchanged.">
            <Field label="Registration Number">
              <Input value={form.exchange.registration_number} onChange={(e) => setNested("exchange", "registration_number", e.target.value)} />
            </Field>
            <Field label="Model Year">
              <Input type="number" value={form.exchange.model_year} onChange={(e) => setNested("exchange", "model_year", e.target.value)} />
            </Field>
            <Field label="Tyre Condition">
              <Input placeholder="Good / Average / Worn" value={form.exchange.tyre_condition} onChange={(e) => setNested("exchange", "tyre_condition", e.target.value)} />
            </Field>
            <Field label="Battery Condition">
              <Input value={form.exchange.battery_condition} onChange={(e) => setNested("exchange", "battery_condition", e.target.value)} />
            </Field>
            <Field label="Body Condition">
              <Input value={form.exchange.body_condition} onChange={(e) => setNested("exchange", "body_condition", e.target.value)} />
            </Field>
            <Field label="Expected Price">
              <Input type="number" value={form.exchange.expected_price} onChange={(e) => setNested("exchange", "expected_price", e.target.value)} />
            </Field>
          </Section>
        )}

        <Section title="Deal">
          <Field label="Customer Expected Price">
            <Input type="number" value={form.deal.customer_expected_price} onChange={(e) => setNested("deal", "customer_expected_price", e.target.value)} />
          </Field>
          <Field label="Offered Price">
            <Input type="number" value={form.deal.offered_price} onChange={(e) => setNested("deal", "offered_price", e.target.value)} />
          </Field>
          <Field label="Discount">
            <Input type="number" value={form.deal.discount} onChange={(e) => setNested("deal", "discount", e.target.value)} />
          </Field>
          <Field label="Interest Level">
            <Select value={form.deal.interest_level} onValueChange={(v) => setNested("deal", "interest_level", v)}>
              <SelectTrigger data-testid="interest-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                {constants?.priorities?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Payment & Finance">
          <Field label="Payment Mode">
            <Select value={form.payment_mode || "__NONE__"} onValueChange={(v) => set("payment_mode", v === "__NONE__" ? "" : v)}>
              <SelectTrigger data-testid="payment-mode-select"><SelectValue placeholder="Select mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {constants?.payment_modes?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {form.payment_mode === "Finance" && (
            <>
              <Field label="Finance Company">
                <Input value={form.finance.finance_company} onChange={(e) => setNested("finance", "finance_company", e.target.value)} />
              </Field>
              <Field label="Down Payment">
                <Input type="number" value={form.finance.down_payment} onChange={(e) => setNested("finance", "down_payment", e.target.value)} />
              </Field>
              <Field label="EMI">
                <Input type="number" value={form.finance.emi} onChange={(e) => setNested("finance", "emi", e.target.value)} />
              </Field>
              <Field label="Tenure (months)">
                <Input type="number" value={form.finance.tenure} onChange={(e) => setNested("finance", "tenure", e.target.value)} />
              </Field>
            </>
          )}
        </Section>

        <Section title="Follow-up">
          <Field label="Next Follow-up Date">
            <Input type="date" value={form.next_followup_date} onChange={(e) => set("next_followup_date", e.target.value)} data-testid="next-fu-date" />
          </Field>
          <Field label="Follow-up Type">
            <Select value={form.next_followup_type || "__NONE__"} onValueChange={(v) => set("next_followup_type", v === "__NONE__" ? "" : v)}>
              <SelectTrigger data-testid="fu-type-select"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                {constants?.followup_types?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes" full>
            <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </Section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => nav(-1)} className="rounded-sm">Cancel</Button>
          <Button type="submit" disabled={busy} className="rounded-sm bg-brand hover:bg-brand-dark font-bold" data-testid="submit-lead-button">
            {busy ? "Saving..." : "Create Lead"}
          </Button>
        </div>
      </form>
      </div>
    </>
  );
}
