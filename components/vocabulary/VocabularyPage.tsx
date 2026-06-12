"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { StudyBeeNavbar } from "@/components/layout/StudyBeeNavbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoneycombPattern } from "@/components/ui/honeycomb-pattern";
import { CreateDeckDialog } from "@/components/vocabulary/CreateDeckDialog";
import { CreateFolderDialog } from "@/components/vocabulary/CreateFolderDialog";
import { CopyNodeDialog } from "@/components/vocabulary/CopyNodeDialog";
import { MoveNodeDialog } from "@/components/vocabulary/MoveNodeDialog";
import { RenameNodeDialog } from "@/components/vocabulary/RenameNodeDialog";
import { VocabularyBreadcrumb } from "@/components/vocabulary/VocabularyBreadcrumb";
import {
  VocabularyEmptyState,
  VocabularyGridSkeleton,
  VocabularyNodeGrid,
} from "@/components/vocabulary/VocabularyNodeGrid";
import {
  deleteVocabularyNode,
  fetchBreadcrumb,
  fetchCommunityNodes,
  fetchMyNodes,
  fetchSavedNodeIds,
  fetchSavedNodes,
  getCurrentProfile,
  getVisibilityLimit,
  saveCommunityNode,
  unsaveCommunityNode,
  type VocabularyNode,
  type VocabularyProfile,
} from "@/lib/vocabularyTree";

type VocabularyTab = "mine" | "community" | "saved";

export function VocabularyPage({ folderId = null }: { folderId?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const communityFolderId = searchParams.get("folder");

  const [profile, setProfile] = useState<VocabularyProfile | null>(null);
  const [nodes, setNodes] = useState<VocabularyNode[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<VocabularyNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [renameNode, setRenameNode] = useState<VocabularyNode | null>(null);
  const [moveNode, setMoveNode] = useState<VocabularyNode | null>(null);
  const [copyNode, setCopyNode] = useState<VocabularyNode | null>(null);
  const [deleteNode, setDeleteNode] = useState<VocabularyNode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeTab: VocabularyTab =
    requestedTab === "community" || requestedTab === "saved"
      ? requestedTab
      : "mine";
  const activeFolderId = activeTab === "community" ? communityFolderId : folderId;
  const editable = activeTab === "mine";
  const ancestorVisibility = getVisibilityLimit(breadcrumb);

  const loadNodes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const currentProfile = await getCurrentProfile();
      setProfile(currentProfile);

      const [nextNodes, nextBreadcrumb] =
        activeTab === "community"
          ? await Promise.all([
              fetchCommunityNodes(activeFolderId, currentProfile.id),
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

  async function handleDelete() {
    if (!deleteNode || !profile) return;
    setDeleting(true);

    try {
      await deleteVocabularyNode(profile.id, deleteNode);
      setDeleteNode(null);
      await loadNodes();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể xóa.");
    } finally {
      setDeleting(false);
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
            <Tabs value={activeTab} className="gap-0">
              <TabsList>
                {[
                  { value: "mine", label: "Bộ của tôi" },
                  { value: "community", label: "Cộng đồng" },
                  { value: "saved", label: "Đã lưu" },
                ].map((item) => (
                  <TabsTrigger key={item.value} value={item.value} asChild>
                    <Link
                      href={
                        item.value === "mine"
                          ? "/vocabulary"
                          : `/vocabulary?tab=${item.value}`
                      }
                    >
                      {item.label}
                    </Link>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

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
                    ancestorVisibility={ancestorVisibility}
                    onCreated={loadNodes}
                  />
                  <CreateDeckDialog
                    profileId={profile?.id}
                    parentId={activeFolderId}
                    ancestorVisibility={ancestorVisibility}
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
          ) : filteredNodes.length === 0 ? (
            <VocabularyEmptyState
              variant={
                searchTerm.trim()
                  ? "search"
                  : activeTab === "saved"
                    ? "saved"
                    : activeTab === "community"
                      ? "community"
                      : activeFolderId
                        ? "folder"
                        : "mine"
              }
            />
          ) : (
            <VocabularyNodeGrid
              nodes={filteredNodes}
              editable={editable}
              onRename={setRenameNode}
              onDelete={setDeleteNode}
              onMove={setMoveNode}
              onCopy={activeTab === "community" ? setCopyNode : undefined}
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
        ancestorVisibility={ancestorVisibility}
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
      <CopyNodeDialog
        profileId={profile?.id}
        node={copyNode}
        open={Boolean(copyNode)}
        onOpenChange={(open) => !open && setCopyNode(null)}
        onCopied={({ parentId }) => {
          setCopyNode(null);
          router.push(parentId ? `/vocabulary/folder/${parentId}` : "/vocabulary");
        }}
      />
      <AlertDialog
        open={Boolean(deleteNode)}
        onOpenChange={(open) => !open && !deleting && setDeleteNode(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Xóa {deleteNode?.type === "folder" ? "thư mục" : "bộ từ"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteNode?.type === "folder"
                ? `Thư mục "${deleteNode.title}" và toàn bộ nội dung bên trong sẽ bị xóa vĩnh viễn.`
                : `Bộ từ "${deleteNode?.title ?? ""}" và các từ vựng bên trong sẽ bị xóa vĩnh viễn.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {deleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
