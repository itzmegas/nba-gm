import { z } from "zod";

const resultSchema = z.object({
  enrolled_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
});

export async function importInitialFreeAgents(gameId: string): Promise<void> {
  z.uuid().parse(gameId);
  const response = await fetch("/api/free-agency/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(body);
    throw new Error(error.success ? error.data.error : "Initial free-agent import failed.");
  }
  resultSchema.parse(body);
}
