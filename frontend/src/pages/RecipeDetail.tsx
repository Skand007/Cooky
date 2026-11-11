import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Recipe } from "@/lib/types";

export function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCooked, setShowCooked] = useState(false);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState("");
  const [deduct, setDeduct] = useState(true);

  function load() {
    apiFetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then(setRecipe)
      .catch((e: Error) => setError(e.message));
  }

  useEffect(load, [id]);

  async function markCooked(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch(`/api/recipes/${id}/cooked`, {
      method: "POST",
      body: JSON.stringify({ note: note || null, rating: rating ? Number(rating) : null, deduct }),
    });
    const data: { deducted: string[]; skipped: string[] } = await res.json();
    const parts = ["Logged in your cooking history."];
    if (data.deducted.length) parts.push(`Used from stock: ${data.deducted.join(", ")}.`);
    if (data.skipped.length) parts.push(`Not adjusted: ${data.skipped.join(", ")}.`);
    setMessage(parts.join(" "));
    setShowCooked(false);
    setNote("");
    setRating("");
    load();
  }

  async function addMissing() {
    const res = await apiFetch(`/api/recipes/${id}/shopping`, { method: "POST" });
    const data: { added: string[]; already_listed: string[] } = await res.json();
    setMessage(
      data.added.length
        ? `Added to shopping list: ${data.added.join(", ")}.`
        : data.already_listed.length
          ? "Everything missing is already on the shopping list."
          : "You already have everything."
    );
  }

  async function remove() {
    if (!window.confirm("Delete this recipe? Your cooking history is kept.")) return;
    await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
    navigate("/recipes");
  }

  if (error) return <p className="text-accent">{error}</p>;
  if (!recipe) return <p className="text-text-muted text-sm">Loading…</p>;

  const missingCount = recipe.ingredients.filter((i) => i.available === false).length;

  return (
    <div className="space-y-4">
      <Link to="/recipes" className="text-sm text-text-muted">← Recipes</Link>
      <div>
        <h1 className="page-title">{recipe.title}</h1>
        <p className="text-xs text-text-muted mt-1">
          {recipe.total_minutes ? `${recipe.total_minutes} min` : "time unknown"} · serves {recipe.servings} ·{" "}
          {recipe.diets.join(", ") || "contains meat/fish"} · {recipe.source}
          {recipe.times_cooked > 0 && ` · cooked ${recipe.times_cooked}×`}
        </p>
        {recipe.description && <p className="text-sm mt-2">{recipe.description}</p>}
      </div>

      {message && <p className="glass-sm text-sm">{message}</p>}

      <section>
        <h2 className="font-semibold mb-2">
          Ingredients{" "}
          <span className="text-xs font-normal text-text-muted">
            {missingCount === 0 ? "you have everything" : `${missingCount} missing`}
          </span>
        </h2>
        <ul className="space-y-1">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id} className="text-sm flex gap-2">
              <span className={ing.available ? "text-accent" : "text-accent-alt"} aria-label={ing.available ? "have" : "missing"}>
                {ing.available ? "✓" : "✗"}
              </span>
              <span>
                {ing.item.name}
                {ing.quantity ? ` — ${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}` : ""}
                {ing.item.staple && <span className="text-xs text-text-muted"> (staple)</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Steps</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-text-muted">No steps written.</p>
        ) : (
          <ol className="space-y-2 list-decimal pl-5 text-sm">
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </section>

      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-sm text-accent underline">
          Original source
        </a>
      )}

      {isOwner && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowCooked((v) => !v)} className="btn-primary">
              I cooked it
            </button>
            {missingCount > 0 && (
              <button onClick={addMissing} className="btn">
                Add missing to shopping list
              </button>
            )}
            <Link to={`/recipes/${recipe.id}/edit`} className="btn">
              Edit
            </Link>
            <button onClick={remove} className="btn text-accent">
              Delete
            </button>
          </div>
          {showCooked && (
            <form onSubmit={markCooked} className="glass p-3 space-y-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                maxLength={300}
                className="w-full field"
                aria-label="Note"
              />
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="field"
                aria-label="Rating"
              >
                <option value="">No rating</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{"★".repeat(n)}</option>
                ))}
              </select>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
                Subtract ingredients from my stock (same units only)
              </label>
              <button className="w-full btn-primary">Save</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
