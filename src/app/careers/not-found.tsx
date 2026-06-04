import Link from "next/link";

export default function CareersNotFound() {
  return (
    <div className="flex flex-col items-center py-28 text-center">
      <p className="font-[family-name:var(--font-fraunces)] text-6xl font-semibold text-zinc-700">
        404
      </p>
      <h1 className="mt-4 font-[family-name:var(--font-fraunces)] text-2xl text-zinc-100">
        This role isn&apos;t open
      </h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        The position you&apos;re looking for may have been filled or closed.
      </p>
      <Link
        href="/careers"
        className="mt-8 rounded-full border border-white/15 px-5 py-2.5 text-sm text-zinc-200 transition hover:border-emerald-400/50 hover:text-white"
      >
        View all open roles
      </Link>
    </div>
  );
}
