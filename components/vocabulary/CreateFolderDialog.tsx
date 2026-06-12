"use client";

import { useState } from "react";
import { FolderPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createVocabularyNode,
  type VocabularyVisibility,
} from "@/lib/vocabularyTree";

export function CreateFolderDialog({
  profileId,
  parentId,
  onCreated,
}: {
  profileId?: string | null;
  parentId: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<VocabularyVisibility>("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!title.trim()) {
      setError("Vui lòng nhập tên thư mục");
      return;
    }
    if (!profileId) {
      setError("Không tìm thấy hồ sơ người dùng.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createVocabularyNode(profileId, {
        parentId,
        title: title.trim(),
        description: description.trim() || null,
        type: "folder",
        visibility,
      });

      setTitle("");
      setDescription("");
      setVisibility("private");
      setOpen(false);
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-yellow-200 bg-white px-5 text-sm font-bold text-gray-800 shadow-sm shadow-yellow-100/60 transition-colors hover:bg-yellow-50"
        >
          <Plus className="h-4 w-4 text-yellow-700" />
          Tạo thư mục
        </button>
      </DialogTrigger>

      <DialogContent className="overflow-hidden border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-md">
        <div className="bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-300 text-gray-900">
              <FolderPlus className="h-5 w-5" />
            </div>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              Tạo thư mục mới
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Tên thư mục
            <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </label>
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Mô tả
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-gray-700">
            Visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as VocabularyVisibility)}
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
          <Button variant="outline" onClick={() => setOpen(false)} className="h-10 rounded-full bg-white px-5 font-bold">
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="h-10 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700">
            {loading ? "Đang tạo..." : "Tạo thư mục"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
