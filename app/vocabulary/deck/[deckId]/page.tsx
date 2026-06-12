import { redirect } from "next/navigation";

export default async function DeckAliasPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  redirect(`/vocabulary/${deckId}`);
}
