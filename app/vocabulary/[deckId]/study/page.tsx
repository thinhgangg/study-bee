"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Flame,
  HelpCircle,
  ImageIcon,
  RotateCcw,
  Shuffle,
  Target,
  Trophy,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoneycombPattern } from "@/components/ui/honeycomb-pattern";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import {
  calculateReviewSchedule,
  isCardDue,
} from "@/lib/spacedRepetition";
import {
  fetchStudyStreak,
  initializeStudyDay,
  recordStudyReview,
  type StudyStreak,
} from "@/lib/studyStreak";
import { fetchNode } from "@/lib/vocabularyTree";

interface Deck {
  id: string;
  name: string;
  description: string | null;
}

interface StudyCard {
  id: string;
  deck_id: string;
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  vietnamese_meaning: string | null;
  english_example: string | null;
  vietnamese_example: string | null;
  synonyms: string[] | null;
  antonyms: string[] | null;
  collocations: string[] | null;
  image_url: string | null;
  order_index: number | null;
  created_at: string;
}

interface Profile {
  id: string;
}

interface CardReview {
  card_id: string;
  repetition: number | null;
  interval_days: number | null;
  ease_factor: number | null;
  next_review_at: string | null;
}

type ReviewResults = Record<string, number>;

const reviewOptions = [
  {
    label: "Quên rồi",
    quality: 1,
    className:
      "border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800",
  },
  {
    label: "Hơi khó",
    quality: 3,
    className:
      "border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
  },
  {
    label: "Nhớ được",
    quality: 4,
    className:
      "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800",
  },
  {
    label: "Quá dễ",
    quality: 5,
    className:
      "border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800",
  },
];

const relatedSeparators = [" — ", " – ", " - ", ": ", "："];

function getEnglishLabel(value: string) {
  const trimmed = value.trim();
  const separator = relatedSeparators.find((item) => trimmed.includes(item));

  if (!separator) return trimmed;

  return trimmed.split(separator)[0]?.trim() || trimmed;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 120 : -120,
    opacity: 0,
    scale: 0.9,
  }),

  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },

  exit: (direction: number) => ({
    x: direction > 0 ? -120 : 120,
    opacity: 0,
    scale: 0.95,
  }),
};

