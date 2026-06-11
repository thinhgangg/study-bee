"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  GraduationCap,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Mic2,
  PlayCircle,
  Plus,
  Settings,
  Target,
  User,
  Volume2,
} from "lucide-react";
import { AddCardDialog } from "@/components/vocabulary/AddCardDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StudyBeeLogo } from "@/components/StudyBeeLogo";
import { supabase } from "@/lib/supabase";

interface Deck {
  id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  card_count: number | null;
}

type VocabularyStatus = "learning" | "mastered" | "review";

interface VocabularyCardData {
  id: string;
  deck_id: string;
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  vietnamese_meaning: string | null;
  english_example: string | null;
  vietnamese_example: string | null;
  english_definition?: string | null;
  definition?: string | null;
  notes?: string | null;
  learning_notes?: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  collocations: string[] | null;
  image_url: string | null;
  order_index: number | null;
  created_at: string;
  review_quality?: number | null;
  next_review_at?: string | null;
  reviewed_at?: string | null;
  status: VocabularyStatus;
}

interface CardReview {
  card_id: string;
  quality: number | null;
  next_review_at: string | null;
  reviewed_at: string | null;
}

interface Profile {
  id: string;
  email: string;
}

interface RelatedTerm {
  text: string;
  meaning: string;
}

const navItems = [
  { label: "Từ vựng", href: "/vocabulary", icon: BookOpenCheck, active: true },
  { label: "Luyện kỹ năng", href: "/#features", icon: Mic2 },
  { label: "Mock Test", href: "/#features", icon: Target },
  { label: "Lộ trình", href: "/#features", icon: LayoutDashboard },
  { label: "Bảng giá", href: "/#pricing", icon: GraduationCap },
];

function getCardStatus(review?: CardReview): VocabularyStatus {
  if (!review?.reviewed_at) return "learning";
  if (typeof review.quality === "number" && review.quality >= 5) {
    return "mastered";
  }
  if (review.next_review_at && new Date(review.next_review_at) <= new Date()) {
    return "review";
  }
  return "learning";
}

function getStatusMeta(status: VocabularyStatus) {
  if (status === "mastered") {
    return {
      label: "Đã thuộc",
      className: "bg-emerald-50 text-emerald-700 border-emerald-100",
      icon: CheckCircle2,
    };
  }

  if (status === "review") {
    return {
      label: "Cần ôn tập",
      className: "bg-rose-50 text-rose-700 border-rose-100",
      icon: Clock3,
    };
  }

  return {
    label: "Đang học",
    className: "bg-yellow-50 text-yellow-700 border-yellow-100",
    icon: BookOpen,
  };
}

const relatedTermSeparators = [" — ", " – ", " - ", ": ", "："];

function parseRelatedTerm(value: string): RelatedTerm {
  const trimmed = value.trim();
  const separator = relatedTermSeparators.find((item) =>
    trimmed.includes(item),
  );

  if (!separator) {
    return { text: trimmed, meaning: "" };
  }

  const [text, ...meaningParts] = trimmed.split(separator);

  return {
    text: text.trim(),
    meaning: meaningParts.join(separator).trim(),
  };
}

function HoneycombPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="deck-detail-honey"
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
            strokeOpacity="0.16"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#deck-detail-honey)" />
    </svg>
  );
}

export default function DeckDetailPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  return <VocabularyDeckPage deckId={deckId} />;
}

