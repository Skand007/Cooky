import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useAuth } from "@/context/AuthContext";

// Simple 24px line icons (stroke follows the text colour).
const ICONS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  inventory: "M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM4 7.5 12 12l8-4.5M12 12v9",
  recipes: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6",
  shopping: "M4 5h2l2 11h10l2-8H7.2M10 20.5h.01M17 20.5h.01",
  bot: "M12 3.5v2.5M5 9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8l-4 3V9zM9.5 12h.01M14.5 12h.01",
  stats: "M5 20V11M12 20V5M19 20v-7",
};

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/inventory", label: "Inventory", icon: "inventory" },
  { to: "/recipes", label: "Recipes", icon: "recipes" },
  { to: "/shopping-list", label: "Shopping", icon: "shopping" },
  { to: "/bot", label: "Bot", icon: "bot" },
  { to: "/stats", label: "Stats", icon: "stats" },
];

function Icon({ name }: { name: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Layout() {
  const { isOwner, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen text-text flex flex-col">
      {/* Floating glass header: content scrolls underneath it. */}
      <header className="sticky top-0 z-20 px-3 pt-[max(0.6rem,env(safe-area-inset-top))] pb-1">
        <div className="glass-bar mx-auto max-w-3xl flex items-center justify-between pl-5 pr-2 py-2">
          <NavLink to="/" className="text-xl font-bold tracking-tight">
            Cooky<span className="text-accent">.</span>
          </NavLink>
          <div className="flex items-center gap-1.5">
            {isOwner && (
              <NavLink to="/catalogue" className="btn !px-3 !py-1.5">
                Catalogue
              </NavLink>
            )}
            {isOwner ? (
              <button onClick={logout} className="btn !px-3 !py-1.5">
                Log out
              </button>
            ) : (
              <NavLink to="/login" className="btn !px-3 !py-1.5">
                Owner login
              </NavLink>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-3 pb-32 max-w-3xl w-full mx-auto">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      {/* Floating glass tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-events-none"
      >
        <div className="glass-bar pointer-events-auto mx-auto max-w-md flex gap-0.5 p-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => `tab ${isActive ? "is-active" : ""}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
