"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Mic2,
  PlayCircle,
  Star,
  Target,
  TrendingUp,
  Volume2,
} from "lucide-react";
import { StudyBeeNavbar } from "@/components/layout/StudyBeeNavbar";
import { StudyBeeLogo } from "@/components/StudyBeeLogo";
import { supabase } from "@/lib/supabase";

// ─── Data ────────────────────────────────────────────────────

const stats = [
  { value: "50k+", label: "Học viên" },
  { value: "7.0+", label: "Band trung bình" },
  { value: "10k+", label: "Từ vựng IELTS" },
];

const features = [
  {
    title: "Flashcard thông minh",
    text: "AI tự điền từ vựng, phiên âm, ví dụ và hình ảnh. Spaced repetition nhắc bạn ôn đúng lúc.",
    icon: BookOpenCheck,
    accent: "bg-yellow-100 text-yellow-700",
  },
  {
    title: "Luyện đủ 4 kỹ năng",
    text: "Bài tập ngắn cho Listening, Reading, Writing và Speaking. AI chấm điểm và chỉ ra chỗ cần cải thiện.",
    icon: Mic2,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "Mock Test sát đề thật",
    text: "Format chuẩn Cambridge. Làm xong nhận band dự kiến và phân tích từng phần rõ ràng.",
    icon: Target,
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "Theo dõi tiến độ",
    text: "Biểu đồ band score theo tuần, streak học tập và gợi ý lộ trình phù hợp mục tiêu của bạn.",
    icon: TrendingUp,
    accent: "bg-rose-100 text-rose-700",
  },
];

const steps = [
  {
    n: "01",
    title: "Đăng ký miễn phí",
    desc: "Tạo tài khoản và chọn trình độ hiện tại của bạn.",
  },
  {
    n: "02",
    title: "Đặt mục tiêu",
    desc: "Chọn band IELTS mong muốn và thời gian ôn mỗi ngày.",
  },
  {
    n: "03",
    title: "Học cùng AI",
    desc: "Nhận lộ trình cá nhân, bài tập ngắn và nhắc ôn đúng lúc.",
  },
  {
    n: "04",
    title: "Thi và theo dõi",
    desc: "Mock test, xem lỗi sai, điều chỉnh kế hoạch học tiếp.",
  },
];

const testimonials = [
  {
    name: "Linh Chi",
    result: "Band 8.0",
    quote:
      "Flashcard của StudyBee hoàn toàn khác. AI điền hết, mình chỉ cần học — tiết kiệm rất nhiều thời gian.",
    initials: "LC",
    color: "bg-yellow-200 text-yellow-800",
  },
  {
    name: "Minh Đức",
    result: "Band 7.5",
    quote:
      "AI chấm Speaking chỉ ra lỗi phát âm rất cụ thể. Mình tự luyện được ở nhà mà không cần gia sư.",
    initials: "MĐ",
    color: "bg-sky-200 text-sky-800",
  },
  {
    name: "Thu Hương",
    result: "Band 7.0",
    quote:
      "Tăng từ 5.5 lên 7.0 sau 3 tháng. Lộ trình rõ ràng, báo cáo hàng tuần giúp mình không bị lạc hướng.",
    initials: "TH",
    color: "bg-emerald-200 text-emerald-800",
  },
];

const plans = [
  {
    name: "Miễn phí",
    price: "0đ",
    period: "/tháng",
    cta: "Bắt đầu",
    href: "/register",
    featured: false,
    features: [
      "100 flashcard mỗi ngày",
      "1 mock test mỗi tháng",
      "Theo dõi streak học",
    ],
  },
  {
    name: "Pro",
    price: "99k",
    period: "/tháng",
    cta: "Nâng cấp ngay",
    href: "/register",
    featured: true,
    features: [
      "Flashcard không giới hạn",
      "Mock test không giới hạn",
      "Luyện 4 kỹ năng với AI",
      "Phân tích lỗi chi tiết",
    ],
  },
  {
    name: "Nhóm",
    price: "150k",
    period: "/người/tháng",
    cta: "Liên hệ tư vấn",
    href: "/login",
    featured: false,
    features: [
      "Tất cả tính năng Pro",
      "Quản lý tiến độ nhóm",
      "Hỗ trợ ưu tiên",
    ],
  },
];

// ─── Honeycomb SVG pattern ────────────────────────────────────
// Inline SVG as data URI for bg pattern — subtle, warm
const HoneycombBg = () => (
  <svg
    className="absolute inset-0 h-full w-full"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <pattern
        id="honey"
        x="0"
        y="0"
        width="56"
        height="64"
        patternUnits="userSpaceOnUse"
      >
        {/* Single hexagon cell, outline only, very subtle */}
        <polygon
          points="28,2 52,16 52,48 28,62 4,48 4,16"
          fill="none"
          stroke="#FACC15"
          strokeWidth="0.8"
          strokeOpacity="0.25"
        />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#honey)" />
  </svg>
);

