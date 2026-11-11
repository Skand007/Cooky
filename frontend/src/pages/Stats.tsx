import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { CookLog, Stats as StatsData } from "@/lib/types";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 truncate text-text-muted">{label}</span>
      <div className="flex-1 h-3 rounded bg-surface-alt border border-border overflow-hidden">
        <div className="h-full bg-accent" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-6 text-right">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface-alt p-3 space-y-2">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Stats() {
  const { isOwner } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [history, setHistory] = useState<CookLog[]>([]);

  function load() {
    apiFetch("/api/stats").then((r) => r.json()).then(setStats);
    apiFetch("/api/history?limit=20").then((r) => r.json()).then(setHistory);
  }

  useEffect(load, []);

  async function removeLog(id: number) {
    await apiFetch(`/api/history/${id}`, { method: "DELETE" });
    load();
  }

  if (!stats) return <p className="text-text-muted text-sm">Loading…</p>;
  const weekMax = Math.max(1, ...stats.cooking.by_week.map((w) => w.count));
  const locMax = Math.max(1, ...Object.values(stats.inventory.by_location));

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">Stats</h1>

      <div className="grid grid-cols-2 gap-2 text-center">
        {[
          ["In stock", stats.inventory.total],
          ["On shopping list", stats.shopping.open],
          ["Recipes", stats.recipes.total],
          ["Cooked (30 days)", stats.cooking.last_30_days],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-surface-alt p-3">
            <p className="text-2xl font-display text-accent">{value}</p>
            <p className="text-xs text-text-muted">{label}</p>
          </div>
        ))}
      </div>

      <Card title="Stock by location">
        {Object.entries(stats.inventory.by_location).map(([loc, n]) => (
          <Bar key={loc} label={loc} value={n} max={locMax} />
        ))}
      </Card>

      {(stats.inventory.expired.length > 0 || stats.inventory.expiring_soon.length > 0) && (
        <Card title="Needs attention">
          {stats.inventory.expired.map((e) => (
            <p key={`x${e.id}`} className="text-sm text-accent">{e.name} expired ({e.location})</p>
          ))}
          {stats.inventory.expiring_soon.map((e) => (
            <p key={`s${e.id}`} className="text-sm text-accent-alt">
              {e.name} — {e.days_left === 0 ? "today" : `${e.days_left}d left`} ({e.location})
            </p>
          ))}
        </Card>
      )}

      <Card title="Cooked per week">
        {stats.cooking.by_week.map((w) => (
          <Bar key={w.week_start} label={w.week_start.slice(5)} value={w.count} max={weekMax} />
        ))}
        {stats.cooking.average_rating !== null && (
          <p className="text-xs text-text-muted">Average rating {stats.cooking.average_rating.toFixed(1)} ★</p>
        )}
      </Card>

      {stats.cooking.top_recipes.length > 0 && (
        <Card title="Most cooked">
          {stats.cooking.top_recipes.map((r) => (
            <Bar key={r.name} label={r.name} value={r.count} max={stats.cooking.top_recipes[0].count} />
          ))}
        </Card>
      )}

      {stats.cooking.top_ingredients.length > 0 && (
        <Card title="Most used ingredients">
          {stats.cooking.top_ingredients.map((r) => (
            <Bar key={r.name} label={r.name} value={r.count} max={stats.cooking.top_ingredients[0].count} />
          ))}
        </Card>
      )}

      <Card title="Cooking history">
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">Nothing logged yet. Tap “I cooked it” on a recipe.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-sm flex justify-between gap-2">
                <span className="min-w-0">
                  {h.recipe_title}
                  {h.rating ? ` ${"★".repeat(h.rating)}` : ""}
                  <span className="text-xs text-text-muted"> · {h.cooked_at.slice(0, 10)}</span>
                  {h.note && <span className="block text-xs text-text-muted">{h.note}</span>}
                </span>
                {isOwner && (
                  <button onClick={() => removeLog(h.id)} aria-label={`Delete ${h.recipe_title} log`} className="text-accent">✕</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
