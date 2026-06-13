"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  Clock3,
  FileText,
  Filter,
  GraduationCap,
  Layers3,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { StudyBeeNavbar } from "@/components/layout/StudyBeeNavbar";
import { HoneycombPattern } from "@/components/ui/honeycomb-pattern";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getReadingPracticeList } from "@/lib/reading";
import type {
  ReadingPracticeKind,
  ReadingPracticeListItem,
} from "@/lib/reading.types";
import { supabase } from "@/lib/supabase";

type KindFilter = "all" | ReadingPracticeKind;
type PassageFilter = "all" | "1" | "2" | "3";

const DIFFICULTIES = ["all", "5", "5.5", "6", "6.5", "7", "8"];

export function ReadingListPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [items, setItems] = useState<ReadingPracticeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [passage, setPassage] = useState<PassageFilter>("all");
  const [topic, setTopic] = useState("all");
  const [difficulty, setDifficulty] = useState("all");

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUserEmail(data.session?.user.email ?? "");
      setLoadingAuth(false);
    }

    void loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? "");
      setLoadingAuth(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadItems() {
      setLoading(true);
      setError("");

      try {
        const nextItems = await getReadingPracticeList();
        if (active) setItems(nextItems);
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không thể tải danh sách bài đọc.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadItems();
    return () => {
      active = false;
    };
  }, []);

  const topics = useMemo(
    () => [...new Set(items.map((item) => item.topic))].sort(),
    [items],
  );

  const filteredItems = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (
        passage !== "all" &&
        (item.kind !== "single" || item.passageNumber !== Number(passage))
      ) {
        return false;
      }
      if (topic !== "all" && item.topic !== topic) return false;
      if (difficulty !== "all" && item.difficulty !== Number(difficulty)) {
        return false;
      }
      if (!keyword) return true;

      return (
        item.title.toLowerCase().includes(keyword) ||
        item.topic.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword)
      );
    });
  }, [difficulty, items, kind, passage, searchTerm, topic]);

  function selectKind(nextKind: KindFilter) {
    setKind(nextKind);
    if (nextKind === "full_test") setPassage("all");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFFBEB] text-gray-900">
      <HoneycombPattern />
      <StudyBeeNavbar
        userEmail={userEmail}
        loadingAuth={loadingAuth}
        showAuthActions
        onSignOut={handleSignOut}
      />

      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-3 py-1.5 text-xs font-bold text-yellow-700 shadow-sm">
              <BookOpenText className="h-4 w-4" />
              IELTS Reading
            </div>
            <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Luyện Reading theo cách của bạn
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500 sm:text-base">
              Luyện từng passage để tập trung cải thiện kỹ năng, hoặc làm full đề
              để mô phỏng bài thi IELTS Reading 60 phút.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            <SummaryStat icon={FileText} value={items.filter((item) => item.kind === "single").length} label="Bài lẻ" />
            <SummaryStat icon={Layers3} value={items.filter((item) => item.kind === "full_test").length} label="Full đề" />
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/70 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all" as const, label: "Tất cả" },
                { value: "single" as const, label: "Bài lẻ" },
                { value: "full_test" as const, label: "Full đề" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectKind(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                    kind === option.value
                      ? "bg-gray-900 text-yellow-300"
                      : "bg-gray-50 text-gray-600 hover:bg-yellow-50 hover:text-gray-900"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_180px_180px_160px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm bài đọc hoặc chủ đề..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm outline-none transition focus:border-yellow-300 focus:bg-white focus:ring-4 focus:ring-yellow-300/20"
                />
              </label>

              <FilterSelect value={passage} onValueChange={(value) => setPassage(value as PassageFilter)} disabled={kind === "full_test"}>
                <SelectItem value="all">Tất cả Passage</SelectItem>
                <SelectItem value="1">Passage 1</SelectItem>
                <SelectItem value="2">Passage 2</SelectItem>
                <SelectItem value="3">Passage 3</SelectItem>
              </FilterSelect>

              <FilterSelect value={topic} onValueChange={setTopic}>
                <SelectItem value="all">Tất cả chủ đề</SelectItem>
                {topics.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </FilterSelect>

              <FilterSelect value={difficulty} onValueChange={setDifficulty}>
                {DIFFICULTIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "all" ? "Tất cả band" : `Band ${item}`}
                  </SelectItem>
                ))}
              </FilterSelect>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-500">
            {loading ? "Đang tải bài đọc..." : `${filteredItems.length} bài luyện tập`}
          </p>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Lọc theo nhu cầu của bạn
          </span>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">{error}</div>
        ) : loading ? (
          <ReadingGridSkeleton />
        ) : filteredItems.length === 0 ? (
          <ReadingEmptyState hasFilters={Boolean(searchTerm || kind !== "all" || passage !== "all" || topic !== "all" || difficulty !== "all")} />
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => <ReadingCard key={`${item.kind}-${item.id}`} item={item} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function FilterSelect({ children, ...props }: React.ComponentProps<typeof Select>) {
  return (
    <Select {...props}>
      <SelectTrigger className="h-11 w-full rounded-xl border-gray-200 bg-gray-50 px-3 focus:ring-yellow-300/20">
        <div className="flex min-w-0 items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-yellow-600" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent position="popper" className="min-w-[var(--radix-select-trigger-width)]">{children}</SelectContent>
    </Select>
  );
}

function ReadingCard({ item }: { item: ReadingPracticeListItem }) {
  const isFullTest = item.kind === "full_test";
  const href = isFullTest ? `/reading/test/${item.slug}` : `/reading/${item.slug}`;

  return (
    <article className="group flex min-h-64 flex-col rounded-3xl border border-yellow-100 bg-white p-5 shadow-sm shadow-yellow-100/50 transition hover:-translate-y-0.5 hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-100/70">
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isFullTest ? "bg-gray-900 text-yellow-300" : "bg-yellow-100 text-yellow-800"}`}>
          {isFullTest ? <Layers3 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          {isFullTest ? "Full đề" : `Passage ${item.passageNumber ?? "-"}`}
        </span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Band {item.difficulty.toFixed(1)}</span>
      </div>

      <div className="mt-5 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-yellow-700">{item.topic}</p>
        <h2 className="mt-2 font-heading text-xl font-bold leading-snug text-gray-900">{item.title}</h2>
        {item.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">{item.description}</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-xs font-semibold text-gray-500">
        <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-yellow-600" />{item.estimatedTime} phút</span>
        <span className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4 text-yellow-600" />{item.questionCount} câu hỏi</span>
        {isFullTest && <span className="flex items-center gap-1.5"><BookOpenText className="h-4 w-4 text-yellow-600" />{item.passageCount}/3 passages</span>}
      </div>

      <Link href={href} className="mt-5 flex items-center justify-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-bold text-yellow-300 transition hover:bg-gray-700">
        Bắt đầu luyện <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </article>
  );
}

function SummaryStat({ icon: Icon, value, label }: { icon: typeof FileText; value: number; label: string }) {
  return (
    <div className="min-w-32 rounded-2xl border border-yellow-100 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-gray-400"><Icon className="h-4 w-4 text-yellow-600" /><span className="text-xs font-bold">{label}</span></div>
      <p className="mt-1 font-heading text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function ReadingGridSkeleton() {
  return <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl border border-yellow-100 bg-white/70" />)}</div>;
}

function ReadingEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="mt-5 rounded-3xl border border-dashed border-yellow-300 bg-white/80 px-6 py-16 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700"><BookOpenText className="h-7 w-7" /></span>
      <h2 className="mt-4 font-heading text-xl font-bold">{hasFilters ? "Không tìm thấy bài phù hợp" : "Chưa có bài Reading được xuất bản"}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">{hasFilters ? "Thử thay đổi từ khóa hoặc bộ lọc để xem thêm bài luyện tập." : "Các bài Reading sẽ xuất hiện tại đây sau khi được thêm và publish trong Supabase."}</p>
    </div>
  );
}
