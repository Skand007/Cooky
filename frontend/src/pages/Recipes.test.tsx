import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Recipes } from "@/pages/Recipes";
import { AuthProvider } from "@/context/AuthContext";

const suggestion = {
  recipe: { id: 1, title: "Tomato rice", total_minutes: 20, diets: ["vegetarian"], ingredients: [], steps: [] },
  have: ["Rice"],
  missing: ["Tomato"],
  missing_count: 1,
  use_up_hits: [],
  expiring_hits: [],
  score: 1,
};

describe("Recipes", () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [suggestion] }) as typeof fetch;
  });

  it("lists suggestions with what is missing", async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <Recipes />
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Tomato rice")).toBeInTheDocument());
    expect(screen.getByText(/Missing: Tomato/)).toBeInTheDocument();
    expect(screen.queryByText("+ New recipe")).not.toBeInTheDocument();
  });
});
