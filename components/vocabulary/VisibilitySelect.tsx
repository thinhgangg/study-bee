"use client";

import {
  AlertTriangle,
  Globe,
  Link,
  LockKeyhole,
  type LucideIcon,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { VocabularyVisibility } from "@/lib/vocabularyTree";

const visibilityOptions = {
  private: {
    label: "Riêng tư",
    description: "Chỉ bạn có thể xem",
    icon: LockKeyhole,
  },
  unlisted: {
    label: "Không công khai",
    description: "Chỉ người có liên kết có thể xem",
    icon: Link,
  },
  public: {
    label: "Công khai",
    description: "Mọi người có thể tìm thấy và xem",
    icon: Globe,
  },
} satisfies Record<
  VocabularyVisibility,
  { label: string; description: string; icon: LucideIcon }
>;

export function VisibilitySelect({
  value,
  onValueChange,
}: {
  value: VocabularyVisibility;
  onValueChange: (value: VocabularyVisibility) => void;
}) {
  const selected = visibilityOptions[value];
  const SelectedIcon = selected.icon;

  return (
    <Select
      value={value}
      onValueChange={(nextValue: string) =>
        onValueChange(nextValue as VocabularyVisibility)
      }
    >
      <SelectTrigger className="h-auto min-h-[3.75rem] w-full rounded-2xl border-gray-200 bg-gray-50 px-4 py-2 text-left shadow-none outline-none hover:border-yellow-200 hover:bg-yellow-50/50 focus-visible:border-yellow-300 focus-visible:ring-4 focus-visible:ring-yellow-300/20 data-[state=open]:border-yellow-300 data-[state=open]:bg-white data-[state=open]:ring-4 data-[state=open]:ring-yellow-300/20">
        <span className="flex min-w-0 items-center gap-3 pr-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
            <SelectedIcon className="h-4 w-4" />
          </span>

          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold text-gray-800">
              {selected.label}
            </span>
            <span className="mt-0.5 block truncate text-xs font-medium text-gray-400">
              {selected.description}
            </span>
          </span>
        </span>
      </SelectTrigger>

      <SelectContent
        position="popper"
        align="start"
        sideOffset={8}
        className="z-[100] w-[var(--radix-select-trigger-width)] rounded-2xl border border-yellow-100 bg-white p-1.5 shadow-xl shadow-yellow-100/60"
      >
        {(
          Object.entries(visibilityOptions) as Array<
            [
              VocabularyVisibility,
              (typeof visibilityOptions)[VocabularyVisibility],
            ]
          >
        ).map(([optionValue, option]) => {
          const Icon = option.icon;

          return (
            <SelectItem
              key={optionValue}
              value={optionValue}
              className="cursor-pointer rounded-xl py-3 pl-3 pr-9 focus:bg-yellow-50"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                  <Icon className="h-4 w-4" />
                </span>

                <span className="min-w-0 leading-tight">
                  <span className="block text-sm font-bold text-gray-800">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-gray-400">
                    {option.description}
                  </span>
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function VisibilityRestrictionNotice({
  itemType,
  visibility,
  ancestorVisibility,
}: {
  itemType: "folder" | "deck";
  visibility: VocabularyVisibility;
  ancestorVisibility: VocabularyVisibility;
}) {
  if (visibility !== "public" || ancestorVisibility === "public") return null;

  const parentLabel =
    ancestorVisibility === "private" ? "Riêng tư" : "Không công khai";
  const itemLabel = itemType === "deck" ? "Bộ từ" : "Thư mục";

  return (
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {itemLabel} này chưa hiển thị ở Cộng đồng vì thư mục cha đang ở quyền
        {" "}
        <strong>{parentLabel}</strong>. Hãy đổi quyền thư mục cha thành Công khai
        nếu muốn mục này xuất hiện ở Cộng đồng.
      </p>
    </div>
  );
}
