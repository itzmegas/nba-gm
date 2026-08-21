import type { CareerSave, CreateCareerSaveInput } from "@/domain/entities/CareerSave";

export interface CareerSaveRepository {
  getById(id: string): Promise<CareerSave | null>;
  getByUserId(userId: string): Promise<CareerSave[]>;
  create(input: CreateCareerSaveInput & { userId: string }): Promise<CareerSave>;
}
