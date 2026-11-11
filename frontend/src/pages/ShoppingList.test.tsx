import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ShoppingList } from "@/pages/ShoppingList";
import { AuthProvider } from "@/context/AuthContext";

const item = (id: number, name: string) => ({
  id,
  name,
  category: null,
  default_unit: null,
  aliases: [],
  diet: "veg",
  jain_ok: true,
  staple: false,
});
const line = (id: number, name: string, extra: object = {}) => ({
  id,
  item: item(id, name),
  quantity: null,
  unit: null,
  note: null,
  bought: false,
  in_stock: false,
  added_at: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("ShoppingList paper", () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        line(1, "Zucchini"),
        line(2, "Rice", { in_stock: true }),
        line(3, "Apple", { bought: true }),
        line(4, "Milk"),
      ],
    }) as typeof fetch;
  });

  it("lists to-buy items A–Z first, then crossed-out ones A–Z", async () => {
    render(
      <AuthProvider>
        <ShoppingList />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Zucchini")).toBeInTheDocument());
    const names = screen.getAllByRole("listitem").map((li) => li.querySelector(".paper-name")?.textContent?.trim());
    expect(names).toEqual(["Milk", "Zucchini", "Apple", "Rice"]);
    expect(screen.getByText("Rice").closest("li")).toHaveClass("is-done");
    expect(screen.getByText("Milk").closest("li")).not.toHaveClass("is-done");
    expect(screen.getByText("already in stock")).toBeInTheDocument();
  });
});