function VocabularyDeckPage({ deckId }: { deckId: string }) {
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<VocabularyCardData[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedVocabulary, setSelectedVocabulary] =
    useState<VocabularyCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  const loadDeck = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (profileError || !profileData) {
        throw new Error("Không tìm thấy hồ sơ người dùng.");
      }

      setProfile({ id: profileData.id, email: user.email ?? "" });

      const { data: deckData, error: deckError } = await supabase
        .from("decks")
        .select("id, name, description, cover_image_url, card_count")
        .eq("id", deckId)
        .eq("user_id", profileData.id)
        .maybeSingle();

      if (deckError) throw deckError;

      if (!deckData) {
        setDeck(null);
        setCards([]);
        setNotFound(true);
        return;
      }

      const { data: cardData, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (cardsError) throw cardsError;

      const rawCards = (cardData ?? []) as Omit<VocabularyCardData, "status">[];
      let reviewsByCardId = new Map<string, CardReview>();

      if (rawCards.length > 0) {
        const { data: reviewData, error: reviewError } = await supabase
          .from("card_reviews")
          .select("card_id, quality, next_review_at, reviewed_at")
          .eq("user_id", profileData.id)
          .in(
            "card_id",
            rawCards.map((card) => card.id),
          );

        if (reviewError) throw reviewError;

        reviewsByCardId = new Map(
          ((reviewData ?? []) as CardReview[]).map((review) => [
            review.card_id,
            review,
          ]),
        );
      }

      const mergedCards = rawCards.map((card) => {
        const review = reviewsByCardId.get(card.id);
        return {
          ...card,
          review_quality: review?.quality ?? null,
          next_review_at: review?.next_review_at ?? null,
          reviewed_at: review?.reviewed_at ?? null,
          status: getCardStatus(review),
        };
      });

      setDeck(deckData as Deck);
      setCards(mergedCards);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, [deckId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeck();
  }, [loadDeck]);

  const progress = useMemo(() => {
    const total = cards.length;
    const mastered = cards.filter((card) => card.status === "mastered").length;
    const due = cards.filter((card) => card.status === "review").length;
    const studied = cards.filter((card) => card.reviewed_at).length;
    const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;

    return { total, mastered, due, studied, percent };
  }, [cards]);

  const markAsMastered = useCallback(
    async (card: VocabularyCardData) => {
      if (!profile) return;

      const now = new Date();
      const nextReviewAt = new Date(now);
      nextReviewAt.setDate(now.getDate() + 7);

      const { data: existingReview } = await supabase
        .from("card_reviews")
        .select("id, repetition")
        .eq("user_id", profile.id)
        .eq("card_id", card.id)
        .maybeSingle();

      const repetition =
        typeof existingReview?.repetition === "number"
          ? existingReview.repetition + 1
          : 1;

      const { error: upsertError } = await supabase.from("card_reviews").upsert(
        {
          user_id: profile.id,
          card_id: card.id,
          quality: 5,
          interval_days: 7,
          next_review_at: nextReviewAt.toISOString(),
          reviewed_at: now.toISOString(),
          repetition,
        },
        { onConflict: "user_id,card_id" },
      );

      if (upsertError) {
        setError(upsertError.message);
        return;
      }

      setCards((currentCards) =>
        currentCards.map((item) =>
          item.id === card.id
            ? {
                ...item,
                status: "mastered",
                review_quality: 5,
                reviewed_at: now.toISOString(),
                next_review_at: nextReviewAt.toISOString(),
              }
            : item,
        ),
      );
      setSelectedVocabulary((current) =>
        current?.id === card.id
          ? {
              ...current,
              status: "mastered",
              review_quality: 5,
              reviewed_at: now.toISOString(),
              next_review_at: nextReviewAt.toISOString(),
            }
          : current,
      );
    },
    [profile],
  );

  if (loading) return <DeckDetailSkeleton />;

  if (notFound) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#FFFBEB] font-body text-gray-900">
        <HoneycombPattern />
        <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-5 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-700">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="font-heading text-3xl font-bold">
            Không tìm thấy bộ thẻ
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
            Bộ thẻ này không tồn tại hoặc không thuộc tài khoản hiện tại.
          </p>
          <Link
            href="/vocabulary"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại Từ vựng
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFFBEB] font-body text-gray-900">
      <HoneycombPattern />
      <AppNavbar email={profile?.email ?? ""} />

      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 lg:px-8">
        {error && (
          <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        {deck && (
          <>
            <DeckHeader
              deck={deck}
              deckId={deckId}
              progress={progress}
              onCardCreated={loadDeck}
            />

            {cards.length === 0 ? (
              <EmptyDeckState deckId={deckId} onCardCreated={loadDeck} />
            ) : (
              <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                  <VocabularyCard
                    key={card.id}
                    card={card}
                    onOpen={() => setSelectedVocabulary(card)}
                    onCardUpdated={loadDeck}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      <VocabularyDetailModal
        vocabulary={selectedVocabulary}
        open={Boolean(selectedVocabulary)}
        onOpenChange={(open) => {
          if (!open) setSelectedVocabulary(null);
        }}
        onMarkMastered={markAsMastered}
      />
    </main>
  );
}

function AppNavbar({ email }: { email: string }) {
  const router = useRouter();
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

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
                  onClick={handleSignOut}
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

function DeckHeader({
  deck,
  deckId,
  progress,
  onCardCreated,
}: {
  deck: Deck;
  deckId: string;
  progress: {
    total: number;
    mastered: number;
    due: number;
    studied: number;
    percent: number;
  };
  onCardCreated: () => void | Promise<void>;
}) {
  return (
    <section className="rounded-3xl border border-yellow-100 bg-white p-5 shadow-sm shadow-yellow-100/50 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 sm:text-sm">
            <Link href="/vocabulary" className="hover:text-yellow-700">
              Từ vựng
            </Link>
            <span>/</span>
            <span className="truncate text-gray-900">{deck.name}</span>
          </div>

          <h1 className="font-heading text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
            {deck.name}
          </h1>
          {deck.description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-500">
              {deck.description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:pt-9">
          <Link
            href={`/vocabulary/${deckId}/study`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-bold text-yellow-300 shadow-lg shadow-gray-900/10 transition-colors hover:bg-gray-700"
          >
            <PlayCircle className="h-4 w-4" />
            Học ngay
          </Link>
          <AddCardDialog
            deckId={deckId}
            onCardCreated={onCardCreated}
            triggerLabel="Thêm từ mới"
            trigger={
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-yellow-400 px-5 text-sm font-bold text-gray-900 shadow-lg shadow-yellow-200/60 transition-colors hover:bg-yellow-300"
              >
                <Plus className="h-4 w-4" />
                Thêm từ mới
              </button>
            }
          />
        </div>
      </div>

      <ProgressSummary progress={progress} />
    </section>
  );
}

function ProgressSummary({
  progress,
}: {
  progress: {
    total: number;
    mastered: number;
    due: number;
    studied: number;
    percent: number;
  };
}) {
  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem
          icon={BookOpenCheck}
          label="Tổng số thẻ"
          value={progress.total}
          tone="bg-yellow-100 text-yellow-700"
        />
        <SummaryItem
          icon={BookOpen}
          label="Đã học"
          value={progress.studied}
          tone="bg-sky-100 text-sky-700"
        />
        <SummaryItem
          icon={Clock3}
          label="Cần ôn tập"
          value={progress.due}
          tone="bg-rose-100 text-rose-700"
        />
        <SummaryItem
          icon={CheckCircle2}
          label="Đã thuộc"
          value={progress.mastered}
          tone="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-yellow-100 bg-yellow-50/60 p-3.5">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-500">
          <span>Mức độ hoàn thành</span>
          <span>{progress.percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-yellow-100">
          <div
            className="h-full rounded-full bg-yellow-400 transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400">{label}</p>
          <p className="font-heading text-xl font-bold leading-none text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function VocabularyCard({
  card,
  onOpen,
  onCardUpdated,
}: {
  card: VocabularyCardData;
  onOpen: () => void;
  onCardUpdated: () => void | Promise<void>;
}) {
  const status = getStatusMeta(card.status);
  const StatusIcon = status.icon;

  return (
    <article className="group flex h-full min-h-[330px] flex-col rounded-3xl border border-yellow-100/70 bg-white p-4 text-left shadow-sm shadow-yellow-100/40 transition-all duration-300 hover:-translate-y-1 hover:border-yellow-200 hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 cursor-pointer flex-col text-left"
      >
        <div className="flex gap-3.5">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-yellow-50 to-sky-50 sm:h-[88px] sm:w-[88px]">
            {card.image_url ? (
              <img
                src={card.image_url}
                alt={card.word}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-yellow-600">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex min-h-[24px] flex-wrap items-center gap-1.5">
              {card.part_of_speech && (
                <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-bold text-yellow-700">
                  {card.part_of_speech}
                </span>
              )}

              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.className}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>
            </div>

            <h2 className="line-clamp-2 break-words font-heading text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
              {card.word}
            </h2>

            <p className="mt-1 min-h-[22px] break-words font-mono text-sm leading-relaxed text-slate-500">
              {card.phonetic || ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex-1 space-y-3">
          <div className="min-h-[56px]">
            {card.vietnamese_meaning ? (
              <p className="line-clamp-2 break-words text-base font-semibold leading-relaxed text-amber-700">
                {card.vietnamese_meaning}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Chưa có nghĩa tiếng Việt</p>
            )}
          </div>

          <div className="min-h-[74px] rounded-2xl bg-slate-50 px-4 py-3">
            {card.english_example ? (
              <p className="line-clamp-2 overflow-hidden break-words text-sm italic leading-relaxed text-slate-600">
                &ldquo;{card.english_example}&rdquo;
              </p>
            ) : (
              <p className="text-sm italic text-slate-400">
                Chưa có ví dụ minh họa
              </p>
            )}
          </div>
        </div>
      </button>

      <div className="mt-auto flex items-center justify-end border-t border-gray-100 pt-3">
        <AddCardDialog
          deckId={card.deck_id}
          onCardCreated={onCardUpdated}
          card={card}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700 transition-colors hover:bg-yellow-200"
            >
              Chỉnh sửa
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          }
        />
      </div>
    </article>
  );
}

function VocabularyDetailModal({
  vocabulary,
  open,
  onOpenChange,
  onMarkMastered,
}: {
  vocabulary: VocabularyCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkMastered: (card: VocabularyCardData) => void | Promise<void>;
}) {
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!vocabulary) return null;

  const selected = vocabulary;
  const status = getStatusMeta(selected.status);
  const StatusIcon = status.icon;
  const definition = selected.english_definition ?? selected.definition;

  function speakWord() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(selected.word);
    utterance.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function handleMarkMastered() {
    setMarking(true);
    await onMarkMastered(selected);
    setMarking(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-900/25 supports-backdrop-filter:backdrop-blur-sm"
        className="max-h-[85vh] overflow-hidden rounded-3xl border border-yellow-100 bg-white p-0 shadow-2xl shadow-slate-900/20 sm:max-w-4xl"
      >
        <div className="border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
          <DialogHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-50 shadow-sm">
                {selected.image_url ? (
                  <img
                    src={selected.image_url}
                    alt={selected.word}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-yellow-600">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${status.className}`}
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                  {selected.part_of_speech && (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-700">
                      {selected.part_of_speech}
                    </span>
                  )}
                </div>
                <DialogTitle className="font-heading text-3xl font-bold text-gray-900 sm:text-4xl">
                  {selected.word}
                </DialogTitle>
                {selected.phonetic && (
                  <p className="mt-1 font-mono text-sm text-slate-500">
                    {selected.phonetic}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid min-h-0 gap-0 md:grid-cols-[220px_1fr]">
          <aside className="border-b border-gray-100 bg-slate-50/70 p-4 md:border-b-0 md:border-r md:p-5">
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-1">
              <button
                type="button"
                onClick={speakWord}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-yellow-100 bg-white px-4 text-sm font-bold text-gray-700 transition-colors hover:bg-yellow-50"
              >
                <Volume2 className="h-4 w-4 text-yellow-600" />
                Nghe phát âm
              </button>
              <button
                type="button"
                onClick={handleMarkMastered}
                disabled={marking || selected.status === "mastered"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gray-900 px-4 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {selected.status === "mastered"
                  ? "Đã thuộc"
                  : marking
                    ? "Đang lưu..."
                    : "Đã thuộc"}
              </button>
            </div>
          </aside>

          <div className="max-h-[calc(85vh-140px)] min-h-0 overflow-y-auto px-5 py-5 [scrollbar-width:thin] [scrollbar-color:#FACC15_transparent] sm:px-6">
            <div className="space-y-4">
              <DetailSection title="Nghĩa">
                <p className="text-lg font-semibold text-amber-700">
                  {selected.vietnamese_meaning || "Chưa có nghĩa tiếng Việt"}
                </p>
              </DetailSection>

              {definition && (
                <DetailSection title="Định nghĩa">
                  <p className="leading-relaxed text-slate-600">{definition}</p>
                </DetailSection>
              )}

              <DetailSection title="Ví dụ">
                {selected.english_example ? (
                  <p className="font-medium italic leading-relaxed text-slate-800">
                    &ldquo;{selected.english_example}&rdquo;
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
                )}
                {selected.vietnamese_example && (
                  <p className="mt-2 leading-relaxed text-slate-600">
                    {selected.vietnamese_example}
                  </p>
                )}
              </DetailSection>

              <RelatedTagSection
                title="Từ đồng nghĩa"
                items={selected.synonyms ?? []}
              />
              <RelatedTagSection
                title="Từ trái nghĩa"
                items={selected.antonyms ?? []}
              />
              <RelatedTagSection
                title="Cụm từ thường gặp"
                items={selected.collocations ?? []}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

function RelatedTagSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  const [activeItem, setActiveItem] = useState<string | null>(null);

  return (
    <DetailSection title={title}>
      {items.length > 0 ? (
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
                className="group relative rounded-full border border-yellow-100 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700 transition-colors hover:border-yellow-300 hover:bg-white"
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
      ) : (
        <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
      )}
    </DetailSection>
  );
}

function EmptyDeckState({
  deckId,
  onCardCreated,
}: {
  deckId: string;
  onCardCreated: () => void | Promise<void>;
}) {
  return (
    <section className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-yellow-300 bg-white/80 px-6 py-20 text-center shadow-sm shadow-yellow-100/60">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-700">
        <BookOpen className="h-8 w-8" />
      </div>
      <h2 className="font-heading text-2xl font-bold text-gray-900">
        Bộ thẻ này chưa có từ nào
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
        Tạo thẻ đầu tiên bằng AI để bắt đầu học từ vựng trong bộ này.
      </p>
      <div className="mt-6">
        <AddCardDialog
          deckId={deckId}
          onCardCreated={onCardCreated}
          triggerLabel="Thêm từ đầu tiên"
        />
      </div>
    </section>
  );
}

function DeckDetailSkeleton() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FFFBEB]">
      <HoneycombPattern />
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 lg:px-8">
        <div className="rounded-3xl border border-yellow-100 bg-white p-6">
          <Skeleton className="mb-5 h-5 w-48 bg-yellow-100/70" />
          <Skeleton className="mb-4 h-12 w-full max-w-xl bg-gray-100" />
          <Skeleton className="h-5 w-full max-w-2xl bg-gray-100" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-20 rounded-2xl bg-gray-100" />
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-64 rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </main>
  );
}
