import { redirect } from "next/navigation";

export default async function DeckStudyAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { deckId } = await params;
  const { source } = await searchParams;
  redirect(`/vocabulary/${deckId}/study${source ? `?source=${source}` : ""}`);
}
