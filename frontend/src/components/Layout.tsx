import { NavLink, Outlet } from "react-router-dom";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/inventory", label: "Inventory" },
  { to: "/recipes", label: "Recipes" },
  { to: "/shopping-list", label: "Shopping" },
  { to: "/stats", label: "Stats" },
];

export function Layout() {
  const { isOwner, logout } = useAuth();

  return (
    <div className="min-h-screen bg-surface text-text flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <span className="font-display text-xl text-accent">Cooky</span>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {isOwner ? (
            <button onClick={logout} className="text-sm text-text-muted">
              Log out
            </button>
          ) : (
            <NavLink to="/login" className="text-sm text-text-muted">
              Owner login
            </NavLink>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-20 max-w-3xl w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-10 border-t border-border bg-surface-alt flex justify-between px-2 py-2 sm:static sm:border-t-0 sm:bg-transparent sm:justify-center sm:gap-6 sm:py-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 sm:flex-none text-center text-xs sm:text-sm rounded-lg py-1.5 px-1 ${
                isActive ? "text-accent font-semibold" : "text-text-muted"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
