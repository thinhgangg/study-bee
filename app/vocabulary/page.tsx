"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  BookOpenCheck,
  ChevronDown,
  Clock3,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mic2,
  Search,
  Settings,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { StudyBeeLogo } from "@/components/StudyBeeLogo";
import { supabase } from "@/lib/supabase";
import { DeckCard } from "@/components/vocabulary/DeckCard";
import { CreateDeckDialog } from "@/components/vocabulary/CreateDeckDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface DeckStat {
  deck_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  card_count: number;
  studied_count: number;
  due_count: number;
  created_at: string;
}

type DeckFilter = "all" | "due" | "active";

const navItems = [
  { label: "Từ vựng", href: "/vocabulary", icon: BookOpenCheck, active: true },
  { label: "Luyện kỹ năng", href: "/#features", icon: Mic2 },
  { label: "Mock Test", href: "/#features", icon: Target },
  { label: "Lộ trình", href: "/#features", icon: LayoutDashboard },
  { label: "Bảng giá", href: "/#pricing", icon: GraduationCap },
];

function HoneycombPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="vocabulary-honey"
          x="0"
          y="0"
          width="56"
          height="64"
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points="28,2 52,16 52,48 28,62 4,48 4,16"
            fill="none"
            stroke="#FACC15"
            strokeWidth="0.8"
            strokeOpacity="0.18"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#vocabulary-honey)" />
    </svg>
  );
}

function DeckSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60">
      <Skeleton className="h-32 w-full rounded-2xl bg-yellow-100/70" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-5 w-3/4 bg-gray-100" />
        <Skeleton className="h-4 w-full bg-gray-100" />
        <Skeleton className="h-4 w-1/2 bg-gray-100" />
        <Skeleton className="h-2 w-full rounded-full bg-yellow-100/70" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-full bg-gray-100" />
        <Skeleton className="h-10 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

