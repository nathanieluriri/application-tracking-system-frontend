import { notFound } from "next/navigation";
import Link from "next/link";
import { serverFetch } from "@/lib/api/server";
import { ApplicationForm } from "@/components/careers/application-form";

export const dynamic = "force-dynamic";

interface Role {
  id: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
  description?: string | null;
  requirements?: string[] | null;
}

function fmtType(t?: string | null): string | null {
  if (!t) return null;
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await serverFetch<{ data: Role }>(`/v1/positions/public/${id}`);
  const role = res.data?.data;
  if (!role) notFound();

  const tags = [role.department, role.location, fmtType(role.employment_type)].filter(Boolean) as string[];

  return (
    <article className="animate-in fade-in slide-in-from-bottom-3 py-12 duration-700">
      <Link
        href="/careers"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span aria-hidden>←</span> All roles
      </Link>

      <header className="mt-8 border-b border-white/10 pb-8">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
          {role.title}
        </h1>
        {tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/12 px-3 py-1 text-xs text-zinc-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      {role.description && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">About the role</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-zinc-300">
            {role.description}
          </p>
        </section>
      )}

      {role.requirements && role.requirements.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">What we&apos;re looking for</h2>
          <ul className="mt-3 space-y-2">
            {role.requirements.map((req, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-zinc-300">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                {req}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 border-t border-white/10 pt-10">
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl font-medium text-zinc-50">
          Apply for this role
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Tell us a little about yourself. Fields marked with * are required.
        </p>
        <div className="mt-6">
          <ApplicationForm positionId={role.id} roleTitle={role.title} />
        </div>
      </section>
    </article>
  );
}
