"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { VocabularyNode } from "@/lib/vocabularyTree";

export function VocabularyBreadcrumb({
  items,
  basePath,
}: {
  items: VocabularyNode[];
  basePath: "/vocabulary" | "/vocabulary?tab=community";
}) {
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-bold text-gray-500">
      <Link
        href={basePath}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-gray-700 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50"
      >
        <Home className="h-4 w-4 text-yellow-600" />
        Từ vựng
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const href =
          basePath === "/vocabulary?tab=community"
            ? `/vocabulary?tab=community&folder=${item.id}`
            : `/vocabulary/folder/${item.id}`;

        return (
          <span key={item.id} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            {isLast ? (
              <span className="max-w-[220px] truncate rounded-full bg-yellow-100 px-3 py-2 text-gray-900">
                {item.title}
              </span>
            ) : (
              <Link
                href={href}
                className="max-w-[220px] truncate rounded-full bg-white px-3 py-2 transition-colors hover:bg-yellow-50 hover:text-gray-900"
              >
                {item.title}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
