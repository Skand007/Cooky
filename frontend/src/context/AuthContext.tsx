import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch, setAuthToken } from "@/lib/api";

interface AuthContextValue {
  isOwner: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = "cooky-token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    apiFetch("/api/auth/me")
      .then(() => setIsOwner(true))
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json()) as { access_token: string };
    window.localStorage.setItem(TOKEN_KEY, data.access_token);
    setAuthToken(data.access_token);
    setIsOwner(true);
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setIsOwner(false);
  }

  return (
    <AuthContext.Provider value={{ isOwner, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
