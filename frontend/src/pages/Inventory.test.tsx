import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Inventory } from "@/pages/Inventory";
import { AuthProvider } from "@/context/AuthContext";

const mockItem = { id: 1, name: "Onion", category: "Produce", default_unit: "pcs", aliases: [] };
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
});
