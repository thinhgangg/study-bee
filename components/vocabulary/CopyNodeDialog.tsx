"use client";

import { useEffect, useState } from "react";
import { CopyPlus, Folder, FolderRoot } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  VisibilityRestrictionNotice,
  VisibilitySelect,
} from "@/components/vocabulary/VisibilitySelect";
import {
  copyCommunityNode,
  fetchFolderOptions,
  getVisibilityLimit,
  renameVocabularyNode,
  type VocabularyNode,
  type VocabularyVisibility,
} from "@/lib/vocabularyTree";

export function CopyNodeDialog({
  profileId,
  node,
  open,
  onOpenChange,
  onCopied,
}: {
  profileId?: string | null;
  node: VocabularyNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopied: (result: { nodeId: string; parentId: string | null }) => void;
}) {
  const [folders, setFolders] = useState<
    Pick<VocabularyNode, "id" | "parent_id" | "title" | "visibility">[]
  >([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("root");
  const [visibility, setVisibility] =
    useState<VocabularyVisibility>("private");
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !node || !profileId) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(node.title);
    setDescription(node.description ?? "");
    setParentId("root");
    setVisibility("private");
    setError("");
    /* eslint-enable react-hooks/set-state-in-effect */

    fetchFolderOptions(profileId)
      .then(setFolders)
      .catch((err: unknown) =>
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải danh sách thư mục.",
        ),
      );
  }, [node, open, profileId]);

  async function handleCopy() {
    if (!node || !profileId || !title.trim()) return;
    setCopying(true);
    setError("");
    const targetParentId = parentId === "root" ? null : parentId;

    try {
      const copiedNodeId = await copyCommunityNode(
        profileId,
        node.id,
        targetParentId,
      );
      await renameVocabularyNode(profileId, {
        nodeId: copiedNodeId,
        title: title.trim(),
        description: description.trim() || null,
        visibility,
      });
      onOpenChange(false);
      onCopied({ nodeId: copiedNodeId, parentId: targetParentId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể sao chép.");
    } finally {
      setCopying(false);
    }
  }

  const ancestorVisibility = (() => {
    if (parentId === "root") return "public";

    const folderById = new Map(folders.map((folder) => [folder.id, folder]));
    const ancestors: Array<{ visibility: VocabularyVisibility }> = [];
    const visited = new Set<string>();
    let current = folderById.get(parentId);

    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      ancestors.push({ visibility: current.visibility });
      current = current.parent_id ? folderById.get(current.parent_id) : undefined;
    }

    return getVisibilityLimit(ancestors);
  })();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !copying && onOpenChange(nextOpen)}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-lg">
        <div className="bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-2xl font-bold text-gray-900">
              <CopyPlus className="h-5 w-5 text-yellow-700" />
              Sao chép {node?.type === "folder" ? "thư mục" : "bộ từ"}
            </DialogTitle>
            <DialogDescription>
              Tùy chỉnh thông tin và vị trí cho bản sao của bạn.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 py-5">
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Tên
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              autoFocus
              className="h-12 rounded-2xl border-gray-200 bg-gray-50 px-4 font-semibold shadow-none focus-visible:border-yellow-300 focus-visible:ring-yellow-300/20"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Mô tả
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Thêm mô tả cho bản sao..."
              maxLength={500}
              className="min-h-24 resize-none rounded-2xl border-gray-200 bg-gray-50 px-4 py-3 font-medium shadow-none focus-visible:border-yellow-300 focus-visible:ring-yellow-300/20"
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Thư mục cha
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="h-12 w-full rounded-2xl border-gray-200 bg-gray-50 px-4 font-semibold text-gray-700 shadow-none hover:border-yellow-200 hover:bg-yellow-50/50 focus-visible:border-yellow-300 focus-visible:ring-4 focus-visible:ring-yellow-300/20 data-[state=open]:border-yellow-300 data-[state=open]:bg-white data-[state=open]:ring-4 data-[state=open]:ring-yellow-300/20">
                <SelectValue placeholder="Chọn thư mục đích" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="start"
                className="rounded-2xl border border-yellow-100 bg-white p-1.5 shadow-xl shadow-yellow-100/60"
              >
                <SelectItem
                  value="root"
                  className="rounded-xl py-2.5 pl-3 pr-9 font-semibold focus:bg-yellow-50"
                >
                  <FolderRoot className="text-yellow-700" />
                  Từ vựng
                </SelectItem>
                {folders.map((folder) => (
                  <SelectItem
                    key={folder.id}
                    value={folder.id}
                    className="rounded-xl py-2.5 pl-3 pr-9 font-semibold focus:bg-yellow-50"
                  >
                    <Folder className="text-yellow-700" />
                    {folder.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Quyền hiển thị
            <VisibilitySelect
              value={visibility}
              onValueChange={setVisibility}
            />
          </label>
          <VisibilityRestrictionNotice
            itemType={node?.type ?? "deck"}
            visibility={visibility}
            ancestorVisibility={ancestorVisibility}
          />

          {error && (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-yellow-100 bg-[#FFFBEB] p-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={copying}
            className="h-10 rounded-full bg-white px-5 font-bold"
          >
            Hủy
          </Button>
          <Button
            onClick={handleCopy}
            disabled={copying || !title.trim()}
            className="h-10 gap-2 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
          >
            {copying ? "Đang sao chép..." : "Tạo bản sao"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
