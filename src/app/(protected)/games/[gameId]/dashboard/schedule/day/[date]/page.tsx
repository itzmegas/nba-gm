import { notFound } from "next/navigation";
import { z } from "zod";
import { DailyGames } from "@/components/games/DailyGames";

interface DailyGamesPageProps {
  params: Promise<{ gameId: string; date: string }>;
}

export default async function DailyGamesPage({ params }: DailyGamesPageProps) {
  const { gameId, date } = await params;
  if (!z.iso.date().safeParse(date).success) notFound();
  return <DailyGames gameId={gameId} date={date} />;
}
