export const GAME_START_MODE = {
  TODAY: "today",
  SEASON_START: "season-start",
} as const;

export type GameStartMode = (typeof GAME_START_MODE)[keyof typeof GAME_START_MODE];

const newYorkClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** 2026-27 modern cutoffs only; this does not certify that matching scenario data exists. */
export function getGameStartCutoff(mode: GameStartMode, now: Date): Date {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid creation time");
  if (mode === GAME_START_MODE.SEASON_START) return new Date("2026-10-20T04:00:00Z");

  const local = Object.fromEntries(
    newYorkClock.formatToParts(now).map(({ type, value }) => [type, value])
  );
  const midnight = Date.UTC(Number(local.year), Number(local.month) - 1, Number(local.day));
  let cutoff = midnight;
  // Resolve the offset at midnight, not at creation time on a daylight-saving transition day.
  for (let pass = 0; pass < 2; pass++) {
    const parts = Object.fromEntries(
      newYorkClock.formatToParts(cutoff).map(({ type, value }) => [type, value])
    );
    const localTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    cutoff = midnight - (localTime - cutoff);
  }
  return new Date(cutoff);
}
