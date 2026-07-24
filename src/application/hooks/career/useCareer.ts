"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { selectEvent } from "@/domain/constants/career-events";
import {
  applyChoice,
  type CareerSave,
  type CreateCareerSaveInput,
  createCareerSaveInputSchema,
  type DraftPickInput,
  draftPickInputSchema,
  parseSupabaseRow,
  pendingEventSchema,
  type ResolveEventInput,
  resolveEventInputSchema,
} from "@/domain/entities/CareerSave";
import { SupabaseCareerSaveRepository } from "@/infrastructure/repositories/SupabaseCareerSaveRepository";
import { createClient } from "@/infrastructure/supabase/client";

const careerListKey = (userId: string) => ["career-saves", userId] as const;
const careerKey = (userId: string, careerId: string) => ["career-saves", userId, careerId] as const;

function useAuthenticatedUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return userId;
}

export class StaleCareerError extends Error {
  constructor() {
    super("Career save is stale; the dashboard will refetch its current state.");
    this.name = "StaleCareerError";
  }
}

export class InvalidTeamChoiceError extends Error {
  constructor(teamId: string) {
    super(`Invalid team choice: ${teamId}`);
    this.name = "InvalidTeamChoiceError";
  }
}

const invalidateCareer = async (
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
  careerId: string
) => {
  await queryClient.invalidateQueries({ queryKey: careerListKey(userId) });
  await queryClient.invalidateQueries({ queryKey: careerKey(userId, careerId) });
};

const updateOrStale = async (
  queryClient: ReturnType<typeof useQueryClient>,
  careerId: string,
  update: Record<string, unknown>,
  filters: Array<[string, string, string]>
) => {
  // Lifecycle filters are cooperative guards, not security; an owner can bypass them via direct calls on their row.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  let request = supabase.from("career_saves").update(update).eq("id", careerId);
  for (const [column, operator, value] of filters) {
    request =
      operator === "is"
        ? request.is(column, null)
        : operator === "neq"
          ? request.neq(column, value)
          : request.eq(column, value);
  }
  const { data, error } = await request.select().maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    void invalidateCareer(queryClient, user.id, careerId);
    throw new StaleCareerError();
  }
  return parseCareerRow(data);
};

const parseCareerRow = (row: unknown): CareerSave => parseSupabaseRow(row);

export function useCareerSaves() {
  const userId = useAuthenticatedUserId();
  return useQuery<CareerSave[]>({
    queryKey: userId ? careerListKey(userId) : ["career-saves", null],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return new SupabaseCareerSaveRepository(supabase).getByUserId(user.id);
    },
    enabled: !!userId,
  });
}

export function useCareerSave(careerId: string | null) {
  const userId = useAuthenticatedUserId();
  return useQuery<CareerSave | null>({
    queryKey: userId ? careerKey(userId, careerId ?? "") : ["career-saves", null, careerId ?? ""],
    queryFn: () =>
      careerId ? new SupabaseCareerSaveRepository(createClient()).getById(careerId) : null,
    enabled: !!careerId && !!userId,
  });
}

export function useCreateCareerSave() {
  const queryClient = useQueryClient();
  return useMutation<CareerSave, Error, CreateCareerSaveInput>({
    mutationFn: async (input) => {
      const parsed = createCareerSaveInputSchema.parse(input);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return new SupabaseCareerSaveRepository(supabase).create({ ...parsed, userId: user.id });
    },
    onSuccess: (save) => queryClient.invalidateQueries({ queryKey: careerListKey(save.userId) }),
  });
}

export function useRollEvent(careerId: string) {
  const queryClient = useQueryClient();
  return useMutation<CareerSave, Error, void>({
    mutationFn: async () => {
      const save = await new SupabaseCareerSaveRepository(createClient()).getById(careerId);
      if (!save) throw new Error("Career save not found");
      const template = selectEvent(save.id, save.currentAge, save.currentOverall, save.stage);
      const pendingEvent = pendingEventSchema.parse({
        id: `${save.id}:${save.currentAge}:${save.currentOverall}:${template.kind}`,
        ...template,
      });
      return updateOrStale(
        queryClient,
        careerId,
        {
          pending_event: pendingEvent,
          updated_at: new Date().toISOString(),
        },
        [
          ["pending_event", "is", "null"],
          ["stage", "eq", save.stage],
          ["stage", "neq", "retired"],
        ]
      );
    },
    onSuccess: (save) => invalidateCareer(queryClient, save.userId, careerId),
  });
}

export function useResolveEvent(careerId: string) {
  const queryClient = useQueryClient();
  return useMutation<CareerSave, Error, ResolveEventInput>({
    mutationFn: async (input) => {
      const { optionIndex } = resolveEventInputSchema.parse(input);
      const save = await new SupabaseCareerSaveRepository(createClient()).getById(careerId);
      if (!save?.pendingEvent) throw new Error("No pending event to resolve");
      const next = applyChoice(save, optionIndex);
      return updateOrStale(
        queryClient,
        careerId,
        {
          current_overall: next.currentOverall,
          current_age: next.currentAge,
          stage: next.stage,
          current_team_id: next.currentTeamId,
          events_resolved: save.eventsResolved + 1,
          pending_event: null,
          updated_at: new Date().toISOString(),
        },
        [["pending_event->>id", "eq", save.pendingEvent.id]]
      );
    },
    onSuccess: (save) => invalidateCareer(queryClient, save.userId, save.id),
  });
}

export function usePickDraftTeam(careerId: string) {
  const queryClient = useQueryClient();
  return useMutation<CareerSave, Error, DraftPickInput>({
    mutationFn: async (input) => {
      const parsed = draftPickInputSchema.parse(input);
      if (!parsed.offerIds.includes(parsed.teamId)) throw new InvalidTeamChoiceError(parsed.teamId);
      return updateOrStale(
        queryClient,
        careerId,
        {
          current_team_id: parsed.teamId,
          stage: "nba",
          updated_at: new Date().toISOString(),
        },
        [
          ["stage", "eq", "draft"],
          ["pending_event", "is", "null"],
        ]
      );
    },
    onSuccess: (save) => invalidateCareer(queryClient, save.userId, careerId),
  });
}

export function useRetireCareer(careerId: string) {
  const queryClient = useQueryClient();
  return useMutation<CareerSave, Error, void>({
    mutationFn: async () => {
      return updateOrStale(
        queryClient,
        careerId,
        {
          stage: "retired",
          updated_at: new Date().toISOString(),
        },
        [
          ["stage", "eq", "nba"],
          ["pending_event", "is", "null"],
        ]
      );
    },
    onSuccess: (save) => invalidateCareer(queryClient, save.userId, careerId),
  });
}
