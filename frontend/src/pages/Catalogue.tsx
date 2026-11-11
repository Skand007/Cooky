import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Item } from "@/lib/types";

export function Catalogue() {
  const { isOwner } = useAuth();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [aliases, setAliases] = useState("");

  function load() {
    apiFetch(`/api/items?search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then(setItems);
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function patch(item: Item, body: Record<string, unknown>) {
    await apiFetch(`/api/items/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
    setEditing(null);
    load();
  }

  if (!isOwner) return <p className="text-text-muted">Only the owner can edit the catalogue.</p>;

  return (
    <div className="space-y-3">
      <h1 className="font-display text-2xl">Catalogue</h1>
      <p className="text-xs text-text-muted">
        Aliases make “scallion” and “spring onion” the same ingredient. Jain-friendly and staple flags drive the diet
        filters and “assume salt, oil, water”.
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search items…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        aria-label="Search catalogue"
      />
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border bg-surface-alt p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{item.name}</span>
              <button
                onClick={() => {
                  setEditing(editing?.id === item.id ? null : item);
                  setAliases(item.aliases.join(", "));
                }}
                className="text-xs rounded-lg border border-border px-2 py-0.5"
              >
                {editing?.id === item.id ? "Close" : "Edit"}
              </button>
            </div>
            <p className="text-xs text-text-muted">
              {item.diet} · {item.jain_ok ? "Jain ok" : "not Jain"}
              {item.staple && " · staple"}
              {item.aliases.length > 0 && ` · also: ${item.aliases.join(", ")}`}
            </p>
            {editing?.id === item.id && (
              <div className="mt-2 space-y-2">
                <input
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-2 py-1"
                  aria-label="Aliases"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    defaultValue={item.diet}
                    onChange={(e) => patch(item, { diet: e.target.value })}
                    className="rounded-lg border border-border bg-surface px-2 py-1"
                    aria-label="Diet"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="egg">Egg</option>
                    <option value="nonveg">Non-veg</option>
                  </select>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" defaultChecked={item.jain_ok} onChange={(e) => patch(item, { jain_ok: e.target.checked })} />
                    Jain ok
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" defaultChecked={item.staple} onChange={(e) => patch(item, { staple: e.target.checked })} />
                    Staple
                  </label>
                  <button
                    onClick={() =>
                      patch(item, { aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean) })
                    }
                    className="rounded-lg bg-accent text-surface px-3 py-1 font-semibold"
                  >
                    Save aliases
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
