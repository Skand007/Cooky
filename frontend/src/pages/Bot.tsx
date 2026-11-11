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
        <h1 className="font-display text-2xl">Kitchen bot</h1>
        <select
          value={diet}
          onChange={(e) => setDiet(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
          aria-label="Diet for the bot"
        >
          <option value="">Vegetarian (default)</option>
          {DIET_OPTIONS.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </div>
      <p className="text-xs text-text-muted">
        Ask what you can cook. The bot sees your current stock, expiry dates and saved recipes.
      </p>

      {!canChat && (
        <p className="rounded-lg border border-border bg-surface-alt p-3 text-sm">
          The bot uses a shared free quota, so only the owner can chat. Log in as owner to use it.
        </p>
      )}
      {status && !status.configured && isOwner && (
        <p className="rounded-lg border border-border bg-surface-alt p-3 text-sm">
          The Gemini key isn't set yet. Add GEMINI_API_KEY in the backend project's Vercel settings and redeploy.
        </p>
      )}

      <div className="space-y-2 min-h-[40vh]">
        {messages.length === 0 && canChat && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-sm text-text-muted">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-accent text-surface" : "bg-surface-alt border border-border"
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
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            aria-label="Message"
          />
          <button disabled={busy || !text.trim()} className="rounded-lg bg-accent text-surface font-semibold px-4 disabled:opacity-50">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
