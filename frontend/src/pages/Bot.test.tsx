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

  it("tells visitors that limited to the owner", async () => {
    render(
      <AuthProvider>
        <Bot />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/limited to the owner/i)).toBeInTheDocument());
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });
});

describe("Bot (public)", () => {
  it("lets visitors chat when the bot is public", async () => {
    window.localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: true, public: true }),
    }) as typeof fetch;
    render(
      <AuthProvider>
        <Bot />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByLabelText("Message")).toBeInTheDocument());
  });
});
