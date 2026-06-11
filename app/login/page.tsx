"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    router.push("/vocabulary");
  }

  async function handleGoogleLogin() {
    setErrorMessage("");
    setIsGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/vocabulary`
            : undefined,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setIsGoogleLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#FFFBEB] px-6 py-10 text-gray-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(250,204,21,0.3)_1px,transparent_0)] bg-[length:28px_28px]" />

      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center rounded-3xl border border-yellow-100 bg-white p-7 shadow-2xl shadow-yellow-100/70 md:p-9">
          <Link href="/">
            <img
              src="/studybee-logo.svg"
              alt="StudyBee"
              className="h-20 w-20 object-contain"
            />
          </Link>

          <div className="mb-7 mt-4 text-center">
            <h1 className="font-heading text-3xl font-bold text-gray-900">
              Chào mừng trở lại!
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              Sẵn sàng chinh phục IELTS hôm nay chứ?
            </p>
          </div>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="flex items-center gap-2 text-sm font-semibold text-gray-600"
              >
                <Mail className="h-[18px] w-[18px] text-yellow-600" />
                Địa chỉ email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="alex@studybee.com"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
              />
            </div>

            <div className="relative space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-600"
                >
                  <Lock className="h-[18px] w-[18px] text-yellow-600" />
                  Mật khẩu
                </label>
              </div>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3 pr-12 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-yellow-400 focus:bg-white focus:ring-4 focus:ring-yellow-400/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-900"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <button
                type="button"
                className="absolute right-0 top-0 text-xs font-semibold text-yellow-700 transition hover:text-gray-900"
              >
                Quên mật khẩu?
              </button>
            </div>

            <label className="flex items-center gap-3 pt-1 text-sm font-semibold text-gray-600">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
              />
              Ghi nhớ thiết bị này
            </label>

            {errorMessage && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="mt-1 flex w-full items-center justify-center gap-3 rounded-full bg-gray-900 px-5 py-3 text-base font-bold text-yellow-300 shadow-lg shadow-gray-900/10 transition hover:bg-gray-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
              {!isLoading && <ArrowRight className="h-5 w-5" />}
            </button>
          </form>

          <div className="mt-8 w-full space-y-4 text-center">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-100" />
              <span className="mx-6 flex-shrink text-xs font-semibold text-gray-300">
                HOẶC
              </span>
              <div className="flex-grow border-t border-gray-100" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <GoogleIcon />
              {isGoogleLoading ? "Đang chuyển hướng..." : "Tiếp tục với Google"}
            </button>

            <p className="mt-5 text-center text-sm text-gray-500">
              Chưa có tài khoản?{" "}
              <Link
                href="/register"
                className="font-bold text-yellow-700 underline-offset-4 hover:underline"
              >
                Đăng ký
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
