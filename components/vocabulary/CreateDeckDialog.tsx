"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
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
import { supabase } from "@/lib/supabase";

interface CreateDeckDialogProps {
  onCreated: () => void;
}

export function CreateDeckDialog({ onCreated }: CreateDeckDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      setError("Vui lòng nhập tên bộ thẻ");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Chưa đăng nhập");

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profileErr || !profile) throw new Error("Không tìm thấy profile");

      const { error: insertErr } = await supabase.from("decks").insert({
        user_id: profile.id,
        name: name.trim(),
        description: description.trim() || null,
      });

      if (insertErr) throw insertErr;

      setName("");
      setDescription("");
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
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-bold text-yellow-300 shadow-lg shadow-gray-900/10 transition-colors hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          Tạo bộ thẻ mới
        </button>
      </DialogTrigger>

      <DialogContent className="overflow-hidden border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-md">
        <div className="rounded-t-xl bg-[#FFFBEB] px-5 py-5">
          <DialogHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-300 text-gray-900">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
              Tạo bộ thẻ mới
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">
              Tên bộ thẻ
            </label>
            <Input
              placeholder="VD: IELTS Environment, Academic Words..."
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleCreate()}
              className="h-11 rounded-2xl border-gray-200 bg-gray-50 px-4 focus-visible:border-yellow-300 focus-visible:ring-yellow-300/20"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">
              Mô tả{" "}
              <span className="font-medium text-gray-400">(tuỳ chọn)</span>
            </label>
            <Textarea
              placeholder="Mô tả ngắn về bộ thẻ này..."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 rounded-2xl border-gray-200 bg-gray-50 px-4 py-3 focus-visible:border-yellow-300 focus-visible:ring-yellow-300/20"
              rows={3}
            />
          </div>

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
            className="h-10 rounded-full border-gray-200 bg-white px-5 font-bold text-gray-700 hover:bg-gray-50"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="h-10 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
          >
            {loading ? "Đang tạo..." : "Tạo bộ thẻ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
