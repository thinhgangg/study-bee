"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookA,
  BookOpenText,
  CheckCheck,
  ChevronDown,
  Clock3,
  LogOut,
  Menu,
  Settings,
  User,
  X,
  Dumbbell,
  ClipboardCheck,
  Route,
  CreditCard,
  Flame,
  Headphones,
  Mic2,
  PenLine,
} from "lucide-react";
import { StudyBeeLogo } from "@/components/StudyBeeLogo";
import { supabase } from "@/lib/supabase";
import {
  fetchStudyStreak,
  type StudyActivity,
  type StudyStreak,
} from "@/lib/studyStreak";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Từ vựng", href: "/vocabulary", icon: BookA },
  { label: "Mock Test", href: "/#features", icon: ClipboardCheck },
  { label: "Lộ trình", href: "/#features", icon: Route },
  { label: "Bảng giá", href: "/#pricing", icon: CreditCard },
];

const skillItems = [
  { label: "Reading", href: "/reading", icon: BookOpenText },
  { label: "Listening", href: "/listening", icon: Headphones },
  { label: "Writing", href: "/writing", icon: PenLine },
  { label: "Speaking", href: "/speaking", icon: Mic2 },
];

interface ReviewNotification {
  deckId: string;
  deckName: string;
  dueCount: number;
}

interface StudyBeeNavbarProps {
  userEmail?: string;
  loadingAuth?: boolean;
  showAuthActions?: boolean;
  onSignOut?: () => void | Promise<void>;
}

const EMPTY_STREAK: StudyStreak = {
  current: 0,
  longest: 0,
  studiedToday: false,
  activity: [],
  todayReviewed: 0,
  todayGoal: 0,
  todayProgress: 0,
};

