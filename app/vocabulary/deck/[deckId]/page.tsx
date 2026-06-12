import { redirect } from "next/navigation";

export default async function DeckAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { deckId } = await params;
  const { source } = await searchParams;
  redirect(`/vocabulary/${deckId}${source ? `?source=${source}` : ""}`);
}