// ─── Page ────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setEmail(session?.user.email ?? "");
      setLoadingAuth(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? "");
      setLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-white font-body text-gray-900">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <StudyBeeNavbar
        userEmail={email}
        loadingAuth={loadingAuth}
        showAuthActions
        onSignOut={handleSignOut}
      />

      {/* ── Hero — 2 column ────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#FFFBEB] pt-16">
        <HoneycombBg />

        {/* Dashed bee flight path — decorative SVG overlay */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M 80 120 Q 200 60 320 140 Q 440 220 560 100 Q 650 30 740 160"
            fill="none"
            stroke="#FACC15"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            strokeOpacity="0.5"
          />
          {/* Little bee dot at end of path */}
          <circle cx="742" cy="160" r="4" fill="#FACC15" fillOpacity="0.7" />
        </svg>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          {/* Left — copy */}
          <div>
            <h1 className="font-heading text-5xl font-bold leading-tight text-gray-900 sm:text-6xl">
              Học IELTS{" "}
              <span className="relative inline-block">
                thông minh hơn
                {/* Honey underline squiggle */}
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="8"
                  viewBox="0 0 200 8"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M0,5 Q25,0 50,5 Q75,10 100,5 Q125,0 150,5 Q175,10 200,5"
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>{" "}
              <span className="relative inline-block">cùng StudyBee</span>
            </h1>

            <p className="mt-8 max-w-lg text-lg leading-relaxed text-gray-500">
              Lộ trình cá nhân, flashcard tự động và luyện 4 kỹ năng — tất cả
              trong một ứng dụng dễ dùng dành riêng cho học viên Việt Nam.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-sm font-semibold text-yellow-300 hover:bg-gray-700 transition-colors"
              >
                Bắt đầu miễn phí
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-7 py-3.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <PlayCircle className="h-4 w-4 text-yellow-500" />
                Xem demo
              </a>
            </div>

            {/* Stats */}
            <div className="mt-10 flex flex-wrap gap-8 border-t border-yellow-200 pt-8">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="font-heading text-2xl font-bold text-gray-900">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <AppMockup />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-gray-900 sm:text-4xl">
              Đủ công cụ để đạt band mục tiêu
            </h2>
            <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-yellow-400" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map(({ title, text, icon: Icon, accent }) => (
              <div
                key={title}
                className="rounded-2xl border border-gray-100 bg-white p-6 hover:border-yellow-200 transition-colors"
              >
                <div
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent} mb-4`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-gray-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#FFFBEB] py-20">
        <HoneycombBg />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-gray-900 sm:text-4xl">
              Chỉ 4 bước để bắt đầu
            </h2>
            <p className="mt-3 text-gray-500">
              Đơn giản, rõ ràng và dễ duy trì mỗi ngày.
            </p>
          </div>

          {/* Dashed connector line */}
          <div className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div
              className="pointer-events-none absolute left-0 right-0 top-8 hidden border-t-2 border-dashed border-yellow-300 lg:block"
              style={{ left: "12.5%", right: "12.5%" }}
            />
            {steps.map(({ n, title, desc }) => (
              <div
                key={n}
                className="relative rounded-2xl bg-white border border-yellow-100 p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 font-heading text-sm font-bold text-white shadow-sm">
                  {n}
                </div>
                <h3 className="font-heading text-base font-bold text-gray-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <h2 className="font-heading text-center text-3xl font-bold text-gray-900 sm:text-4xl mb-12">
            Học viên nói gì về StudyBee
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl border border-gray-100 bg-white p-6"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-600">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${t.color}`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-yellow-600 font-semibold">
                      {t.result}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section
        id="pricing"
        className="relative overflow-hidden bg-[#FFFBEB] py-20"
      >
        <HoneycombBg />
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl font-bold text-gray-900 sm:text-4xl">
              Đơn giản, minh bạch
            </h2>
            <p className="mt-3 text-gray-500">
              Chọn gói phù hợp với mục tiêu của bạn.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3 lg:items-end">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl bg-white p-7 ${plan.featured ? "border-2 border-gray-900 lg:scale-105" : "border border-gray-100"}`}
              >
                {plan.featured && (
                  <span className="inline-block rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold text-gray-900 mb-4">
                    Phổ biến nhất
                  </span>
                )}
                <h3 className="font-heading text-xl font-bold text-gray-900">
                  {plan.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  <span className="text-sm text-gray-400">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-gray-600"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-8 flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold transition-colors ${
                    plan.featured
                      ? "bg-gray-900 text-yellow-300 hover:bg-gray-700"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="bg-white py-20 text-center">
        <div className="mx-auto max-w-2xl px-5">
          {/* Honey drip detail */}
          <div
            className="mb-6 flex justify-center gap-3 text-yellow-500 opacity-40"
            aria-hidden="true"
          >
            {["▼", "▼", "▼"].map((d, i) => (
              <span key={i} className="text-xs">
                {d}
              </span>
            ))}
          </div>
          <h2 className="font-heading text-3xl font-bold text-gray-900 sm:text-4xl">
            Sẵn sàng chinh phục IELTS chưa?
          </h2>
          <p className="mx-auto mt-4 text-base text-gray-700 leading-relaxed">
            Tham gia cùng 50,000+ học viên và bắt đầu nâng band ngay hôm nay.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold bg-gray-900 text-yellow-300 hover:bg-gray-700 transition-colors"
          >
            Bắt đầu miễn phí ngay
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-gray-900 border-t border-white/10 py-12">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <StudyBeeLogo
                imageClassName="h-8 w-8"
                textClassName="font-heading text-lg font-bold text-yellow-300"
              />
              <p className="mt-4 text-sm leading-relaxed text-gray-500">
                Người bạn học thông minh giúp bạn đạt mục tiêu IELTS nhanh hơn.
              </p>
            </div>
            {[
              {
                title: "Sản phẩm",
                links: [
                  "Flashcard",
                  "Mock Test",
                  "Luyện kỹ năng",
                  "Lộ trình học",
                ],
              },
              {
                title: "Hỗ trợ",
                links: ["Hướng dẫn", "Blog IELTS", "Cộng đồng", "Liên hệ"],
              },
              { title: "Pháp lý", links: ["Điều khoản", "Bảo mật", "Cookie"] },
            ].map(({ title, links }) => (
              <div key={title}>
                <p className="text-sm font-semibold text-white mb-4">{title}</p>
                <ul className="space-y-3">
                  {links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-sm text-gray-500 hover:text-yellow-300 transition-colors"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 StudyBee. All rights reserved.</p>
            <div className="flex gap-5">
              {["Facebook", "TikTok", "LinkedIn"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="hover:text-yellow-300 transition-colors"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function AppMockup() {
  return (
    <div className="w-full rounded-3xl border border-yellow-100 bg-white overflow-hidden shadow-xl shadow-yellow-100/60">
      {/* Deck header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            IELTS Academic · Thẻ 8 / 20
          </p>
          <span className="rounded-full bg-[#BAE6FD] px-2.5 py-0.5 text-xs font-semibold text-sky-700">
            Academic
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-yellow-400"
            style={{ width: "40%" }}
          />
        </div>
      </div>

      {/* Flashcard */}
      <div className="mx-5 mb-4 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-heading text-3xl font-bold text-gray-900">
              ephemeral
            </h2>
            <p className="mt-0.5 font-mono text-sm text-gray-400">
              /ɪˈfem.ər.əl/
            </p>
            <span className="mt-1.5 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
              adjective
            </span>
          </div>
          <button
            type="button"
            aria-label="Phát âm"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-50 text-yellow-600 hover:bg-yellow-100 transition-colors"
          >
            <Volume2 className="h-4 w-4" />
          </button>
        </div>

        <p className="text-base font-semibold text-yellow-600 mb-4">
          phù du, chóng tàn
        </p>

        <div className="rounded-xl bg-gray-50 border-l-2 border-yellow-400 px-4 py-3 mb-4">
          <p className="text-sm italic leading-relaxed text-gray-700">
            &ldquo;Fame in the world of social media is largely
            ephemeral.&rdquo;
          </p>
          <p className="mt-1.5 text-xs text-gray-400">
            Sự nổi tiếng trên mạng xã hội phần lớn đều rất phù du.
          </p>
        </div>

        {/* Synonyms / antonyms */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-400 self-center">Đồng nghĩa:</span>
          {["transient", "fleeting", "momentary"].map((w) => (
            <span
              key={w}
              className="rounded-full bg-[#BBF7D0] px-3 py-0.5 text-xs font-semibold text-emerald-700"
            >
              {w}
            </span>
          ))}
          <span className="text-xs text-gray-400 self-center ml-1">≠</span>
          <span className="rounded-full bg-[#FDA4AF] px-3 py-0.5 text-xs font-semibold text-rose-700">
            permanent
          </span>
        </div>

        {/* Image placeholder */}
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-100 h-28 flex items-center justify-center border border-yellow-100">
          <div className="text-center">
            <span className="text-3xl">🌸</span>
            <p className="text-xs text-yellow-600 mt-1 font-medium">
              Hình minh họa
            </p>
          </div>
        </div>
      </div>

      {/* Rating buttons */}
      <div className="grid grid-cols-4 gap-2 px-5 pb-5">
        {[
          {
            label: "Quên",
            sub: "< 1p",
            bg: "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100",
          },
          {
            label: "Khó",
            sub: "10p",
            bg: "bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-100",
          },
          {
            label: "Nhớ",
            sub: "1 ngày",
            bg: "bg-sky-50 text-sky-600 hover:bg-sky-100 border-sky-100",
          },
          {
            label: "Dễ",
            sub: "4 ngày",
            bg: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-100",
          },
        ].map(({ label, sub, bg }) => (
          <button
            key={label}
            type="button"
            className={`flex flex-col items-center rounded-xl border py-3 text-xs font-semibold transition-colors ${bg}`}
          >
            <span className="font-bold">{label}</span>
            <span className="mt-0.5 text-xs opacity-60">{sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
