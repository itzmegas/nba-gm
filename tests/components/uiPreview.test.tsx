// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UiPreviewPage from "@/app/ui-preview/page";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { UiPreview } from "@/components/design/ui-preview";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function renderPreview() {
  return render(
    <I18nProvider locale="en">
      <TooltipProvider>
        <UiPreview />
      </TooltipProvider>
    </I18nProvider>
  );
}

describe("stage-one visual sample", () => {
  it("is unavailable outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => UiPreviewPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    vi.stubEnv("NODE_ENV", "development");
    expect(UiPreviewPage().type).toBe(UiPreview);
  });

  it("switches proposal and all 30 team themes, then removes preview attributes on unmount", () => {
    const { unmount } = renderPreview();
    expect(document.documentElement.dataset.uiPreview).toBe("proposed");
    expect(screen.getAllByRole("option")).toHaveLength(30);
    fireEvent.change(screen.getByLabelText("Franchise"), { target: { value: "LAL" } });
    expect(document.documentElement.dataset.team).toBe("LAL");
    fireEvent.click(screen.getByLabelText("Current tokens"));
    expect(document.documentElement.dataset.uiPreview).toBe("current");
    unmount();
    expect(document.documentElement.dataset.uiPreview).toBeUndefined();
    expect(document.documentElement.dataset.team).toBeUndefined();
  });

  it("uses native selection buttons and announces the selected fictional player", () => {
    renderPreview();
    const first = screen.getByRole("button", { name: "Select Alex Morgan" });
    const next = screen.getByRole("button", { name: "Select Jordan Williams-Smith" });
    expect(first.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(next);
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(next.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Selected: Jordan Williams-Smith");
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unavailable" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Updating…" }).getAttribute("aria-busy")).toBe(
      "true"
    );
  });
});
