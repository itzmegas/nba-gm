import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/recovery/route";

const { exchangeCodeForSession } = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/infrastructure/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession } }),
}));
beforeEach(() => vi.resetAllMocks());

it("exchanges the recovery code and uses a fixed local destination", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  const response = await GET(
    new Request("https://game.example/auth/recovery?code=valid&next=https://evil.example")
  );
  expect(exchangeCodeForSession).toHaveBeenCalledWith("valid");
  expect(response.headers.get("location")).toBe("https://game.example/account/password");
});

it("rejects missing and expired codes", async () => {
  exchangeCodeForSession.mockResolvedValue({ error: new Error("Expired") });
  for (const query of ["", "?code=expired"]) {
    const response = await GET(new Request(`https://game.example/auth/recovery${query}`));
    expect(response.headers.get("location")).toBe(
      "https://game.example/account/password?error=recovery"
    );
  }
});
