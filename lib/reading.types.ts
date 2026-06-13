export type ReadingQuestionType =
  | "multiple_choice"
  | "true_false_not_given"
  | "matching_headings"
  | "matching_information"
  | "summary_completion"
  | "sentence_completion"
  | "diagram_labeling";

export interface ReadingPassage {
  id: string;
  title: string;
  slug: string;
  content: string;
  topic: string;
  difficulty: number;
  estimated_time: number;
  passage_number: 1 | 2 | 3 | null;
  is_standalone: boolean;
  source: string | null;
  source_url: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingPassageSection {
  id: string;
  passage_id: string;
  label: string;
  content: string;
  order_index: number;
}

export interface ReadingQuestionOption {
  id: string;
  question_id: string;
  option_key: string;
  option_text: string;
  order_index: number;
}

export interface ReadingQuestionAnswer {
  id: string;
  question_id: string;
  answer_text: string;
}

export interface ReadingQuestion {
  id: string;
  passage_id: string;
  question_group: string | null;
  order_index: number;
  question_type: ReadingQuestionType;
  prompt: string;
  explanation: string | null;
}

export interface ReadingPassageVocabulary {
  id: string;
  passage_id: string;
  word: string;
  context_sentence: string;
  created_at: string;
}

export interface UserReadingAttempt {
  id: string;
  user_id: string;
  passage_id: string;
  started_at: string;
  completed_at: string | null;
  time_taken_seconds: number | null;
  total_questions: number;
  correct_count: number;
  accuracy: number;
  created_at: string;
}

export interface UserReadingAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  user_answer: string;
  is_correct: boolean;
  created_at: string;
}

export interface UserSavedPassage {
  id: string;
  user_id: string;
  passage_id: string;
  saved_at: string;
}

export interface ReadingPassageListItem
  extends Pick<
    ReadingPassage,
    "id" | "title" | "slug" | "topic" | "difficulty" | "estimated_time"
  > {
  question_count: number;
}

export type ReadingPracticeKind = "single" | "full_test";

export interface ReadingPracticeListItem {
  id: string;
  kind: ReadingPracticeKind;
  title: string;
  slug: string;
  description: string | null;
  topic: string;
  difficulty: number;
  estimatedTime: number;
  questionCount: number;
  passageNumber: 1 | 2 | 3 | null;
  passageCount: number;
  publishedAt: string | null;
}

export interface ReadingListFilters {
  search?: string;
  kind?: "all" | ReadingPracticeKind;
  passageNumber?: "all" | 1 | 2 | 3;
  topic?: string;
  difficulty?: number;
}

export interface ReadingQuestionWithOptions extends ReadingQuestion {
  reading_question_options: ReadingQuestionOption[];
}

export interface ReadingPassageDetail extends ReadingPassage {
  reading_passage_sections: ReadingPassageSection[];
  reading_questions: ReadingQuestionWithOptions[];
}

export interface ReadingAttemptResult extends UserReadingAttempt {
  reading_passages: Pick<ReadingPassage, "title" | "slug">;
  user_reading_answers: Array<
    UserReadingAnswer & {
      reading_questions: Pick<
        ReadingQuestion,
        "prompt" | "order_index" | "explanation"
      > & {
        reading_question_answers: ReadingQuestionAnswer[];
      };
    }
  >;
}

export interface ReadingFilters {
  search?: string;
  topic?: string;
  difficulty?: number;
}

export interface ReadingSubmissionAnswer {
  questionId: string;
  answer: string;
}
