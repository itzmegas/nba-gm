// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/application/providers/I18nProvider";
import { PasswordForm } from "@/components/password-form";

const { getUser, updateUser, resetPasswordForEmail } = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@/infrastructure/supabase/client", () => ({
  createClient: () => ({ auth: { getUser, updateUser, resetPasswordForEmail } }),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState({}, "", "/account/password");
  getUser.mockResolvedValue({ data: { user: { id: "user" } } });
  updateUser.mockResolvedValue({ error: null });
  resetPasswordForEmail.mockResolvedValue({ error: null });
});

function mount() {
  render(
    <I18nProvider locale="en">
      <PasswordForm />
    </I18nProvider>
  );
}
async function submitPasswords(confirm = "new-password") {
  fireEvent.change(await screen.findByLabelText("New password"), {
    target: { value: "new-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
  fireEvent.submit(screen.getByRole("form"));
}

describe("password management", () => {
  it("updates the signed-in account without asking for the old password", async () => {
    mount();
    await submitPasswords();
    expect(await screen.findByRole("status")).toBeTruthy();
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "new-password" }));
    expect(await screen.findByText(/Password updated/)).toBeTruthy();
  });
  it("rejects mismatched passwords", async () => {
    mount();
    await submitPasswords("different");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("must match")
    );
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("sends a recovery email when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    mount();
    fireEvent.change(await screen.findByLabelText("Email"), {
      target: { value: "gm@example.com" },
    });
    fireEvent.submit(screen.getByRole("form"));
    await waitFor(() =>
      expect(resetPasswordForEmail).toHaveBeenCalledWith("gm@example.com", {
        redirectTo: `${window.location.origin}/auth/recovery`,
      })
    );
    expect(await screen.findByText(/If an account exists/)).toBeTruthy();
  });
  it("keeps the form available after a provider error", async () => {
    updateUser.mockResolvedValue({ error: new Error("Rejected") });
    mount();
    await submitPasswords();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText("New password")).toBeTruthy();
  });
  it("offers a fresh recovery link after an expired callback", async () => {
    window.history.replaceState({}, "", "/account/password?error=recovery");
    mount();
    expect(await screen.findByLabelText("Email")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("invalid or expired");
  });
});
