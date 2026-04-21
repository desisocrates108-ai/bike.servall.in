import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/ui/input";
import { Phone, MessageCircle, Search, User } from "lucide-react";
import { stageClass } from "../lib/labels";

/**
 * Contacts — customer contact list (name, phone, stage, last interaction).
 * Actions: one-tap Call (tel:) and WhatsApp (wa.me).
 * Backend RBAC scopes /api/leads to the logged-in role.
 */
const sanitizePhone = (p) => (p || "").replace(/[^\d]/g, "");
const waHref = (p) => {
  const d = sanitizePhone(p);
  if (!d) return "#";
  // Add country code 91 (India) if 10-digit
  const num = d.length === 10 ? `91${d}` : d;
  return `https://wa.me/${num}`;
};
const telHref = (p) => {
  const d = sanitizePhone(p);
  return d ? `tel:${d}` : "#";
};

function daysAgo(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch { return ""; }
}

export default function Contacts() {
  const { t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/leads", { params: { page_size: 500 } });
        if (!cancelled) setLeads(data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // De-duplicate by phone — keep latest interaction
  const contacts = useMemo(() => {
    const map = new Map();
    leads.forEach((l) => {
      const p = sanitizePhone(l.phone);
      if (!p) return;
      const existing = map.get(p);
      const current = {
        id: l.id,
        name: l.customer_name,
        phone: l.phone,
        stage: l.stage,
        last_interaction: l.updated_at || l.created_at,
      };
      if (!existing || (new Date(current.last_interaction) > new Date(existing.last_interaction))) {
        map.set(p, current);
      }
    });
    const list = Array.from(map.values())
      .sort((a, b) => (new Date(b.last_interaction) - new Date(a.last_interaction)));
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((c) =>
      (c.name || "").toLowerCase().includes(needle) ||
      (c.phone || "").includes(needle)
    );
  }, [leads, q]);

  return (
    <>
      <PageHeader
        title={t("nav.contacts", "Contacts")}
        subtitle={`${contacts.length} ${t("common.total", "total").toLowerCase()}`}
        showBack={false}
        sticky
      />
      <div className="p-3 sm:p-6 max-w-[900px] mx-auto w-full">
        <div className="bg-white border border-zinc-200 rounded-sm p-3 mb-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              placeholder={t("search.placeholder", "Search name or phone...")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 rounded-sm h-10"
              data-testid="contacts-search-input"
            />
          </div>
        </div>

        {loading && <div className="py-8 text-center text-sm text-zinc-400">{t("common.loading")}</div>}
        {!loading && contacts.length === 0 && (
          <div className="py-12 text-center text-sm text-zinc-400">{t("contacts.empty", "No contacts yet.")}</div>
        )}

        <div className="space-y-2">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-zinc-200 rounded-sm p-3 flex items-center gap-2"
              data-testid={`contact-card-${c.id}`}
            >
              <Link to={`/leads/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0 active:bg-zinc-50 -m-3 p-3 rounded-sm">
                <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-zinc-500 uppercase">
                  {c.name?.[0] || <User className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{c.name}</div>
                  <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                    {c.phone}
                    <span>·</span>
                    <span className={`inline-block px-1.5 py-0 rounded-sm text-[10px] font-bold uppercase ${stageClass(c.stage)}`}>
                      {c.stage}
                    </span>
                  </div>
                  {c.last_interaction && (
                    <div className="text-[11px] text-zinc-400 mt-0.5">{daysAgo(c.last_interaction)}</div>
                  )}
                </div>
              </Link>
              <a
                href={telHref(c.phone)}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all text-white flex items-center justify-center flex-shrink-0"
                aria-label="Call"
                data-testid={`contact-call-${c.id}`}
              >
                <Phone className="w-4 h-4" strokeWidth={2} />
              </a>
              <a
                href={waHref(c.phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-[#25D366] hover:bg-[#1ebe5d] active:scale-95 transition-all text-white flex items-center justify-center flex-shrink-0"
                aria-label="WhatsApp"
                data-testid={`contact-wa-${c.id}`}
              >
                <MessageCircle className="w-4 h-4" strokeWidth={2} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
