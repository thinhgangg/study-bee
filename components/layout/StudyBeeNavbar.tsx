"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookA,
  ChevronDown,
  LogOut,
  Menu,
  Settings,
  User,
  X,
  Dumbbell,
  ClipboardCheck,
  Route,
  CreditCard,
} from "lucide-react";
import { StudyBeeLogo } from "@/components/StudyBeeLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Từ vựng", href: "/vocabulary", icon: BookA },
  { label: "Luyện kỹ năng", href: "/#features", icon: Dumbbell },
  { label: "Mock Test", href: "/#features", icon: ClipboardCheck },
  { label: "Lộ trình", href: "/#features", icon: Route },
  { label: "Bảng giá", href: "/#pricing", icon: CreditCard },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const isLoggedIn = Boolean(userEmail);
  const initials = userEmail.trim()[0]?.toUpperCase() || "B";

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
