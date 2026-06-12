"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Copy,
  Edit3,
  Files,
  Folder,
  FolderOpen,
  GraduationCap,
  MoreHorizontal,
  MoveRight,
  Trash2,
} from "lucide-react";
import type { VocabularyNode } from "@/lib/vocabularyTree";

export function VocabularyNodeCard({
  node,
  editable,
  onRename,
  onDelete,
  onMove,
  onCopy,
  folderHref,
}: {
  node: VocabularyNode;
  editable: boolean;
  onRename: (node: VocabularyNode) => void;
  onDelete: (node: VocabularyNode) => void;
  onMove: (node: VocabularyNode) => void;
  onCopy?: (node: VocabularyNode) => void;
  folderHref?: (node: VocabularyNode) => string;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isFolder = node.type === "folder";
  const openHref = isFolder
    ? (folderHref?.(node) ?? `/vocabulary/folder/${node.id}`)
    : `/vocabulary/deck/${node.id}`;
  const studyHref = `/vocabulary/deck/${node.id}/study`;
  const studiedCount = Number(node.studied_count ?? 0);
  const dueCount = Number(node.due_count ?? 0);
  const progress =
    node.card_count > 0
      ? Math.round((studiedCount / node.card_count) * 100)
      : 0;

  function openNode() {
    if (menuOpen) {
      setMenuOpen(false);
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
      className="group relative flex min-h-[260px] cursor-pointer flex-col rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-200 hover:shadow-xl hover:shadow-yellow-100/70 focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300/30"
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
            <BookOpen className="h-7 w-7" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-bold capitalize text-gray-500">
            {node.visibility}
          </span>
          {editable && (
            <div
              className="relative z-30"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Tùy chọn"
                aria-expanded={menuOpen}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenuOpen((current) => !current);
                }}
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-yellow-50 hover:text-gray-900 aria-expanded:bg-yellow-50 aria-expanded:text-gray-900"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-yellow-100 bg-white p-1 shadow-xl shadow-yellow-100/70">
                <MenuButton
                  icon={Edit3}
                  label="Chỉnh sửa"
                  onClick={() => {
                    setMenuOpen(false);
                    onRename(node);
                  }}
                />
                <MenuButton
                  icon={MoveRight}
                  label="Di chuyển"
                  onClick={() => {
                    setMenuOpen(false);
                    onMove(node);
                  }}
                />
                <MenuButton
                  danger
                  icon={Trash2}
                  label="Xóa"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(node);
                  }}
                />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1">
        <h3 className="line-clamp-2 break-words font-heading text-xl font-bold leading-tight text-gray-900">
          {node.title}
        </h3>
        <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-relaxed text-gray-500">
          {node.description ||
            (isFolder
              ? "Sắp xếp các thư mục con và bộ từ theo chủ đề học của bạn."
              : "Bộ từ StudyBee cho các từ vựng bạn muốn ôn mỗi ngày.")}
        </p>

        {isFolder ? (
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold text-gray-600">
            <Stat
              icon={FolderOpen}
              value={node.child_folder_count}
              label="thư mục"
            />
            <Stat icon={Files} value={node.child_deck_count} label="bộ từ" />
            <Stat
              icon={GraduationCap}
              value={node.total_card_count}
              label="từ"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-[#FFFBEB] px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-sm font-bold text-gray-700">
                <span className="flex min-w-0 items-center gap-2">
                  <GraduationCap className="h-4 w-4 shrink-0 text-yellow-600" />
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
              {node.level && <Chip>{node.level}</Chip>}
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
              href={studyHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700"
            >
              <GraduationCap className="h-4 w-4" />
              Học ngay
            </Link>
            <Link
              href={openHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-yellow-50"
            >
              Xem bộ thẻ
            </Link>
          </>
        )}
      </div>

      {!editable && onCopy && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onCopy(node);
          }}
          className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 text-sm font-bold text-yellow-800 transition-colors hover:bg-yellow-100"
        >
          <Copy className="h-4 w-4" />
          Sao chép về bộ của tôi
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
    <div className="rounded-2xl bg-gray-50 px-3 py-2">
      <Icon className="mb-1 h-4 w-4 text-yellow-600" />
      <div className="leading-tight">
        <span className="text-gray-900">{value}</span>
        <span className="block text-[11px] text-gray-400">{label}</span>
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

function MenuButton({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof Edit3;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold transition-colors ${
        danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-gray-700 hover:bg-yellow-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
