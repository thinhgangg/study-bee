"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  ImageIcon,
  RotateCcw,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

function getIntervalDays(quality: number) {
  if (quality <= 2) return 1;
  if (quality === 3) return 2;
  if (quality === 4) return 4;
  return 7;
}

function getEnglishLabel(value: string) {
  const trimmed = value.trim();
  const separator = relatedSeparators.find((item) => trimmed.includes(item));

  if (!separator) return trimmed;

  return trimmed.split(separator)[0]?.trim() || trimmed;
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
          id="study-honeycomb"
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
            strokeOpacity="0.14"
            strokeWidth="0.8"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#study-honeycomb)" />
    </svg>
  );
}

export default function StudyPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = use(params);
  const router = useRouter();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

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

      const { data: deckData, error: deckError } = await supabase
        .from("decks")
        .select("id, name, description")
        .eq("id", deckId)
        .eq("user_id", profileData.id)
        .maybeSingle();

      if (deckError) throw deckError;

      if (!deckData) {
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

      setProfile(profileData as Profile);
      setDeck(deckData as Deck);
      setCards((cardData ?? []) as StudyCard[]);
      setCurrentIndex(0);
      setFlipped(false);
      setCompleted(false);
      setReviewedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, [deckId, router]);

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
    setCompleted(false);
    setCurrentIndex((index) => Math.max(index - 1, 0));
    setFlipped(false);
  }, [cards.length]);

  const goNext = useCallback(() => {
    if (cards.length === 0) return;

    if (currentIndex >= cards.length - 1) {
      setCompleted(true);
      setFlipped(false);
      return;
    }

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
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement) return;
      if (event.target instanceof HTMLTextAreaElement) return;

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

  async function handleReview(quality: number) {
    if (!profile || !currentCard || savingReview) return;

    setSavingReview(true);
    setError("");

    try {
      const intervalDays = getIntervalDays(quality);
      const now = new Date();
      const nextReviewAt = new Date(now);
      nextReviewAt.setDate(now.getDate() + intervalDays);

      const { data: existingReview, error: existingError } = await supabase
        .from("card_reviews")
        .select("id, repetition")
        .eq("user_id", profile.id)
        .eq("card_id", currentCard.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const repetition =
        typeof existingReview?.repetition === "number"
          ? existingReview.repetition + 1
          : 1;

      const reviewPayload = {
        user_id: profile.id,
        card_id: currentCard.id,
        quality,
        interval_days: intervalDays,
        next_review_at: nextReviewAt.toISOString(),
        reviewed_at: now.toISOString(),
        repetition,
      };

      const { error: upsertError } = await supabase
        .from("card_reviews")
        .upsert(reviewPayload, { onConflict: "user_id,card_id" });

      if (upsertError) throw upsertError;

      setReviewedIds((current) => new Set(current).add(currentCard.id));
      goNext();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Không thể lưu đánh giá thẻ.",
      );
    } finally {
      setSavingReview(false);
    }
  }

  function restartSession() {
    setCurrentIndex(0);
    setFlipped(false);
    setCompleted(false);
    setReviewedIds(new Set());
  }

  if (loading) {
    return <StudySkeleton />;
  }

  if (notFound) {
    return (
      <StudyShell>
        <CenteredState
          title="Không tìm thấy bộ thẻ"
          description="Bộ thẻ này không tồn tại hoặc không thuộc tài khoản hiện tại."
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
          title="Bộ thẻ này chưa có từ nào"
          description="Hãy quay lại bộ thẻ để thêm từ mới trước khi bắt đầu học."
          action={
            <Button
              asChild
              className="rounded-full bg-gray-900 font-bold text-yellow-300 hover:bg-gray-700"
            >
              <Link href={`/vocabulary/${deckId}`}>Quay lại thêm từ</Link>
            </Button>
          }
        />
      </StudyShell>
    );
  }

  if (completed) {
    return (
      <StudyShell>
        <div className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 py-12 text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-yellow-100 text-yellow-700 shadow-sm">
            <CheckCircle2 className="h-11 w-11" />
          </div>
          <h1 className="font-heading text-4xl font-bold text-gray-900">
            Hoàn thành phiên học!
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Bạn đã ôn {reviewedIds.size} / {cards.length} thẻ.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              onClick={restartSession}
              className="h-11 gap-2 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
            >
              <RotateCcw className="h-4 w-4" />
              Học lại
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-full bg-white px-5 font-bold"
            >
              <Link href={`/vocabulary/${deckId}`}>Quay lại bộ thẻ</Link>
            </Button>
          </div>
        </div>
      </StudyShell>
    );
  }

  return (
    <StudyShell>
      <div className="relative mx-auto flex h-screen min-h-0 max-w-6xl flex-col px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <header className="shrink-0 rounded-3xl border border-yellow-100 bg-white/95 px-4 py-3 shadow-sm shadow-yellow-100/50 backdrop-blur sm:px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              asChild
              variant="ghost"
              className="h-10 w-fit gap-2 rounded-full px-3 font-bold text-slate-700 hover:bg-yellow-50"
            >
              <Link href={`/vocabulary/${deckId}`}>
                <ArrowLeft className="h-4 w-4" />
                Quay lại bộ thẻ
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

        <section className="flex min-h-0 flex-1 flex-col items-center justify-center py-3 sm:py-4">
          <button
            type="button"
            onClick={flipCard}
            className="group w-full max-w-[680px] rounded-[2rem] text-left outline-none focus-visible:ring-4 focus-visible:ring-yellow-200"
          >
            <div className="[perspective:1400px]">
              <div
                className={`relative h-[clamp(330px,50vh,470px)] transition-transform duration-500 ease-out [transform-style:preserve-3d] sm:h-[clamp(360px,52vh,500px)] ${
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
            </div>
          </button>

          <p className="mt-3 text-center text-sm font-medium text-slate-500">
            Click thẻ hoặc nhấn Space / Enter để lật
          </p>

          <div
            className={`mt-4 grid w-full max-w-[680px] grid-cols-2 gap-3 transition-opacity sm:grid-cols-4 ${
              flipped ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!flipped}
          >
            {reviewOptions.map((option) => (
              <Button
                key={option.quality}
                variant="outline"
                disabled={!flipped || savingReview}
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
              Đã ôn {reviewedIds.size} thẻ · {reviewedPercent}%
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

function CardFront({ card }: { card: StudyCard }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
      <h2 className="line-clamp-2 max-w-full break-words font-heading text-4xl font-bold text-gray-900 sm:text-6xl">
        {card.word}
      </h2>
      {card.phonetic && (
        <p className="mt-4 break-words font-mono text-base text-slate-500 sm:text-lg">
          {card.phonetic}
        </p>
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
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.word}
          className="mb-4 h-28 w-44 rounded-3xl object-cover shadow-sm sm:h-32 sm:w-52"
        />
      ) : (
        <div className="mb-4 flex h-24 w-36 items-center justify-center rounded-3xl bg-yellow-50 text-yellow-700 sm:h-28 sm:w-44">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}

      <h2 className="line-clamp-2 max-w-xl break-words font-heading text-2xl font-bold leading-tight text-amber-700 sm:text-3xl">
        {card.vietnamese_meaning || "Chưa có nghĩa tiếng Việt"}
      </h2>

      {card.english_example ? (
        <div className="mt-5 max-w-xl rounded-3xl bg-slate-50 px-4 py-3 text-left">
          <p className="line-clamp-2 break-words text-sm font-medium italic leading-relaxed text-slate-800 sm:text-base">
            &ldquo;{card.english_example}&rdquo;
          </p>
          {card.vietnamese_example && (
            <p className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-slate-600">
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
            1. Nhìn từ tiếng Anh ở mặt trước, tự đoán nghĩa tiếng Việt trước
            khi lật thẻ.
          </p>
          <p>
            2. Click thẻ hoặc nhấn Space/Enter để xem đáp án, ví dụ và các gợi
            ý liên quan.
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
function StudyShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative h-screen overflow-hidden bg-[#FFFBEB] font-body text-gray-900">
      <HoneycombPattern />
      {children}
    </main>
  );
}

function CenteredState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-100 text-yellow-700 shadow-sm">
        <ImageIcon className="h-8 w-8" />
      </div>
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
      <Link href="/vocabulary">Quay lại bộ thẻ</Link>
    </Button>
  );
}

function StudySkeleton() {
  return (
    <StudyShell>
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-yellow-100 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-36 rounded-full bg-yellow-100/70" />
            <Skeleton className="h-10 w-48 rounded-full bg-gray-100" />
            <Skeleton className="h-10 w-24 rounded-full bg-yellow-100/70" />
          </div>
          <Skeleton className="mt-4 h-2 w-full rounded-full bg-yellow-100/70" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <Skeleton className="h-[430px] w-full max-w-[680px] rounded-[2rem] bg-white" />
          <Skeleton className="mt-5 h-5 w-56 bg-gray-100" />
          <Skeleton className="mt-8 h-10 w-96 max-w-full bg-gray-100" />
        </div>
      </div>
    </StudyShell>
  );
}
