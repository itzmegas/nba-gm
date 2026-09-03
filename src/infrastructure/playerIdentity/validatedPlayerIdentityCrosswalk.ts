import { z } from "zod";
import {
  PLAYER_IDENTITY_PROVIDER,
  type PlayerIdentityBinding,
  type PlayerIdentityCrosswalk,
} from "@/domain/playerIdentity/PlayerIdentityCrosswalk";

const externalPlayerIdentitySchema = z.object({
  provider: z.enum(PLAYER_IDENTITY_PROVIDER),
  externalId: z.string().trim().min(1),
});

const playerIdentityBindingSchema = z.object({
  canonicalName: z.string().trim().min(1),
  identities: z.array(externalPlayerIdentitySchema).min(2),
});

const playerIdentityBindingsSchema = z
  .array(playerIdentityBindingSchema)
  .superRefine((bindings, context) => {
    const identityOwners = new Map<string, number>();

    bindings.forEach((binding, bindingIndex) => {
      const providers = new Set<string>();

      binding.identities.forEach((identity, identityIndex) => {
        if (providers.has(identity.provider)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate provider ${identity.provider} in one player binding`,
            path: [bindingIndex, "identities", identityIndex],
          });
        }
        providers.add(identity.provider);

        const key = `${identity.provider}:${identity.externalId}`;
        const existingOwner = identityOwners.get(key);
        if (existingOwner !== undefined) {
          context.addIssue({
            code: "custom",
            message: `External identity ${key} is already bound at index ${existingOwner}`,
            path: [bindingIndex, "identities", identityIndex],
          });
        } else {
          identityOwners.set(key, bindingIndex);
        }
      });
    });
  });

const unresolvedPlayerIdentitySchema = z.object({
  canonicalName: z.string().trim().min(1),
  sourceProvider: z.enum(PLAYER_IDENTITY_PROVIDER),
  sourceExternalId: z.string().trim().min(1),
  targetProvider: z.enum(PLAYER_IDENTITY_PROVIDER),
  reason: z.string().trim().min(1),
  evidenceUrls: z.array(z.url()).min(1),
  observedOn: z.iso.date(),
});

export function createPlayerIdentityCrosswalk(input: unknown): PlayerIdentityCrosswalk {
  const bindings: PlayerIdentityBinding[] = playerIdentityBindingsSchema.parse(input);
  const bindingByIdentity = new Map<string, PlayerIdentityBinding>();

  for (const binding of bindings) {
    for (const identity of binding.identities) {
      bindingByIdentity.set(`${identity.provider}:${identity.externalId}`, binding);
    }
  }

  return {
    resolve(provider, externalId, targetProvider) {
      const binding = bindingByIdentity.get(`${provider}:${externalId}`);
      if (!binding) return [];
      return binding.identities
        .filter((identity) => identity.provider === targetProvider)
        .map((identity) => identity.externalId);
    },
  };
}

// Manually approved from the live provider records observed on 2026-08-24.
// BRef: https://www.basketball-reference.com/contracts/LAL.html
// ESPN: https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/lal/roster
const approvedPlayerIdentityBindings = [
  { canonicalName: "Cameron Carr", bref: "carrca01", espn: "5113969" },
  { canonicalName: "Luka Dončić", bref: "doncilu01", espn: "3945274" },
  { canonicalName: "Quentin Grimes", bref: "grimequ01", espn: "4397014" },
  { canonicalName: "Jaden Hardy", bref: "hardyja02", espn: "4868423" },
  { canonicalName: "Bronny James", bref: "jamesbr02", espn: "4683774" },
  { canonicalName: "Walker Kessler", bref: "kesslwa01", espn: "4433136" },
  { canonicalName: "Dalton Knecht", bref: "knechda01", espn: "4897943" },
  { canonicalName: "Jake LaRavia", bref: "laravja01", espn: "4592691" },
  { canonicalName: "Kevon Looney", bref: "looneke01", espn: "3155535" },
  { canonicalName: "Sandro Mamukelashvili", bref: "mamuksa01", espn: "4278580" },
  { canonicalName: "Chris Mañon", bref: "manonch01", espn: "4702972" },
  // BRef and ESPN agree on full name, Lakers, 2004-04-18 birth date, Arkansas, SG/guard,
  // Charlotte's 2023 first-round pick, and 6-2/185 measurements.
  { canonicalName: "Nick Smith Jr.", bref: "smithni01", espn: "4683686" },
  { canonicalName: "AK Okereke", bref: "okereak01", espn: "5114350" },
  { canonicalName: "Austin Reaves", bref: "reaveau01", espn: "4066457" },
  { canonicalName: "Collin Sexton", bref: "sextoco01", espn: "4277811" },
  { canonicalName: "Adou Thiero", bref: "thierad01", espn: "5060631" },
  { canonicalName: "Matisse Thybulle", bref: "thybuma01", espn: "3907498" },
  { canonicalName: "Jarred Vanderbilt", bref: "vandeja01", espn: "4278077" },
  { canonicalName: "Ziaire Williams", bref: "willizi02", espn: "4433137" },
] as const;

export const curatedContractIdentityExceptions = approvedPlayerIdentityBindings.map(
  ({ bref, espn }) => ({
    sourcePlayerId: bref,
    targetProviderId: espn,
    evidence: "Manually approved provider record evidence documented in this module on 2026-08-24",
  })
);

export const basketballReferenceToEspnIdentityMap = Object.fromEntries(
  approvedPlayerIdentityBindings.map(({ bref, espn }) => [bref, espn])
) as Readonly<Record<string, string>>;

export const unresolvedPlayerIdentities = [
  unresolvedPlayerIdentitySchema.parse({
    canonicalName: "Arthur Kaluma",
    sourceProvider: PLAYER_IDENTITY_PROVIDER.BASKETBALL_REFERENCE,
    sourceExternalId: "kalumar01",
    targetProvider: PLAYER_IDENTITY_PROVIDER.ESPN,
    reason:
      "BRef identifies the Lakers forward born 2002-03-01 with Creighton, Kansas State, and Texas history, but ESPN's live NBA athlete collection and Lakers roster expose no Arthur Kaluma record; ESPN search exposes no stable athlete result, so no ESPN ID is proven.",
    evidenceUrls: [
      "https://www.basketball-reference.com/players/k/kalumar01.html",
      "https://sports.core.api.espn.com/v3/sports/basketball/nba/athletes?limit=1000",
      "https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/lal/roster",
      "https://www.espn.com/search/_/q/arthur%20kaluma",
    ],
    observedOn: "2026-08-24",
  }),
] as const;

export const validatedPlayerIdentityCrosswalk = createPlayerIdentityCrosswalk(
  approvedPlayerIdentityBindings.map(({ canonicalName, bref, espn }) => ({
    canonicalName,
    identities: [
      { provider: PLAYER_IDENTITY_PROVIDER.BASKETBALL_REFERENCE, externalId: bref },
      { provider: PLAYER_IDENTITY_PROVIDER.ESPN, externalId: espn },
    ],
  }))
);
