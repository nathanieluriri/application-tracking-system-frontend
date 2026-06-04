import type { ReactNode } from "react";
import Link from "next/link";
import { Fraunces } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK", "opsz"],
});

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Careers";

/**
 * Public careers chrome — a self-contained dark, editorial canvas (no dashboard
 * sidebar, no auth) matching the embeddable widget's default visual language.
 */
export default function CareersLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} min-h-screen bg-[#0b0b0c] text-zinc-100 antialiased`}
    >
      <div className="flex min-h-screen flex-col">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-7">
          <Link
            href="/careers"
            className="font-[family-name:var(--font-fraunces)] text-lg font-semibold tracking-tight text-zinc-50 transition-opacity hover:opacity-80"
          >
            {APP_NAME}
            <span className="text-emerald-400">.</span>
          </Link>
          <Link
            href="/careers"
            className="text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-100 hover:underline"
          >
            All roles
          </Link>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24">{children}</main>

        <footer className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="border-t border-white/10 pt-6 text-xs text-zinc-500">
            © {APP_NAME} — careers. Powered by an in-house ATS.
          </div>
        </footer>
      </div>
    </div>
  );
}
