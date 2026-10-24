// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { usePostseason } from "@/application/hooks/postseason/usePostseason";
import {
  postseasonFixture,
  postseasonId,
} from "@/infrastructure/repositories/postseason.test-fixture";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/infrastructure/supabase/client", () => ({ createClient: () => ({ rpc }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(gameId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => usePostseason(gameId), { wrapper }), client };
}

it("stores validated data under the career-specific postseason key", async () => {
  const state = postseasonFixture();
  rpc.mockResolvedValue({ data: state, error: null });
  const { result, client } = setup(postseasonId(100));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(client.getQueryData(["postseason", postseasonId(100)])).toEqual(state);
  expect(client.getQueryData(["postseason", postseasonId(200)])).toBeUndefined();
});

it("surfaces invalid backend payloads without caching them as ready", async () => {
  rpc.mockResolvedValue({ data: { ...postseasonFixture(), phase: "offseason" }, error: null });
  const { result } = setup(postseasonId(100));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.data).toBeUndefined();
});

it("does not request a missing career", () => {
  setup("");
  expect(rpc).not.toHaveBeenCalled();
});
