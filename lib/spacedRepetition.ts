export interface ReviewState {
  repetition: number;
  intervalDays: number;
  easeFactor: number;
}

export interface ReviewSchedule extends ReviewState {
  nextReviewAt: Date;
}

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const STARTER_INTERVALS = [1, 3, 7, 14, 30];

export function calculateReviewSchedule(
  quality: number,
  previous?: Partial<ReviewState>,
  reviewedAt = new Date(),
): ReviewSchedule {
  const normalizedQuality = Math.max(0, Math.min(5, Math.round(quality)));
  const previousRepetition = Math.max(0, previous?.repetition ?? 0);
  const previousInterval = Math.max(0, previous?.intervalDays ?? 0);
  const previousEase = Math.max(
    MIN_EASE_FACTOR,
    previous?.easeFactor ?? DEFAULT_EASE_FACTOR,
  );

  const easeFactor = Math.max(
    MIN_EASE_FACTOR,
    previousEase +
      (0.1 -
        (5 - normalizedQuality) * (0.08 + (5 - normalizedQuality) * 0.02)),
  );

  let repetition = previousRepetition;
  let intervalDays = 1;

  if (normalizedQuality < 3) {
    repetition = 0;
  } else {
    repetition += 1;

    if (repetition <= STARTER_INTERVALS.length) {
      intervalDays = STARTER_INTERVALS[repetition - 1];
    } else {
      const growthFactor = 1.3 + (normalizedQuality - 3) * 0.25;
      intervalDays = Math.max(
        1,
        Math.round(previousInterval * Math.min(easeFactor, growthFactor)),
      );
    }
  }

  const nextReviewAt = new Date(reviewedAt);
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays);

  return { repetition, intervalDays, easeFactor, nextReviewAt };
}

export function isCardDue(nextReviewAt?: string | null, now = new Date()) {
  return !nextReviewAt || new Date(nextReviewAt) <= now;
}
