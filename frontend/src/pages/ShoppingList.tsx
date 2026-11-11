import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { Item, ShoppingEntry } from "@/lib/types";
import { ItemAutocomplete } from "@/components/ItemAutocomplete";

export function ShoppingList() {
  const { isOwner } = useAuth();
  const [entries, setEntries] = useState<ShoppingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | { newName: string } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  function load() {
    setLoading(true);
    apiFetch("/api/shopping-list")
      .then((res) => res.json())
      .then(setEntries)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingItem) return;
    const payload: Record<string, unknown> = {
      quantity: quantity ? Number(quantity) : undefined,
      note: note || undefined,
    };
    if ("newName" in pendingItem) payload.new_item_name = pendingItem.newName;
    else payload.item_id = pendingItem.id;

    await apiFetch("/api/shopping-list", { method: "POST", body: JSON.stringify(payload) });
    setPendingItem(null);
    setQuantity("");
    setNote("");
    setShowAdd(false);
    load();
  }

  async function toggleBought(entry: ShoppingEntry) {
    await apiFetch(`/api/shopping-list/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ bought: !entry.bought }),
    });
    load();
  }

  async function removeEntry(entry: ShoppingEntry) {
    await apiFetch(`/api/shopping-list/${entry.id}`, { method: "DELETE" });
    load();
  }

  const toBuy = entries.filter((e) => !e.bought);
  const bought = entries.filter((e) => e.bought);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Shopping list</h1>
        {isOwner && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-lg bg-accent text-surface text-sm font-semibold px-3 py-1.5"
          >
            {showAdd ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {showAdd && isOwner && (
        <form onSubmit={addEntry} className="rounded-xl border border-border bg-surface-alt p-3 space-y-2">
          <ItemAutocomplete onPick={setPendingItem} placeholder="What do you need to buy?" />
          {pendingItem && (
            <p className="text-sm text-text-muted">
              Adding: <span className="text-text">{"newName" in pendingItem ? pendingItem.newName : pendingItem.name}</span>
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="qty (optional)"
              className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="note (optional)"
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5"
            />
          </div>
          <button
            type="submit"
            disabled={!pendingItem}
            className="w-full rounded-lg bg-accent text-surface font-semibold py-2 disabled:opacity-50"
          >
            Add to list
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-text-muted text-sm">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-text-muted text-sm">Nothing on the list.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {toBuy.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-border bg-surface-alt p-3 flex items-center gap-3"
              >
                {isOwner && (
                  <input
                    type="checkbox"
                    checked={entry.bought}
                    onChange={() => toggleBought(entry)}
                    aria-label={`Mark ${entry.item.name} as bought`}
                    className="h-5 w-5"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {entry.item.name}
                    {entry.quantity != null && (
                      <span className="text-text-muted"> · {entry.quantity} {entry.unit ?? ""}</span>
                    )}
                  </p>
                  {entry.note && <p className="text-xs text-text-muted truncate">{entry.note}</p>}
                </div>
                {isOwner && (
                  <button onClick={() => removeEntry(entry)} className="text-xs text-accent shrink-0">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          {bought.length > 0 && (
            <details className="text-sm">
              <summary className="text-text-muted cursor-pointer">
                Bought ({bought.length})
              </summary>
              <ul className="space-y-2 mt-2">
                {bought.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-border bg-surface-alt p-3 flex items-center gap-3 opacity-60"
                  >
                    {isOwner && (
                      <input
                        type="checkbox"
                        checked={entry.bought}
                        onChange={() => toggleBought(entry)}
                        className="h-5 w-5"
                      />
                    )}
                    <p className="flex-1 line-through">{entry.item.name}</p>
                    {isOwner && (
                      <button onClick={() => removeEntry(entry)} className="text-xs text-accent">
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
