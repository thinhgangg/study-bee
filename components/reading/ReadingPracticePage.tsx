"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  BookOpenText,
  Clipboard,
  GripVertical,
  Highlighter,
  Languages,
  Loader2,
  NotebookPen,
  Plus,
  Save,
  Trash2,
  Volume2,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { StudyBeeNavbar } from "@/components/layout/StudyBeeNavbar";
import { HoneycombPattern } from "@/components/ui/honeycomb-pattern";
import { ReadingResultSummary } from "./ReadingResultSummary";
import {
  getReadingPassage,
  startReadingAttempt,
  submitReadingAttempt,
  getReadingAttemptResult,
} from "@/lib/reading";
import type {
  ReadingPassageDetail,
  ReadingQuestionWithOptions,
  ReadingAttemptResult,
  UserReadingAnswer,
  ReadingQuestionAnswer,
  ReadingPassageSection,
} from "@/lib/reading.types";
import { supabase } from "@/lib/supabase";

type Tool = "highlight" | "notes" | "dictionary";

interface Annotation {
  id: string;
  type: "highlight" | "note";
  start: number;
  end: number;
  quote: string;
  note: string;
}

interface SelectionPopup {
  start: number;
  end: number;
  quote: string;
  x: number;
  y: number;
}

interface AnnotationPopup {
  annotationId: string;
  x: number;
  y: number;
}

interface DictionaryEntry {
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  contextMeaning: string;
  example: string;
}

type DictionaryPanelState = DictionaryEntry;

const DICTIONARY: Record<string, Omit<DictionaryEntry, "word">> = {
  flexible: {
    phonetic: "/ˈflek.sə.bəl/",
    partOfSpeech: "adjective",
    meaning: "linh hoạt, dễ thích nghi",
    contextMeaning:
      "Trong bài, flexible mô tả không gian thư viện có thể phục vụ nhiều mục đích khác nhau.",
    example: "A flexible study space can support both groups and individuals.",
  },
  makerspace: {
    phonetic: "/ˈmeɪ.kə.speɪs/",
    partOfSpeech: "noun",
    meaning: "không gian sáng tạo, chế tạo",
    contextMeaning:
      "Một khu vực có công cụ và thiết bị để người dùng thiết kế, sửa chữa hoặc tạo sản phẩm.",
    example: "Students used the makerspace to build a simple robot.",
  },
  isolation: {
    phonetic: "/ˌaɪ.səˈleɪ.ʃən/",
    partOfSpeech: "noun",
    meaning: "sự cô lập, cảm giác tách biệt",
    contextMeaning:
      "Trong ngữ cảnh này, isolation là cảm giác thiếu kết nối xã hội dù sống giữa thành phố đông người.",
    example: "Community activities can reduce social isolation.",
  },
  redesigned: {
    phonetic: "/ˌriː.dɪˈzaɪnd/",
    partOfSpeech: "verb/adjective",
    meaning: "được thiết kế lại",
    contextMeaning:
      "Từ này nói đến các thư viện đã thay đổi cách bố trí và dịch vụ để đáp ứng nhu cầu mới.",
    example: "The redesigned building attracted more visitors.",
  },
};

