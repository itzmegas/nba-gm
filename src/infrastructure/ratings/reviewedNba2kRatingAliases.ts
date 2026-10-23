export interface ReviewedPlayerRatingAlias {
  espnId: number;
  canonicalName: string;
  sourceName: string;
  sourceSlug: string;
}

// Reviewed against current ESPN rosters and 2K profiles on 2026-10-23; see PLAYER_ATTRIBUTES.md.
export const reviewedNba2kRatingAliases: readonly ReviewedPlayerRatingAlias[] = [
  {
    espnId: 3133602,
    canonicalName: "Svi Mykhailiuk",
    sourceName: "Sviatoslav Mykhailiuk",
    sourceSlug: "sviatoslav-mykhailiuk",
  },
  {
    espnId: 4277919,
    canonicalName: "Mo Bamba",
    sourceName: "Mohamed Bamba",
    sourceSlug: "mohamed-bamba",
  },
  {
    espnId: 4845374,
    canonicalName: "Bub Carrington",
    sourceName: "Carlton Carrington",
    sourceSlug: "bub-carrington",
  },
  {
    espnId: 5160992,
    canonicalName: "Alex Sarr",
    sourceName: "Alexandre Sarr",
    sourceSlug: "alexandre-sarr",
  },
  {
    espnId: 4683771,
    canonicalName: "Ronald Holland II",
    sourceName: "Ron Holland",
    sourceSlug: "ronald-holland",
  },
  {
    espnId: 6430,
    canonicalName: "Jimmy Butler III",
    sourceName: "Jimmy Butler",
    sourceSlug: "jimmy-butler",
  },
  {
    espnId: 4713010,
    canonicalName: "David Jones Garcia",
    sourceName: "David Jones-Garcia",
    sourceSlug: "david-jones-garcia",
  },
  {
    espnId: 4683774,
    canonicalName: "Bronny James",
    sourceName: "Bronny James Jr.",
    sourceSlug: "bronny-james",
  },
  {
    espnId: 3064482,
    canonicalName: "Bobby Portis",
    sourceName: "Bobby Portis Jr.",
    sourceSlug: "bobby-portis",
  },
  {
    espnId: 4278067,
    canonicalName: "Nic Claxton",
    sourceName: "Nicolas Claxton",
    sourceSlug: "nicolas-claxton",
  },
];