export default function StudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const studyAllCards = searchParams.get("mode") === "all";
  const backHref =
    source === "community" || source === "saved"
      ? `/vocabulary/${deckId}?source=${source}`
      : `/vocabulary/${deckId}`;
  const studyAllHref =
    source === "community" || source === "saved"
      ? `/vocabulary/${deckId}/study?source=${source}&mode=all`
      : `/vocabulary/${deckId}/study?mode=all`;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [totalCardCount, setTotalCardCount] = useState(0);
  const [allCards, setAllCards] = useState<StudyCard[]>([]);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [slideDirection, setSlideDirection] = useState(0); // 1 = next, -1 = prev
  const [animKey, setAnimKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [reviewResults, setReviewResults] = useState<ReviewResults>({});
  const [sessionDuration, setSessionDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [studyStreak, setStudyStreak] = useState<StudyStreak>({
    current: 0,
    longest: 0,
    studiedToday: false,
    activity: [],
    todayReviewed: 0,
    todayGoal: 0,
    todayProgress: 0,
  });
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const sessionStartedAt = useRef(0);
  const pendingReviewIds = useRef(new Set<string>());

  const currentCard = cards[currentIndex];
  const reviewedPercent =
    cards.length > 0 ? Math.round((reviewedIds.size / cards.length) * 100) : 0;
  const positionPercent =
    cards.length > 0
      ? Math.round(((currentIndex + 1) / cards.length) * 100)
      : 0;

  const hintItems = useMemo(() => {
    const synonyms = currentCard?.synonyms ?? [];
    const collocations = currentCard?.collocations ?? [];

    return [...synonyms, ...collocations]
      .map(getEnglishLabel)
      .filter(Boolean)
      .slice(0, 3);
  }, [currentCard]);

  const loadStudyData = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
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

      try {
        setStudyStreak(await initializeStudyDay(profileData.id));
      } catch {
        try {
          setStudyStreak(await fetchStudyStreak(profileData.id));
        } catch {
          setStudyStreak({
            current: 0,
            longest: 0,
            studiedToday: false,
            activity: [],
            todayReviewed: 0,
            todayGoal: 0,
            todayProgress: 0,
          });
        }
      }

      const node = await fetchNode(deckId);
      const canReadNode =
        Boolean(node) &&
        node?.type === "deck" &&
        (node.user_id === profileData.id ||
          node.visibility === "public" ||
          node.visibility === "unlisted");

      if (!node || !canReadNode) {
        setNotFound(true);
        setDeck(null);
        setCards([]);
        return;
      }

      const { data: deckData, error: deckError } = await supabase
        .from("decks")
        .select("id, name, description")
        .eq("id", deckId)
        .maybeSingle();

      if (deckError) throw deckError;

      if (!deckData && !node) {
        setNotFound(true);
        setDeck(null);
        setCards([]);
        return;
      }

      const { data: cardData, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId)
        .order("order_index", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (cardsError) throw cardsError;

      const loadedCards = (cardData ?? []) as StudyCard[];
      setTotalCardCount(loadedCards.length);
      const cardIds = loadedCards.map((card) => card.id);
      let reviewsByCardId = new Map<string, CardReview>();

      if (cardIds.length > 0) {
        const { data: reviewData, error: reviewsError } = await supabase
          .from("card_reviews")
          .select(
            "card_id, repetition, interval_days, ease_factor, next_review_at",
          )
          .eq("user_id", profileData.id)
          .in("card_id", cardIds);

        if (reviewsError) throw reviewsError;

        reviewsByCardId = new Map(
          ((reviewData ?? []) as CardReview[]).map((review) => [
            review.card_id,
            review,
          ]),
        );
      }

      const studyCards = studyAllCards
        ? loadedCards
        : loadedCards.filter((card) =>
            isCardDue(reviewsByCardId.get(card.id)?.next_review_at),
          );

      setProfile(profileData as Profile);
      setDeck(
        deckData
          ? (deckData as Deck)
          : {
              id: node.id,
              name: node.title,
              description: node.description,
            },
      );
      setAllCards(studyCards);
      setCards(studyCards);
      setCurrentIndex(0);
      setFlipped(false);
      setCompleted(false);
      setReviewedIds(new Set());
      setReviewResults({});
      setSessionDuration(0);
      sessionStartedAt.current = Date.now();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, [deckId, router, studyAllCards]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStudyData();
  }, [loadStudyData]);

  const flipCard = useCallback(() => {
    if (!currentCard || completed) return;
    setFlipped((value) => !value);
  }, [completed, currentCard]);

  const goPrevious = useCallback(() => {
    if (cards.length === 0) return;
    if (currentIndex === 0) return;
    setCompleted(false);
    setSlideDirection(-1);
    setAnimKey((value) => value + 1);
    setCurrentIndex((index) => Math.max(index - 1, 0));
    setFlipped(false);
  }, [cards.length, currentIndex]);

  const goNext = useCallback(() => {
    if (cards.length === 0) return;

    if (currentIndex >= cards.length - 1) {
      setSessionDuration(
        Math.max(1, Math.round((Date.now() - sessionStartedAt.current) / 1000)),
      );
      setCompleted(true);
      setFlipped(false);
      return;
    }

    setSlideDirection(1);
    setAnimKey((value) => value + 1);
    setCurrentIndex((index) => index + 1);
    setFlipped(false);
  }, [cards.length, currentIndex]);

  const shuffleCards = useCallback(() => {
    setCards((currentCards) => {
      const shuffled = [...currentCards];

      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [
          shuffled[randomIndex],
          shuffled[index],
        ];
      }

      return shuffled;
    });
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
    setSlideDirection(0);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.target instanceof HTMLTextAreaElement) return;
      if (event.target instanceof HTMLButtonElement) return;
      if (event.target instanceof HTMLAnchorElement) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        flipCard();
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        shuffleCards();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flipCard, goNext, goPrevious, shuffleCards]);

  function handleReview(quality: number) {
    if (!profile || !currentCard) return;
    if (pendingReviewIds.current.has(currentCard.id)) return;

    const reviewedCard = currentCard;
    const currentProfile = profile;
    pendingReviewIds.current.add(reviewedCard.id);
    setError("");
    setReviewedIds((current) => new Set(current).add(reviewedCard.id));
    setReviewResults((current) => ({
      ...current,
      [reviewedCard.id]: quality,
    }));
    goNext();

    void (async () => {
      try {
        const now = new Date();

        const { data: existingReview, error: existingError } = await supabase
          .from("card_reviews")
          .select("id, repetition, interval_days, ease_factor")
          .eq("user_id", currentProfile.id)
          .eq("card_id", reviewedCard.id)
          .maybeSingle();

        if (existingError) throw existingError;

        const schedule = calculateReviewSchedule(
          quality,
          {
            repetition: existingReview?.repetition ?? 0,
            intervalDays: existingReview?.interval_days ?? 0,
            easeFactor: existingReview?.ease_factor ?? 2.5,
          },
          now,
        );

        const reviewPayload = {
          user_id: currentProfile.id,
          card_id: reviewedCard.id,
          quality,
          interval_days: schedule.intervalDays,
          ease_factor: schedule.easeFactor,
          next_review_at: schedule.nextReviewAt.toISOString(),
          reviewed_at: now.toISOString(),
          repetition: schedule.repetition,
        };

        const { error: upsertError } = await supabase
          .from("card_reviews")
          .upsert(reviewPayload, { onConflict: "user_id,card_id" });

        if (upsertError) throw upsertError;

        try {
          setStudyStreak(await recordStudyReview(currentProfile.id));
        } catch {
          // Review vẫn được lưu nếu migration streak chưa được chạy.
        }
      } catch (err: unknown) {
        setReviewedIds((current) => {
          const next = new Set(current);
          next.delete(reviewedCard.id);
          return next;
        });
        setReviewResults((current) => {
          const next = { ...current };
          delete next[reviewedCard.id];
          return next;
        });
        setError(
          err instanceof Error ? err.message : "Không thể lưu đánh giá từ vựng.",
        );
      } finally {
        pendingReviewIds.current.delete(reviewedCard.id);
      }
    })();
  }

  function restartSession() {
    setCards(allCards);
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
    setReviewedIds(new Set());
    setReviewResults({});
    setSessionDuration(0);
    sessionStartedAt.current = Date.now();
  }

  function reviewDifficultCards() {
    const difficultCards = allCards.filter(
      (card) => (reviewResults[card.id] ?? 5) <= 3,
    );

    if (difficultCards.length === 0) return;

    setCards(difficultCards);
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
    setReviewedIds(new Set());
    setReviewResults({});
    setSessionDuration(0);
    sessionStartedAt.current = Date.now();
  }

  if (loading) {
    return <StudySkeleton />;
  }

  if (notFound) {
    return (
      <StudyShell>
        <CenteredState
          title="Không tìm thấy bộ từ"
          description="Bộ từ này không tồn tại hoặc không thuộc tài khoản hiện tại."
          action={<BackToDecksButton />}
        />
      </StudyShell>
    );
  }

  if (!deck) {
    return (
      <StudyShell>
        <CenteredState
          title="Không thể tải phiên học"
          description={error || "Vui lòng thử lại sau."}
          action={<BackToDecksButton />}
        />
      </StudyShell>
    );
  }

  if (cards.length === 0) {
    return (
      <StudyShell>
        <CenteredState
          icon={
            totalCardCount > 0 ? (
              <Image
                src="/studybee-mascot.png"
                alt="StudyBee"
                width={160}
                height={160}
                className="mx-auto h-24 w-24 object-contain sm:h-28 sm:w-28"
                priority
              />
            ) : undefined
          }
          title={
            totalCardCount === 0
              ? "Bộ từ này chưa có từ vựng nào"
              : "Hôm nay bạn đã ôn xong"
          }
          description={
            totalCardCount === 0
              ? "Hãy quay lại bộ từ để thêm từ mới trước khi bắt đầu học."
              : "Chưa có thẻ nào đến hạn. Hãy quay lại vào lịch ôn tiếp theo."
          }
          action={
            totalCardCount === 0 ? (
              <Button
                asChild
                className="rounded-full bg-gray-900 font-bold text-yellow-300 hover:bg-gray-700"
              >
                <Link href={backHref}>Quay lại bộ từ</Link>
              </Button>
            ) : (
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  className="rounded-full bg-gray-900 font-bold text-yellow-300 hover:bg-gray-700"
                >
                  <Link href={studyAllHref}>Học lại tất cả</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full font-bold">
                  <Link href={backHref}>Quay lại bộ từ</Link>
                </Button>
              </div>
            )
          }
        />
      </StudyShell>
    );
  }

  if (completed) {
    return (
      <StudyShell scrollable>
        <StudySummary
          deck={deck}
          cards={cards}
          reviewResults={reviewResults}
          sessionDuration={sessionDuration}
          studyStreak={studyStreak}
          backHref={backHref}
          onRestart={restartSession}
          onReviewDifficult={reviewDifficultCards}
        />
      </StudyShell>
    );
  }

  return (
    <StudyShell>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-4 py-3 sm:px-6 sm:py-4 lg:h-[100dvh] lg:min-h-0 lg:px-8">
        <header className="shrink-0 rounded-3xl border border-yellow-100 bg-white/95 px-4 py-3 shadow-sm shadow-yellow-100/50 backdrop-blur sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              asChild
              variant="ghost"
              className="h-10 w-fit gap-2 rounded-full px-3 font-bold text-slate-700 hover:bg-yellow-50"
            >
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại bộ từ
              </Link>
            </Button>

            <div className="min-w-0 text-left sm:text-center">
              <h1 className="line-clamp-1 break-words font-heading text-xl font-bold text-gray-900">
                {deck.name}
              </h1>
            </div>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <GuideDialog />
              <div className="rounded-full border border-yellow-100 bg-yellow-50 px-4 py-2 text-sm font-bold text-gray-900">
                {currentIndex + 1} / {cards.length}
              </div>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-yellow-100/70">
            <div
              className="h-full rounded-full bg-yellow-400 transition-all duration-300"
              style={{ width: `${positionPercent}%` }}
            />
          </div>
        </header>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <section className="flex flex-1 flex-col items-center gap-0 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:py-4 lg:min-h-0 lg:justify-center">
          <div
            role="button"
            tabIndex={0}
            onClick={flipCard}
            className="group w-full max-w-[640px] rounded-[2rem] text-left outline-none focus-visible:ring-4 focus-visible:ring-yellow-200"
            aria-label={flipped ? "Xem mặt trước flashcard" : "Lật flashcard"}
          >
            <div className="relative [perspective:1400px]">
              <AnimatePresence
                initial={false}
                mode="popLayout"
                custom={slideDirection}
              >
                <motion.div
                  key={animKey}
                  custom={slideDirection}
                  variants={cardVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    type: "spring",
                    stiffness: 280,
                    damping: 24,
                  }}
                >
                  <div
                    className={`relative h-[clamp(360px,54dvh,500px)] transition-transform duration-500 ease-out [transform-style:preserve-3d] sm:h-[clamp(400px,54dvh,540px)] lg:h-[clamp(400px,56vh,540px)] ${
                      flipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-yellow-200 bg-white p-6 shadow-xl shadow-yellow-100/70 transition group-hover:-translate-y-0.5 group-hover:border-yellow-300 sm:p-9 [backface-visibility:hidden]">
                      <CardFront card={currentCard} />
                    </div>
                    <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-yellow-200 bg-white p-5 shadow-xl shadow-yellow-100/70 transition group-hover:-translate-y-0.5 group-hover:border-yellow-300 sm:p-8 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <CardBack card={currentCard} hintItems={hintItems} />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <p className="mt-3 text-center text-sm font-medium text-slate-500">
            Click thẻ hoặc nhấn Space / Enter để lật
          </p>

          <div
            className={`mt-4 grid w-full max-w-[640px] grid-cols-2 gap-3 transition-opacity sm:grid-cols-4 ${
              flipped ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!flipped}
          >
            {reviewOptions.map((option) => (
              <Button
                key={option.quality}
                variant="outline"
                disabled={!flipped}
                onClick={() => handleReview(option.quality)}
                className={`h-11 rounded-2xl font-bold shadow-sm transition disabled:opacity-60 ${option.className}`}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrevious}
              disabled={currentIndex === 0}
              aria-label="Thẻ trước"
              className="h-10 rounded-full bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="rounded-full border border-gray-100 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm">
              Đã ôn {reviewedIds.size} từ · {reviewedPercent}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              aria-label="Thẻ tiếp theo"
              className="h-10 rounded-full bg-white"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shuffleCards}
              aria-label="Xáo trộn thẻ"
              className="h-10 gap-2 rounded-full bg-white"
            >
              <Shuffle className="h-4 w-4" />
              Xáo trộn
            </Button>
          </div>
        </section>
      </div>
    </StudyShell>
  );
}