export function ReadingPracticePage({ slug }: { slug: string }) {
  const router = useRouter();
  const panelsRef = useRef<HTMLDivElement>(null);
  const passageRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef(new Map<string, HTMLDivElement>());
  const [passage, setPassage] = useState<ReadingPassageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [passageWidth, setPassageWidth] = useState(50);
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(
      `studybee:reading:annotations:${slug}`,
    );
    return stored ? (JSON.parse(stored) as Annotation[]) : [];
  });
  const [noteDraft, setNoteDraft] = useState("");
  const [noteComposer, setNoteComposer] = useState<SelectionPopup | null>(null);
  const [annotationPopup, setAnnotationPopup] =
    useState<AnnotationPopup | null>(null);
  const [dictionaryPopup, setDictionaryPopup] =
    useState<DictionaryPanelState | null>(null);
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem("studybee:reading:saved-words");
    return stored ? (JSON.parse(stored) as string[]) : [];
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    correct: number;
    total: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"practice" | "summary" | "review">("practice");
  const [attemptResult, setAttemptResult] = useState<ReadingAttemptResult | null>(null);
  const [selectedQuestionIdForReview, setSelectedQuestionIdForReview] = useState<string | null>(null);
  const [filterIncorrectOnly, setFilterIncorrectOnly] = useState(false);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"passage" | "questions">("passage");

  const userAnswersMap = useMemo(() => {
    if (!attemptResult) return new Map<string, any>();
    const map = new Map<string, any>();
    attemptResult.user_reading_answers.forEach((ans) => {
      map.set(ans.question_id, ans);
    });
    return map;
  }, [attemptResult]);

  const totalQuestions = passage?.reading_questions.length ?? 0;
  const correctCount = result?.correct ?? 0;
  const skippedCount = useMemo(() => {
    if (!attemptResult) return 0;
    return attemptResult.user_reading_answers.filter(
      (ans) => !ans.user_answer || ans.user_answer.trim() === ""
    ).length;
  }, [attemptResult]);
  const incorrectCount = totalQuestions - correctCount - skippedCount;
  const notes = useMemo(
    () => annotations.filter((annotation) => annotation.type === "note"),
    [annotations],
  );

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [nextPassage, sessionResult] = await Promise.all([
          getReadingPassage(slug),
          supabase.auth.getSession(),
        ]);
        if (!active) return;
        setPassage(nextPassage);
        setUserEmail(sessionResult.data.session?.user.email ?? "");
        if (!nextPassage) setError("Không tìm thấy bài Reading này.");
      } catch (err: unknown) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Không thể tải bài đọc.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
          setLoadingAuth(false);
        }
      }
    }

    void load();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? "");
      setLoadingAuth(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [slug]);

  function persistAnnotations(nextAnnotations: Annotation[]) {
    setAnnotations(nextAnnotations);
    window.localStorage.setItem(
      `studybee:reading:annotations:${slug}`,
      JSON.stringify(nextAnnotations),
    );
  }

  function readSelection(): SelectionPopup | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }
    const range = selection.getRangeAt(0);
    if (!passageRef.current?.contains(range.commonAncestorContainer))
      return null;
    const selectedWords = Array.from(
      passageRef.current.querySelectorAll<HTMLElement>("[data-word-index]"),
    ).filter((word) => selection.containsNode(word, true));
    if (selectedWords.length === 0) return null;

    const start = Number(selectedWords[0].dataset.wordIndex);
    const end = Number(
      selectedWords[selectedWords.length - 1].dataset.wordIndex,
    );
    const startWord = passageRef.current.querySelector<HTMLElement>(
      `[data-word-index="${start}"]`,
    );
    const endWord = passageRef.current.querySelector<HTMLElement>(
      `[data-word-index="${end}"]`,
    );
    if (!startWord || !endWord) return null;

    const snappedRange = document.createRange();
    snappedRange.setStartBefore(startWord);
    snappedRange.setEndAfter(endWord);
    selection.removeAllRanges();
    selection.addRange(snappedRange);
    const rect = snappedRange.getBoundingClientRect();

    return {
      start,
      end,
      quote: snappedRange.toString().trim(),
      ...getPopupPosition(rect, 320, 170),
    };
  }

  function addHighlight(selection: SelectionPopup) {
    if (
      annotations.some(
        (annotation) =>
          annotation.type === "highlight" &&
          annotation.start === selection.start &&
          annotation.end === selection.end,
      )
    ) {
      window.getSelection()?.removeAllRanges();
      return;
    }
    persistAnnotations([
      ...annotations,
      {
        id: crypto.randomUUID(),
        type: "highlight",
        start: selection.start,
        end: selection.end,
        quote: selection.quote,
        note: "",
      },
    ]);
    window.getSelection()?.removeAllRanges();
  }

  function openDictionaryForWord(word: string) {
    const key = word.toLowerCase().replace(/[^a-z-]/g, "");
    const known = DICTIONARY[key];
    setDictionaryPopup({
      word,
      phonetic: known?.phonetic ?? "/ pronunciation /",
      partOfSpeech: known?.partOfSpeech ?? "word or phrase",
      meaning: known?.meaning ?? "Nghĩa đang được cập nhật",
      contextMeaning:
        known?.contextMeaning ??
        `“${word}” được dùng trong đoạn văn đang chọn. Phiên bản AI sẽ giải thích sâu hơn theo ngữ cảnh.`,
      example: known?.example ?? `Create your own example with “${word}”.`,
    });
  }

  const keyboardToolsRef = useRef({
    toggle: (tool: Tool) =>
      setActiveTool((current) => (current === tool ? null : tool)),
  });

  useEffect(() => {
    keyboardToolsRef.current = {
      toggle: (tool: Tool) =>
        setActiveTool((current) => (current === tool ? null : tool)),
    };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable=true]")) return;

      if (event.key.toLowerCase() === "h")
        keyboardToolsRef.current.toggle("highlight");
      if (event.key.toLowerCase() === "n")
        keyboardToolsRef.current.toggle("notes");
      if (event.key.toLowerCase() === "t")
        keyboardToolsRef.current.toggle("dictionary");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement;

      if (
        noteComposer &&
        !target.closest('[data-reading-popup="note-composer"]')
      ) {
        setNoteComposer(null);
        setNoteDraft("");
      }

      if (
        annotationPopup &&
        !target.closest('[data-reading-popup="annotation-actions"]')
      ) {
        setAnnotationPopup(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [annotationPopup, noteComposer]);

  function handlePassageMouseUp() {
    if (activeTool === "dictionary") return;
    window.setTimeout(() => {
      const selection = readSelection();
      if (!selection) return;
      if (activeTool === "highlight") addHighlight(selection);
      if (activeTool === "notes") {
        setNoteDraft("");
        setNoteComposer(selection);
      }
    }, 0);
  }

  function handlePassageDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (activeTool !== "highlight") return;
    const wordElement = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-word-index]",
    );
    if (!wordElement) return;
    const index = Number(wordElement.dataset.wordIndex);
    addHighlight({
      start: index,
      end: index,
      quote: wordElement.textContent ?? "",
      ...getPopupPosition(wordElement.getBoundingClientRect(), 320, 170),
    });
  }

  function handlePassageClick(event: React.MouseEvent<HTMLDivElement>) {
    const wordElement = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-word-index]",
    );
    if (!wordElement) return;

    if (activeTool === "dictionary") {
      openDictionaryForWord(
        wordElement.textContent?.replace(/^[^\p{L}]+|[^\p{L}-]+$/gu, "") ?? "",
      );
      return;
    }

    if (activeTool) return;
    const annotationId = wordElement.dataset.annotationId;
    if (!annotationId) return;
    setAnnotationPopup({
      annotationId,
      ...getPopupPosition(wordElement.getBoundingClientRect(), 300, 180),
    });
  }

  function handleDividerPointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    const panels = panelsRef.current;
    if (!panels || window.innerWidth < 1024) return;
    const activePanels = panels;
    event.currentTarget.setPointerCapture(event.pointerId);

    function resize(pointerEvent: PointerEvent) {
      const rect = activePanels.getBoundingClientRect();
      const offset = pointerEvent.clientX - rect.left;
      setPassageWidth(Math.min(70, Math.max(30, (offset / rect.width) * 100)));
    }

    function stop() {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stop);
    }

    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stop);
  }

  async function chooseAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    if (!attemptId && userEmail && passage) {
      try {
        setAttemptId(await startReadingAttempt(passage.id));
      } catch {
        // Answering remains available if attempt creation is temporarily unavailable.
      }
    }
  }

  function addNote() {
    if (!noteComposer || !noteDraft.trim()) return;
    persistAnnotations([
      ...annotations,
      {
        id: crypto.randomUUID(),
        type: "note",
        start: noteComposer.start,
        end: noteComposer.end,
        quote: noteComposer.quote,
        note: noteDraft.trim(),
      },
    ]);
    setNoteDraft("");
    setNoteComposer(null);
    window.getSelection()?.removeAllRanges();
  }

  function removeNote(id: string) {
    persistAnnotations(
      annotations.filter((annotation) => annotation.id !== id),
    );
    setAnnotationPopup(null);
  }

  function removeAllHighlights() {
    persistAnnotations(
      annotations.filter((annotation) => annotation.type !== "highlight"),
    );
    setAnnotationPopup(null);
  }

  function addNoteToAnnotation(annotation: Annotation) {
    const word = passageRef.current?.querySelector<HTMLElement>(
      `[data-word-index="${annotation.start}"]`,
    );
    if (!word) return;
    setNoteDraft("");
    setNoteComposer({
      start: annotation.start,
      end: annotation.end,
      quote: annotation.quote,
      ...getPopupPosition(word.getBoundingClientRect(), 320, 170),
    });
    setAnnotationPopup(null);
  }

  function saveDictionaryWord() {
    if (!dictionaryPopup) return;
    const nextWords = [...new Set([...savedWords, dictionaryPopup.word])];
    setSavedWords(nextWords);
    window.localStorage.setItem(
      "studybee:reading:saved-words",
      JSON.stringify(nextWords),
    );
  }

  async function handleSubmit() {
    if (!passage) return;
    if (!userEmail) {
      router.push(`/login?next=/reading/${slug}`);
      return;
    }
    // Allow submission if at least one question is answered
    if (Object.keys(answers).length === 0) return;

    setSubmitting(true);
    try {
      const currentAttemptId =
        attemptId ?? (await startReadingAttempt(passage.id));
      setAttemptId(currentAttemptId);
      const attempt = await submitReadingAttempt(
        currentAttemptId,
        passage.reading_questions.map((question) => ({
          questionId: question.id,
          answer: answers[question.id] || "",
        })),
      );

      // Fetch the full detailed attempt result
      const detailedResult = await getReadingAttemptResult(currentAttemptId);
      setAttemptResult(detailedResult);

      setResult({
        correct: attempt.correct_count,
        total: attempt.total_questions,
      });
      setViewMode("summary");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể nộp bài.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTryAgain() {
    setAnswers({});
    setAttemptId(null);
    setResult(null);
    setAttemptResult(null);
    setViewMode("practice");
    setSelectedQuestionIdForReview(null);
    setHighlightedSectionId(null);
  }

  function handleLocateEvidence(explanation: string | null) {
    if (!passage) return;
    const sectionId = findEvidenceSection(explanation, passage.reading_passage_sections);
    if (sectionId) {
      setHighlightedSectionId(sectionId);
      // Auto-switch to passage tab on mobile
      setMobileTab("passage");

      window.setTimeout(() => {
        const sectionEl = passageRef.current?.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionEl) {
          sectionEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 50);

      // Pulse highlight effect for 4 seconds
      window.setTimeout(() => {
        setHighlightedSectionId((curr) => curr === sectionId ? null : curr);
      }, 4000);
    }
  }

  const answeredCount = Object.keys(answers).length;

  if (loading) return <PracticeLoading />;

  if (!passage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FFFBEB] px-5">
        <div className="rounded-3xl border border-yellow-100 bg-white p-8 text-center shadow-lg">
          <BookOpenText className="mx-auto h-10 w-10 text-yellow-600" />
          <h1 className="mt-4 font-heading text-2xl font-bold">
            Không thể mở bài đọc
          </h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <Link
            href="/reading"
            className="mt-5 inline-flex rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-yellow-300"
          >
            Quay lại danh sách
          </Link>
        </div>
      </main>
    );
  }

  if (viewMode === "summary" && attemptResult) {
    return (
      <ReadingResultSummary
        result={attemptResult}
        passage={passage}
        onReview={() => setViewMode("review")}
        onTryAgain={handleTryAgain}
      />
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#FFFBEB] text-gray-900">
      <HoneycombPattern />
      <StudyBeeNavbar
        userEmail={userEmail}
        loadingAuth={loadingAuth}
        showAuthActions
        onSignOut={async () => {
          await supabase.auth.signOut();
          router.push("/reading");
        }}
      />

      <div className="fixed inset-x-0 bottom-16 top-16 z-10 flex flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-yellow-100 bg-white/95 px-4 backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => {
                if (viewMode === "review") {
                  setViewMode("summary");
                } else {
                  router.push("/reading");
                }
              }}
              aria-label="Quay lại"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-yellow-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{passage.title}</p>
              <p className="text-[11px] text-gray-400">
                Passage {passage.passage_number ?? 1} · Band{" "}
                {Number(passage.difficulty).toFixed(1)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNotesOpen((current) => !current)}
            className="flex items-center gap-2 rounded-full border border-yellow-100 px-3 py-1.5 text-xs font-bold hover:bg-yellow-50"
          >
            <NotebookPen className="h-4 w-4 text-yellow-600" />{" "}
            {notesOpen ? "Ẩn note" : "Xem note"} ({notes.length})
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          <ToolSidebar
            activeTool={activeTool}
            onToggle={(tool) =>
              setActiveTool((current) => (current === tool ? null : tool))
            }
          />

          <div
            ref={panelsRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row"
          >
            {/* Mobile Tab Navigation segmented selector */}
            <div className="flex h-12 shrink-0 items-center justify-center border-b border-yellow-100 bg-white px-4 lg:hidden">
              <div className="flex w-full max-w-sm rounded-xl bg-amber-50 p-1 border border-amber-100/50">
                <button
                  type="button"
                  onClick={() => setMobileTab("passage")}
                  className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all ${
                    mobileTab === "passage"
                      ? "bg-white text-gray-900 shadow-sm border border-amber-100"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  📖 Bài đọc
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab("questions")}
                  className={`flex-1 rounded-lg py-1.5 text-center text-xs font-bold transition-all ${
                    mobileTab === "questions"
                      ? "bg-white text-gray-900 shadow-sm border border-amber-100"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  ✍️ Câu hỏi ({answeredCount}/{totalQuestions})
                </button>
              </div>
            </div>

            <section
              className={`flex min-h-0 flex-col border-b border-amber-100 bg-[rgb(255,250,246)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:border-b-0 ${
                mobileTab === "passage" ? "flex" : "hidden lg:flex"
              }`}
              style={{ "--passage-width": `${passageWidth}%` } as CSSProperties}
            >
              <div
                ref={passageRef}
                onMouseUp={handlePassageMouseUp}
                onDoubleClick={handlePassageDoubleClick}
                onClick={handlePassageClick}
                className={`reading-scrollbar mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:px-12 ${
                  activeTool === "highlight"
                    ? "cursor-text"
                    : activeTool === "notes"
                      ? "cursor-text"
                      : activeTool === "dictionary"
                        ? "reading-dictionary-mode cursor-pointer"
                        : "cursor-text"
                }`}
              >
                <div className="mb-8">
                  <h1 className="font-heading text-xl font-bold">
                    Reading passage {passage.passage_number ?? 1}
                  </h1>
                  <p className="mt-2 text-[15px] leading-7 text-gray-700">
                    You should spend about 20 minutes on questions 1 -{" "}
                    {passage.reading_questions.length} which are based on
                    Reading Passage {passage.passage_number ?? 1} below.
                  </p>
                  <h2 className="mt-7 text-center font-heading text-2xl font-bold sm:text-3xl">
                    {passage.title}
                  </h2>
                </div>
                <div className="space-y-5 text-[15px] leading-7 text-gray-700 selection:bg-yellow-200 selection:text-gray-900">
                  <PassageContent 
                    passage={passage} 
                    annotations={annotations} 
                    highlightedSectionId={highlightedSectionId} 
                  />
                </div>
              </div>

              {dictionaryPopup && (
                <DictionaryPanel
                  entry={dictionaryPopup}
                  saved={savedWords.includes(dictionaryPopup.word)}
                  onClose={() => setDictionaryPopup(null)}
                  onSave={saveDictionaryWord}
                />
              )}
            </section>

            <button
              type="button"
              aria-label="Kéo để thay đổi độ rộng hai panel"
              onPointerDown={handleDividerPointerDown}
              className="group relative hidden w-4 shrink-0 touch-none cursor-ew-resize items-center justify-center bg-[rgb(255,250,246)] lg:flex"
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-amber-200 transition-all duration-300 group-hover:w-0.5 group-hover:bg-amber-300" />
              <span className="relative z-10 flex h-10 w-4 items-center justify-center rounded-full border border-amber-200 bg-white shadow-sm transition-colors duration-300 group-hover:border-amber-300 group-hover:bg-amber-50">
                <GripVertical className="h-5 w-5 text-amber-500" />
              </span>
            </button>

            <section
              className={`reading-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto bg-[rgb(255,250,246)] transition-[flex-basis,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mobileTab === "questions" ? "block" : "hidden lg:block"
              }`}
            >
              <div className="mx-auto max-w-3xl px-6 py-8 sm:px-9">
                <p className="text-xs font-bold uppercase tracking-wider text-yellow-700">
                  Questions 1–{passage.reading_questions.length}
                </p>
                <h2 className="mt-2 font-heading text-2xl font-bold">
                  {viewMode === "review" ? "Xem lại bài làm" : "Choose the correct answer"}
                </h2>
                
                <div className="mt-2 text-sm text-gray-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-4">
                  <span>
                    {viewMode === "review" 
                      ? "Phân tích câu trả lời và cách giải chi tiết." 
                      : "Chọn một đáp án cho mỗi câu hỏi."}
                  </span>
                  
                  {/* Review Mode Filter Tabs */}
                  {viewMode === "review" && (
                    <div className="flex gap-1.5 rounded-xl bg-amber-50 border border-amber-100 p-1 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setFilterIncorrectOnly(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          !filterIncorrectOnly 
                            ? "bg-white text-gray-900 shadow-sm border border-amber-100" 
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        Tất cả ({totalQuestions})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterIncorrectOnly(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          filterIncorrectOnly 
                            ? "bg-white text-rose-600 shadow-sm border border-amber-100" 
                            : "text-gray-500 hover:text-rose-600"
                        }`}
                      >
                        Sai/Bỏ qua ({incorrectCount + skippedCount})
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-7 space-y-6">
                  {viewMode === "review"
                    ? passage.reading_questions
                        .filter((q) => {
                          if (!filterIncorrectOnly) return true;
                          const ansObj = userAnswersMap.get(q.id);
                          return !ansObj || !ansObj.is_correct;
                        })
                        .map((question, index) => {
                          const number = passage.reading_questions.findIndex((q) => q.id === question.id) + 1;
                          const ansObj = userAnswersMap.get(question.id);
                          return (
                            <ReviewQuestionCard
                              key={question.id}
                              question={question}
                              number={number}
                              userAnswerObj={ansObj}
                              onLocate={handleLocateEvidence}
                              refCallback={(node) => {
                                if (node) questionRefs.current.set(question.id, node);
                              }}
                            />
                          );
                        })
                    : passage.reading_questions.map((question, index) => (
                        <QuestionCard
                          key={question.id}
                          question={question}
                          number={index + 1}
                          answer={answers[question.id]}
                          onAnswer={(value) =>
                            void chooseAnswer(question.id, value)
                          }
                          refCallback={(node) => {
                            if (node) questionRefs.current.set(question.id, node);
                          }}
                        />
                      ))}
                </div>
              </div>
            </section>
          </div>

          <div
            className={`absolute inset-y-0 right-0 z-30 overflow-hidden transition-[width,opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:relative lg:z-auto lg:shrink-0 ${
              notesOpen
                ? "w-[min(340px,92vw)] translate-x-0 opacity-100 lg:w-80"
                : "pointer-events-none w-0 translate-x-8 opacity-0"
            }`}
          >
            <NotesPanel
              notes={notes}
              onRemove={removeNote}
              onClose={() => setNotesOpen(false)}
            />
          </div>
        </div>
      </div>

      <QuestionNavigator
        questions={passage.reading_questions}
        answers={answers}
        answeredCount={answeredCount}
        submitting={submitting}
        result={result}
        viewMode={viewMode}
        userAnswersMap={userAnswersMap}
        onQuestion={(questionId) => {
          if (viewMode === "review" && filterIncorrectOnly) {
            const ansObj = userAnswersMap.get(questionId);
            if (ansObj && ansObj.is_correct) {
              setFilterIncorrectOnly(false);
            }
          }
          setMobileTab("questions");
          window.setTimeout(() => {
            questionRefs.current
              .get(questionId)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 50);
        }}
        onSubmit={() => void handleSubmit()}
        onBackToSummary={() => setViewMode("summary")}
      />

      {noteComposer && (
        <NoteComposerPopup
          selection={noteComposer}
          value={noteDraft}
          onChange={setNoteDraft}
          onSave={addNote}
          onClose={() => setNoteComposer(null)}
        />
      )}

      {annotationPopup &&
        (() => {
          const annotation = annotations.find(
            (item) => item.id === annotationPopup.annotationId,
          );
          return annotation ? (
            <AnnotationActionsPopup
              annotation={annotation}
              position={annotationPopup}
              onAddNote={() => addNoteToAnnotation(annotation)}
              onDelete={() => removeNote(annotation.id)}
              onDeleteAll={removeAllHighlights}
              onClose={() => setAnnotationPopup(null)}
            />
          ) : null;
        })()}

      <style jsx global>{`
        .reading-dictionary-mode [data-word-index]:hover {
          text-decoration: underline;
          text-decoration-color: #ca8a04;
          text-decoration-thickness: 2px;
          text-underline-offset: 3px;
        }
        .reading-scrollbar {
          scrollbar-color: #d8bd72 transparent;
          scrollbar-width: thin;
        }
        .reading-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .reading-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .reading-scrollbar::-webkit-scrollbar-thumb {
          border-radius: 9999px;
          background: #d8bd72;
        }
        .reading-scrollbar::-webkit-scrollbar-button {
          display: none;
          width: 0;
          height: 0;
        }
        @media (min-width: 1024px) {
          section[style*="--passage-width"] {
            width: var(--passage-width);
            flex: none;
          }
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.005); }
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s infinite ease-in-out;
        }
      `}</style>
    </main>
  );
}

function PassageContent({
  passage,
  annotations,
  highlightedSectionId,
}: {
  passage: ReadingPassageDetail;
  annotations: Annotation[];
  highlightedSectionId?: string | null;
}) {
  let wordIndex = -1;

  return passage.reading_passage_sections.map((section) => (
    <p key={section.id} data-section-id={section.id}>
      <strong className="mr-1 text-gray-900">{section.label}.</strong>
      {Array.from(section.content.matchAll(/\S+\s*/g)).map(
        ([token], tokenIndex) => {
          wordIndex += 1;
          const currentIndex = wordIndex;
          const matching = [...annotations]
            .reverse()
            .find(
              (annotation) =>
                currentIndex >= annotation.start &&
                currentIndex <= annotation.end,
            );

          return (
            <span
              key={`${section.id}-${tokenIndex}`}
              data-word-index={currentIndex}
              data-annotation-id={matching?.id}
              className={
                matching?.type === "note"
                  ? "bg-yellow-100 underline decoration-yellow-600 decoration-dotted decoration-2 underline-offset-4"
                  : matching?.type === "highlight"
                    ? "bg-yellow-200"
                    : undefined
              }
            >
              {token}
            </span>
          );
        },
      )}
    </p>
  ));
}

function ToolSidebar({
  activeTool,
  onToggle,
}: {
  activeTool: Tool | null;
  onToggle: (tool: Tool) => void;
}) {
  const tools = [
    {
      id: "highlight" as const,
      label: "Highlight",
      shortcut: "H",
      icon: Highlighter,
    },
    { id: "notes" as const, label: "Notes", shortcut: "N", icon: NotebookPen },
    {
      id: "dictionary" as const,
      label: "Tra từ vựng",
      shortcut: "T",
      icon: Languages,
    },
  ];

  return (
    <aside className="flex shrink-0 items-center justify-center gap-2 border-b border-yellow-100 bg-white/95 p-2 backdrop-blur-sm lg:w-[100px] lg:flex-col lg:border-b-0 lg:border-r lg:py-4">
      {tools.map(({ id, label, shortcut, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onToggle(id)}
          title={`${label} (${shortcut})`}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-[12px] font-bold leading-tight transition-colors duration-300 lg:h-20 lg:w-[90px] lg:flex-none lg:flex-col lg:gap-1.5 ${activeTool === id ? "border-2 border-amber-300 bg-amber-200 text-amber-950 shadow-sm shadow-amber-100" : "border-2 border-amber-100 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-gray-900"}`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap text-center">{label}</span>
          <kbd className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-[9px] text-gray-400 shadow-sm">
            {shortcut}
          </kbd>
        </button>
      ))}
    </aside>
  );
}

function QuestionCard({
  question,
  number,
  answer,
  onAnswer,
  refCallback,
}: {
  question: ReadingQuestionWithOptions;
  number: number;
  answer?: string;
  onAnswer: (value: string) => void;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={refCallback} className="scroll-mt-24">
      <div className="flex gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors duration-300 ${answer ? "bg-amber-200 text-amber-950" : "bg-amber-50 text-amber-800"}`}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="pt-1 text-sm font-semibold leading-6 text-gray-800">
            {question.prompt}
          </p>
          <div className="mt-3 space-y-2">
            {question.reading_question_options.map((option) => (
              <label
                key={option.id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors duration-300 ${answer === option.option_key ? "border-amber-300 bg-amber-50/80 shadow-sm" : "border-gray-200 hover:border-amber-200 hover:bg-amber-50/40"}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.option_key}
                  checked={answer === option.option_key}
                  onChange={() => onAnswer(option.option_key)}
                  className="mt-0.5 h-4 w-4 accent-yellow-500"
                />
                <span>
                  <strong className="mr-2">{option.option_key}</strong>
                  {option.option_text !== option.option_key &&
                    option.option_text}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesPanel({
  notes,
  onRemove,
  onClose,
}: {
  notes: Annotation[];
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <aside className="flex h-full w-[min(340px,92vw)] flex-col border-l border-amber-100 bg-white/95 shadow-2xl backdrop-blur-sm lg:w-80 lg:shadow-none">
      <div className="flex items-center justify-between border-b border-yellow-100 px-4 py-3">
        <div>
          <p className="font-heading font-bold">Notes</p>
          <p className="text-[11px] text-gray-400">Lưu ý theo đoạn đang đọc</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng notes"
          className="rounded-full p-2 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="reading-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
        {notes.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            <NotebookPen className="mx-auto mb-2 h-7 w-7" />
            Chưa có ghi chú
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-2xl border border-yellow-200 bg-[#FFFEF8] p-3"
            >
              {note.quote && (
                <p className="line-clamp-3 text-xs italic leading-5 text-gray-500">
                  “{note.quote}”
                </p>
              )}
              {note.note && (
                <p className="mt-2 text-sm leading-5 text-gray-800">
                  {note.note}
                </p>
              )}
              <button
                type="button"
                onClick={() => onRemove(note.id)}
                className="mt-2 flex items-center gap-1 text-[11px] font-bold text-rose-500"
              >
                <Trash2 className="h-3 w-3" /> Xóa
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function NoteComposerPopup({
  selection,
  value,
  onChange,
  onSave,
  onClose,
}: {
  selection: SelectionPopup;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-reading-popup="note-composer"
      className="fixed z-[85] w-[min(320px,calc(100vw-24px))] rounded-2xl border border-yellow-200 bg-white p-3 shadow-2xl shadow-yellow-100/70"
      style={{ left: selection.x, top: selection.y }}
    >
      <div className="flex items-start justify-between gap-3">
        <blockquote className="line-clamp-2 border-l-2 border-yellow-400 pl-2 text-xs italic leading-5 text-gray-500">
          “{selection.quote}”
        </blockquote>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full p-1 hover:bg-gray-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSave();
          }
        }}
        placeholder="Nhập ghi chú, nhấn Enter để lưu..."
        className="mt-3 min-h-20 w-full resize-none rounded-xl border border-yellow-100 bg-[#FFFEF8] p-3 text-sm outline-none focus:border-yellow-300 focus:ring-4 focus:ring-yellow-100"
      />
      <button
        type="button"
        onClick={onSave}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-xs font-bold text-yellow-300"
      >
        <Plus className="h-3.5 w-3.5" />
        Lưu note
      </button>
    </div>
  );
}

function AnnotationActionsPopup({
  annotation,
  position,
  onAddNote,
  onDelete,
  onDeleteAll,
  onClose,
}: {
  annotation: Annotation;
  position: AnnotationPopup;
  onAddNote: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-reading-popup="annotation-actions"
      className="fixed z-[85] w-[min(300px,calc(100vw-24px))] rounded-2xl border border-yellow-200 bg-white p-3 shadow-2xl"
      style={{ left: position.x, top: position.y }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-900">
            {annotation.type === "note" ? "Ghi chú" : "Đoạn đã highlight"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs italic leading-5 text-gray-500">
            “{annotation.quote}”
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 hover:bg-gray-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {annotation.note && (
        <p className="mt-3 rounded-xl border border-yellow-100 bg-yellow-50 p-3 text-sm leading-5 text-gray-700">
          {annotation.note}
        </p>
      )}
      <div className="mt-3 grid gap-2">
        {annotation.type === "highlight" && (
          <button
            type="button"
            onClick={onAddNote}
            className="flex items-center justify-center gap-2 rounded-full bg-yellow-100 px-3 py-2 text-xs font-bold text-yellow-800"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Thêm note
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center justify-center gap-2 rounded-full border border-rose-100 px-3 py-2 text-xs font-bold text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Xóa {annotation.type === "note" ? "note" : "highlight"}
        </button>
        <button
          type="button"
          onClick={onDeleteAll}
          className="rounded-full px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
        >
          Xóa tất cả highlight
        </button>
      </div>
    </div>
  );
}

function DictionaryPanel({
  entry,
  saved,
  onClose,
  onSave,
}: {
  entry: DictionaryPanelState;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  function pronounce() {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(entry.word));
  }

  return (
    <div className="reading-scrollbar max-h-[46%] shrink-0 overflow-y-auto border-t border-amber-200 bg-white shadow-[0_-8px_24px_rgba(180,140,45,0.07)]">
      <div className="flex items-start justify-between border-b border-yellow-100 bg-yellow-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={pronounce}
            aria-label="Phát âm"
            className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-yellow-700 shadow-sm"
          >
            <Volume2 className="h-4 w-4" />
          </button>
          <div>
            <h3 className="font-heading text-xl font-bold">{entry.word}</h3>
            <p className="text-xs text-gray-500">
              {entry.phonetic} · {entry.partOfSpeech}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 hover:bg-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 p-4 text-sm">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Nghĩa tiếng Việt
          </p>
          <p className="mt-1 font-bold text-gray-900">{entry.meaning}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Trong ngữ cảnh
          </p>
          <p className="mt-1 leading-6 text-gray-600">{entry.contextMeaning}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Ví dụ thêm
          </p>
          <p className="mt-1 italic leading-5 text-gray-600">{entry.example}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSave}
            className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${saved ? "bg-emerald-100 text-emerald-700" : "bg-gray-900 text-yellow-300"}`}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Đã lưu" : "Lưu từ vựng"}
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(entry.word)}
            className="flex items-center justify-center gap-2 rounded-full border border-gray-200 px-3 py-2 text-xs font-bold hover:bg-gray-50"
          >
            <Clipboard className="h-3.5 w-3.5" />
            Sao chép
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">
        Explained by <strong className="text-yellow-700">StudyBee</strong>
      </div>
    </div>
  );
}

function QuestionNavigator({
  questions,
  answers,
  answeredCount,
  submitting,
  result,
  viewMode,
  userAnswersMap,
  onQuestion,
  onSubmit,
  onBackToSummary,
}: {
  questions: ReadingQuestionWithOptions[];
  answers: Record<string, string>;
  answeredCount: number;
  submitting: boolean;
  result: { correct: number; total: number } | null;
  viewMode: "practice" | "review" | "summary";
  userAnswersMap?: Map<string, UserReadingAnswer>;
  onQuestion: (id: string) => void;
  onSubmit: () => void;
  onBackToSummary?: () => void;
}) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center border-t border-yellow-100 bg-white/95 px-3 backdrop-blur sm:px-5">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
          {questions.map((question, index) => {
            let btnStyle = "border-gray-200 bg-white text-gray-500 hover:border-amber-200 hover:bg-amber-50";
            if (viewMode === "review" && userAnswersMap) {
              const ansObj = userAnswersMap.get(question.id);
              if (ansObj) {
                if (ansObj.is_correct) {
                  btnStyle = "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200/60";
                } else if (!ansObj.user_answer || ansObj.user_answer.trim() === "") {
                  btnStyle = "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200/60";
                } else {
                  btnStyle = "border-rose-200 bg-rose-100 text-rose-800 hover:bg-rose-200/60";
                }
              }
            } else if (answers[question.id]) {
              btnStyle = "border-amber-200 bg-amber-200 text-amber-950";
            }

            return (
              <button
                key={question.id}
                type="button"
                onClick={() => onQuestion(question.id)}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors duration-300 ${btnStyle}`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
        
        {viewMode === "review" ? (
          <button
            type="button"
            onClick={onBackToSummary}
            className="flex shrink-0 items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-yellow-300 hover:bg-gray-800 transition-colors"
          >
            Quay lại Bảng điểm
          </button>
        ) : result ? (
          <div className="shrink-0 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
            {result.correct}/{result.total} đúng
          </div>
        ) : (
          <button
            type="button"
            disabled={answeredCount === 0 || submitting}
            onClick={onSubmit}
            className="flex shrink-0 items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-yellow-300 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
          >
            Nộp bài{" "}
            <span className="hidden sm:inline">
              ({answeredCount}/{questions.length})
            </span>
          </button>
        )}
      </div>
    </footer>
  );
}

function PracticeLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFFBEB]">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-yellow-600" />
        <p className="mt-3 text-sm font-semibold text-gray-500">
          Đang mở bài Reading...
        </p>
      </div>
    </main>
  );
}

function getPopupPosition(
  rect: DOMRect,
  preferredWidth: number,
  preferredHeight: number,
) {
  const width = Math.min(preferredWidth, window.innerWidth - 24);
  const x = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const y =
    rect.bottom + preferredHeight + 20 < window.innerHeight
      ? rect.bottom + 10
      : Math.max(76, rect.top - preferredHeight - 10);
  return { x, y };
}

function findEvidenceSection(
  explanation: string | null,
  sections: ReadingPassageSection[]
): string | null {
  if (!explanation) return null;
  const normalized = explanation.toLowerCase();
  
  for (const sec of sections) {
    const label = sec.label.toLowerCase();
    const patterns = [
      `paragraph ${label}`,
      `đoạn ${label}`,
      `đoạn văn ${label}`,
      `bước ${label}`,
      `section ${label}`
    ];
    if (patterns.some(pattern => normalized.includes(pattern))) {
      return sec.id;
    }
  }
  
  const paragraphMatch = normalized.match(/(paragraph|đoạn|section)\s+([a-g])/i);
  if (paragraphMatch && paragraphMatch[2]) {
    const targetLabel = paragraphMatch[2].toUpperCase();
    const matchedSec = sections.find(s => s.label.toUpperCase() === targetLabel);
    if (matchedSec) return matchedSec.id;
  }
  return null;
}

function parseExplanationSteps(explanation: string | null) {
  if (!explanation) return [];
  const stepRegex = /(Bước\s+\d+|Step\s+\d+):/gi;
  const parts = explanation.split(stepRegex);
  if (parts.length > 1) {
    const steps: { title: string; content: string }[] = [];
    for (let i = 1; i < parts.length; i += 2) {
      const title = parts[i].trim();
      const content = parts[i + 1]?.trim() || "";
      if (content) {
        steps.push({ title, content });
      }
    }
    return steps;
  }
  return explanation.split(/\n+/).map((line, idx) => ({
    title: `Phân tích ${idx + 1}`,
    content: line.trim()
  })).filter(s => s.content.length > 0);
}

function ReviewQuestionCard({
  question,
  number,
  userAnswerObj,
  onLocate,
  refCallback,
}: {
  question: ReadingQuestionWithOptions;
  number: number;
  userAnswerObj?: UserReadingAnswer & {
    reading_questions: {
      explanation: string | null;
      reading_question_answers: ReadingQuestionAnswer[];
    };
  };
  onLocate: (explanation: string | null) => void;
  refCallback: (node: HTMLDivElement | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const userAnswer = userAnswerObj?.user_answer ?? "";
  const isCorrect = userAnswerObj?.is_correct ?? false;
  const isSkipped = !userAnswer || userAnswer.trim() === "";
  
  const correctAnswer = userAnswerObj?.reading_questions?.reading_question_answers?.[0]?.answer_text ?? "";

  const steps = useMemo(() => {
    return parseExplanationSteps(userAnswerObj?.reading_questions?.explanation || question.explanation);
  }, [userAnswerObj, question]);

  return (
    <div ref={refCallback} className="scroll-mt-24 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        {isCorrect ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
            {number}
          </span>
        ) : isSkipped ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm font-bold">
            {number}
          </span>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-sm font-bold">
            {number}
          </span>
        )}
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Câu {number}
            </span>
            {isCorrect ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <CheckCircle2 className="w-3 h-3 shrink-0" /> Đúng rồi! 🍯
              </span>
            ) : isSkipped ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
                <HelpCircle className="w-3 h-3 shrink-0" /> Chưa làm 💤
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                <XCircle className="w-3 h-3 shrink-0" /> Sai rồi 🐝
              </span>
            )}
          </div>
          
          <p className="mt-2 text-sm font-semibold leading-6 text-gray-800">
            {question.prompt}
          </p>
          
          <div className="mt-3 space-y-2">
            {question.reading_question_options.map((option) => {
              const isOptionCorrect = option.option_key === correctAnswer;
              const isOptionSelected = option.option_key === userAnswer;
              
              let borderStyle = "border-gray-200 bg-white text-gray-700";
              let badge = null;
              
              if (isOptionCorrect) {
                borderStyle = "border-emerald-300 bg-emerald-50/50 text-emerald-950 font-medium";
                badge = (
                  <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-xs font-black text-emerald-600">
                    ✓
                  </span>
                );
              } else if (isOptionSelected && !isCorrect) {
                borderStyle = "border-rose-300 bg-rose-50/40 text-rose-950";
                badge = (
                  <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-white text-xs font-black text-rose-600">
                    X
                  </span>
                );
              }
              
              return (
                <div
                  key={option.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${borderStyle}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      disabled
                      checked={isOptionSelected}
                      className={`mt-0.5 h-4 w-4 shrink-0 ${isOptionCorrect ? "accent-emerald-500" : "accent-rose-500"}`}
                    />
                    <span>
                      <strong className="mr-2">{option.option_key}</strong>
                      {option.option_text !== option.option_key && option.option_text}
                    </span>
                  </div>
                  {badge}
                </div>
              );
            })}
          </div>
          
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition-all"
              >
                Giải thích của StudyBee 📖
                {isOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
              
              <button
                type="button"
                onClick={() => onLocate(userAnswerObj?.reading_questions?.explanation || question.explanation)}
                className="flex items-center gap-1.5 text-xs font-bold text-yellow-700 hover:text-yellow-900 bg-yellow-50 hover:bg-yellow-100 border border-yellow-100 px-3.5 py-2 rounded-xl transition-all"
              >
                Xem vị trí bài đọc 🔍
              </button>
            </div>
            
            {isOpen && (
              <div className="mt-3 bg-[#FFFDF7] border border-yellow-100 rounded-2xl p-4 text-sm text-gray-700 space-y-3 animate-scale-up">
                <div className="flex items-center gap-1.5 border-b border-yellow-50 pb-2 mb-2">
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                  <span className="font-bold text-xs text-yellow-800 uppercase tracking-wide">
                    Hướng dẫn giải chi tiết
                  </span>
                </div>
                {steps.map((step, idx) => (
                  <div key={idx} className="space-y-1">
                    <h5 className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                      <span className="inline-flex w-1.5 h-1.5 rounded-full bg-yellow-400" />
                      {step.title}
                    </h5>
                    <p className="pl-3 text-xs leading-5 text-gray-600 whitespace-pre-line">
                      {step.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
