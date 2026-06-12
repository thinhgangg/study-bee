"use client";

import type { ReactNode } from "react";
import { useId, useMemo, useState } from "react";
import { ImageIcon, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

interface GeneratedCard {
  word: string;
  phonetic: string;
  part_of_speech: string;
  vietnamese_meaning: string;
  english_example: string;
  vietnamese_example: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  image_url: string | null;
  image_options?: string[];
}

interface CardForm {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  vietnameseMeaning: string;
  englishExample: string;
  vietnameseExample: string;
  synonyms: string;
  antonyms: string;
  collocations: string;
  imageUrl: string;
}

interface RelatedTerm {
  text: string;
  meaning: string;
}

interface AddCardDialogProps {
  deckId: string;
  onCardCreated: () => void | Promise<void>;
  triggerLabel?: string;
  trigger?: ReactNode;
  card?: {
    id: string;
    word: string;
    phonetic: string | null;
    part_of_speech: string | null;
    vietnamese_meaning: string | null;
    english_example: string | null;
    vietnamese_example: string | null;
    synonyms: string[] | null;
    antonyms: string[] | null;
    collocations: string[] | null;
    image_url: string | null;
  };
}

const emptyForm: CardForm = {
  word: "",
  phonetic: "",
  partOfSpeech: "",
  vietnameseMeaning: "",
  englishExample: "",
  vietnameseExample: "",
  synonyms: "",
  antonyms: "",
  collocations: "",
  imageUrl: "",
};

const relatedSeparators = [" — ", " – ", " - ", ": ", "："];

function parseRelatedTerm(value: string): RelatedTerm {
  const trimmed = value.trim();
  const separator = relatedSeparators.find((item) => trimmed.includes(item));

  if (!separator) {
    return { text: trimmed, meaning: "" };
  }

  const [text, ...meaningParts] = trimmed.split(separator);

  return {
    text: text.trim(),
    meaning: meaningParts.join(separator).trim(),
  };
}

function splitRelatedTerms(value: string) {
  return value
    .split(/\n|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinRelatedTerms(value: string[]) {
  return value.join("\n");
}

export function AddCardDialog({
  deckId,
  onCardCreated,
  triggerLabel = "Thêm từ mới",
  trigger,
  card,
}: AddCardDialogProps) {
  const uploadInputId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CardForm>(() =>
    card ? cardToForm(card) : emptyForm,
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasGeneratedWithAi, setHasGeneratedWithAi] = useState(false);
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [error, setError] = useState("");

  const synonyms = useMemo(
    () => splitRelatedTerms(form.synonyms),
    [form.synonyms],
  );
  const antonyms = useMemo(
    () => splitRelatedTerms(form.antonyms),
    [form.antonyms],
  );
  const collocations = useMemo(
    () => splitRelatedTerms(form.collocations),
    [form.collocations],
  );
  const isEditing = Boolean(card);

  function updateField<K extends keyof CardForm>(field: K, value: CardForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field !== "imageUrl") setConfirmDelete(false);
  }

  function resetForm() {
    setForm(card ? cardToForm(card) : emptyForm);
    setHasGeneratedWithAi(false);
    setImageOptions([]);
    setConfirmDelete(false);
    setError("");
  }

  async function handleGenerate() {
    const trimmedWord = form.word.trim();

    if (!trimmedWord) {
      setError("Vui lòng nhập từ tiếng Anh trước khi tạo bằng AI.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: trimmedWord }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Không thể tạo từ vựng bằng AI.");
      }

      const generatedCard = data as GeneratedCard;

      setForm({
        word: generatedCard.word,
        phonetic: generatedCard.phonetic,
        partOfSpeech: generatedCard.part_of_speech,
        vietnameseMeaning: generatedCard.vietnamese_meaning,
        englishExample: generatedCard.english_example,
        vietnameseExample: generatedCard.vietnamese_example,
        synonyms: joinRelatedTerms(generatedCard.synonyms),
        antonyms: joinRelatedTerms(generatedCard.antonyms),
        collocations: joinRelatedTerms(generatedCard.collocations),
        imageUrl: generatedCard.image_url ?? "",
      });
      setImageOptions(generatedCard.image_options ?? []);
      setHasGeneratedWithAi(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Có lỗi xảy ra khi gọi AI.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function handleImageUpload(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn một file ảnh.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Ảnh tải lên nên nhỏ hơn 2MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateField("imageUrl", reader.result);
        setImageOptions([]);
        setError("");
      }
    };
    reader.onerror = () => setError("Không thể đọc file ảnh này.");
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!form.word.trim()) {
      setError("Vui lòng nhập từ tiếng Anh.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        deck_id: deckId,
        word: form.word.trim(),
        phonetic: form.phonetic.trim() || null,
        part_of_speech: form.partOfSpeech.trim() || null,
        vietnamese_meaning: form.vietnameseMeaning.trim() || null,
        english_example: form.englishExample.trim() || null,
        vietnamese_example: form.vietnameseExample.trim() || null,
        synonyms,
        antonyms,
        collocations,
        image_url: form.imageUrl.trim() || null,
      };

      const { error: saveError } = card
        ? await supabase.from("cards").update(payload).eq("id", card.id)
        : await supabase.from("cards").insert(payload);

      if (saveError) throw saveError;

      await onCardCreated();
      setOpen(false);
      resetForm();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Có lỗi xảy ra khi lưu từ vựng.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!card) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const { error: reviewsError } = await supabase
        .from("card_reviews")
        .delete()
        .eq("card_id", card.id);

      if (reviewsError) throw reviewsError;

      const { error: deleteError } = await supabase
        .from("cards")
        .delete()
        .eq("id", card.id)
        .eq("deck_id", deckId);

      if (deleteError) throw deleteError;

      await onCardCreated();
      setOpen(false);
      resetForm();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Có lỗi xảy ra khi xóa từ vựng.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 bg-yellow-400 text-gray-950 hover:bg-yellow-500">
            <Plus className="h-4 w-4" />
            {triggerLabel}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        overlayClassName="bg-slate-900/25 supports-backdrop-filter:backdrop-blur-sm"
        className="flex max-h-[88vh] flex-col overflow-hidden rounded-3xl border border-yellow-100 bg-white p-0 shadow-2xl shadow-slate-900/20 sm:max-w-5xl"
      >
        <div className="shrink-0 border-b border-yellow-100 bg-[#FFFBEB]/70 px-5 py-5 sm:px-6">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              {isEditing ? "Chỉnh sửa từ vựng" : "Thêm từ vựng mới"}
            </DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-relaxed text-slate-500">
              {isEditing
                ? "Cập nhật nội dung học, ảnh minh họa và các cụm từ liên quan."
                : "Nhập từ tiếng Anh rồi để AI gợi ý nội dung, hoặc tự điền thông tin trước khi lưu."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#FACC15_transparent] lg:grid-cols-[1fr_300px]">
          <div className="px-5 py-5 sm:px-6">
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <Field label="Từ tiếng Anh">
                  <Input
                    placeholder="medication"
                    value={form.word}
                    onChange={(event) =>
                      updateField("word", event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleGenerate();
                    }}
                    autoFocus
                  />
                </Field>

                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || saving || deleting}
                  className="h-11 gap-2 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
                >
                  <Sparkles className="h-4 w-4" />
                  {generating ? "Đang tạo..." : "Tạo bằng AI"}
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phiên âm">
                  <Input
                    placeholder="/ˌmedɪˈkeɪʃn/"
                    value={form.phonetic}
                    onChange={(event) =>
                      updateField("phonetic", event.target.value)
                    }
                  />
                </Field>

                <Field label="Từ loại">
                  <Input
                    placeholder="noun"
                    value={form.partOfSpeech}
                    onChange={(event) =>
                      updateField("partOfSpeech", event.target.value)
                    }
                  />
                </Field>
              </div>

              <Field label="Nghĩa tiếng Việt">
                <Textarea
                  placeholder="thuốc; dược phẩm dùng để điều trị bệnh"
                  value={form.vietnameseMeaning}
                  onChange={(event) =>
                    updateField("vietnameseMeaning", event.target.value)
                  }
                  rows={2}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ví dụ tiếng Anh">
                  <Textarea
                    placeholder="The doctor prescribed medication to reduce the pain."
                    value={form.englishExample}
                    onChange={(event) =>
                      updateField("englishExample", event.target.value)
                    }
                    rows={3}
                  />
                </Field>

                <Field label="Dịch nghĩa tiếng Việt">
                  <Textarea
                    placeholder="Bác sĩ kê thuốc để giảm cơn đau."
                    value={form.vietnameseExample}
                    onChange={(event) =>
                      updateField("vietnameseExample", event.target.value)
                    }
                    rows={3}
                  />
                </Field>
              </div>

              <RelatedField
                label="Từ đồng nghĩa"
                value={form.synonyms}
                emptyText="Chưa có từ đồng nghĩa"
                onChange={(value) => updateField("synonyms", value)}
                showPreview={hasGeneratedWithAi || synonyms.length > 0}
              />

              <RelatedField
                label="Cụm từ thường gặp"
                value={form.collocations}
                emptyText="Chưa có cụm từ thường gặp"
                onChange={(value) => updateField("collocations", value)}
                showPreview={hasGeneratedWithAi || collocations.length > 0}
              />

              <RelatedField
                label="Từ trái nghĩa"
                value={form.antonyms}
                emptyText="Chưa có từ trái nghĩa"
                onChange={(value) => updateField("antonyms", value)}
                showPreview={hasGeneratedWithAi || antonyms.length > 0}
              />
            </div>
          </div>

          <aside className="border-t border-gray-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-3xl border border-yellow-100 bg-white shadow-sm">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.word || "Ảnh minh họa"}
                    className="h-56 w-full object-cover"
                    onError={() => {
                      updateField("imageUrl", "");
                      setImageOptions((current) =>
                        current.filter(
                          (imageUrl) => imageUrl !== form.imageUrl,
                        ),
                      );
                    }}
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-yellow-50 text-yellow-700">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
              </div>

              <input
                id={uploadInputId}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleImageUpload(event.target.files?.[0])}
              />

              <div className="grid grid-cols-2 gap-2">
                <Button
                  asChild
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-full bg-white"
                >
                  <label htmlFor={uploadInputId}>
                    <Upload className="h-4 w-4" />
                    Tải ảnh
                  </label>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-full bg-white"
                  disabled={!form.imageUrl}
                  onClick={() => updateField("imageUrl", "")}
                >
                  <X className="h-4 w-4" />
                  Xóa ảnh
                </Button>
              </div>

              {imageOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-900">
                    Gợi ý ảnh minh họa
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {imageOptions.map((imageUrl) => {
                      const selected = imageUrl === form.imageUrl;

                      return (
                        <button
                          key={imageUrl}
                          type="button"
                          onClick={() => updateField("imageUrl", imageUrl)}
                          className={`overflow-hidden rounded-2xl border-2 bg-white transition ${
                            selected
                              ? "border-yellow-400 ring-2 ring-yellow-100"
                              : "border-transparent hover:border-yellow-300"
                          }`}
                        >
                          <img
                            src={imageUrl}
                            alt="Gợi ý ảnh minh họa"
                            className="h-20 w-full object-cover"
                            onError={() =>
                              setImageOptions((current) =>
                                current.filter((item) => item !== imageUrl),
                              )
                            }
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="rounded-3xl border border-rose-100 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-rose-700">
                        Xóa từ vựng
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-rose-500">
                        Xóa từ này và lịch sử ôn tập liên quan khỏi bộ từ.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full gap-2 rounded-full border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    disabled={generating || saving || deleting}
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleting
                      ? "Đang xóa..."
                      : confirmDelete
                        ? "Nhấn lần nữa để xác nhận"
                        : "Xóa từ này"}
                  </Button>
                </div>
              )}
            </div>
          </aside>
        </div>

        <div className="shrink-0 flex flex-col-reverse gap-3 border-t border-gray-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="min-h-5 text-sm text-rose-600">{error}</p>
          <div className="flex gap-2 sm:justify-end">
            <Button
              variant="outline"
              className="rounded-full bg-white px-5"
              onClick={() => setOpen(false)}
              disabled={generating || saving || deleting}
            >
              Hủy
            </Button>
            <Button
              className="rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
              onClick={handleSave}
              disabled={!form.word.trim() || generating || saving || deleting}
            >
              {saving ? "Đang lưu..." : isEditing ? "Lưu thay đổi" : "Lưu từ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cardToForm(card: NonNullable<AddCardDialogProps["card"]>): CardForm {
  return {
    word: card.word ?? "",
    phonetic: card.phonetic ?? "",
    partOfSpeech: card.part_of_speech ?? "",
    vietnameseMeaning: card.vietnamese_meaning ?? "",
    englishExample: card.english_example ?? "",
    vietnameseExample: card.vietnamese_example ?? "",
    synonyms: joinRelatedTerms(card.synonyms ?? []),
    antonyms: joinRelatedTerms(card.antonyms ?? []),
    collocations: joinRelatedTerms(card.collocations ?? []),
    imageUrl: card.image_url ?? "",
  };
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <span className="text-sm font-bold text-gray-800">{label}</span>
      {children}
    </label>
  );
}

function RelatedField({
  label,
  value,
  emptyText,
  showPreview,
  onChange,
}: {
  label: string;
  value: string;
  emptyText: string;
  showPreview: boolean;
  onChange: (value: string) => void;
}) {
  const items = useMemo(() => splitRelatedTerms(value), [value]);

  return (
    <Field label={label}>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder={
          "Mỗi dòng một mục, ví dụ:\nmedical treatment — phương pháp điều trị y tế"
        }
      />

      {showPreview && <RelatedPreview items={items} emptyText={emptyText} />}
    </Field>
  );
}

function RelatedPreview({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  if (items.length === 0) {
    return <span className="text-xs text-slate-400">{emptyText}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const parsed = parseRelatedTerm(item);
        const active = activeItem === item;

        return (
          <button
            key={item}
            type="button"
            onClick={() => setActiveItem(active ? null : item)}
            onBlur={() => setActiveItem(null)}
            className="group relative rounded-full border border-yellow-100 bg-yellow-50/60 px-3 py-1 text-xs font-bold text-slate-700 transition-colors hover:border-yellow-300 hover:bg-white"
          >
            {parsed.text || item}
            <span
              className={`pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-[260px] whitespace-normal rounded-2xl border border-yellow-200 bg-white px-3 py-2 text-left text-xs font-medium leading-relaxed text-slate-600 opacity-0 shadow-lg shadow-yellow-100/70 transition-opacity group-hover:opacity-100 ${
                active ? "opacity-100" : ""
              }`}
            >
              {parsed.meaning || "Chưa có nghĩa tiếng Việt"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
