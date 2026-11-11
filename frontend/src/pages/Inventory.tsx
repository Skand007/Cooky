import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LOCATIONS, type InventoryEntry, type Item, type Location } from "@/lib/types";
import { ItemAutocomplete } from "@/components/ItemAutocomplete";

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function ExpiryBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  let tone = "text-text-muted";
  let label = `Expires ${dateStr}`;
  if (days < 0) {
    tone = "text-accent font-semibold";
    label = "Expired";
  } else if (days === 0) {
    tone = "text-accent font-semibold";
    label = "Expires today";
  } else if (days <= 3) {
    tone = "text-accent-alt font-semibold";
    label = `Expires in ${days}d`;
  }
  return <span className={`text-xs ${tone}`}>{label}</span>;
}

export function Inventory() {
  const { isOwner } = useAuth();
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [activeLocation, setActiveLocation] = useState<Location>("fridge");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingItem, setPendingItem] = useState<Item | { newName: string } | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [expiry, setExpiry] = useState("");

  function load() {
    setLoading(true);
    apiFetch("/api/inventory")
      .then((res) => res.json())
      .then(setEntries)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const grouped = useMemo(
    () => entries.filter((e) => e.location === activeLocation),
    [entries, activeLocation]
  );

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingItem) return;
    const payload: Record<string, unknown> = {
      location: activeLocation,
      quantity: Number(quantity) || 1,
      unit: unit || undefined,
      expiry_date: expiry || undefined,
    };
    if ("newName" in pendingItem) payload.new_item_name = pendingItem.newName;
    else payload.item_id = pendingItem.id;

    await apiFetch("/api/inventory", { method: "POST", body: JSON.stringify(payload) });
    setPendingItem(null);
    setQuantity("1");
    setUnit("");
    setExpiry("");
    setShowAdd(false);
    load();
  }

  async function toggleUseUp(entry: InventoryEntry) {
    await apiFetch(`/api/inventory/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({ use_up: !entry.use_up }),
    });
    load();
  }

  async function removeEntry(entry: InventoryEntry) {
    await apiFetch(`/api/inventory/${entry.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Inventory</h1>
        {isOwner && (
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="rounded-lg bg-accent text-surface text-sm font-semibold px-3 py-1.5"
          >
            {showAdd ? "Cancel" : "+ Add item"}
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setActiveLocation(loc.id)}
            className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap border ${
              activeLocation === loc.id
                ? "bg-accent text-surface border-accent"
                : "border-border text-text-muted"
            }`}
          >
            {loc.label}
          </button>
        ))}
      </div>

      {showAdd && isOwner && (
        <form onSubmit={addEntry} className="rounded-xl border border-border bg-surface-alt p-3 space-y-2">
          <ItemAutocomplete onPick={setPendingItem} />
          {pendingItem && (
            <p className="text-sm text-text-muted">
              Adding: <span className="text-text">{"newName" in pendingItem ? pendingItem.newName : pendingItem.name}</span>{" "}
              to {LOCATIONS.find((l) => l.id === activeLocation)?.label}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-20 rounded-lg border border-border bg-surface px-2 py-1.5"
              aria-label="Quantity"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit"
              className="w-24 rounded-lg border border-border bg-surface px-2 py-1.5"
              aria-label="Unit"
            />
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1.5"
              aria-label="Expiry date"
            />
          </div>
          <button
            type="submit"
            disabled={!pendingItem}
            className="w-full rounded-lg bg-accent text-surface font-semibold py-2 disabled:opacity-50"
          >
            Add to {LOCATIONS.find((l) => l.id === activeLocation)?.label}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-text-muted text-sm">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-text-muted text-sm">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {grouped.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-border bg-surface-alt p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {entry.item.name}
                  {entry.use_up && (
                    <span className="ml-2 text-xs rounded-full bg-accent/20 text-accent px-2 py-0.5">
                      use up
                    </span>
                  )}
                </p>
                <p className="text-xs text-text-muted">
                  {entry.quantity} {entry.unit ?? ""}
                </p>
                <ExpiryBadge dateStr={entry.expiry_date} />
              </div>
              {isOwner && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleUseUp(entry)}
                    className="text-xs rounded-lg border border-border px-2 py-1"
                  >
                    {entry.use_up ? "Unflag" : "Use up"}
                  </button>
                  <button
                    onClick={() => removeEntry(entry)}
                    aria-label={`Remove ${entry.item.name}`}
                    className="text-xs text-accent"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
