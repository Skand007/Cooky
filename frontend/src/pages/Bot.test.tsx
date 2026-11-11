import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Bot } from "@/pages/Bot";
import { AuthProvider } from "@/context/AuthContext";

describe("Bot", () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true, public: false }),
    }) as typeof fetch;
  });

  it("tells visitors that only the owner can chat", async () => {
    render(
      <AuthProvider>
        <Bot />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/only the owner can chat/i)).toBeInTheDocument());
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });
});
