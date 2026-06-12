import { redirect } from "next/navigation";

export default async function DeckStudyAliasPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  redirect(`/vocabulary/${deckId}/study`);
}
