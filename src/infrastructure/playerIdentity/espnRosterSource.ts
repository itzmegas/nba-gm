import { z } from "zod";
import type { ContractRosterPlayer } from "@/infrastructure/playerIdentity/reconcileContractPlayerIdentities";
import { fetchCurrentRosterForTeam } from "@/infrastructure/roster/espnRosterSource";

const identityRosterPayloadSchema = z.object({
  full_name: z.string().min(1),
  years_of_experience: z.number().int().nonnegative().max(99).nullable(),
});

export interface EspnRosterFetchInput {
  nbaTeam: string;
  sourceTeam: string;
  signal?: AbortSignal;
}

export async function fetchEspnTeamRoster(
  input: EspnRosterFetchInput
): Promise<ContractRosterPlayer[]> {
  const nbaTeam = z
    .string()
    .regex(/^[A-Z]{3}$/)
    .parse(input.nbaTeam);
  const sourceTeam = z
    .string()
    .regex(/^[A-Z]{3}$/)
    .parse(input.sourceTeam);
  const roster = await fetchCurrentRosterForTeam({ nbaId: 0, abbreviation: nbaTeam }, input.signal);
  return roster.map((athlete) => ({
    playerId: `espn:${athlete.sourceId}`,
    providerId: String(athlete.sourceId),
    fullName: identityRosterPayloadSchema.parse(athlete.payload).full_name,
    nbaTeam,
    sourceTeam,
    yearsOfExperience: identityRosterPayloadSchema.parse(athlete.payload).years_of_experience,
  }));
}
