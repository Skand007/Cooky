import { useEffect, useRef, useState } from "react";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/context/ThemeContext";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when tapping anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Change theme"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="btn !h-9 !w-9 !p-0"
      >
        <span
          className="h-4 w-4 rounded-full ring-2 ring-white/60"
          style={{ backgroundColor: THEMES.find((t) => t.id === theme)?.swatch }}
        />
      </button>
      {open && (
        <div role="menu" className="glass-menu menu-enter absolute right-0 mt-2 w-44 p-1.5 z-30">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="menuitem"
              onClick={() => {
                setTheme(t.id);
                setOpen(false);
              }}
              className="menu-item"
            >
              <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: t.swatch }} />
              {t.label}
              <span className="ml-auto text-xs text-text-muted">{t.mode}</span>
              {t.id === theme && <span className="text-accent">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