function AppNavbar({
  email,
  onSignOut,
}: {
  email: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = email?.trim()?.[0]?.toUpperCase() || "B";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-yellow-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <StudyBeeLogo
          imageClassName="h-8 w-8"
          textClassName="font-heading text-xl font-bold text-gray-900"
        />

        <nav className="hidden items-center gap-1 text-sm text-gray-500 lg:flex">
          {navItems.map(({ label, href, icon: Icon, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-colors ${
                active
                  ? "bg-yellow-100 text-gray-900"
                  : "hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Thông báo"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-yellow-100 bg-white text-gray-600 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50 hover:text-gray-900"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-white" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="flex items-center gap-2 rounded-full border border-yellow-100 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-gray-700 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-300 font-heading text-sm font-bold text-gray-900">
                {initials}
              </span>
              <span className="hidden max-w-28 truncate sm:inline">
                {email || "StudyBee"}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {open && (
              <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-yellow-100 bg-white p-2 shadow-xl shadow-yellow-100/70">
                <Link
                  href="#"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50"
                >
                  <User className="h-4 w-4 text-yellow-600" />
                  Hồ sơ
                </Link>
                <Link
                  href="#"
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-yellow-50"
                >
                  <Settings className="h-4 w-4 text-yellow-600" />
                  Cài đặt
                </Link>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400">{label}</p>
          <p className="font-heading text-2xl font-bold leading-none text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VocabularyPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<DeckFilter>("all");

  const fetchDecks = useCallback(async (profileId: string) => {
    const { data, error } = await supabase
      .from("deck_stats")
      .select("*")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false });

    if (!error && data) setDecks(data as DeckStat[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profile) {
        setUserId(profile.id);
        fetchDecks(profile.id);
      } else {
        setLoading(false);
      }
    }
    init();
  }, [fetchDecks, router]);

  const handleCreated = useCallback(() => {
    if (userId) fetchDecks(userId);
  }, [userId, fetchDecks]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const totalCards = decks.reduce((sum, deck) => sum + deck.card_count, 0);
  const totalDue = decks.reduce((sum, deck) => sum + Number(deck.due_count), 0);
  const studiedCards = decks.reduce(
    (sum, deck) => sum + Number(deck.studied_count),
    0
  );

  const filteredDecks = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return decks.filter((deck) => {
      const matchesSearch =
        !keyword ||
        deck.name.toLowerCase().includes(keyword) ||
        deck.description?.toLowerCase().includes(keyword);
      const matchesFilter =
        filter === "all" ||
        (filter === "due" && Number(deck.due_count) > 0) ||
        (filter === "active" && deck.card_count > 0);

      return matchesSearch && matchesFilter;
    });
  }, [decks, filter, searchTerm]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFFBEB] font-body text-gray-900">
      <HoneycombPattern />
      <AppNavbar email={email} onSignOut={handleSignOut} />

      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-white px-3 py-1 text-xs font-bold text-yellow-700 shadow-sm shadow-yellow-100/60">
              <Sparkles className="h-3.5 w-3.5" />
              Vocabulary hive
            </div>
            <h1 className="font-heading text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
              Bộ từ vựng của tôi
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-600">
              Quản lý flashcard IELTS, theo dõi từ cần ôn và bắt đầu phiên học
              nhanh trong cùng một không gian StudyBee.
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-yellow-300 text-gray-900">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {totalDue > 0
                    ? `${totalDue} từ đang chờ bạn ôn`
                    : "Hôm nay chưa có từ đến hạn"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  Một phiên ôn ngắn mỗi ngày sẽ giữ nhịp học nhẹ mà bền.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={BookOpenCheck}
            label="Bộ thẻ"
            value={decks.length}
            tone="bg-yellow-100 text-yellow-700"
          />
          <StatCard
            icon={BookOpen}
            label="Từ vựng"
            value={totalCards}
            tone="bg-sky-100 text-sky-700"
          />
          <StatCard
            icon={Clock3}
            label="Đã học"
            value={studiedCards}
            tone="bg-emerald-100 text-emerald-700"
          />
        </div>

        <div className="mt-8 rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm shadow-yellow-100/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm bộ thẻ, chủ đề, ghi chú..."
                className="h-12 w-full rounded-full border border-gray-100 bg-[#FFFBEB] pl-11 pr-4 text-sm font-medium text-gray-900 outline-none transition focus:border-yellow-300 focus:bg-white focus:ring-4 focus:ring-yellow-300/20"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid grid-cols-3 rounded-full border border-gray-100 bg-gray-50 p-1 text-xs font-bold text-gray-500">
                {[
                  { value: "all", label: "Tất cả" },
                  { value: "due", label: "Cần ôn" },
                  { value: "active", label: "Đang học" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value as DeckFilter)}
                    className={`rounded-full px-3 py-2 transition-colors ${
                      filter === item.value
                        ? "bg-yellow-300 text-gray-900 shadow-sm"
                        : "hover:text-gray-900"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <CreateDeckDialog onCreated={handleCreated} />
            </div>
          </div>
        </div>

        <div className="mt-6">
          {loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <DeckSkeleton key={item} />
              ))}
            </div>
          )}

          {!loading && decks.length === 0 && (
            <div className="rounded-3xl border border-yellow-100 bg-white px-6 py-16 text-center shadow-sm shadow-yellow-100/60">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-700">
                <BookOpen className="h-8 w-8" />
              </div>
              <h2 className="font-heading text-2xl font-bold text-gray-900">
                Bạn chưa có bộ thẻ nào
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
                Tạo bộ thẻ đầu tiên để gom từ vựng IELTS, thêm ví dụ và bắt đầu
                học với flashcard.
              </p>
              <div className="mt-6 flex justify-center">
                <CreateDeckDialog onCreated={handleCreated} />
              </div>
            </div>
          )}

          {!loading && decks.length > 0 && filteredDecks.length === 0 && (
            <div className="rounded-3xl border border-yellow-100 bg-white px-6 py-14 text-center shadow-sm shadow-yellow-100/60">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Search className="h-7 w-7" />
              </div>
              <h2 className="font-heading text-xl font-bold text-gray-900">
                Không tìm thấy bộ thẻ phù hợp
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Thử đổi từ khóa hoặc chuyển về bộ lọc “Tất cả”.
              </p>
            </div>
          )}

          {!loading && filteredDecks.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDecks.map((deck) => (
                <DeckCard
                  key={deck.deck_id}
                  deck={deck}
                  onChanged={handleCreated}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
