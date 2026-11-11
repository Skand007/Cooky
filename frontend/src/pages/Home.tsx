import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { Stats, Suggestion } from "@/lib/types";

export function Home() {
  const [ready, setReady] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch("/api/recipes/suggest?max_missing=0&limit=3")
      .then((r) => r.json())
      .then(setReady)
      .catch(() => {});
    apiFetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const attention = stats ? [...stats.inventory.expired, ...stats.inventory.expiring_soon] : [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl">What's in the kitchen?</h1>

      <section className="rounded-xl border border-border bg-surface-alt p-3 space-y-2">
        <h2 className="font-semibold">Cook right now</h2>
        {ready.length === 0 ? (
          <p className="text-sm text-text-muted">
            No saved recipe is fully covered by your stock yet.{" "}
            <Link to="/recipes" className="text-accent underline">Browse recipes</Link>
          </p>
        ) : (
          <ul className="space-y-1">
            {ready.map((s) => (
              <li key={s.recipe.id}>
                <Link to={`/recipes/${s.recipe.id}`} className="text-accent underline">{s.recipe.title}</Link>
                <span className="text-xs text-text-muted">
                  {s.recipe.total_minutes ? ` · ${s.recipe.total_minutes} min` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {attention.length > 0 && (
        <section className="rounded-xl border border-border bg-surface-alt p-3 space-y-1">
          <h2 className="font-semibold">Use soon</h2>
          {attention.map((e) => (
            <p key={e.id} className={`text-sm ${e.days_left !== null && e.days_left < 0 ? "text-accent" : "text-accent-alt"}`}>
              {e.name} — {e.days_left !== null && e.days_left < 0 ? "expired" : e.days_left === 0 ? "today" : `${e.days_left}d left`}
            </p>
          ))}
        </section>
      )}

      {stats && stats.inventory.use_up.length > 0 && (
        <section className="rounded-xl border border-border bg-surface-alt p-3 space-y-1">
          <h2 className="font-semibold">Flagged to use up</h2>
          <p className="text-sm">{stats.inventory.use_up.map((e) => e.name).join(", ")}</p>
          <Link to="/recipes" className="text-xs text-accent underline">Find recipes that use them</Link>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2 text-center text-sm">
        <Link to="/inventory" className="rounded-xl border border-border bg-surface-alt p-3">
          <span className="block text-2xl font-display text-accent">{stats?.inventory.total ?? "–"}</span>
          items in stock
        </Link>
        <Link to="/shopping-list" className="rounded-xl border border-border bg-surface-alt p-3">
          <span className="block text-2xl font-display text-accent">{stats?.shopping.open ?? "–"}</span>
          to buy
        </Link>
      </div>
      <Link to="/bot" className="block rounded-xl bg-accent text-surface text-center font-semibold py-2">
        Ask the kitchen bot
      </Link>
    </div>
  );
}
