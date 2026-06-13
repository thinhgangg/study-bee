import { supabase } from "@/lib/supabase";

export interface StudyStreak {
  current: number;
  longest: number;
  studiedToday: boolean;
  activity: StudyActivity[];
  todayReviewed: number;
  todayGoal: number;
  todayProgress: number;
}

export interface StudyActivity {
  activityDate: string;
  reviewedCount: number;
  dueCountAtStart: number;
  goalCompleted: boolean;
}

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return getLocalDate(value);
}

export async function fetchStudyStreak(
  profileId: string,
): Promise<StudyStreak> {
  const now = new Date().toISOString();
  const [initialActivityResult, dueResult] = await Promise.all([
    supabase
      .from("daily_study_activity")
      .select(
        "activity_date, reviewed_count, due_count_at_start, goal_completed",
      )
      .eq("user_id", profileId)
      .order("activity_date", { ascending: true }),
    supabase
      .from("card_reviews")
      .select("card_id", { count: "exact", head: true })
      .eq("user_id", profileId)
      .not("next_review_at", "is", null)
      .lte("next_review_at", now),
  ]);

  let activityRows = initialActivityResult.data;

  if (initialActivityResult.error) {
    const missingGoalColumn = initialActivityResult.error.message.includes(
      "due_count_at_start",
    );

    if (!missingGoalColumn) throw initialActivityResult.error;

    const fallbackResult = await supabase
      .from("daily_study_activity")
      .select("activity_date, reviewed_count, goal_completed")
      .eq("user_id", profileId)
      .order("activity_date", { ascending: true });

    if (fallbackResult.error) throw fallbackResult.error;
    activityRows = (fallbackResult.data ?? []).map((row) => ({
      ...row,
      due_count_at_start: 0,
    }));
  }

  if (dueResult.error) throw dueResult.error;

  const activity = (activityRows ?? []).map((row) => ({
    activityDate: row.activity_date as string,
    reviewedCount: Number(row.reviewed_count ?? 0),
    dueCountAtStart: Number(row.due_count_at_start ?? 0),
    goalCompleted: Boolean(row.goal_completed),
  }));
  const dates = activity
    .filter((item) => item.goalCompleted)
    .map((item) => item.activityDate);
  const today = getLocalDate();
  const yesterday = addDays(today, -1);
  const studiedToday = dates.includes(today);
  const todayActivity = activity.find((item) => item.activityDate === today);
  const reviewedToday = todayActivity?.reviewedCount ?? 0;
  const remainingDueCount = dueResult.count ?? 0;
  const todayGoal = todayActivity
    ? todayActivity.dueCountAtStart
    : remainingDueCount;
  const todayReviewed = Math.min(
    reviewedToday,
    todayGoal,
  );
  const todayProgress =
    todayGoal > 0
      ? Math.min(100, Math.round((todayReviewed / todayGoal) * 100))
      : studiedToday
        ? 100
        : 0;
  let longest = 0;
  let running = 0;
  let previousDate = "";

  for (const date of dates) {
    running = previousDate && addDays(previousDate, 1) === date ? running + 1 : 1;
    longest = Math.max(longest, running);
    previousDate = date;
  }

  const latestDate = dates.at(-1);
  let current = 0;

  if (latestDate === today || latestDate === yesterday) {
    current = 1;

    for (let index = dates.length - 2; index >= 0; index -= 1) {
      const newerDate = dates[index + 1];
      const olderDate = dates[index];

      if (addDays(olderDate, 1) !== newerDate) break;
      current += 1;
    }
  }

  return {
    current,
    longest,
    studiedToday,
    activity,
    todayReviewed,
    todayGoal,
    todayProgress,
  };
}

export async function recordStudyReview(profileId: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { error } = await supabase.rpc("record_daily_study_activity", {
    p_timezone: timezone,
  });

  if (error) throw error;
  return fetchStudyStreak(profileId);
}

export async function initializeStudyDay(profileId: string) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { error } = await supabase.rpc("initialize_daily_study_activity", {
    p_timezone: timezone,
  });

  if (error) throw error;
  return fetchStudyStreak(profileId);
}
