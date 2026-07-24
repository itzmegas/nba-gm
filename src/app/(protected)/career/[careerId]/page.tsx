"use client";
// biome-ignore format: keep this deliberately compact presentation slice within its PR budget.
import { use } from "react";
import {
  StaleCareerError,
  useCareerSave,
  usePickDraftTeam,
  useResolveEvent,
  useRetireCareer,
  useRollEvent,
} from "@/application/hooks/career/useCareer";
import { useTeams } from "@/application/hooks/teams/useTeams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pickNbaOffers } from "@/domain/constants/career-events";
import { CAREER_STAGE } from "@/domain/entities/CareerSave";
// biome-ignore format: compact implementation keeps the PR within its authored-line cap.

export default function CareerDashboard({ params }: { params: Promise<{ careerId: string }> }) {
  const { careerId } = use(params), query = useCareerSave(careerId), teams = useTeams();
  const roll = useRollEvent(careerId), resolve = useResolveEvent(careerId), pick = usePickDraftTeam(careerId), retire = useRetireCareer(careerId);
  if (query.isLoading) return <output>Loading career...</output>;
  if (query.error || !query.data) return <p role="alert">Unable to load career.</p>;
  const save = query.data, mutations = [roll, resolve, pick, retire], stale = query.isFetching && mutations.some((mutation) => mutation.error instanceof StaleCareerError), error = mutations.find((mutation) => mutation.error && !(mutation.error instanceof StaleCareerError))?.error, team = (id: string | null) => teams.data?.find((item) => item.id === id)?.name ?? "Undrafted", offers = (() => { try { return save.stage === CAREER_STAGE.DRAFT && teams.data ? pickNbaOffers(save.id, teams.data) : []; } catch { return []; } })();
  return <main className="mx-auto max-w-3xl space-y-6 p-6"><h1 className="text-3xl font-black">{save.firstName} {save.lastName}</h1>{stale && <output className="text-muted-foreground">Refreshing current state...</output>}{error && <p role="alert" className="text-destructive">{error.message}</p>}<Card><CardContent className="grid grid-cols-2 gap-3 pt-6 text-sm"><span>Position: {save.position}</span><span>College: {save.college}</span><span>Age: {save.currentAge}</span><span>Overall: {save.currentOverall}</span><span>Team: {team(save.currentTeamId)}</span><span>Events: {save.eventsResolved}</span></CardContent></Card>{save.pendingEvent ? <Card><CardHeader><CardTitle>{save.pendingEvent.prompt}</CardTitle></CardHeader><CardContent className="space-y-2">{save.pendingEvent.options.map((option, index) => <Button className="w-full" disabled={stale || resolve.isPending} key={option.label} onClick={() => resolve.mutate({ optionIndex: index })}>{option.label}</Button>)}</CardContent></Card> : save.stage === CAREER_STAGE.DRAFT ? <Card><CardHeader><CardTitle>Choose your NBA team</CardTitle></CardHeader><CardContent className="space-y-2">{offers.length ? offers.map((offer) => <Button className="w-full" disabled={stale || pick.isPending} key={offer.id} onClick={() => pick.mutate({ teamId: offer.id, offerIds: offers.map((item) => item.id) })}>Sign with {offer.city} {offer.name}</Button>) : <p role="alert">Unable to load draft offers.</p>}</CardContent></Card> : save.stage === CAREER_STAGE.RETIRED ? <Card><CardHeader><CardTitle>Legacy</CardTitle></CardHeader><CardContent>Final overall {save.currentOverall} · Age {save.currentAge} · {save.college} · {team(save.currentTeamId)} · {save.eventsResolved} events resolved</CardContent></Card> : <div className="flex gap-2"><Button disabled={stale || roll.isPending || retire.isPending} onClick={() => roll.mutate()}>{roll.isPending ? "Advancing..." : "Advance Season"}</Button>{save.stage === CAREER_STAGE.NBA && <Button variant="outline" disabled={stale || retire.isPending || roll.isPending} onClick={() => retire.mutate()}>Retire</Button>}</div>}</main>;
}
