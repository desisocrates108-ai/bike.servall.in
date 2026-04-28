import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Upload, Camera, FileText, X as XIcon } from "lucide-react";

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
    city: "",
    source: "Walk-in",
    branch_id: user?.branch_id || "",
    priority: "Warm",
    assigned_to: user?.role === "sales_executive" ? user.id : "",
    brand_id: "",
    model_id: "",
    variant_id: "",
    color_id: "",
    vehicle_type: "",     // Bike / Scooty
    test_ride_done: false,
    purchase_type: "New Purchase",
    customer_type: "",
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Staged files for Identity + Exchange — uploaded after lead creation
  const [stagedFiles, setStagedFiles] = useState({
    aadhaar: [],        // Identity — Aadhaar (multi: front+back)
    pan: [],            // Identity — PAN (multi)
    other: [],          // Identity — Other docs (optional, multi)
    rc: [],             // Exchange — RC (multi: front+back+pdf)
    front_photo: [],    // Exchange — Vehicle Front
    back_photo: [],     // Exchange — Vehicle Back
  });

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
      ["alt_phone", "birthdate", "address", "city", "vehicle_type", "brand_id", "model_id", "variant_id", "color_id",
        "next_followup_date", "next_followup_type", "notes", "payment_mode", "source"].forEach((k) => {
        if (payload[k] === "") payload[k] = null;
      });

      const { data } = await api.post("/leads", payload);

      // Upload staged files (only when customer_type wants documents)
      const wantsDocs = payload.customer_type === "Instant Buyer" || payload.customer_type === "Token Finance Buyer";
      const isExch = payload.purchase_type === "Exchange Vehicle";
      const identityKeys = ["aadhaar", "pan", "other"];
      const exchangeKeys = ["rc", "front_photo", "back_photo"];
      const keys = wantsDocs ? (isExch ? [...identityKeys, ...exchangeKeys] : identityKeys) : [];
      const all = keys.flatMap((k) => (stagedFiles[k] || []).map((s) => ({ docType: k, file: s.file })));
      if (all.length > 0) {
        toast.loading(`Uploading ${all.length} file(s)…`, { id: "exch-up" });
        for (const { docType, file } of all) {
          try {
            const fd = new FormData();
            fd.append("file", file);
            await api.post(`/leads/${data.id}/exchange-photos`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
              params: { doc_type: docType },
            });
          } catch (err) {
            console.error("Upload failed", docType, err);
          }
        }
        toast.success(`${all.length} file(s) uploaded`, { id: "exch-up" });
      }

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
        <Section title="Customer Type" desc="Pick the buying intent — drives which fields are needed.">
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="customer-type-grid">
            {[
              { v: "Instant Buyer", title: "Instant Buyer", sub: "Pays full now → Booking" },
              { v: "Token Finance Buyer", title: "Token / Finance", sub: "Token or finance → Hold" },
              { v: "Just Inquiry", title: "Just Inquiry", sub: "Looking only → Follow-up" },
            ].map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => set("customer_type", opt.v)}
                className={`border-2 rounded-sm p-3 text-left transition-colors ${
                  form.customer_type === opt.v
                    ? "border-brand bg-brand/5 text-brand-dark"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                }`}
                data-testid={`customer-type-${opt.v.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="font-bold text-sm">{opt.title}</div>
                <div className="text-[10px] uppercase font-semibold mt-0.5 text-zinc-500">{opt.sub}</div>
              </button>
            ))}
          </div>
        </Section>

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
            <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="House / Street / Area" data-testid="customer-address-input" />
          </Field>
          <Field label="City *">
            <Input required value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Bilimora" data-testid="customer-city-input" />
          </Field>
        </Section>

        <Section title="Lead Meta" desc={showAdvanced ? "Source, branch, priority — usually auto-set." : "Hidden by default — click below to override."}>
          {!showAdvanced && (
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="text-sm font-bold text-brand hover:underline"
                data-testid="show-advanced-btn"
              >
                Show advanced (Source / Priority / Assign) →
              </button>
            </div>
          )}
          {showAdvanced && (<>
          <Field label="Lead Source">
            <Select value={form.source} onValueChange={(v) => set("source", v)}>
              <SelectTrigger data-testid="source-select"><SelectValue placeholder="Walk-in" /></SelectTrigger>
              <SelectContent>
                {constants?.lead_sources?.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Branch (POS)">
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
          </>)}
        </Section>

        <Section title="Vehicle Interest" desc="What is the customer looking for? All optional.">
          <Field label="Vehicle Type">
            <Select value={form.vehicle_type || "__NONE__"} onValueChange={(v) => set("vehicle_type", v === "__NONE__" ? "" : v)}>
              <SelectTrigger data-testid="vehicle-type-select"><SelectValue placeholder="Bike / Scooty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__NONE__">—</SelectItem>
                <SelectItem value="Bike">Bike</SelectItem>
                <SelectItem value="Scooty">Scooty</SelectItem>
                <SelectItem value="EV">EV</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Test Ride">
            <div className="flex gap-2 items-center h-10">
              <button
                type="button"
                onClick={() => set("test_ride_done", !form.test_ride_done)}
                className={`px-4 py-2 rounded-sm border-2 text-sm font-bold transition-colors ${
                  form.test_ride_done ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-white text-zinc-500"
                }`}
                data-testid="test-ride-toggle"
              >
                {form.test_ride_done ? "✓ Done" : "Not yet"}
              </button>
            </div>
          </Field>
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
          <Section title="Exchange Vehicle" desc="Quick info now — full details collected at confirmation.">
            <Field label="Registration Number">
              <Input value={form.exchange.registration_number} onChange={(e) => setNested("exchange", "registration_number", e.target.value)} placeholder="GJ06AB1234" data-testid="exch-regno" />
            </Field>
            <Field label="Expected Price">
              <Input type="number" value={form.exchange.expected_price} onChange={(e) => setNested("exchange", "expected_price", e.target.value)} placeholder="₹" data-testid="exch-expected" />
            </Field>
            {showAdvanced && (<>
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
            </>)}
          </Section>
        )}

        {(form.customer_type === "Instant Buyer" || form.customer_type === "Token Finance Buyer") && (
        <Section
          title="Documents"
          desc={form.purchase_type === "Exchange Vehicle"
            ? "Capture or upload Aadhaar, PAN (optional), RC Book, vehicle photos. Files saved after lead is created."
            : "Capture or upload Aadhaar (mandatory). PAN + Other docs optional."}
        >
          <div className="md:col-span-2 space-y-5">
            <div>
              <div className="overline mb-2">Identity (KYC)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StagedSlot
                  label="Aadhaar (front + back)"
                  testid="staged-aadhaar"
                  required
                  multi
                  files={stagedFiles.aadhaar}
                  onAdd={(f) => setStagedFiles((s) => ({ ...s, aadhaar: [...s.aadhaar, { file: f, preview: URL.createObjectURL(f) }] }))}
                  onRemove={(idx) => setStagedFiles((s) => ({ ...s, aadhaar: s.aadhaar.filter((_, i) => i !== idx) }))}
                />
                <StagedSlot
                  label="PAN Card"
                  testid="staged-pan"
                  multi
                  files={stagedFiles.pan}
                  onAdd={(f) => setStagedFiles((s) => ({ ...s, pan: [...s.pan, { file: f, preview: URL.createObjectURL(f) }] }))}
                  onRemove={(idx) => setStagedFiles((s) => ({ ...s, pan: s.pan.filter((_, i) => i !== idx) }))}
                />
                <StagedSlot
                  label="Other Documents"
                  testid="staged-other"
                  multi
                  files={stagedFiles.other}
                  onAdd={(f) => setStagedFiles((s) => ({ ...s, other: [...s.other, { file: f, preview: URL.createObjectURL(f) }] }))}
                  onRemove={(idx) => setStagedFiles((s) => ({ ...s, other: s.other.filter((_, i) => i !== idx) }))}
                />
              </div>
            </div>

            {form.purchase_type === "Exchange Vehicle" && (
              <div data-testid="staged-exchange-section" className="space-y-4">
                <div>
                  <div className="overline mb-2">Vehicle Documents</div>
                  <StagedSlot
                    label="RC Book (front + back)"
                    testid="staged-rc"
                    required
                    multi
                    files={stagedFiles.rc}
                    onAdd={(f) => setStagedFiles((s) => ({ ...s, rc: [...s.rc, { file: f, preview: URL.createObjectURL(f) }] }))}
                    onRemove={(idx) => setStagedFiles((s) => ({ ...s, rc: s.rc.filter((_, i) => i !== idx) }))}
                  />
                </div>
                <div>
                  <div className="overline mb-2">Vehicle Photos</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <StagedSlot
                      label="Front Photo"
                      testid="staged-front"
                      required
                      imageOnly
                      files={stagedFiles.front_photo}
                      onAdd={(f) => setStagedFiles((s) => ({ ...s, front_photo: [{ file: f, preview: URL.createObjectURL(f) }] }))}
                      onRemove={() => setStagedFiles((s) => ({ ...s, front_photo: [] }))}
                    />
                    <StagedSlot
                      label="Back Photo"
                      testid="staged-back"
                      required
                      imageOnly
                      files={stagedFiles.back_photo}
                      onAdd={(f) => setStagedFiles((s) => ({ ...s, back_photo: [{ file: f, preview: URL.createObjectURL(f) }] }))}
                      onRemove={() => setStagedFiles((s) => ({ ...s, back_photo: [] }))}
                    />
                  </div>
                </div>
              </div>
            )}

            {(() => {
              const isExch = form.purchase_type === "Exchange Vehicle";
              const target = isExch ? 4 : 1;
              const done =
                (stagedFiles.aadhaar.length ? 1 : 0) +
                (isExch ? (stagedFiles.rc.length ? 1 : 0) : 0) +
                (isExch ? (stagedFiles.front_photo.length ? 1 : 0) : 0) +
                (isExch ? (stagedFiles.back_photo.length ? 1 : 0) : 0);
              const other = stagedFiles.other.length;
              const pan = stagedFiles.pan.length;
              const extras = [];
              if (pan) extras.push(`+${pan} PAN`);
              if (other) extras.push(`+${other} other`);
              const extraStr = extras.length ? ` · ${extras.join(" · ")}` : "";
              return (
                <div className={`text-xs font-bold ${done === target ? "text-emerald-700" : "text-amber-700"}`} data-testid="staged-progress">
                  {done === target
                    ? `✅ All ${target} mandatory file(s) staged${extraStr}`
                    : `⚠️ ${done}/${target} mandatory file(s) — upload after lead is saved${extraStr}`}
                </div>
              );
            })()}
          </div>
        </Section>
        )}

        {showAdvanced && (
        <Section title="Deal (optional)" desc="Pricing details — leave blank if not yet finalized.">
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
        )}

        {showAdvanced && (
        <Section title="Payment & Finance (optional)">
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
        )}

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

function StagedSlot({ label, testid, imageOnly, multi, required, files, onAdd, onRemove }) {
  const captureRef = useRef(null);
  const uploadRef = useRef(null);
  const has = files && files.length > 0;
  const isImg = imageOnly === true;
  return (
    <div
      className={`border-2 rounded-sm p-3 ${
        has ? "border-emerald-300 bg-emerald-50/30" :
        required ? "border-dashed border-amber-300 bg-amber-50/30" :
        "border-dashed border-zinc-300 bg-zinc-50"
      }`}
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1">
          {label} {required && <span className="text-rose-600">*</span>}
          {multi && <span className="text-[9px] font-semibold text-zinc-500">(multi)</span>}
        </div>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${has ? "bg-emerald-600 text-white" : required ? "bg-amber-500 text-white" : "bg-zinc-400 text-white"}`}>
          {has ? (multi ? files.length : "✓") : (required ? "!" : "+")}
        </span>
      </div>

      {/* Two hidden inputs — capture (rear cam) + upload (file picker) */}
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onAdd(e.target.files[0]);
            e.target.value = "";
          }
        }}
        data-testid={`${testid}-capture-input`}
      />
      <input
        ref={uploadRef}
        type="file"
        accept={isImg ? "image/*" : "image/*,application/pdf"}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onAdd(e.target.files[0]);
            e.target.value = "";
          }
        }}
        data-testid={`${testid}-upload-input`}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => captureRef.current?.click()} className="rounded-sm font-semibold h-10 bg-white" data-testid={`${testid}-capture-btn`}>
          <Camera className="w-4 h-4 mr-1" /> {has && !multi ? "Re-capture" : "Capture"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => uploadRef.current?.click()} className="rounded-sm font-semibold h-10 bg-white" data-testid={`${testid}-upload-btn`}>
          <Upload className="w-4 h-4 mr-1" /> {has && !multi ? "Re-upload" : "Upload"}
        </Button>
      </div>

      {has && (
        <div className="mt-3">
          <div className={isImg && files.length > 1 ? "grid grid-cols-2 gap-1" : "space-y-1"}>
            {files.map((s, i) => (
              <div key={i} className="relative group">
                {isImg || (s.file.type || "").startsWith("image/") ? (
                  <img src={s.preview} alt={label} className="border border-zinc-200 w-full aspect-square object-cover rounded-sm" />
                ) : (
                  <div className="flex items-center gap-2 p-2 bg-white border border-zinc-200 rounded-sm text-xs font-mono">
                    <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                    <span className="truncate">{s.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-sm w-6 h-6 text-xs font-bold hover:bg-rose-700 flex items-center justify-center"
                  data-testid={`${testid}-del-${i}`}
                  aria-label="Remove"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
