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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "expiry">("name");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [editLocation, setEditLocation] = useState<Location>("fridge");

  function load() {
    setLoading(true);
    apiFetch("/api/inventory")
      .then((res) => res.json())
      .then(setEntries)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const needle = search.trim().toLowerCase();
  const grouped = useMemo(() => {
    // While searching, look across all four places so nothing hides in another tab.
    const list = entries.filter((e) =>
      needle ? e.item.name.toLowerCase().includes(needle) : e.location === activeLocation
    );
    return [...list].sort((a, b) => {
      if (sort === "expiry") {
        if (!a.expiry_date && !b.expiry_date) return a.item.name.localeCompare(b.item.name);
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return a.expiry_date.localeCompare(b.expiry_date);
      }
      return a.item.name.localeCompare(b.item.name);
    });
  }, [entries, activeLocation, needle, sort]);

  const counts = useMemo(
    () => Object.fromEntries(LOCATIONS.map((l) => [l.id, entries.filter((e) => e.location === l.id).length])),
    [entries]
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

  function startEdit(entry: InventoryEntry) {
    if (editingId === entry.id) {
      setEditingId(null);
      return;
    }
    setEditingId(entry.id);
    setEditQty(String(entry.quantity));
    setEditUnit(entry.unit ?? "");
    setEditExpiry(entry.expiry_date ?? "");
    setEditLocation(entry.location);
  }

  async function saveEdit(e: React.FormEvent, entry: InventoryEntry) {
    e.preventDefault();
    await apiFetch(`/api/inventory/${entry.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity: Number(editQty) || entry.quantity,
        unit: editUnit || null,
        expiry_date: editExpiry || null,
        location: editLocation,
      }),
    });
    setEditingId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Inventory</h1>
        {isOwner && (
          <button onClick={() => setShowAdd((v) => !v)} className="btn-primary">
            {showAdd ? "Cancel" : "+ Add item"}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search everything in stock…"
          className="field flex-1"
          aria-label="Search stock"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "name" | "expiry")}
          className="field"
          aria-label="Sort"
        >
          <option value="name">A–Z</option>
          <option value="expiry">Expiry</option>
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => {
              setActiveLocation(loc.id);
              setSearch("");
            }}
            aria-pressed={activeLocation === loc.id && !needle}
            className="chip !text-sm"
          >
            {loc.label}
            <span className="opacity-70 text-xs">{counts[loc.id]}</span>
          </button>
        ))}
      </div>

      {showAdd && isOwner && (
        <form onSubmit={addEntry} className="glass space-y-2">
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
              className="w-20 field"
              aria-label="Quantity"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit"
              className="w-24 field"
              aria-label="Unit"
            />
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="flex-1 field"
              aria-label="Expiry date"
            />
          </div>
          <button type="submit" disabled={!pendingItem} className="btn-primary w-full">
            Add to {LOCATIONS.find((l) => l.id === activeLocation)?.label}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-text-muted text-sm">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-text-muted text-sm">{needle ? "No match in stock." : "Nothing here yet."}</p>
      ) : (
        <ul className="space-y-2">
          {grouped.map((entry) => (
            <li key={entry.id} className="glass">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {entry.item.name}
                    {entry.use_up && <span className="pill ml-2">use up</span>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {entry.quantity} {entry.unit ?? ""}
                    {needle && ` · ${LOCATIONS.find((l) => l.id === entry.location)?.label}`}
                  </p>
                  <ExpiryBadge dateStr={entry.expiry_date} />
                </div>
                {isOwner && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleUseUp(entry)} className="btn">
                      {entry.use_up ? "Unflag" : "Use up"}
                    </button>
                    <button onClick={() => startEdit(entry)} className="btn" aria-label={`Edit ${entry.item.name}`}>
                      Edit
                    </button>
                    <button
                      onClick={() => removeEntry(entry)}
                      aria-label={`Remove ${entry.item.name}`}
                      className="text-xs text-accent px-1"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {isOwner && editingId === entry.id && (
                <form onSubmit={(e) => saveEdit(e, entry)} className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      className="w-20 field"
                      aria-label="Edit quantity"
                    />
                    <input
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder="unit"
                      className="w-20 field"
                      aria-label="Edit unit"
                    />
                    <input
                      type="date"
                      value={editExpiry}
                      onChange={(e) => setEditExpiry(e.target.value)}
                      className="flex-1 field"
                      aria-label="Edit expiry date"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value as Location)}
                      className="field"
                      aria-label="Edit location"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l.id} value={l.id}>{l.label}</option>
                      ))}
                    </select>
                    <button className="btn-primary flex-1">Save</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
