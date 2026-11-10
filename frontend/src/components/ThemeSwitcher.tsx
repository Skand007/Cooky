import { useState } from "react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/context/ThemeContext";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Change theme"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-9 rounded-full border border-border flex items-center justify-center"
      >
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: THEMES.find((t) => t.id === theme)?.swatch }}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-xl border border-border bg-surface-alt p-2 shadow-lg z-20"
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface"
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: t.swatch }} />
              {t.label}
              {t.id === theme && <span className="ml-auto text-xs text-text-muted">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
