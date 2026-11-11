import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DIET_OPTIONS } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "What can I cook right now?",
  "What should I use up first?",
  "Something quick for dinner",
  "I'm missing one ingredient, what then?",
];

export function Bot() {
  const { isOwner } = useAuth();
  const [status, setStatus] = useState<{ configured: boolean; public: boolean } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [diet, setDiet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/api/chat/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, busy]);

  const canChat = isOwner || status?.public === true;

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || busy) return;
    const next: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setText("");
    setError("");
    setBusy(true);
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: next.slice(-12), diet: diet || null }),
      });
      const data: { reply: string } = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Kitchen bot</h1>
        <select
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          className="field"
          aria-label="Diet for the bot"
        >
          <option value="">Vegetarian (default)</option>
          {DIET_OPTIONS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-text-muted">
        Ask what can be cooked from what's in Cooky's kitchen right now. It sees the current stock, expiry dates
        and saved recipes. It's an AI, so double-check anything important.
      </p>

      {!canChat && status !== null && (
        <p className="glass-sm text-sm">
          The bot is limited to the owner right now. Log in as owner to use it.
        </p>
      )}
      {status && !status.configured && isOwner && (
        <p className="glass-sm text-sm">
          The Gemini key isn't set yet. Add GEMINI_API_KEY in the backend project's Vercel settings and redeploy.
        </p>
      )}

      <div className="space-y-2 min-h-[40vh]">
        {messages.length === 0 && canChat && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="chip">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap text-sm ${
                m.role === "user"
                  ? "btn-primary !rounded-3xl !justify-start !text-left !font-medium !px-4 !py-2.5"
                  : "glass !rounded-3xl !py-2.5 !px-4"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
        {busy && <p className="text-xs text-text-muted">Cooky is thinking…</p>}
        {error && <p className="text-sm text-accent">{error}</p>}
        <div ref={endRef} />
      </div>

      {canChat && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="Ask about dinner…"
            className="flex-1 field"
            aria-label="Message"
          />
          <button disabled={busy || !text.trim()} className="btn-primary">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
