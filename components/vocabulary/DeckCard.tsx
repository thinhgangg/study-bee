"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Layers,
  PlayCircle,
  Save,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

interface DeckCardProps {
  deck: {
    deck_id: string;
    name: string;
    description: string | null;
    cover_image_url: string | null;
    card_count: number;
    studied_count: number;
    due_count: number;
    created_at: string;
  };
  onChanged?: () => void;
}

export function DeckCard({ deck, onChanged }: DeckCardProps) {
  const progress =
    deck.card_count > 0
      ? Math.round((Number(deck.studied_count) / deck.card_count) * 100)
      : 0;

  return (
    <article className="group flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-yellow-100 bg-white shadow-sm shadow-yellow-100/60 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-200 hover:shadow-xl hover:shadow-yellow-100/80">
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-yellow-50 via-white to-sky-50">
        {deck.cover_image_url ? (
          <img
            src={deck.cover_image_url}
            alt={deck.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-600">
              <Layers className="h-8 w-8" />
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />

        <DeckSettingsDialog deck={deck} onChanged={onChanged} />

        {deck.due_count > 0 ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600 shadow-sm">
            <Clock3 className="h-3.5 w-3.5" />
            {deck.due_count} cần ôn
          </span>
        ) : (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Đúng nhịp
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <h3 className="line-clamp-1 font-heading text-xl font-bold leading-tight text-gray-900">
            {deck.name}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-relaxed text-gray-500">
            {deck.description || "Bộ thẻ StudyBee cho các từ vựng bạn muốn ôn mỗi ngày."}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-gray-500">
            <div className="flex items-center gap-2 rounded-2xl bg-[#FFFBEB] px-3 py-2">
              <BookOpen className="h-4 w-4 text-yellow-600" />
              {deck.card_count} thẻ
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2">
              <Clock3 className="h-4 w-4 text-sky-600" />
              {progress}% xong
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-gray-400">
              <span>Tiến độ học</span>
              <span>{Number(deck.studied_count)}/{deck.card_count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-yellow-100">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href={`/vocabulary/${deck.deck_id}/study`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700"
          >
            <PlayCircle className="h-4 w-4" />
            Học ngay
          </Link>
          <Link
            href={`/vocabulary/${deck.deck_id}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-yellow-50 hover:text-gray-900"
          >
            Xem thẻ
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function DeckSettingsDialog({
  deck,
  onChanged,
}: DeckCardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  async function getProfileId() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Chưa đăng nhập");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Không tìm thấy profile");
    }

    return profile.id as string;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Vui lòng nhập tên bộ thẻ");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const profileId = await getProfileId();
      const { error: updateError } = await supabase
        .from("decks")
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq("id", deck.deck_id)
        .eq("user_id", profileId);

      if (updateError) throw updateError;

      setOpen(false);
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const profileId = await getProfileId();

      const { error: cardsError } = await supabase
        .from("cards")
        .delete()
        .eq("deck_id", deck.deck_id);

      if (cardsError) throw cardsError;

      const { error: deckError } = await supabase
        .from("decks")
        .delete()
        .eq("id", deck.deck_id)
        .eq("user_id", profileId);

      if (deckError) throw deckError;

      setOpen(false);
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setName(deck.name);
          setDescription(deck.description ?? "");
        } else {
          setConfirmDelete(false);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Cài đặt bộ thẻ"
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-yellow-100 bg-white/95 text-gray-600 shadow-sm shadow-yellow-100/60 backdrop-blur transition-colors hover:bg-yellow-50 hover:text-gray-900"
        >
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="overflow-hidden border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-md">
        <div className="bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-300 text-gray-900">
              <Settings className="h-5 w-5" />
            </div>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              Cài đặt bộ thẻ
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">
              Tên bộ thẻ
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-2xl border-gray-200 bg-gray-50 px-4 focus-visible:border-yellow-300 focus-visible:ring-yellow-300/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">
              Mô tả{" "}
              <span className="font-medium text-gray-400">(tuỳ chọn)</span>
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 rounded-2xl border-gray-200 bg-gray-50 px-4 py-3 focus-visible:border-yellow-300 focus-visible:ring-yellow-300/20"
            />
          </div>

          {error && (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
              {error}
            </p>
          )}

          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-700">
                  Xóa bộ thẻ
                </p>
                <p className="mt-1 text-sm leading-relaxed text-rose-600/80">
                  Thao tác này sẽ xóa bộ thẻ và các từ vựng bên trong.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              {deleting
                ? "Đang xóa..."
                : confirmDelete
                  ? "Nhấn lần nữa để xác nhận"
                  : "Xóa bộ thẻ"}
            </button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-yellow-100 bg-[#FFFBEB] p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-10 items-center justify-center rounded-full border border-gray-200 bg-white px-5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
