"use client";

import { useState } from "react";
import { BookPlus } from "lucide-react";
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
  VisibilityRestrictionNotice,
  VisibilitySelect,
} from "@/components/vocabulary/VisibilitySelect";
import {
  createVocabularyNode,
  type VocabularyVisibility,
} from "@/lib/vocabularyTree";

interface CreateDeckDialogProps {
  profileId?: string | null;
  parentId?: string | null;
  ancestorVisibility?: VocabularyVisibility;
  onCreated: () => void;
}

export function CreateDeckDialog({
  profileId,
  parentId = null,
  ancestorVisibility = "public",
  onCreated,
}: CreateDeckDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [visibility, setVisibility] = useState<VocabularyVisibility>("private");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!title.trim()) {
      setError("Vui lòng nhập tên bộ từ");
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
        type: "deck",
        visibility,
        level: level.trim() || null,
        category: category.trim() || null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      setTitle("");
      setDescription("");
      setLevel("");
      setCategory("");
      setTags("");
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
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-bold text-yellow-300 shadow-lg shadow-gray-900/10 transition-colors hover:bg-gray-700"
        >
          <BookPlus className="h-4 w-4" />
          Tạo bộ từ
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-lg">
        <div className="bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              Tạo bộ từ mới
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-5 py-4">
          <Field label="Tên bộ từ">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Mô tả">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              <Input
                placeholder="VD: B1, IELTS 6.5"
                value={level}
                onChange={(event) => setLevel(event.target.value)}
              />
            </Field>
            <Field label="Category">
              <Input
                placeholder="VD: Reading"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Tags">
            <Input
              placeholder="academic, cambridge, passage 1"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>
          <Field label="Quyền hiển thị">
            <VisibilitySelect
              value={visibility}
              onValueChange={setVisibility}
            />
          </Field>
          <VisibilityRestrictionNotice
            itemType="deck"
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
            onClick={() => setOpen(false)}
            className="h-10 rounded-full bg-white px-5 font-bold"
          >
            Hủy
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="h-10 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
          >
            {loading ? "Đang tạo..." : "Tạo bộ từ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-gray-700">
      {label}
      {children}
    </label>
  );
}
