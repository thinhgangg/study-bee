"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { StudyBeeNavbar } from "@/components/layout/StudyBeeNavbar";
import { CreateDeckDialog } from "@/components/vocabulary/CreateDeckDialog";
import { CreateFolderDialog } from "@/components/vocabulary/CreateFolderDialog";
import { MoveNodeDialog } from "@/components/vocabulary/MoveNodeDialog";
import { RenameNodeDialog } from "@/components/vocabulary/RenameNodeDialog";
import { VocabularyBreadcrumb } from "@/components/vocabulary/VocabularyBreadcrumb";
import {
  PublicEmptyState,
  VocabularyGridSkeleton,
  VocabularyNodeGrid,
} from "@/components/vocabulary/VocabularyNodeGrid";
import {
  copyCommunityNode,
  deleteVocabularyNode,
  fetchBreadcrumb,
  fetchCommunityNodes,
  fetchMyNodes,
  fetchSavedNodeIds,
  fetchSavedNodes,
  getCurrentProfile,
  saveCommunityNode,
  unsaveCommunityNode,
  type VocabularyNode,
  type VocabularyProfile,
} from "@/lib/vocabularyTree";

type VocabularyTab = "mine" | "community" | "saved";

export function VocabularyPage({ folderId = null }: { folderId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as VocabularyTab | null;
  const communityFolderId = searchParams.get("folder");

  const [profile, setProfile] = useState<VocabularyProfile | null>(null);
  const [nodes, setNodes] = useState<VocabularyNode[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<VocabularyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tab, setTab] = useState<VocabularyTab>(requestedTab ?? "mine");
  const [error, setError] = useState("");
  const [renameNode, setRenameNode] = useState<VocabularyNode | null>(null);
  const [moveNode, setMoveNode] = useState<VocabularyNode | null>(null);

  const activeTab = requestedTab ?? tab;
  const activeFolderId = activeTab === "community" ? communityFolderId : folderId;
  const editable = activeTab === "mine";

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const currentProfile = await getCurrentProfile();
      setProfile(currentProfile);

      const [nextNodes, nextBreadcrumb] =
        activeTab === "community"
          ? await Promise.all([
              fetchCommunityNodes(activeFolderId),
              fetchBreadcrumb(activeFolderId),
            ])
          : activeTab === "saved"
            ? [await fetchSavedNodes(currentProfile.id), []]
            : await Promise.all([
                fetchMyNodes(currentProfile.id, activeFolderId),
                fetchBreadcrumb(activeFolderId),
              ]);

      if (activeTab === "community") {
        const savedNodeIds = await fetchSavedNodeIds(currentProfile.id);
        setNodes(
          nextNodes.map((node) => ({
            ...node,
            saved_by_me: savedNodeIds.has(node.id),
          })),
        );
      } else if (activeTab === "saved") {
        setNodes(nextNodes.map((node) => ({ ...node, saved_by_me: true })));
      } else {
        setNodes(nextNodes);
      }
      setBreadcrumb(nextBreadcrumb);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Có lỗi xảy ra.";
      if (message === "Chưa đăng nhập") {
        router.replace("/login");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeFolderId, activeTab, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNodes();
  }, [loadNodes]);

  async function handleSignOut() {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleDelete(node: VocabularyNode) {
    const confirmed = window.confirm(
      node.type === "folder"
        ? `Xóa thư mục "${node.title}" và toàn bộ nội dung bên trong?`
        : `Xóa bộ từ "${node.title}" và các từ vựng bên trong?`,
    );

    if (!confirmed || !profile) return;

    try {
      await deleteVocabularyNode(profile.id, node);
      await loadNodes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể xóa.");
    }
  }

  async function handleCopy(node: VocabularyNode) {
    if (!profile) return;
    setError("");

    try {
      await copyCommunityNode(profile.id, node.id, null);
      router.push("/vocabulary");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể sao chép.");
    }
  }

  async function handleSave(node: VocabularyNode) {
    if (!profile) return;
    setError("");
    const alreadySaved = Boolean(node.saved_by_me);

    try {
      if (alreadySaved) {
        await unsaveCommunityNode(profile.id, node.id);
        if (activeTab === "saved") {
          setNodes((current) => current.filter((item) => item.id !== node.id));
          return;
        }
        setNodes((current) =>
          current.map((item) =>
            item.id === node.id
              ? {
                  ...item,
                  saved_by_me: false,
                  save_count: Math.max(Number(item.save_count ?? 0) - 1, 0),
                }
              : item,
          ),
        );
        return;
      }

      await saveCommunityNode(profile.id, node.id);
      if (activeTab === "community") {
        setNodes((current) =>
          current.map((item) =>
            item.id === node.id
              ? {
                  ...item,
                  saved_by_me: true,
                  save_count: Number(item.save_count ?? 0) + 1,
                }
              : item,
          ),
        );
      } else {
        await loadNodes();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể lưu bộ này.");
    }
  }

  const filteredNodes = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return nodes;

    return nodes.filter((node) => {
      return (
        node.title.toLowerCase().includes(keyword) ||
        node.description?.toLowerCase().includes(keyword) ||
        node.category?.toLowerCase().includes(keyword) ||
        node.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });
  }, [nodes, searchTerm]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFFBEB] font-body text-gray-900">
      <HoneycombPattern />
      <StudyBeeNavbar userEmail={profile?.email ?? ""} onSignOut={handleSignOut} />

      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 lg:px-8">
        <div className="mb-4">
          <VocabularyBreadcrumb
            items={breadcrumb}
            basePath={activeTab === "community" ? "/vocabulary?tab=community" : "/vocabulary"}
          />
        </div>

        <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-3 rounded-full border border-gray-100 bg-gray-50 p-1 text-xs font-bold text-gray-500">
              {[
                { value: "mine", label: "Bộ của tôi" },
                { value: "community", label: "Cộng đồng" },
                { value: "saved", label: "Đã lưu" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setTab(item.value as VocabularyTab);
                    router.push(
                      item.value === "mine"
                        ? "/vocabulary"
                        : `/vocabulary?tab=${item.value}`,
                    );
                  }}
                  className={`rounded-full px-3 py-2 transition-colors ${
                    activeTab === item.value
                      ? "bg-yellow-300 text-gray-900 shadow-sm"
                      : "hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm thư mục, bộ từ..."
                  className="h-11 w-full rounded-full border border-gray-100 bg-[#FFFBEB] pl-11 pr-4 text-sm font-medium text-gray-900 outline-none transition focus:border-yellow-300 focus:bg-white focus:ring-4 focus:ring-yellow-300/20"
                />
              </div>

              {editable && (
                <>
                  <CreateFolderDialog
                    profileId={profile?.id}
                    parentId={activeFolderId}
                    onCreated={loadNodes}
                  />
                  <CreateDeckDialog
                    profileId={profile?.id}
                    parentId={activeFolderId}
                    onCreated={loadNodes}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <VocabularyGridSkeleton />
          ) : activeTab === "saved" && filteredNodes.length === 0 ? (
            <PublicEmptyState />
          ) : activeTab === "community" && filteredNodes.length === 0 ? (
            <PublicEmptyState />
          ) : (
            <VocabularyNodeGrid
              nodes={filteredNodes}
              editable={editable}
              onRename={setRenameNode}
              onDelete={handleDelete}
              onMove={setMoveNode}
              onCopy={activeTab === "community" ? handleCopy : undefined}
              onSave={
                activeTab === "community" || activeTab === "saved"
                  ? handleSave
                  : undefined
              }
              variant={activeTab}
              folderHref={(node) =>
                activeTab === "community"
                  ? `/vocabulary?tab=community&folder=${node.id}`
                  : activeTab === "saved"
                    ? `/vocabulary?tab=community&folder=${node.id}`
                    : `/vocabulary/folder/${node.id}`
              }
              deckHref={(node) =>
                activeTab === "community"
                  ? `/vocabulary/deck/${node.id}?source=community`
                  : activeTab === "saved"
                    ? `/vocabulary/deck/${node.id}?source=saved`
                    : `/vocabulary/deck/${node.id}`
              }
              studyHref={(node) =>
                activeTab === "community"
                  ? `/vocabulary/deck/${node.id}/study?source=community`
                  : activeTab === "saved"
                    ? `/vocabulary/deck/${node.id}/study?source=saved`
                    : `/vocabulary/deck/${node.id}/study`
              }
            />
          )}
        </div>
      </section>

      <RenameNodeDialog
        profileId={profile?.id}
        node={renameNode}
        open={Boolean(renameNode)}
        onOpenChange={(open) => !open && setRenameNode(null)}
        onSaved={loadNodes}
      />
      <MoveNodeDialog
        profileId={profile?.id}
        node={moveNode}
        open={Boolean(moveNode)}
        onOpenChange={(open) => !open && setMoveNode(null)}
        onMoved={loadNodes}
      />
    </main>
  );
}

function HoneycombPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="vocabulary-tree-honey"
          x="0"
          y="0"
          width="56"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="28,2 52,16 52,48 28,62 4,48 4,16"
            fill="none"
            stroke="#FACC15"
            strokeOpacity="0.18"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#vocabulary-tree-honey)" />
    </svg>
  );
}
