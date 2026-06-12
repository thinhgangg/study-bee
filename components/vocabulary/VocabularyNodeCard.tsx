"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookmarkOff,
  Bookmark,
  Library,
  Edit3,
  Eye,
  Languages,
  Folder,
  FolderOpen,
  MoreHorizontal,
  FolderInput,
  Trash2,
  CirclePlay,
  CopyPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VocabularyNode } from "@/lib/vocabularyTree";

export function VocabularyNodeCard({
  node,
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
  menuOpen,
  onMenuOpenChange,
}: {
  node: VocabularyNode;
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
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isFolder = node.type === "folder";
  const isCommunity = variant === "community";
  const isSaved = variant === "saved";
  const openHref = isFolder
    ? (folderHref?.(node) ?? `/vocabulary/folder/${node.id}`)
    : (deckHref?.(node) ?? `/vocabulary/deck/${node.id}`);
  const nodeStudyHref =
    studyHref?.(node) ?? `/vocabulary/deck/${node.id}/study`;
  const studiedCount = Number(node.studied_count ?? 0);
  const dueCount = Number(node.due_count ?? 0);
  const saveCount = Number(node.save_count ?? 0);
  const savedByMe = Boolean(node.saved_by_me);
  const visibilityLabel =
    {
      public: "Công khai",
      private: "Riêng tư",
      unlisted: "Không công khai",
    }[node.visibility] ?? node.visibility;
  const progressTotal = isFolder ? node.total_card_count : node.card_count;
  const progress =
    progressTotal > 0 ? Math.round((studiedCount / progressTotal) * 100) : 0;
  const clonedFromAuthor = node.cloned_from_author_label;
  const studyLabel =
    progress <= 0 ? "Học ngay" : progress >= 100 ? "Ôn tập" : "Học tiếp";

  function openNode() {
    if (menuOpen) {
      onMenuOpenChange(false);
      return;
    }
    router.push(openHref);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={openNode}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openNode();
        }
      }}
      className={`group relative flex min-h-[280px] cursor-pointer flex-col rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-200 hover:shadow-xl hover:shadow-yellow-100/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/30 ${
        menuOpen ? "z-20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
            isFolder
              ? "bg-yellow-100 text-yellow-700"
              : "bg-sky-100 text-sky-700"
          }`}
        >
          {isFolder ? (
            <Folder className="h-8 w-8" />
          ) : (
            <Library className="h-7 w-7" />
          )}
        </div>

        <div className="flex items-center gap-1">
          {isCommunity || isSaved ? (
            <span className="rounded-full border border-yellow-100 bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-700">
              {saveCount} lưu
            </span>
          ) : (
            <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-bold capitalize text-gray-500">
              {visibilityLabel}
            </span>
          )}

          {editable && (
            <div
              className="relative z-30"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Tùy chọn"
                    className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-gray-400 outline-none transition-colors hover:bg-yellow-50 hover:text-gray-900 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-yellow-50 data-[state=open]:text-gray-900"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  onClick={(event) => event.stopPropagation()}
                >
                  <DropdownMenuItem onSelect={() => onRename(node)}>
                    <Edit3 className="text-yellow-600" />
                    Chỉnh sửa
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onMove(node)}>
                    <FolderInput className="text-yellow-600" />
                    Di chuyển
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onDelete(node)}
                    className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                  >
                    <Trash2 />
                    Xóa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="line-clamp-2 break-words font-heading text-xl font-bold leading-tight text-gray-900">
          {node.title}
        </h3>
        <p className="mt-2 h-10 line-clamp-2 text-sm leading-5 text-gray-500">
          {node.description ||
            (isFolder
              ? "Sắp xếp các thư mục con và bộ từ theo chủ đề học của bạn."
              : "Bộ từ StudyBee cho các từ vựng bạn muốn ôn mỗi ngày.")}
        </p>

        {(isCommunity || isSaved) && (
          <div className="mt-3 min-h-[2.75rem] text-xs font-bold">
            <div className="flex min-w-0 items-center justify-between gap-2 text-gray-400">
              <span className="min-w-0 truncate">
                Tác giả: {node.user_id.slice(0, 8)}
              </span>
              {node.level && (
                <span className="shrink-0 rounded-full bg-gray-50 px-2 py-1 text-gray-500">
                  {node.level}
                </span>
              )}
            </div>
            {clonedFromAuthor ? (
              <p className="mt-1 line-clamp-1 text-yellow-700">
                Sao chép từ {isFolder ? "thư mục" : "bộ từ"} của{" "}
                {clonedFromAuthor}
              </p>
            ) : (
              <p className="mt-1 invisible">Không có nguồn sao chép</p>
            )}
          </div>
        )}

        {isSaved && !isFolder ? (
          <div className="mt-4 rounded-2xl bg-[#FFFBEB] px-3 py-2">
            <div className="flex items-center justify-between gap-3 text-sm font-bold text-gray-700">
              <span className="flex min-w-0 items-center gap-2">
                <Languages className="h-4 w-4 shrink-0 text-yellow-600" />
                <span>{progressTotal} từ vựng</span>
              </span>
              <span className="shrink-0 text-gray-900">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-yellow-100">
              <div
                className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {dueCount > 0 && (
              <p className="mt-2 text-xs font-bold text-rose-600">
                {dueCount} từ cần ôn
              </p>
            )}
          </div>
        ) : isFolder ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold text-gray-600">
            <Stat
              icon={Folder}
              value={node.child_folder_count}
              label="thư mục"
            />
            <Stat icon={Library} value={node.child_deck_count} label="bộ từ" />
            <Stat
              icon={Languages}
              value={node.total_card_count}
              label="từ vựng"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-[#FFFBEB] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-gray-700">
                <span className="flex min-w-0 items-center gap-2">
                  <Languages className="h-4 w-4 shrink-0 text-yellow-600" />
                  <span>{node.card_count} từ vựng</span>
                </span>
                <span className="shrink-0 text-gray-900">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-yellow-100">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {dueCount > 0 && (
                <p className="mt-2 text-xs font-bold text-rose-600">
                  {dueCount} từ cần ôn
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {node.category && <Chip>{node.category}</Chip>}
              {node.tags.slice(0, 2).map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className="mt-5 grid grid-cols-2 gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        {isFolder ? (
          <Link
            href={openHref}
            className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700"
          >
            <FolderOpen className="h-4 w-4" />
            Mở
          </Link>
        ) : (
          <>
            <Link
              href={nodeStudyHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700"
            >
              <CirclePlay className="h-4 w-4" />
              {studyLabel}
            </Link>
            <Link
              href={openHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-yellow-50"
            >
              <Eye className="h-4 w-4" />
              Xem bộ từ
            </Link>
          </>
        )}
      </div>

      {(isCommunity || isSaved) && onSave && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSave(node);
          }}
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 text-sm font-bold text-yellow-800 transition-colors hover:border-yellow-300 hover:bg-yellow-100"
        >
          {savedByMe ? (
            <BookmarkOff className="h-4 w-4" />
          ) : (
            <Bookmark className="h-4 w-4" />
          )}
          {savedByMe ? "Bỏ lưu" : "Lưu"}
        </button>
      )}

      {!editable && onCopy && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCopy(node);
          }}
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 text-sm font-bold text-yellow-800 transition-colors hover:bg-yellow-100"
        >
          <CopyPlus className="h-4 w-4" />
          Sao chép
        </button>
      )}
    </article>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Folder;
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 px-3 py-2">
      <Icon className="mb-1 h-4 w-4 text-yellow-600" />
      <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-tight">
        <span className="text-gray-900">{value}</span>
        <span className="truncate text-[11px] text-gray-400">{label}</span>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
      {children}
    </span>
  );
}
