import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { Item } from "@/lib/types";

interface Props {
  onPick: (item: Item | { newName: string }) => void;
  placeholder?: string;
}

/** Type-ahead search against the item catalogue, with a fallback to add
 * whatever was typed as a brand new item when nothing matches. */
export function ItemAutocomplete({ onPick, placeholder = "Search ingredients…" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiFetch(`/api/items?search=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((items: Item[]) => setResults(items))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(item: Item) {
    onPick(item);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function pickNew() {
    onPick({ newName: query.trim() });
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  const exactMatch = results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface-alt px-3 py-2"
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-surface-alt shadow-lg max-h-56 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-surface"
            >
              {item.name}
              {item.category && <span className="text-text-muted"> · {item.category}</span>}
            </button>
          ))}
          {!exactMatch && (
            <button
              type="button"
              onClick={pickNew}
              className="block w-full text-left px-3 py-2 text-sm text-accent hover:bg-surface"
            >
              + Add "{query.trim()}" as a new item
            </button>
          )}
        </div>
      )}
    </div>
  );
}
