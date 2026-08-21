import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type CareerSave,
  type CreateCareerSaveInput,
  parseSupabaseRow,
} from "@/domain/entities/CareerSave";
import type { CareerSaveRepository } from "@/domain/repositories/CareerSaveRepository";

export class SupabaseCareerSaveRepository implements CareerSaveRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getById(id: string): Promise<CareerSave | null> {
    const { data, error } = await this.client
      .from("career_saves")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? parseSupabaseRow(data) : null;
  }

  async getByUserId(userId: string): Promise<CareerSave[]> {
    const { data, error } = await this.client
      .from("career_saves")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(parseSupabaseRow);
  }

  async create(input: CreateCareerSaveInput & { userId: string }): Promise<CareerSave> {
    const { data, error } = await this.client
      .from("career_saves")
      .insert({
        user_id: input.userId,
        first_name: input.firstName,
        last_name: input.lastName,
        position: input.position,
        college: input.college,
        current_overall: 60,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return parseSupabaseRow(data);
  }
}
