"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  renameVocabularyNode,
  type VocabularyNode,
  type VocabularyVisibility,
} from "@/lib/vocabularyTree";

export function RenameNodeDialog({
  profileId,
  node,
  open,
  onOpenChange,
  onSaved,
}: {
  profileId?: string | null;
  node: VocabularyNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<VocabularyVisibility>("private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!node) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setTitle(node.title);
    setDescription(node.description ?? "");
    setVisibility(node.visibility);
    setError("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [node]);

  async function handleSave() {
    if (!node || !profileId) return;
    if (!title.trim()) {
      setError("Vui lòng nhập tên.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await renameVocabularyNode(profileId, {
        nodeId: node.id,
        title: title.trim(),
        description: description.trim() || null,
        visibility,
      });
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-md">
        <div className="bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              Chỉnh sửa {node?.type === "folder" ? "thư mục" : "bộ từ"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Tên
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Mô tả
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Visibility
            <select
              value={visibility}
              onChange={(event) =>
                setVisibility(event.target.value as VocabularyVisibility)
              }
              className="h-11 rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm font-medium outline-none focus:border-yellow-300 focus:ring-4 focus:ring-yellow-300/20"
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
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
            className="h-10 rounded-full bg-white px-5 font-bold"
          >
            Hủy
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 gap-2 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
          >
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
