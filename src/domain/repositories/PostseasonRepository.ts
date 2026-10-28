import type { PostseasonState } from "@/domain/entities/Postseason";

export interface PostseasonRepository {
  getState(gameId: string): Promise<PostseasonState>;
}
