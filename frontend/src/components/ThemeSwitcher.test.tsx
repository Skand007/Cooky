import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ThemeProvider } from "@/context/ThemeContext";

describe("ThemeSwitcher", () => {
  it("lists all four themes when opened", () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByLabelText("Change theme"));
    expect(screen.getByText("Citrus")).toBeInTheDocument();
    expect(screen.getByText("Linen")).toBeInTheDocument();
    expect(screen.getByText("Midnight")).toBeInTheDocument();
    expect(screen.getByText("Charcoal")).toBeInTheDocument();
  });

  it("applies data-theme to the document on selection", () => {
    render(
      <ThemeProvider>
        <ThemeSwitcher />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByLabelText("Change theme"));
    fireEvent.click(screen.getByText("Midnight"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
