import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import {
  Send, CheckCheck, Check, AlertTriangle, Ban, RefreshCw, MessageSquare,
  UserX, UserCheck, ArrowDown, ArrowUp, Tag,
} from "lucide-react";

const Card = ({ title, children, right }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-5 mb-4">
    <div className="flex items-center justify-between mb-4">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

const StatusIcon = ({ status }) => {
  if (status === "READ") return <CheckCheck className="w-3 h-3 text-blue-600" />;
  if (status === "DELIVERED") return <CheckCheck className="w-3 h-3 text-zinc-500" />;
  if (status === "SENT") return <Check className="w-3 h-3 text-zinc-500" />;
  if (status === "FAILED") return <AlertTriangle className="w-3 h-3 text-rose-600" />;
  return <span className="text-xs text-zinc-400">...</span>;
};

export default function WhatsappSection({ lead, constants, onReload }) {
  const { user } = useAuth();
  const listRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [optedOut, setOptedOut] = useState(false);

  const [text, setText] = useState("");
  const [tplId, setTplId] = useState("");
  const [inbound, setInbound] = useState("");
  const [inboundTag, setInboundTag] = useState("");

  const reload = async () => {
    const [m, t, o] = await Promise.all([
      api.get(`/leads/${lead.id}/wa-messages`),
      api.get(`/wa-templates`),
      api.get(`/leads/${lead.id}/wa-optout`),
    ]);
    setMessages(m.data);
    setTemplates(t.data.filter((x) => x.active));
    setOptedOut(o.data.opted_out);
    setTimeout(() => listRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 50);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lead?.id]);

  const send = async () => {
    if (!text.trim() && !tplId) {
      toast.error("Enter a message or pick a template");
      return;
    }
    try {
      const payload = tplId ? { template_id: tplId } : { content: text, message_type: "text" };
      await api.post(`/leads/${lead.id}/wa-messages`, payload);
      setText("");
      setTplId("");
      toast.success("Sent");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const receive = async () => {
    if (!inbound.trim()) return;
    try {
      await api.post(`/leads/${lead.id}/wa-inbound`, {
        content: inbound,
        reply_tag: inboundTag || null,
      });
      setInbound("");
      setInboundTag("");
      toast.success("Reply logged");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const toggleOptOut = async () => {
    try {
      if (optedOut) await api.delete(`/leads/${lead.id}/wa-optout`);
      else await api.post(`/leads/${lead.id}/wa-optout`);
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const retry = async (mid) => {
    try {
      await api.post(`/wa-messages/${mid}/retry`);
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <>
      <Card
        title={`Conversation · ${lead.phone}`}
        right={
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">
              {messages.length} messages
            </span>
            <Button
              size="sm"
              variant={optedOut ? "default" : "outline"}
              className={`rounded-sm ${optedOut ? "bg-rose-600 hover:bg-rose-700" : ""}`}
              onClick={toggleOptOut}
              data-testid="optout-toggle"
            >
              {optedOut ? <><UserX className="w-4 h-4 mr-1" /> Opted out</> : <><UserCheck className="w-4 h-4 mr-1" /> Opted in</>}
            </Button>
          </div>
        }
      >
        <div
          ref={listRef}
          className="bg-zinc-50 rounded-sm p-3 h-[420px] overflow-y-auto border border-zinc-200"
          data-testid="wa-chat-list"
        >
          {messages.length === 0 && <div className="text-sm text-zinc-400 text-center py-20">No messages yet.</div>}
          {messages.map((m) => {
            const outbound = m.direction === "outbound";
            return (
              <div key={m.id} className={`flex mb-2 ${outbound ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                    outbound ? "bg-emerald-100 text-emerald-950" : "bg-white border border-zinc-200 text-zinc-900"
                  }`}
                  data-testid={`wa-msg-${m.id}`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                  {m.media_url && <div className="text-xs mt-1 font-mono text-zinc-500">📎 {m.media_url}</div>}
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-zinc-500">
                    {m.reply_tag && (
                      <span className="mr-auto bg-blue-100 text-blue-700 px-1 rounded font-bold uppercase tracking-wider">
                        <Tag className="w-2.5 h-2.5 inline mr-0.5" />{m.reply_tag}
                      </span>
                    )}
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {outbound && <StatusIcon status={m.status} />}
                    {outbound && m.status === "FAILED" && m.retry_count < 3 && (
                      <button onClick={() => retry(m.id)} className="text-zinc-500 hover:text-zinc-900" title="retry">
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {optedOut ? (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-sm text-sm text-rose-800">
            <Ban className="w-4 h-4 inline mr-1" /> Lead is opted out — sending is disabled.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <Select value={tplId || "__NONE__"} onValueChange={(v) => setTplId(v === "__NONE__" ? "" : v)}>
                <SelectTrigger className="w-52 h-9" data-testid="wa-tpl-select"><SelectValue placeholder="Template..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">— No template —</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder={tplId ? "Template will be used" : "Type a message..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="flex-1 h-9"
                disabled={!!tplId}
                data-testid="wa-compose"
              />
              <Button onClick={send} className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" data-testid="wa-send-btn">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2 items-center text-xs text-zinc-500">
              <span className="font-semibold">Simulate inbound reply:</span>
              <Input placeholder="Customer reply..." value={inbound} onChange={(e) => setInbound(e.target.value)} className="h-8 flex-1" data-testid="wa-inbound" />
              <Select value={inboundTag || "__NONE__"} onValueChange={(v) => setInboundTag(v === "__NONE__" ? "" : v)}>
                <SelectTrigger className="h-8 w-32" data-testid="wa-inbound-tag"><SelectValue placeholder="Tag" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">— Tag —</SelectItem>
                  {constants?.wa_reply_tags?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={receive} className="h-8 rounded-sm" data-testid="wa-receive-btn">
                <ArrowDown className="w-3 h-3 mr-1" /> Log reply
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
