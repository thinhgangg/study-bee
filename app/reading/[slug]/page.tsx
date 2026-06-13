import { ReadingPracticePage } from "@/components/reading/ReadingPracticePage";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ReadingPracticePage slug={slug} />;
}
