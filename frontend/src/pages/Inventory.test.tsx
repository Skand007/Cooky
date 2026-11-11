import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Inventory } from "@/pages/Inventory";
import { AuthProvider } from "@/context/AuthContext";

const mockItem = { id: 1, name: "Onion", category: "Produce", default_unit: "pcs", aliases: [], diet: "veg", jain_ok: false, staple: false };
const mockEntry = {
  id: 1,
  item: mockItem,
  location: "fridge",
  quantity: 2,
  unit: "pcs",
  expiry_date: null,
  use_up: false,
  added_at: "2026-01-01T00:00:00Z",
};

function mockFetchSequence(responses: unknown[]) {
  let call = 0;
  globalThis.fetch = vi.fn(() => {
    const body = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

describe("Inventory page", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows entries for the fridge tab by default", async () => {
    mockFetchSequence([[mockEntry]]);
    render(
      <AuthProvider>
        <Inventory />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Onion")).toBeInTheDocument());
    expect(screen.getByText(/2 pcs/)).toBeInTheDocument();
  });

  it("shows an empty state for a location with nothing in it", async () => {
    mockFetchSequence([[mockEntry]]);
    render(
      <AuthProvider>
        <Inventory />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Onion")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Freezer"));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("hides the add button for a logged-out visitor", async () => {
    mockFetchSequence([[]]);
    render(
      <AuthProvider>
        <Inventory />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Nothing here yet.")).toBeInTheDocument());
    expect(screen.queryByText("+ Add item")).not.toBeInTheDocument();
  });

  it("searches across all locations", async () => {
    const rice = { ...mockEntry, id: 2, item: { ...mockItem, id: 2, name: "Rice" }, location: "shelf" };
    mockFetchSequence([[mockEntry, rice]]);
    render(
      <AuthProvider>
        <Inventory />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Onion")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Search stock"), { target: { value: "ric" } });
    expect(screen.getByText("Rice")).toBeInTheDocument();
    expect(screen.queryByText("Onion")).not.toBeInTheDocument();
  });

  it("sorts by soonest expiry, undated last", async () => {
    const a = { ...mockEntry, id: 2, item: { ...mockItem, id: 2, name: "Apple" }, expiry_date: null };
    const z = { ...mockEntry, id: 3, item: { ...mockItem, id: 3, name: "Zucchini" }, expiry_date: "2030-01-01" };
    mockFetchSequence([[a, z]]);
    render(
      <AuthProvider>
        <Inventory />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("Apple")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "expiry" } });
    const names = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
    expect(names[0]).toContain("Zucchini");
    expect(names[1]).toContain("Apple");
  });
});
