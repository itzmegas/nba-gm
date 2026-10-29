import { redirect } from "next/navigation";

interface LeaguePageProps {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeaguePage({ params, searchParams }: LeaguePageProps) {
  const { gameId } = await params;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(await searchParams)) {
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) {
      query.append(key, entry);
    }
  }

  const queryString = query.toString();
  redirect(`/games/${gameId}/dashboard/league/teams${queryString ? `?${queryString}` : ""}`);
}