export function StudyBeeNavbar({
  userEmail = "",
  loadingAuth = false,
  showAuthActions = false,
  onSignOut,
}: StudyBeeNavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSkillsOpen, setMobileSkillsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ReviewNotification[]>([]);
  const [notificationSignature, setNotificationSignature] = useState("");
  const [notificationsRead, setNotificationsRead] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [studyStreak, setStudyStreak] = useState<StudyStreak>(EMPTY_STREAK);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = Boolean(userEmail);
  const initials = userEmail.trim()[0]?.toUpperCase() || "B";
  const totalDueCount = notifications.reduce(
    (total, notification) => total + notification.dueCount,
    0,
  );
  const hasUnreadNotifications = totalDueCount > 0 && !notificationsRead;

  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;

    async function loadNotifications() {
      setLoadingNotifications(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (!profile || cancelled) return;

        try {
          const streak = await fetchStudyStreak(profile.id as string);
          if (!cancelled) setStudyStreak(streak);
        } catch {
          if (!cancelled) setStudyStreak(EMPTY_STREAK);
        }

        const now = new Date().toISOString();
        const { data: reviews, error: reviewsError } = await supabase
          .from("card_reviews")
          .select("card_id, next_review_at")
          .eq("user_id", profile.id)
          .not("next_review_at", "is", null)
          .lte("next_review_at", now);

        if (reviewsError) throw reviewsError;

        const cardIds = (reviews ?? []).map((review) => review.card_id as string);

        if (cardIds.length === 0) {
          if (!cancelled) {
            setNotifications([]);
            setNotificationSignature("");
            setNotificationsRead(true);
          }
          return;
        }

        const { data: cards, error: cardsError } = await supabase
          .from("cards")
          .select("id, deck_id")
          .in("id", cardIds);

        if (cardsError) throw cardsError;

        const deckIds = [
          ...new Set((cards ?? []).map((card) => card.deck_id as string)),
        ];

        if (deckIds.length === 0) {
          if (!cancelled) {
            setNotifications([]);
            setNotificationSignature("");
            setNotificationsRead(true);
          }
          return;
        }

        const { data: decks, error: decksError } = await supabase
          .from("decks")
          .select("id, name")
          .in("id", deckIds);

        if (decksError) throw decksError;

        const deckNames = new Map(
          (decks ?? []).map((deck) => [deck.id as string, deck.name as string]),
        );
        const dueByDeck = new Map<string, number>();

        for (const card of cards ?? []) {
          const deckId = card.deck_id as string;
          dueByDeck.set(deckId, (dueByDeck.get(deckId) ?? 0) + 1);
        }

        const nextNotifications = [...dueByDeck.entries()]
          .map(([deckId, dueCount]) => ({
            deckId,
            deckName: deckNames.get(deckId) ?? "Bộ từ vựng",
            dueCount,
          }))
          .sort((left, right) => right.dueCount - left.dueCount);
        const signature = (reviews ?? [])
          .map(
            (review) =>
              `${review.card_id}:${review.next_review_at ?? ""}`,
          )
          .sort()
          .join("|");
        const storageKey = `studybee:notifications:read:${user.id}`;
        const readSignature = window.localStorage.getItem(storageKey);

        if (!cancelled) {
          setNotifications(nextNotifications);
          setNotificationSignature(signature);
          setNotificationsRead(readSignature === signature);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setNotificationSignature("");
          setNotificationsRead(true);
        }
      } finally {
        if (!cancelled) setLoadingNotifications(false);
      }
    }

    void loadNotifications();
    const handleFocus = () => void loadNotifications();
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, [isLoggedIn, pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!mobileMenuRef.current?.contains(target)) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileMenuOpen]);

  async function handleSignOut() {
    await onSignOut?.();
    setMobileMenuOpen(false);
    setMobileSkillsOpen(false);
  }

  async function markAllNotificationsRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !notificationSignature) return;

    window.localStorage.setItem(
      `studybee:notifications:read:${user.id}`,
      notificationSignature,
    );
    setNotificationsRead(true);
  }

  return (
    <header className="width-before-scroll-bar fixed inset-x-0 top-0 z-50 border-b border-yellow-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-5 lg:px-8">
        <div className="min-w-0 shrink-0">
          <StudyBeeLogo
            className="min-w-0"
            imageClassName="h-8 w-8 shrink-0"
            textClassName="truncate font-heading text-xl font-bold text-gray-900"
          />
        </div>

        <nav className="hidden items-center gap-0.5 text-sm text-gray-500 md:flex lg:gap-1">
          {navItems.slice(0, 1).map(({ label, href, icon: Icon }) => {
            const active =
              href === "/vocabulary" && pathname.startsWith("/vocabulary");

            return (
              <Link
                key={label}
                href={href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 transition-colors lg:px-3 ${
                  active
                    ? "bg-yellow-100 text-gray-900"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className="hidden h-4 w-4 lg:block" />
                {label}
              </Link>
            );
          })}

          <SkillsDropdown pathname={pathname} />

          {navItems.slice(1).map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 lg:px-3"
            >
              <Icon className="hidden h-4 w-4 lg:block" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          {loadingAuth ? (
            <div className="h-10 w-36 animate-pulse rounded-full bg-gray-100" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              <StreakDropdown streak={studyStreak} />

              <NotificationDropdown
                notifications={notifications}
                totalDueCount={totalDueCount}
                hasUnreadNotifications={hasUnreadNotifications}
                notificationsRead={notificationsRead}
                loading={loadingNotifications}
                onMarkAllRead={markAllNotificationsRead}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-yellow-100 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-gray-700 shadow-sm shadow-yellow-100/50 outline-none transition-colors hover:bg-yellow-50 focus:outline-none focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-yellow-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-300 font-heading text-sm font-bold text-gray-900">
                      {initials}
                    </span>
                    <span className="hidden max-w-28 truncate sm:inline">
                      {userEmail || "StudyBee"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem>
                    <User className="text-yellow-600" />
                    Hồ sơ
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="text-yellow-600" />
                    Cài đặt
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => void handleSignOut()}
                    className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                  >
                    <LogOut />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : showAuthActions ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="whitespace-nowrap rounded-full border border-yellow-100 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50 lg:px-4"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="whitespace-nowrap rounded-full bg-gray-900 px-3 py-2 text-sm font-semibold text-yellow-300 transition-colors hover:bg-gray-700 lg:px-4"
              >
                Dùng thử miễn phí
              </Link>
            </div>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        <div
          ref={mobileMenuRef}
          className="relative flex shrink-0 items-center gap-2 md:hidden"
        >
          {isLoggedIn && !loadingAuth && (
            <>
              <StreakDropdown streak={studyStreak} />
              <NotificationDropdown
                notifications={notifications}
                totalDueCount={totalDueCount}
                hasUnreadNotifications={hasUnreadNotifications}
                notificationsRead={notificationsRead}
                loading={loadingNotifications}
                onMarkAllRead={markAllNotificationsRead}
              />
            </>
          )}
          <button
            type="button"
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((value) => !value)}
            className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-yellow-100 bg-white text-gray-700 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          {mobileMenuOpen && (
            <div className="absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-yellow-100 bg-white p-2.5 shadow-xl shadow-yellow-100/70">
              <nav className="space-y-1 text-sm font-semibold text-gray-700">
                {navItems.slice(0, 1).map(({ label, href, icon: Icon }) => {
                  const active =
                    href === "/vocabulary" &&
                    pathname.startsWith("/vocabulary");

                  return (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                        active
                          ? "bg-yellow-100 text-gray-900"
                          : "hover:bg-yellow-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-yellow-600" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}

                <button
                  type="button"
                  aria-expanded={mobileSkillsOpen}
                  onClick={() => setMobileSkillsOpen((value) => !value)}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    skillItems.some(({ href }) => pathname.startsWith(href))
                      ? "bg-yellow-100 text-gray-900"
                      : "hover:bg-yellow-50 hover:text-gray-900"
                  }`}
                >
                  <Dumbbell className="h-4 w-4 shrink-0 text-yellow-600" />
                  <span className="flex-1 truncate">Luyện kỹ năng</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                      mobileSkillsOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {mobileSkillsOpen && (
                  <div className="ml-4 space-y-1 border-l border-yellow-100 pl-2">
                    {skillItems.map(({ label, href, icon: Icon }) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setMobileSkillsOpen(false);
                        }}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors ${
                          pathname.startsWith(href)
                            ? "bg-yellow-100 text-gray-900"
                            : "hover:bg-yellow-50 hover:text-gray-900"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-yellow-600" />
                        {label}
                      </Link>
                    ))}
                  </div>
                )}

                {navItems.slice(1).map(({ label, href, icon: Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-yellow-50 hover:text-gray-900"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-yellow-600" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </nav>

              <div className="mt-3 border-t border-yellow-100 pt-3">
                {loadingAuth ? (
                  <div className="h-11 w-full animate-pulse rounded-full bg-gray-100" />
                ) : isLoggedIn ? (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-rose-100 bg-white px-4 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </button>
                ) : showAuthActions ? (
                  <div className="space-y-2">
                    <Link
                      href="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex h-11 w-full items-center justify-center rounded-full border border-yellow-100 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50"
                    >
                      Đăng nhập
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex h-11 w-full items-center justify-center rounded-full bg-gray-900 px-4 text-sm font-bold text-yellow-300 transition-colors hover:bg-gray-700"
                    >
                      Dùng thử miễn phí
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function SkillsDropdown({ pathname }: { pathname: string }) {
  const active = skillItems.some(({ href }) => pathname.startsWith(href));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`group flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 outline-none transition-colors lg:px-3 ${
            active
              ? "bg-yellow-100 text-gray-900"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 data-[state=open]:bg-gray-50 data-[state=open]:text-gray-900"
          }`}
        >
          <Dumbbell className="hidden h-4 w-4 lg:block" />
          Luyện kỹ năng
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {skillItems.map(({ label, href, icon: Icon }) => (
          <DropdownMenuItem key={label} asChild>
            <Link
              href={href}
              className={
                pathname.startsWith(href) ? "bg-yellow-50 text-gray-900" : ""
              }
            >
              <Icon className="text-yellow-600" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationDropdown({
  notifications,
  totalDueCount,
  hasUnreadNotifications,
  notificationsRead,
  loading,
  onMarkAllRead,
}: {
  notifications: ReviewNotification[];
  totalDueCount: number;
  hasUnreadNotifications: boolean;
  notificationsRead: boolean;
  loading: boolean;
  onMarkAllRead: () => void | Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Thông báo"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-yellow-100 bg-white text-gray-600 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50 hover:text-gray-900"
        >
          <Bell className="h-4 w-4" />
          {hasUnreadNotifications && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-white" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-yellow-100 px-4 py-3">
          <div>
            <p className="font-bold text-gray-900">Thông báo</p>
            <p className="text-xs text-gray-500">
              {totalDueCount > 0
                ? `${totalDueCount} từ cần ôn hôm nay`
                : "Bạn đã hoàn thành lịch ôn"}
            </p>
          </div>
          {totalDueCount > 0 && !notificationsRead && (
            <button
              type="button"
              onClick={() => void onMarkAllRead()}
              className="text-xs font-bold text-yellow-700 hover:text-yellow-800"
            >
              Đọc tất cả
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? (
            <div className="space-y-2 p-2">
              <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
              <div className="h-14 animate-pulse rounded-xl bg-gray-100" />
            </div>
          ) : notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem key={notification.deckId} asChild>
                <Link
                  href={`/vocabulary/${notification.deckId}`}
                  className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-700">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-gray-900">
                      {notification.deckName}
                    </span>
                    <span className="block text-xs text-gray-500">
                      Có {notification.dueCount} từ cần ôn hôm nay
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <CheckCheck className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-2 text-sm font-bold text-gray-900">
                Không có thông báo mới
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Hiện chưa có từ nào đến hạn ôn.
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StreakDropdown({
  streak,
}: {
  streak: StudyStreak;
}) {
  const heatmapDays = useMemo(
    () => buildHeatmapDays(streak.activity),
    [streak.activity],
  );
  const recentReviewedCount = heatmapDays.reduce(
    (total, day) => total + day.reviewedCount,
    0,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Streak ${streak.current} ngày`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 text-sm font-bold text-orange-700 outline-none transition-colors hover:bg-orange-100 data-[state=open]:bg-orange-100"
        >
          <Flame className="h-4 w-4 fill-orange-400 text-orange-500" />
          <span>{streak.current}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-orange-100 bg-orange-50/70 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100">
                <Flame className="h-6 w-6 fill-orange-400 text-orange-500" />
              </span>
              <div>
                <p className="font-heading text-xl font-bold text-gray-900">
                  {streak.current} ngày liên tiếp
                </p>
                <p className="text-xs text-gray-500">
                  {streak.studiedToday
                    ? "Đã hoàn thành mục tiêu hôm nay"
                    : "Hoàn thành lịch ôn để giữ streak"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <StreakStat label="Kỷ lục" value={`${streak.longest} ngày`} />
            <StreakStat label="12 tuần qua" value={`${recentReviewedCount} từ`} />
          </div>

          <div className="mt-3 rounded-xl border border-orange-100 bg-white px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-gray-700">Mục tiêu hôm nay</span>
              <span className="font-bold text-orange-700">
                {streak.todayGoal > 0
                  ? `${streak.todayReviewed}/${streak.todayGoal} từ`
                  : streak.studiedToday
                    ? "Đã hoàn thành"
                    : "Không có từ cần ôn"}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-orange-100">
              <div
                className="h-full rounded-full bg-orange-400 transition-[width] duration-300"
                style={{ width: `${streak.todayProgress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              {streak.studiedToday
                ? "Bạn đã giữ streak hôm nay."
                : streak.todayGoal > 0
                  ? `Còn ${Math.max(streak.todayGoal - streak.todayReviewed, 0)} từ để giữ streak.`
                  : "Học một từ mới để giữ streak hôm nay."}
            </p>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Cường độ học tập</p>
            <p className="text-[11px] text-gray-400">12 tuần gần nhất</p>
          </div>

          <div className="flex gap-2">
            <div className="grid grid-rows-7 place-items-center gap-1 pt-px text-center text-[9px] leading-3 text-gray-400">
              <span />
              <span>T2</span>
              <span />
              <span>T4</span>
              <span />
              <span>T6</span>
              <span />
            </div>
            <div className="grid flex-1 grid-flow-col grid-rows-7 gap-1">
              {heatmapDays.map((day) => (
                <span
                  key={day.date}
                  title={formatActivityTitle(day)}
                  aria-label={formatActivityTitle(day)}
                  className={`aspect-square min-w-0 rounded-[3px] ${getActivityColor(day.reviewedCount)} ${
                    day.goalCompleted
                      ? "ring-1 ring-inset ring-emerald-500"
                      : ""
                  } ${day.future ? "opacity-30" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-gray-400">
            <span>Ít</span>
            {[0, 3, 10, 20, 31].map((count) => (
              <span
                key={count}
                className={`h-3 w-3 rounded-[3px] ${getActivityColor(count)}`}
              />
            ))}
            <span>Nhiều</span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StreakStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-orange-100 bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold text-gray-900">{value}</p>
    </div>
  );
}

interface HeatmapDay {
  date: string;
  reviewedCount: number;
  goalCompleted: boolean;
  future: boolean;
}

function buildHeatmapDays(activity: StudyActivity[]): HeatmapDay[] {
  const activityByDate = new Map(
    activity.map((item) => [item.activityDate, item]),
  );
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const start = new Date(end);
  start.setDate(start.getDate() - 83);

  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateKey = getDateKey(date);
    const item = activityByDate.get(dateKey);

    return {
      date: dateKey,
      reviewedCount: item?.reviewedCount ?? 0,
      goalCompleted: item?.goalCompleted ?? false,
      future: date > today,
    };
  });
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getActivityColor(reviewedCount: number) {
  if (reviewedCount <= 0) return "bg-gray-100";
  if (reviewedCount <= 5) return "bg-yellow-100";
  if (reviewedCount <= 15) return "bg-yellow-300";
  if (reviewedCount <= 30) return "bg-amber-400";
  return "bg-amber-600";
}

function formatActivityTitle(day: HeatmapDay) {
  const formattedDate = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${day.date}T12:00:00`));

  if (day.future) return formattedDate;
  if (day.reviewedCount === 0) return `${formattedDate}: Không có hoạt động`;

  return `${formattedDate}: Đã ôn ${day.reviewedCount} từ · ${
    day.goalCompleted ? "Đã hoàn thành mục tiêu" : "Chưa hoàn thành lịch ôn"
  }`;
}
