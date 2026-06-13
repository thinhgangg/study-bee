"use client";

import React, { useMemo, useState } from "react";
import { 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  RotateCcw, 
  BookOpen, 
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Trophy
} from "lucide-react";
import type { ReadingAttemptResult, ReadingPassageDetail } from "@/lib/reading.types";

interface ReadingResultSummaryProps {
  result: ReadingAttemptResult;
  passage: ReadingPassageDetail;
  onReview: () => void;
  onTryAgain: () => void;
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Trắc nghiệm (Multiple Choice)",
  true_false_not_given: "Đúng / Sai / Không đề cập (True/False/Not Given)",
  matching_headings: "Nối tiêu đề (Matching Headings)",
  matching_information: "Nối thông tin (Matching Information)",
  summary_completion: "Hoàn thành đoạn tóm tắt (Summary Completion)",
  sentence_completion: "Hoàn thành câu (Sentence Completion)",
  diagram_labeling: "Nhãn sơ đồ (Diagram Labeling)",
};

export function ReadingResultSummary({
  result,
  passage,
  onReview,
  onTryAgain,
}: ReadingResultSummaryProps) {
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Calculate stats
  const totalQuestions = result.total_questions;
  const correctCount = result.correct_count;
  
  // Count skipped answers (empty strings)
  const skippedCount = useMemo(() => {
    return result.user_reading_answers.filter(
      (ans) => !ans.user_answer || ans.user_answer.trim() === ""
    ).length;
  }, [result]);

  const incorrectCount = totalQuestions - correctCount - skippedCount;
  const accuracyPercent = Math.round((correctCount / totalQuestions) * 100) || 0;

  // Format time taken
  const timeFormatted = useMemo(() => {
    if (!result.time_taken_seconds) return "--:--";
    const mins = Math.floor(result.time_taken_seconds / 60);
    const secs = result.time_taken_seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [result.time_taken_seconds]);

  // Gamified XP reward calculation
  const xpGained = correctCount * 15 + 15;

  // Group performance by question type
  const typeStats = useMemo(() => {
    const stats: Record<
      string,
      { total: number; correct: number; incorrect: number; skipped: number }
    > = {};

    // Map question ID to its type in passage
    const questionTypes: Record<string, string> = {};
    passage.reading_questions.forEach((q) => {
      questionTypes[q.id] = q.question_type;
    });

    result.user_reading_answers.forEach((ans) => {
      const qType = questionTypes[ans.question_id] || "unknown";
      if (!stats[qType]) {
        stats[qType] = { total: 0, correct: 0, incorrect: 0, skipped: 0 };
      }
      
      stats[qType].total += 1;
      if (ans.is_correct) {
        stats[qType].correct += 1;
      } else if (!ans.user_answer || ans.user_answer.trim() === "") {
        stats[qType].skipped += 1;
      } else {
        stats[qType].incorrect += 1;
      }
    });

    return Object.entries(stats).map(([type, counts]) => {
      const typeAccuracy = Math.round((counts.correct / counts.total) * 100);
      let badge = "Cố gắng thêm nhé! 🍯";
      let badgeColor = "bg-amber-50 text-amber-600 border-amber-200";
      
      if (typeAccuracy === 100) {
        badge = "Tuyệt đỉnh! 👑";
        badgeColor = "bg-emerald-50 text-emerald-600 border-emerald-200";
      } else if (typeAccuracy >= 75) {
        badge = "Siêu đẳng! 🌟";
        badgeColor = "bg-yellow-50 text-yellow-600 border-yellow-200";
      } else if (typeAccuracy >= 50) {
        badge = "Khá tốt! 👍";
        badgeColor = "bg-blue-50 text-blue-600 border-blue-200";
      }

      return {
        type,
        label: QUESTION_TYPE_LABELS[type] || type,
        ...counts,
        accuracy: typeAccuracy,
        badge,
        badgeColor,
      };
    });
  }, [result, passage]);

  // Celebrate feedback submission
  const handleFeedback = (type: "like" | "dislike") => {
    setSubmittingFeedback(true);
    setTimeout(() => {
      setFeedback(type);
      setSubmittingFeedback(false);
    }, 400);
  };

  // SVG Radial progress calculations
  const radius = 60;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (accuracyPercent / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-gray-900 pb-16 px-4 pt-6 overflow-y-auto reading-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Playful Top Confetti / Celebration Header */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-yellow-200 bg-white p-8 shadow-[0_8px_30px_rgb(250,204,21,0.06)] text-center">
          <div className="absolute top-2 right-4 text-yellow-300">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div className="absolute bottom-4 left-6 text-yellow-300">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex flex-col items-center">
            {/* StudyBee Mascot Image */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <img
                src="/studybee-mascot.png"
                alt="StudyBee Mascot"
                className="w-28 h-28 object-contain animate-bee-bounce"
              />
            </div>
            
            <h1 className="mt-4 font-bold text-3xl text-gray-900 tracking-tight">
              {accuracyPercent >= 80 ? "Hoàn thành xuất sắc! 🥳" : accuracyPercent >= 50 ? "Làm rất tốt! 👏" : "Cố gắng lên nhé! 💪"}
            </h1>
            <p className="mt-2 text-sm text-gray-500 max-w-md">
              Bạn vừa hoàn thành bài đọc <span className="font-semibold text-yellow-700">{passage.title}</span>. Hãy cùng xem lại thành tích của mình nào!
            </p>
          </div>
        </div>

        {/* Dashboard Grid: Left Score Ring, Right Stats Summary */}
        <div className="grid md:grid-cols-5 gap-6">
          
          {/* Main Score Radial Ring */}
          <div className="md:col-span-2 rounded-3xl border-2 border-yellow-200 bg-white p-6 shadow-[0_8px_30px_rgb(250,204,21,0.04)] flex flex-col items-center justify-center text-center">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-6">Tỉ lệ chính xác</h2>
            <div className="relative w-36 h-36 flex items-center justify-center">
              {/* Circular SVG Ring */}
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke="#F3F4F6"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r={radius}
                  stroke="#FACC15"
                  strokeWidth={strokeWidth}
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
              </svg>
              {/* Inner score label */}
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black text-gray-800">{correctCount}/{totalQuestions}</span>
                <span className="text-xs text-gray-500 font-bold uppercase tracking-wide">câu đúng</span>
              </div>
            </div>

            <div className="mt-6 w-full grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 text-xs font-semibold">
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Đúng
                </span>
                <span className="text-sm font-bold text-gray-800 mt-1">{correctCount}</span>
              </div>
              <div className="flex flex-col items-center border-x border-gray-100">
                <span className="flex items-center gap-1 text-rose-500">
                  <XCircle className="w-3.5 h-3.5 shrink-0" /> Sai
                </span>
                <span className="text-sm font-bold text-gray-800 mt-1">{incorrectCount}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="flex items-center gap-1 text-gray-400">
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" /> Bỏ qua
                </span>
                <span className="text-sm font-bold text-gray-800 mt-1">{skippedCount}</span>
              </div>
            </div>
          </div>

          {/* Gamified Reward Metrics & Action Cards */}
          <div className="md:col-span-3 grid grid-cols-2 gap-4">
            {/* XP Gained Card */}
            <div className="rounded-3xl border-2 border-yellow-200 bg-white p-5 shadow-[0_8px_30px_rgb(250,204,21,0.04)] flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute -right-2 -bottom-2 text-yellow-100/70 group-hover:scale-110 transition-transform duration-300">
                <Trophy className="w-24 h-24 stroke-[1.5]" />
              </div>
              <div className="z-10">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-yellow-100 text-yellow-600 mb-4">
                  <Award className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kinh nghiệm nhận được</p>
                <h3 className="text-3xl font-black text-yellow-500 mt-1">+{xpGained} XP</h3>
              </div>
              <p className="text-[10px] text-gray-400 mt-4 z-10">Đã cộng trực tiếp vào hồ sơ học tập</p>
            </div>

            {/* Time Taken Card */}
            <div className="rounded-3xl border-2 border-yellow-200 bg-white p-5 shadow-[0_8px_30px_rgb(250,204,21,0.04)] flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute -right-2 -bottom-2 text-amber-50/50 group-hover:scale-110 transition-transform duration-300">
                <Clock className="w-24 h-24 stroke-[1.5]" />
              </div>
              <div className="z-10">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Thời gian làm bài</p>
                <h3 className="text-3xl font-black text-gray-800 mt-1">{timeFormatted}</h3>
              </div>
              <p className="text-[10px] text-gray-400 mt-4 z-10">Thời gian lý tưởng: 20 phút</p>
            </div>

            {/* Action Buttons Column Span 2 */}
            <div className="col-span-2 grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                onClick={onReview}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 hover:bg-gray-800 text-yellow-400 py-4 px-6 text-sm font-bold shadow-lg hover:shadow-yellow-100 transition-all duration-300 hover:-translate-y-0.5"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                Xem giải thích chi tiết
                <ChevronRight className="w-4 h-4 shrink-0 ml-1" />
              </button>
              <button
                type="button"
                onClick={onTryAgain}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-yellow-300 hover:border-yellow-400 bg-white hover:bg-yellow-50/40 text-yellow-700 py-4 px-6 text-sm font-bold shadow-sm transition-all duration-300 hover:-translate-y-0.5"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                Làm lại bài này
              </button>
            </div>
          </div>

        </div>

        {/* Question Type Breakdown Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 px-1">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Phân tích năng lực theo dạng câu hỏi
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {typeStats.map((stat) => (
              <div 
                key={stat.type} 
                className="rounded-2xl border-2 border-yellow-100 bg-white p-5 shadow-[0_4px_15px_rgb(250,204,21,0.02)] flex flex-col justify-between hover:border-yellow-200 transition-colors duration-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-bold text-gray-800 leading-tight">{stat.label}</span>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${stat.badgeColor} shrink-0`}>
                      {stat.badge}
                    </span>
                  </div>
                  
                  {/* Score accuracy bar */}
                  <div className="mt-4 flex items-center gap-4">
                    <div className="flex-1 bg-gray-100 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-yellow-400 h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${stat.accuracy}%` }}
                      />
                    </div>
                    <span className="text-sm font-black text-gray-700 shrink-0">{stat.accuracy}%</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs text-gray-400 font-semibold border-t border-gray-50 pt-3">
                  <span>Tổng: <strong className="text-gray-700">{stat.total} câu</strong></span>
                  <span>·</span>
                  <span className="text-emerald-600">Đúng: <strong>{stat.correct}</strong></span>
                  <span>·</span>
                  <span className="text-rose-500">Sai: <strong>{stat.incorrect}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Level suitability recommendation feedback */}
        <div className="rounded-3xl border-2 border-dashed border-yellow-300 bg-yellow-50/20 p-6 text-center">
          {feedback ? (
            <div className="flex flex-col items-center py-4 animate-scale-up">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-gray-800">Cảm ơn bạn đã phản hồi! 🐝</h4>
              <p className="text-xs text-gray-500 mt-1">Ý kiến của bạn sẽ giúp StudyBee tối ưu hóa độ khó bài đọc phù hợp nhất.</p>
            </div>
          ) : (
            <div>
              <h4 className="font-bold text-gray-800 text-sm">
                Bạn có muốn đề xuất bài tập này đến các bạn khác có cùng trình độ (band) với bạn không?
              </h4>
              <p className="text-xs text-gray-500 mt-1 mb-4">Hãy chia sẻ cảm nhận độ khó của bài học này.</p>
              
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  disabled={submittingFeedback}
                  onClick={() => handleFeedback("like")}
                  className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-white hover:bg-yellow-50 px-4 py-2.5 text-xs font-bold text-yellow-800 transition-colors shadow-sm"
                >
                  <ThumbsUp className="w-4 h-4 text-yellow-600" />
                  Đề xuất (Độ khó phù hợp)
                </button>
                <button
                  type="button"
                  disabled={submittingFeedback}
                  onClick={() => handleFeedback("dislike")}
                  className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-white hover:bg-yellow-50 px-4 py-2.5 text-xs font-bold text-yellow-800 transition-colors shadow-sm"
                >
                  <ThumbsDown className="w-4 h-4 text-yellow-600" />
                  Không đề xuất (Quá khó/dễ)
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      <style jsx global>{`
        /* Mascot Keyframe Animations */
        @keyframes bee-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes scale-up {
          0% { transform: scale(0.95); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .animate-bee-bounce {
          animation: bee-bounce 3.5s ease-in-out infinite;
        }
        .animate-scale-up {
          animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}
