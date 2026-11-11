import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DIET_OPTIONS, TIME_OPTIONS, type Recipe, type SpoonacularHit, type Suggestion } from "@/lib/types";

const MISSING_OPTIONS = [
  { id: "0", label: "Only what I have" },
  { id: "1", label: "Missing ≤ 1" },
  { id: "2", label: "Missing ≤ 2" },
  { id: "any", label: "Anything" },
];

type Tab = "suggest" | "all" | "online";

function minutesLabel(r: Recipe): string {
  return r.total_minutes ? `${r.total_minutes} min` : "time unknown";
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} className="chip">
      {children}
    </button>
  );
}

export function Recipes() {
  const { isOwner } = useAuth();
  const [tab, setTab] = useState<Tab>("suggest");
  const [missing, setMissing] = useState("1");
  const [time, setTime] = useState("");
  const [diet, setDiet] = useState("");
  const [useUp, setUseUp] = useState(false);
  const [staples, setStaples] = useState(true);
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [onlineQuery, setOnlineQuery] = useState("");
  const [hits, setHits] = useState<SpoonacularHit[]>([]);
  const [onlineMsg, setOnlineMsg] = useState("");
  const [importing, setImporting] = useState<number | null>(null);

  useEffect(() => {
    if (tab === "online") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (time) params.set("time", time);
    if (diet) params.set("diet", diet);
    if (q.trim()) params.set("q", q.trim());
    if (tab === "suggest") {
      if (missing !== "any") params.set("max_missing", missing);
      if (useUp) params.set("use_up", "true");
      params.set("staples", String(staples));
      apiFetch(`/api/recipes/suggest?${params}`)
        .then((r) => r.json())
        .then(setSuggestions)
        .finally(() => setLoading(false));
    } else {
      apiFetch(`/api/recipes?${params}`)
        .then((r) => r.json())
        .then(setRecipes)
        .finally(() => setLoading(false));
    }
  }, [tab, missing, time, diet, useUp, staples, q]);

  async function searchOnline(e: React.FormEvent) {
    e.preventDefault();
    setOnlineMsg("");
    try {
      const res = await apiFetch(`/api/spoonacular/search?query=${encodeURIComponent(onlineQuery)}`);
      const data: SpoonacularHit[] = await res.json();
      setHits(data);
      if (data.length === 0) setOnlineMsg("No vegetarian recipes found.");
    } catch (err) {
      setHits([]);
      setOnlineMsg((err as Error).message);
    }
  }

  async function importHit(hit: SpoonacularHit) {
    setImporting(hit.id);
    try {
      await apiFetch(`/api/spoonacular/import/${hit.id}`, { method: "POST" });
      setHits((prev) => prev.map((h) => (h.id === hit.id ? { ...h, already_imported: true } : h)));
    } catch (err) {
      setOnlineMsg((err as Error).message);
    } finally {
      setImporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Recipes</h1>
        {isOwner && (
          <Link to="/recipes/new" className="btn-primary">
            + New recipe
          </Link>
        )}
      </div>

      <div className="flex gap-2">
        <Chip active={tab === "suggest"} onClick={() => setTab("suggest")}>Cook now</Chip>
        <Chip active={tab === "all"} onClick={() => setTab("all")}>All recipes</Chip>
        {isOwner && <Chip active={tab === "online"} onClick={() => setTab("online")}>Find online</Chip>}
      </div>

      {tab !== "online" && (
        <div className="space-y-2 glass p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipes or ingredients…"
            className="w-full field"
            aria-label="Search recipes"
          />
          {tab === "suggest" && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {MISSING_OPTIONS.map((o) => (
                <Chip key={o.id} active={missing === o.id} onClick={() => setMissing(o.id)}>{o.label}</Chip>
              ))}
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={time === ""} onClick={() => setTime("")}>Any time</Chip>
            {TIME_OPTIONS.map((o) => (
              <Chip key={o.id} active={time === o.id} onClick={() => setTime(o.id)}>{o.label}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={diet}
              onChange={(e) => setDiet(e.target.value)}
              className="field"
              aria-label="Diet"
            >
              <option value="">Any diet</option>
              {DIET_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
            {tab === "suggest" && (
              <>
                <label className="text-sm flex items-center gap-1">
                  <input type="checkbox" checked={useUp} onChange={(e) => setUseUp(e.target.checked)} />
                  Use-up items only
                </label>
                <label className="text-sm flex items-center gap-1">
                  <input type="checkbox" checked={staples} onChange={(e) => setStaples(e.target.checked)} />
                  Assume salt, oil, water
                </label>
              </>
            )}
          </div>
        </div>
      )}

      {tab === "suggest" &&
        (loading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-text-muted text-sm">
            Nothing matches these filters. Try “Anything”, or add more stock and recipes.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li key={s.recipe.id}>
                <Link to={`/recipes/${s.recipe.id}`} className="block glass p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{s.recipe.title}</p>
                    <span className="text-xs text-text-muted whitespace-nowrap">{minutesLabel(s.recipe)}</span>
                  </div>
                  <p className="text-xs mt-1">
                    {s.missing_count === 0 ? (
                      <span className="text-accent font-semibold">You have everything</span>
                    ) : (
                      <span className="text-text-muted">Missing: {s.missing.join(", ")}</span>
                    )}
                  </p>
                  {(s.use_up_hits.length > 0 || s.expiring_hits.length > 0) && (
                    <p className="text-xs text-accent-alt mt-1">
                      {s.use_up_hits.length > 0 && `Uses up: ${s.use_up_hits.join(", ")}. `}
                      {s.expiring_hits.length > 0 && `Expiring: ${s.expiring_hits.join(", ")}.`}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === "all" &&
        (loading ? (
          <p className="text-text-muted text-sm">Loading…</p>
        ) : recipes.length === 0 ? (
          <p className="text-text-muted text-sm">No recipes yet.</p>
        ) : (
          <ul className="space-y-2">
            {recipes.map((r) => (
              <li key={r.id}>
                <Link to={`/recipes/${r.id}`} className="block glass p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-medium">{r.title}</p>
                    <span className="text-xs text-text-muted whitespace-nowrap">{minutesLabel(r)}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {r.diets.join(" · ") || "contains meat/fish"} · {r.source}
                    {r.times_cooked > 0 && ` · cooked ${r.times_cooked}×`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ))}

      {tab === "online" && isOwner && (
        <div className="space-y-3">
          <form onSubmit={searchOnline} className="flex gap-2">
            <input
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
              placeholder="e.g. paneer, dal, pasta…"
              className="flex-1 field"
              aria-label="Search online"
            />
            <button className="btn-primary">Search</button>
          </form>
          <p className="text-xs text-text-muted">
            Vegetarian recipes from Spoonacular. Importing copies a recipe into Cooky so it works offline and
            counts toward your suggestions.
          </p>
          {onlineMsg && <p className="text-sm text-accent-alt">{onlineMsg}</p>}
          <ul className="space-y-2">
            {hits.map((h) => (
              <li key={h.id} className="glass p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{h.title}</p>
                  <p className="text-xs text-text-muted">{h.ready_in_minutes ? `${h.ready_in_minutes} min` : "time unknown"}</p>
                </div>
                <button
                  disabled={h.already_imported || importing === h.id}
                  onClick={() => importHit(h)}
                  className="text-xs btn"
                >
                  {h.already_imported ? "Imported" : importing === h.id ? "Importing…" : "Import"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
