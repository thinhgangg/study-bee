"use client";

import { useState } from "react";
import { Bookmark, BookOpen, FolderPlus, Search } from "lucide-react";
import type { VocabularyNode } from "@/lib/vocabularyTree";
import { VocabularyNodeCard } from "@/components/vocabulary/VocabularyNodeCard";

export function VocabularyNodeGrid({
  nodes,
  editable,
  onRename,
  onDelete,
  onMove,
  onCopy,
  onSave,
  folderHref,
  deckHref,
  studyHref,
  variant = "mine",
}: {
  nodes: VocabularyNode[];
  editable: boolean;
  onRename: (node: VocabularyNode) => void;
  onDelete: (node: VocabularyNode) => void;
  onMove: (node: VocabularyNode) => void;
  onCopy?: (node: VocabularyNode) => void;
  onSave?: (node: VocabularyNode) => void;
  folderHref?: (node: VocabularyNode) => string;
  deckHref?: (node: VocabularyNode) => string;
  studyHref?: (node: VocabularyNode) => string;
  variant?: "mine" | "community" | "saved";
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (nodes.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-yellow-300 bg-white/80 px-6 py-16 text-center shadow-sm shadow-yellow-100/60">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-700">
          <FolderPlus className="h-8 w-8" />
        </div>
        <h2 className="font-heading text-2xl font-bold text-gray-900">
          Thư mục này chưa có bộ từ nào.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          Tạo thư mục hoặc bộ từ đầu tiên của bạn.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {nodes.map((node) => (
        <VocabularyNodeCard
          key={node.id}
          node={node}
          editable={editable}
          onRename={onRename}
          onDelete={onDelete}
          onMove={onMove}
          onCopy={onCopy}
          onSave={onSave}
          folderHref={folderHref}
          deckHref={deckHref}
          studyHref={studyHref}
          variant={variant}
          menuOpen={openMenuId === node.id}
          onMenuOpenChange={(open) => setOpenMenuId(open ? node.id : null)}
        />
      ))}
    </div>
  );
}

export function VocabularyGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="min-h-[260px] rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60"
        >
          <div className="mb-5 h-14 w-14 rounded-2xl bg-yellow-100/80" />
          <div className="mb-3 h-6 w-3/4 rounded-full bg-gray-100" />
          <div className="mb-2 h-4 w-full rounded-full bg-gray-100" />
          <div className="mb-6 h-4 w-2/3 rounded-full bg-gray-100" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-14 rounded-2xl bg-gray-50" />
            <div className="h-14 rounded-2xl bg-gray-50" />
            <div className="h-14 rounded-2xl bg-gray-50" />
          </div>
          <div className="mt-6 h-10 rounded-full bg-gray-900/10" />
        </div>
      ))}
    </div>
  );
}

export function VocabularyEmptyState({
  variant,
}: {
  variant: "mine" | "folder" | "community" | "saved" | "search";
}) {
  const content = {
    mine: {
      icon: FolderPlus,
      iconClassName: "bg-yellow-100 text-yellow-700",
      title: "Bạn chưa có thư mục hoặc bộ từ nào.",
      description:
        "Bắt đầu bằng cách tạo thư mục để tổ chức, hoặc tạo bộ từ đầu tiên.",
    },
    folder: {
      icon: FolderPlus,
      iconClassName: "bg-yellow-100 text-yellow-700",
      title: "Thư mục này chưa có bộ từ nào.",
      description: "Tạo thư mục hoặc bộ từ đầu tiên của bạn.",
    },
    community: {
      icon: BookOpen,
      iconClassName: "bg-sky-100 text-sky-700",
      title: "Chưa có bộ từ công khai.",
      description:
        "Các thư mục và bộ từ được chia sẻ công khai từ cộng đồng sẽ xuất hiện ở đây.",
    },
    saved: {
      icon: Bookmark,
      iconClassName: "bg-yellow-100 text-yellow-700",
      title: "Bạn chưa lưu bộ từ nào.",
      description:
        "Lưu các bộ từ hoặc thư mục từ cộng đồng để xem lại nhanh ở đây.",
    },
    search: {
      icon: Search,
      iconClassName: "bg-gray-100 text-gray-600",
      title: "Không tìm thấy kết quả phù hợp.",
      description: "Thử thay đổi từ khóa tìm kiếm của bạn.",
    },
  }[variant];
  const Icon = content.icon;

  return (
    <div className="rounded-3xl border border-yellow-100 bg-white px-6 py-16 text-center shadow-sm shadow-yellow-100/60">
      <div
        className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl ${content.iconClassName}`}
      >
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="font-heading text-2xl font-bold text-gray-900">
        {content.title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
        {content.description}
      </p>
    </div>
  );
}
