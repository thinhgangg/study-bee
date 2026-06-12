"use client";

import { useEffect, useState } from "react";
import { MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchFolderOptions,
  moveVocabularyNode,
  type VocabularyNode,
} from "@/lib/vocabularyTree";

export function MoveNodeDialog({
  profileId,
  node,
  open,
  onOpenChange,
  onMoved,
}: {
  profileId?: string | null;
  node: VocabularyNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoved: () => void;
}) {
  const [folders, setFolders] = useState<Pick<VocabularyNode, "id" | "parent_id" | "title">[]>([]);
  const [parentId, setParentId] = useState<string>("");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !profileId) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setParentId(node?.parent_id ?? "");
    setError("");
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchFolderOptions(profileId)
      .then((items) => setFolders(items.filter((item) => item.id !== node?.id)))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Không thể tải danh sách thư mục."),
      );
  }, [node, open, profileId]);

  async function handleMove() {
    if (!node || !profileId) return;
    setMoving(true);
    setError("");

    try {
      await moveVocabularyNode(profileId, node.id, parentId || null);
      onOpenChange(false);
      onMoved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setMoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-md">
        <div className="bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              Di chuyển
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-gray-500">
            Chọn thư mục đích cho <span className="font-bold text-gray-900">{node?.title}</span>.
          </p>
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Thư mục cha
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              className="h-11 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-medium outline-none focus:border-yellow-300 focus:ring-4 focus:ring-yellow-300/20"
            >
              <option value="">Từ vựng</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.title}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-yellow-100 bg-[#FFFBEB] p-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 rounded-full bg-white px-5 font-bold">
            Hủy
          </Button>
          <Button onClick={handleMove} disabled={moving} className="h-10 gap-2 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700">
            <MoveRight className="h-4 w-4" />
            {moving ? "Đang chuyển..." : "Di chuyển"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
