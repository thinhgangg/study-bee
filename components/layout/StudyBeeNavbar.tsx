"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  Settings,
  Target,
  User,
  X,
} from "lucide-react";
import { StudyBeeLogo } from "@/components/StudyBeeLogo";

const navItems = [
  { label: "Từ vựng", href: "/vocabulary", icon: BookOpenCheck },
  { label: "Luyện kỹ năng", href: "/#features", icon: Mic2 },
  { label: "Mock Test", href: "/#features", icon: Target },
  { label: "Lộ trình", href: "/#features", icon: LayoutDashboard },
  { label: "Bảng giá", href: "/#pricing", icon: GraduationCap },
];

interface StudyBeeNavbarProps {
  userEmail?: string;
  loadingAuth?: boolean;
  showAuthActions?: boolean;
  onSignOut?: () => void | Promise<void>;
}

export function StudyBeeNavbar({
  userEmail = "",
  loadingAuth = false,
  showAuthActions = false,
  onSignOut,
}: StudyBeeNavbarProps) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = Boolean(userEmail);
  const initials = userEmail.trim()[0]?.toUpperCase() || "B";

  useEffect(() => {
    if (!accountOpen && !mobileMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!accountMenuRef.current?.contains(target)) {
        setAccountOpen(false);
      }
      if (!mobileMenuRef.current?.contains(target)) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [accountOpen, mobileMenuOpen]);

  async function handleSignOut() {
    await onSignOut?.();
    setAccountOpen(false);
    setMobileMenuOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-yellow-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-5 lg:px-8">
        <div className="min-w-0 shrink-0">
          <StudyBeeLogo
            className="min-w-0"
            imageClassName="h-8 w-8 shrink-0"
            textClassName="truncate font-heading text-xl font-bold text-gray-900"
          />
        </div>

        <nav className="hidden items-center gap-0.5 text-sm text-gray-500 md:flex lg:gap-1">
          {navItems.map(({ label, href, icon: Icon }) => {
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
        </nav>

        <div className="hidden md:block">
          {loadingAuth ? (
            <div className="h-10 w-36 animate-pulse rounded-full bg-gray-100" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Thông báo"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-yellow-100 bg-white text-gray-600 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50 hover:text-gray-900"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-white" />
              </button>

              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  aria-expanded={accountOpen}
                  className="flex items-center gap-2 rounded-full border border-yellow-100 bg-white py-1 pl-1 pr-3 text-sm font-semibold text-gray-700 shadow-sm shadow-yellow-100/50 transition-colors hover:bg-yellow-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-300 font-heading text-sm font-bold text-gray-900">
                    {initials}
                  </span>
                  <span className="hidden max-w-28 truncate sm:inline">
                    {userEmail || "StudyBee"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </button>

                {accountOpen && (
                  <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-yellow-100 bg-white p-2 shadow-xl shadow-yellow-100/70">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-yellow-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <User className="h-4 w-4 text-yellow-600" />
                      Hồ sơ
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-yellow-50"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Settings className="h-4 w-4 text-yellow-600" />
                      Cài đặt
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
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

        <div ref={mobileMenuRef} className="relative flex shrink-0 md:hidden">
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
                {navItems.map(({ label, href, icon: Icon }) => {
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
