import type { ReactNode } from "react";
import { LeagueShell } from "@/components/league/league-shell";

interface LeagueLayoutProps {
  children: ReactNode;
  params: Promise<{ gameId: string }>;
}

export default async function LeagueLayout({ children, params }: LeagueLayoutProps) {
  const { gameId } = await params;
  return <LeagueShell gameId={gameId}>{children}</LeagueShell>;
}
