import Link from "next/link";
import { serverFetch } from "@/lib/api/server";

export const dynamic = "force-dynamic";

interface Role {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
}

function metaLine(r: Role): string {
  return [r.department, r.location, r.employment_type?.replace(/_/g, " ")]
    .filter(Boolean)
    .join("  ·  ");
}

export default async function CareersPage() {
  const res = await serverFetch<{ data: Role[] }>("/v1/positions/public?start=0&stop=200");
  const roles = res.data?.data ?? [];

  return (
    <div>
      <section className="animate-in fade-in slide-in-from-bottom-3 py-16 text-center duration-700">
        <p className="mb-4 text-xs uppercase tracking-[0.25em] text-emerald-400/80">
          We&apos;re hiring
        </p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl font-semibold leading-[1.05] tracking-tight text-zinc-50 sm:text-6xl">
          Featured roles
        </h1>
        <p className="mx-auto mt-5 max-w-md text-balance text-sm leading-relaxed text-zinc-400">
          We&apos;re always seeking talented individuals to join our team. Find the role that fits
          you below.
        </p>
      </section>

      {roles.length === 0 ? (
        <div className="border-t border-white/10 py-20 text-center">
          <p className="text-zinc-400">No open roles right now.</p>
          <p className="mt-1 text-sm text-zinc-600">Check back soon — new positions open often.</p>
        </div>
      ) : (
        <ul className="border-t border-white/10">
          {roles.map((role, i) => (
            <li
              key={role.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500"
              style={{ animationDelay: `${120 + i * 60}ms` }}
            >
              <Link
                href={`/careers/${role.id}`}
                className="group flex items-center justify-between gap-6 border-b border-white/10 py-6 transition-colors hover:bg-white/[0.025]"
              >
                <div className="min-w-0">
                  <h2 className="truncate font-[family-name:var(--font-fraunces)] text-xl font-medium text-zinc-100 transition-colors group-hover:text-white">
                    {role.title}
                  </h2>
                  {metaLine(role) && (
                    <p className="mt-1 text-sm text-zinc-500">{metaLine(role)}</p>
                  )}
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm text-emerald-400 opacity-80 transition-all group-hover:gap-2 group-hover:opacity-100">
                  View role
                  <span aria-hidden>↗</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
