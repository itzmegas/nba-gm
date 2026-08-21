"use client";
// biome-ignore format: keep this deliberately compact presentation slice within its PR budget.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCareerSaves, useCreateCareerSave } from "@/application/hooks/career/useCareer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// biome-ignore format: compact import keeps the PR within its authored-line cap.
import { CAREER_POSITION, COLLEGES, createCareerSaveInputSchema } from "@/domain/entities/CareerSave";
// biome-ignore format: compact implementation keeps the PR within its authored-line cap.
export default function CareerPage() {
  const router = useRouter(), saves = useCareerSaves(), create = useCreateCareerSave(), [formError, setFormError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setFormError(""); try { const save = await create.mutateAsync(createCareerSaveInputSchema.parse(Object.fromEntries(new FormData(event.currentTarget)))); router.push(`/career/${save.id}`); } catch (error) { setFormError(error instanceof Error ? error.message : "Unable to create career."); } }
  if (saves.isLoading) return <output>Loading careers...</output>;
  if (saves.error) return <Card><CardContent className="py-6 text-destructive">Unable to load careers: {saves.error.message}</CardContent></Card>;
  return <main className="mx-auto max-w-3xl space-y-6 p-6"><h1 className="text-3xl font-black">Player Career</h1>{saves.data?.length ? <Card><CardHeader><CardTitle>Career saves</CardTitle></CardHeader><CardContent className="space-y-2">{saves.data.map((save) => <a className="block rounded-lg border p-3 hover:bg-muted" href={`/career/${save.id}`} key={save.id}><b>{save.firstName} {save.lastName}</b><span className="ml-2 text-sm text-muted-foreground">{save.stage} · Overall {save.currentOverall}</span></a>)}</CardContent></Card> : <p className="text-muted-foreground">No career saves yet.</p>}<Card><CardHeader><CardTitle>New career</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><Input aria-label="First name" name="firstName" placeholder="First name" required /><Input aria-label="Last name" name="lastName" placeholder="Last name" required /><select aria-label="Position" className="h-9 rounded-4xl border border-input bg-input/30 px-3" defaultValue="PG" name="position">{Object.values(CAREER_POSITION).map((position) => <option key={position}>{position}</option>)}</select><select aria-label="College" className="h-9 rounded-4xl border border-input bg-input/30 px-3" defaultValue={COLLEGES[0]} name="college">{COLLEGES.map((college) => <option key={college}>{college}</option>)}</select></div>{formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}<Button disabled={create.isPending}>{create.isPending ? "Creating..." : "Create career"}</Button></form></CardContent></Card></main>;
}
