import { supabase } from "@/lib/supabase";
import type {
  ReadingAttemptResult,
  ReadingFilters,
  ReadingListFilters,
  ReadingPassageDetail,
  ReadingPassageListItem,
  ReadingPracticeListItem,
  ReadingSubmissionAnswer,
  UserReadingAttempt,
} from "@/lib/reading.types";

interface FullTestQueryRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  topic: string;
  difficulty: number | string;
  estimated_time: number;
  published_at: string | null;
  reading_test_passages: Array<{
    passage_number: number;
    reading_passages: Array<{
      reading_questions: Array<{ count: number }>;
    }>;
  }>;
}

export async function getReadingPracticeList(
  filters: ReadingListFilters = {},
): Promise<ReadingPracticeListItem[]> {
  const includeSingles = !filters.kind || filters.kind === "all" || filters.kind === "single";
  const includeTests = !filters.kind || filters.kind === "all" || filters.kind === "full_test";

  const singlesPromise = includeSingles
    ? getStandalonePassages(filters)
    : Promise.resolve([]);
  const testsPromise = includeTests
    ? getFullReadingTests(filters)
    : Promise.resolve([]);
  const [singles, tests] = await Promise.all([singlesPromise, testsPromise]);

  return [...singles, ...tests].sort((left, right) =>
    (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
  );
}

async function getStandalonePassages(
  filters: ReadingListFilters,
): Promise<ReadingPracticeListItem[]> {
  let query = supabase
    .from("reading_passages")
    .select(
      "id,title,slug,topic,difficulty,estimated_time,passage_number,published_at,reading_questions(count)",
    )
    .eq("is_standalone", true)
    .order("published_at", { ascending: false });

  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim()}%`);
  if (filters.topic && filters.topic !== "all") query = query.eq("topic", filters.topic);
  if (filters.difficulty !== undefined) query = query.eq("difficulty", filters.difficulty);
  if (filters.passageNumber && filters.passageNumber !== "all") {
    query = query.eq("passage_number", filters.passageNumber);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((passage) => ({
    id: passage.id,
    kind: "single" as const,
    title: passage.title,
    slug: passage.slug,
    description: null,
    topic: passage.topic,
    difficulty: Number(passage.difficulty),
    estimatedTime: passage.estimated_time,
    questionCount: passage.reading_questions[0]?.count ?? 0,
    passageNumber: passage.passage_number as 1 | 2 | 3 | null,
    passageCount: 1,
    publishedAt: passage.published_at,
  }));
}

async function getFullReadingTests(
  filters: ReadingListFilters,
): Promise<ReadingPracticeListItem[]> {
  let query = supabase
    .from("reading_tests")
    .select(
      `
        id,title,slug,description,topic,difficulty,estimated_time,published_at,
        reading_test_passages(
          passage_number,
          reading_passages(reading_questions(count))
        )
      `,
    )
    .order("published_at", { ascending: false });

  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim()}%`);
  if (filters.topic && filters.topic !== "all") query = query.eq("topic", filters.topic);
  if (filters.difficulty !== undefined) query = query.eq("difficulty", filters.difficulty);

  const { data, error } = await query;
  if (error) throw error;

  return ((data ?? []) as unknown as FullTestQueryRow[]).map((test) => ({
    id: test.id,
    kind: "full_test" as const,
    title: test.title,
    slug: test.slug,
    description: test.description,
    topic: test.topic,
    difficulty: Number(test.difficulty),
    estimatedTime: test.estimated_time,
    questionCount: test.reading_test_passages.reduce(
      (total, item) =>
        total + (item.reading_passages[0]?.reading_questions[0]?.count ?? 0),
      0,
    ),
    passageNumber: null,
    passageCount: test.reading_test_passages.length,
    publishedAt: test.published_at,
  }));
}

export async function getReadingPassages(
  filters: ReadingFilters = {},
): Promise<ReadingPassageListItem[]> {
  let query = supabase
    .from("reading_passages")
    .select(
      "id,title,slug,topic,difficulty,estimated_time,reading_questions(count)",
    )
    .order("published_at", { ascending: false });

  if (filters.search?.trim()) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }

  if (filters.topic) {
    query = query.eq("topic", filters.topic);
  }

  if (filters.difficulty !== undefined) {
    query = query.eq("difficulty", filters.difficulty);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((passage) => ({
    id: passage.id,
    title: passage.title,
    slug: passage.slug,
    topic: passage.topic,
    difficulty: Number(passage.difficulty),
    estimated_time: passage.estimated_time,
    question_count: passage.reading_questions[0]?.count ?? 0,
  }));
}

export async function getReadingPassage(
  slug: string,
): Promise<ReadingPassageDetail | null> {
  const { data, error } = await supabase
    .from("reading_passages")
    .select(
      `
        *,
        reading_passage_sections(*),
        reading_questions(
          *,
          reading_question_options(*)
        )
      `,
    )
    .eq("slug", slug)
    .order("order_index", {
      referencedTable: "reading_passage_sections",
      ascending: true,
    })
    .order("order_index", {
      referencedTable: "reading_questions",
      ascending: true,
    })
    .order("order_index", {
      referencedTable: "reading_questions.reading_question_options",
      ascending: true,
    })
    .maybeSingle();

  if (error) throw error;
  return data as ReadingPassageDetail | null;
}

export async function startReadingAttempt(
  passageId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("start_reading_attempt", {
    p_passage_id: passageId,
  });

  if (error) throw error;
  return data as string;
}

export async function submitReadingAttempt(
  attemptId: string,
  answers: ReadingSubmissionAnswer[],
): Promise<UserReadingAttempt> {
  const { data, error } = await supabase.rpc("submit_reading_attempt", {
    p_attempt_id: attemptId,
    p_question_ids: answers.map((answer) => answer.questionId),
    p_user_answers: answers.map((answer) => answer.answer),
  });

  if (error) throw error;
  return data as UserReadingAttempt;
}

export async function getReadingAttemptResult(
  attemptId: string,
): Promise<ReadingAttemptResult | null> {
  const { data, error } = await supabase
    .from("user_reading_attempts")
    .select(
      `
        *,
        reading_passages(title,slug),
        user_reading_answers(
          *,
          reading_questions(
            prompt,
            order_index,
            explanation,
            reading_question_answers(*)
          )
        )
      `,
    )
    .eq("id", attemptId)
    .not("completed_at", "is", null)
    .order("order_index", {
      referencedTable: "user_reading_answers.reading_questions",
      ascending: true,
    })
    .maybeSingle();

  if (error) throw error;
  return data as ReadingAttemptResult | null;
}

export async function getReadingHistory(): Promise<UserReadingAttempt[]> {
  const { data, error } = await supabase
    .from("user_reading_attempts")
    .select("*,reading_passages(title,slug,topic,difficulty)")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return data as UserReadingAttempt[];
}

export async function saveReadingPassage(
  userId: string,
  passageId: string,
): Promise<void> {
  const { error } = await supabase.from("user_saved_passages").upsert(
    { user_id: userId, passage_id: passageId },
    { onConflict: "user_id,passage_id" },
  );

  if (error) throw error;
}

export async function removeSavedReadingPassage(
  passageId: string,
): Promise<void> {
  const { error } = await supabase
    .from("user_saved_passages")
    .delete()
    .eq("passage_id", passageId);

  if (error) throw error;
}
