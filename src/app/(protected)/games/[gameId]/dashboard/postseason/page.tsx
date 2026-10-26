"use client";

import { use } from "react";
import { useGame } from "@/application/hooks/games/useGame";
import { useT } from "@/application/providers/I18nProvider";
import { PostseasonView } from "@/components/postseason/PostseasonView";

interface PostseasonPageProps {
  params: Promise<{ gameId: string }>;
}

export default function PostseasonPage({ params }: PostseasonPageProps) {
  const { gameId } = use(params);
  const game = useGame(gameId);
  const t = useT();
  if (game.isPending) return <output>{t("common", "loading")}</output>;
  if (game.isError || !game.data) return <p role="alert">{t("dashboard", "unableToLoadGame")}</p>;
  return (
    <section data-slot="postseason-screen" aria-labelledby="postseason-title" className="space-y-6">
      <h1 id="postseason-title" className="text-2xl font-bold">
        {t("postseason", "title")}
      </h1>
      <PostseasonView gameId={gameId} selectedTeamId={game.data.selectedTeamId} />
    </section>
  );
}