function StudySummary({
  deck,
  cards,
  reviewResults,
  sessionDuration,
  studyStreak,
  backHref,
  onRestart,
  onReviewDifficult,
}: {
  deck: Deck;
  cards: StudyCard[];
  reviewResults: ReviewResults;
  sessionDuration: number;
  studyStreak: StudyStreak;
  backHref: string;
  onRestart: () => void;
  onReviewDifficult: () => void;
}) {
  const reviewedCount = Object.keys(reviewResults).length;
  const rememberedCount = Object.values(reviewResults).filter(
    (q) => q >= 4,
  ).length;
  const accuracy =
    reviewedCount > 0 ? Math.round((rememberedCount / reviewedCount) * 100) : 0;

  const difficultCards = cards.filter(
    (card) => (reviewResults[card.id] ?? 5) <= 3,
  );

  // Phân bổ chất lượng đánh giá cho thanh progress đa sắc
  const distribution = reviewOptions.map((opt) => ({
    ...opt,
    count: Object.values(reviewResults).filter((q) => q === opt.quality).length,
    percentage:
      reviewedCount > 0
        ? (Object.values(reviewResults).filter((q) => q === opt.quality)
            .length /
            reviewedCount) *
          100
        : 0,
  }));

  function speakWord(word: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "en-US";
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="relative mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
      {/* 1. CELEBRATION HERO */}
      <section className="mb-8 text-center sm:mb-10">
        <div className="relative inline-block">
          <Image
            src="/studybee-mascot.png"
            alt="StudyBee"
            width={160}
            height={160}
            className="mx-auto h-24 w-24 object-contain sm:h-28 sm:w-28"
            priority
          />
          <div className="absolute -right-1 top-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white">
            <Trophy className="h-4 w-4" />
          </div>
        </div>

        <h1 className="mt-4 font-heading text-3xl font-bold text-gray-900 sm:text-4xl">
          {accuracy >= 80
            ? "Xuất Sắc!"
            : accuracy >= 50
              ? "Làm Tốt Lắm!"
              : "Cố Gắng Lên!"}
        </h1>
        <p className="mt-2 text-base font-medium text-slate-600 sm:text-lg">
          Bạn vừa hoàn thành bộ thẻ{" "}
          <span className="font-bold text-amber-600">
            &ldquo;{deck.name}&rdquo;
          </span>
        </p>
        {studyStreak.studiedToday && (
          <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-bold text-orange-700">
            <Flame className="h-4 w-4 fill-orange-400 text-orange-500" />
            Streak {studyStreak.current} ngày đã được giữ hôm nay
          </div>
        )}
      </section>

      {/* 2. CORE STATS BAR */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: "Đã ôn tập",
            value: `${reviewedCount} từ`,
            icon: CheckCircle2,
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            label: "Độ chính xác",
            value: `${accuracy}%`,
            icon: Target,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
          },
          {
            label: "Thời gian",
            value: formatDuration(sessionDuration),
            icon: Clock3,
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Tốc độ",
            value: `${Math.round(sessionDuration / (reviewedCount || 1))}s/từ`,
            icon: Volume2,
            color: "text-purple-600",
            bg: "bg-purple-50",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="flex flex-col items-center rounded-2xl border border-yellow-100 bg-white p-4"
          >
            <div
              className={`mb-2 flex h-10 w-10 items-center justify-center rounded-2xl ${stat.bg} ${stat.color}`}
            >
              <stat.icon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {stat.label}
            </span>
            <span className="mt-1 font-heading text-xl font-bold text-gray-900">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {/* 3. PERFORMANCE BREAKDOWN */}
      <section className="mb-10 rounded-3xl border border-yellow-100 bg-white p-5 sm:p-8">
        <h3 className="mb-6 flex items-center gap-2 font-heading text-xl font-bold">
          <div className="h-2 w-2 rounded-full bg-yellow-400" />
          Phân tích kết quả
        </h3>

        {/* Multi-segment Progress Bar */}
        <div className="mb-8 h-4 w-full overflow-hidden rounded-full bg-slate-100 flex">
          {distribution.map((seg, i) => (
            <div
              key={i}
              style={{ width: `${seg.percentage}%` }}
              className={`h-full ${
                seg.quality === 1
                  ? "bg-rose-400"
                  : seg.quality === 3
                    ? "bg-amber-400"
                    : seg.quality === 4
                      ? "bg-emerald-400"
                      : "bg-sky-400"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1 sm:gap-3">
          {distribution.map((item) => (
            <div
              key={item.quality}
              className="flex min-w-0 items-center justify-center gap-1 rounded-lg border border-gray-100 bg-gray-50/50 px-1 py-2 text-center sm:gap-2 sm:rounded-xl sm:px-3"
            >
              <div
                className={`hidden h-2.5 w-2.5 shrink-0 rounded-full sm:block ${
                  item.quality === 1
                    ? "bg-rose-400"
                    : item.quality === 3
                      ? "bg-amber-400"
                      : item.quality === 4
                        ? "bg-emerald-400"
                        : "bg-sky-400"
                }`}
              />
              <span className="whitespace-nowrap text-[9px] font-bold text-slate-600 sm:text-xs">
                {item.label}
              </span>
              <span className="whitespace-nowrap font-heading text-[9px] font-bold text-gray-900 sm:text-sm">
                {item.count} từ
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 4. DIFFICULT WORDS - MINI CARDS */}
      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-heading text-2xl font-bold text-gray-900">
            Từ vựng cần lưu ý
          </h3>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">
            {difficultCards.length} từ khó
          </span>
        </div>

        {difficultCards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {difficultCards.map((card) => (
              <div
                key={card.id}
                className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 transition-colors hover:border-yellow-200 hover:bg-yellow-50/40"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    onClick={() => speakWord(card.word)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-yellow-600 transition-colors group-hover:bg-yellow-400 group-hover:text-white"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate font-heading font-bold text-gray-900">
                      {card.word}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {card.vietnamese_meaning}
                    </p>
                  </div>
                </div>
                <div
                  className={`h-2 w-2 rounded-full ${reviewResults[card.id] === 1 ? "bg-rose-400" : "bg-amber-400"}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-emerald-100 bg-emerald-50/30 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="font-bold text-emerald-800">
              Tuyệt vời! Bạn đã nắm vững tất cả các từ.
            </p>
            <p className="text-sm text-emerald-600/80">
              Không có từ nào bị đánh giá là khó trong phiên này.
            </p>
          </div>
        )}
      </section>

      {/* 5. ACTIONS */}
      <footer className="grid grid-cols-2 gap-2 border-t border-yellow-100 pt-5 sm:grid-cols-3 sm:gap-3">
        <Button
          onClick={onReviewDifficult}
          disabled={difficultCards.length === 0}
          className="col-span-2 h-11 min-w-0 rounded-xl border border-yellow-400 bg-yellow-400 px-4 text-sm font-bold text-gray-950 hover:border-yellow-500 hover:bg-yellow-500 disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:opacity-100 sm:col-span-1"
        >
          <Target className="mr-2 h-4 w-4 shrink-0" />
          Ôn {difficultCards.length} từ khó
        </Button>

        <Button
          onClick={onRestart}
          variant="outline"
          className="h-11 min-w-0 rounded-xl border-yellow-300 bg-white px-3 text-sm font-bold text-amber-700 hover:border-yellow-400 hover:bg-yellow-50 hover:text-amber-800 sm:px-4"
        >
          <RotateCcw className="mr-2 h-4 w-4 shrink-0 text-amber-600" />
          Học lại
        </Button>

        <Button
          asChild
          variant="outline"
          className="h-11 min-w-0 rounded-xl border-gray-200 bg-white px-3 text-sm font-bold text-slate-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 sm:px-4"
        >
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
            Về bộ từ
          </Link>
        </Button>
      </footer>
    </div>
  );
}

function CardFront({ card }: { card: StudyCard }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, [card.word]);

  function speakWord(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(card.word);
    utterance.lang = "en-US";
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
      <h2 className="line-clamp-2 max-w-full break-words font-heading text-4xl font-bold text-gray-900 sm:text-6xl">
        {card.word}
      </h2>
      {card.phonetic && (
        <div className="mt-4 flex max-w-full items-center justify-center gap-2">
          <p className="break-words font-mono text-base text-slate-500 sm:text-lg">
            {card.phonetic}
          </p>
          <button
            type="button"
            onClick={speakWord}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Phát âm ${card.word}`}
            title="Phát âm"
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200 ${
              isSpeaking
                ? "border-yellow-300 bg-yellow-100 text-yellow-700"
                : "border-yellow-100 bg-white text-yellow-600 hover:bg-yellow-50"
            }`}
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>
      )}
      {card.part_of_speech && (
        <span className="mt-5 rounded-full bg-yellow-100 px-4 py-1.5 text-xs font-bold text-yellow-700">
          {card.part_of_speech}
        </span>
      )}
    </div>
  );
}

function CardBack({
  card,
  hintItems,
}: {
  card: StudyCard;
  hintItems: string[];
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const shouldShowImage =
    Boolean(card.image_url) && failedImageUrl !== card.image_url;

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto overscroll-contain px-1 py-1 text-center [scrollbar-width:thin] [scrollbar-color:#FACC15_transparent]">
      {shouldShowImage ? (
        <Image
          src={card.image_url!}
          alt={card.word}
          width={240}
          height={144}
          unoptimized
          onError={() => setFailedImageUrl(card.image_url)}
          className="mb-5 h-28 w-44 shrink-0 rounded-3xl object-cover shadow-sm sm:h-36 sm:w-60"
        />
      ) : (
        <div className="mb-5 flex h-24 w-36 shrink-0 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-700 sm:h-32 sm:w-52 sm:rounded-3xl">
          <ImageIcon className="h-9 w-9 sm:h-10 sm:w-10" />
        </div>
      )}

      <h2 className="max-w-xl break-words font-heading text-xl font-bold leading-snug text-amber-700 sm:text-2xl">
        {card.vietnamese_meaning || "Chưa có nghĩa tiếng Việt"}
      </h2>

      {card.english_example ? (
        <div className="mt-5 w-full max-w-xl shrink-0 rounded-3xl bg-slate-50 px-4 py-3 text-center">
          <p className="break-words text-sm font-medium italic leading-relaxed text-slate-800 sm:text-base">
            &ldquo;{card.english_example}&rdquo;
          </p>
          {card.vietnamese_example && (
            <p className="mt-2 break-words text-sm leading-relaxed text-slate-600">
              {card.vietnamese_example}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-400">Chưa có ví dụ cho thẻ này</p>
      )}

      {hintItems.length > 0 && (
        <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
          {hintItems.map((item) => (
            <span
              key={item}
              className="line-clamp-1 max-w-[180px] rounded-full border border-yellow-100 bg-yellow-50 px-3 py-1 text-xs font-bold text-slate-700"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GuideDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex h-10 items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-yellow-50 hover:text-gray-900">
          <HelpCircle className="h-4 w-4 text-yellow-600" />
          Cách học
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl border-yellow-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            Cách học flashcard
          </DialogTitle>
          <DialogDescription>
            Luyện nhớ nghĩa tiếng Việt từ từ vựng tiếng Anh.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <p>
            1. Nhìn từ tiếng Anh ở mặt trước, tự đoán nghĩa tiếng Việt trước khi
            lật thẻ.
          </p>
          <p>
            2. Click thẻ hoặc nhấn Space/Enter để xem đáp án, ví dụ và các gợi ý
            liên quan.
          </p>
          <p>
            3. Chọn mức độ nhớ của bạn. StudyBee sẽ lưu kết quả và lên lịch ôn
            tập tiếp theo.
          </p>
          <p className="rounded-2xl bg-yellow-50 px-3 py-2 text-xs font-semibold text-slate-600">
            Phím tắt: ← thẻ trước, → thẻ tiếp theo, Space/Enter lật thẻ, S xáo
            trộn.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
function StudyShell({
  children,
  scrollable = false,
}: {
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <main
      className={`relative min-h-[100dvh] overflow-x-hidden bg-[#FFFBEB] font-body text-gray-900 ${
        scrollable
          ? "overflow-y-auto"
          : "overflow-y-auto lg:h-[100dvh] lg:overflow-hidden"
      }`}
    >
      <HoneycombPattern />
      {children}
    </main>
  );
}

function CenteredState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-5 text-center">
      {icon ?? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-700 shadow-sm">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      <h1 className="font-heading text-3xl font-bold text-gray-900">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-500">
        {description}
      </p>
      <div className="mt-6">{action}</div>
    </div>
  );
}

function BackToDecksButton() {
  return (
    <Button
      asChild
      className="rounded-full bg-gray-900 font-bold text-yellow-300 hover:bg-gray-700"
    >
      <Link href="/vocabulary">Quay lại bộ từ</Link>
    </Button>
  );
}

function StudySkeleton() {
  return (
    <StudyShell>
      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-yellow-100 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-36 rounded-full bg-yellow-100/70" />
            <Skeleton className="h-10 w-48 rounded-full bg-gray-100" />
            <Skeleton className="h-10 w-24 rounded-full bg-yellow-100/70" />
          </div>
          <Skeleton className="mt-4 h-2 w-full rounded-full bg-yellow-100/70" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <Skeleton className="h-[430px] w-full max-w-[640px] rounded-[2rem] bg-white" />
          <Skeleton className="mt-5 h-5 w-56 bg-gray-100" />
          <Skeleton className="mt-8 h-10 w-96 max-w-full bg-gray-100" />
        </div>
      </div>
    </StudyShell>
  );
}
