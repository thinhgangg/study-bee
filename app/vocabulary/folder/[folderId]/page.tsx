"use client";

import { Suspense } from "react";
import { use } from "react";
import { VocabularyPage } from "@/components/vocabulary/VocabularyPage";
import { VocabularyGridSkeleton } from "@/components/vocabulary/VocabularyNodeGrid";

export default function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = use(params);
  return (
    <Suspense fallback={<VocabularyShellFallback />}>
      <VocabularyPage folderId={folderId} />
    </Suspense>
  );
}

function VocabularyShellFallback() {
  return (
    <main className="min-h-screen bg-[#FFFBEB] px-5 pb-16 pt-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <VocabularyGridSkeleton />
      </div>
    </main>
  );
}
