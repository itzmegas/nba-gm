import { redirect } from "next/navigation";
import { GAME_STATUS } from "@/domain/entities/Game";
import { SupabaseGameRepository } from "@/infrastructure/repositories/SupabaseGameRepository";
import { createClient } from "@/infrastructure/supabase/server";

interface GameLayoutProps {
  children: React.ReactNode;
  params: Promise<{ gameId: string }>;
}

export default async function GameLayout({ children, params }: GameLayoutProps) {
  const { gameId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const gameRepository = new SupabaseGameRepository(supabase);
  const game = await gameRepository.getById(gameId);

  if (!game || game.userId !== user.id || game.status === GAME_STATUS.DELETED) {
    redirect("/");
  }

  return children;
}
