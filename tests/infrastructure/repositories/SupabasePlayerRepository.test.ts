import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { SupabasePlayerRepository } from "@/infrastructure/repositories/SupabasePlayerRepository";

it.each([
  [
    { age: 38, birth_date: "1988-03-14" },
    { age: 38, birthDate: "1988-03-14" },
  ],
  [
    { age: null, birth_date: null },
    { age: undefined, birthDate: undefined },
  ],
  [{}, { age: undefined, birthDate: undefined }],
])("maps nullable demographics from player rows", async (row, expected) => {
  const single = vi.fn().mockResolvedValue({ data: { id: "player", ...row }, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const client = { from: vi.fn(() => ({ select })) } as unknown as SupabaseClient;
  expect(await new SupabasePlayerRepository(client).getById("player")).toMatchObject(expected);
});
