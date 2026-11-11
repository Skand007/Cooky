import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ItemAutocomplete } from "@/components/ItemAutocomplete";
import type { Item, Recipe } from "@/lib/types";

interface Line {
  item_id?: number;
  new_item_name?: string;
  name: string;
  quantity: string;
  unit: string;
  is_main: boolean;
}

export function RecipeForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("2");
  const [prep, setPrep] = useState("");
  const [cook, setCook] = useState("");
  const [style, setStyle] = useState("");
  const [steps, setSteps] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/recipes/${id}`)
      .then((r) => r.json())
      .then((r: Recipe) => {
        setTitle(r.title);
        setDescription(r.description ?? "");
        setServings(String(r.servings));
        setPrep(r.prep_minutes?.toString() ?? "");
        setCook(r.cook_minutes?.toString() ?? "");
        setStyle(r.style === "regular" ? "" : r.style);
        setSteps(r.steps.join("\n"));
        setLines(
          r.ingredients.map((i) => ({
            item_id: i.item.id,
            name: i.item.name,
            quantity: i.quantity?.toString() ?? "",
            unit: i.unit ?? "",
            is_main: i.is_main,
          }))
        );
      });
  }, [id]);

  if (!isOwner) return <p className="text-text-muted">Only the owner can edit recipes.</p>;

  function addLine(pick: Item | { newName: string }) {
    setLines((prev) => [
      ...prev,
      "newName" in pick
        ? { new_item_name: pick.newName, name: pick.newName, quantity: "", unit: "", is_main: false }
        : { item_id: pick.id, name: pick.name, quantity: "", unit: pick.default_unit ?? "", is_main: false },
    ]);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const body = {
      title,
      description: description || null,
      servings: Number(servings) || 2,
      prep_minutes: prep ? Number(prep) : null,
      cook_minutes: cook ? Number(cook) : null,
      style: style || null,
      steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
      ingredients: lines.map((l) => ({
        item_id: l.item_id,
        new_item_name: l.item_id ? undefined : l.new_item_name,
        quantity: l.quantity ? Number(l.quantity) : null,
        unit: l.unit || null,
        is_main: l.is_main,
      })),
    };
    try {
      const res = await apiFetch(editing ? `/api/recipes/${id}` : "/api/recipes", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      const saved: Recipe = await res.json();
      navigate(`/recipes/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const input = "w-full field";

  return (
    <form onSubmit={save} className="space-y-4">
      <Link to={editing ? `/recipes/${id}` : "/recipes"} className="text-sm text-text-muted">← Back</Link>
      <h1 className="page-title">{editing ? "Edit recipe" : "New recipe"}</h1>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required className={input} aria-label="Title" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description (optional)" rows={2} className={input} aria-label="Description" />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-text-muted">Servings
          <input type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-text-muted">Prep (min)
          <input type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-text-muted">Cook (min)
          <input type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} className={input} />
        </label>
      </div>
      <label className="text-xs text-text-muted block">Style
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={input}>
          <option value="">Auto-detect</option>
          <option value="regular">Regular</option>
          <option value="meal_prep">Meal prep</option>
          <option value="slow">Slow / overnight</option>
        </select>
      </label>

      <section className="space-y-2">
        <h2 className="font-semibold">Ingredients</h2>
        <ItemAutocomplete onPick={addLine} placeholder="Add an ingredient…" />
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{l.name}</span>
            <input type="number" step="any" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder="qty" className="w-16 field" aria-label={`Quantity of ${l.name}`} />
            <input value={l.unit} onChange={(e) => updateLine(i, { unit: e.target.value })} placeholder="unit" className="w-16 field" aria-label={`Unit of ${l.name}`} />
            <label className="text-xs flex items-center gap-1" title="Main ingredient: counts extra for use-up">
              <input type="checkbox" checked={l.is_main} onChange={(e) => updateLine(i, { is_main: e.target.checked })} />main
            </label>
            <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} aria-label={`Remove ${l.name}`} className="text-accent">✕</button>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Steps <span className="text-xs font-normal text-text-muted">(one per line)</span></h2>
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={7} className={input} aria-label="Steps" />
      </section>

      {error && <p className="text-accent text-sm">{error}</p>}
      <button className="w-full btn-primary">Save recipe</button>
    </form>
  );
}
