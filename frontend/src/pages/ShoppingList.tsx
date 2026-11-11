import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LOCATIONS, type Item, type Location, type ShoppingEntry } from "@/lib/types";
import { ItemAutocomplete } from "@/components/ItemAutocomplete";

export function ShoppingList() {
  const { isOwner } = useAuth();
  const [entries, setEntries] = useState<ShoppingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | { newName: string } | null>(null);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [stockLocation, setStockLocation] = useState<Location>("shelf");
  const [stockMsg, setStockMsg] = useState("");

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

  async function stockBought() {
    const res = await apiFetch("/api/shopping-list/stock-bought", {
      method: "POST",
      body: JSON.stringify({ location: stockLocation }),
    });
    const data: { moved: string[] } = await res.json();
    setStockMsg(`Moved to inventory: ${data.moved.join(", ")}.`);
    load();
  }

  async function removeEntry(entry: ShoppingEntry) {
    await apiFetch(`/api/shopping-list/${entry.id}`, { method: "DELETE" });
    load();
  }

  const byName = (a: ShoppingEntry, b: ShoppingEntry) => a.item.name.localeCompare(b.item.name);
  // Everything is always visible, A–Z. Still-to-buy lines sit on top; lines that are
  // ticked off, or already in stock, are crossed out at the bottom (also A–Z).
  const isDone = (e: ShoppingEntry) => e.bought || e.in_stock;
  const toBuy = entries.filter((e) => !isDone(e)).sort(byName);
  const done = entries.filter(isDone).sort(byName);

  function Row({ entry }: { entry: ShoppingEntry }) {
    const finished = isDone(entry);
    return (
      <li className={`paper-row ${finished ? "is-done" : ""}`}>
        {isOwner && !entry.in_stock ? (
          <button
            onClick={() => toggleBought(entry)}
            className="paper-box"
            aria-label={entry.bought ? `Mark ${entry.item.name} as not bought` : `Mark ${entry.item.name} as bought`}
          >
            {entry.bought ? "✓" : ""}
          </button>
        ) : (
          <span className="paper-box" aria-hidden="true">
            {finished ? "✓" : ""}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="paper-name">
            {entry.item.name}
            {entry.quantity != null && (
              <span>
                {" "}
                · {entry.quantity} {entry.unit ?? ""}
              </span>
            )}
          </span>
          {(entry.note || (entry.in_stock && !entry.bought)) && (
            <span className="paper-note block">
              {entry.in_stock && !entry.bought ? "already in stock" : entry.note}
            </span>
          )}
        </span>
        {isOwner && (
          <button onClick={() => removeEntry(entry)} className="paper-remove" aria-label={`Remove ${entry.item.name}`}>
            remove
          </button>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Shopping list</h1>
        {isOwner && (
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary">
            {showAdd ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {showAdd && isOwner && (
        <form onSubmit={addEntry} className="glass space-y-2">
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
              className="w-28 field"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="note (optional)"
              className="flex-1 field"
            />
          </div>
          <button type="submit" disabled={!pendingItem} className="w-full btn-primary">
            Add to list
          </button>
        </form>
      )}

      {stockMsg && <p className="glass-sm text-sm">{stockMsg}</p>}
      {isOwner && entries.some((e) => e.bought) && (
        <div className="flex items-center gap-2 text-sm">
          <select
            value={stockLocation}
            onChange={(e) => setStockLocation(e.target.value as Location)}
            className="field"
            aria-label="Where to put bought items"
          >
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <button onClick={stockBought} className="btn">
            Move all bought to inventory
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-text-muted text-sm">Loading…</p>
      ) : (
        <div className="paper-wrap">
          <span className="paper-tape" aria-hidden="true" />
          <div className="paper">
            <h2 className="paper-title">To buy</h2>
            {entries.length === 0 && <p className="paper-row">Nothing on the list.</p>}
            <ul>
              {toBuy.map((e) => (
                <Row key={e.id} entry={e} />
              ))}
            </ul>
            {done.length > 0 && (
              <>
                <p className="paper-divider">Done / already in stock</p>
                <ul>
                  {done.map((e) => (
                    <Row key={e.id} entry={e} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
