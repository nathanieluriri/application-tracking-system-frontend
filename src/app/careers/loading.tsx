export default function CareersLoading() {
  return (
    <div>
      <section className="py-16 text-center">
        <div className="mx-auto mb-4 h-3 w-24 animate-pulse motion-reduce:animate-none rounded bg-white/10" />
        <div className="mx-auto h-12 w-72 animate-pulse motion-reduce:animate-none rounded bg-white/10 sm:w-96" />
        <div className="mx-auto mt-5 h-4 w-80 animate-pulse motion-reduce:animate-none rounded bg-white/5" />
      </section>
      <ul className="border-t border-white/10">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-6 border-b border-white/10 py-6"
          >
            <div className="min-w-0 flex-1">
              <div className="h-6 w-1/2 animate-pulse motion-reduce:animate-none rounded bg-white/10" />
              <div className="mt-2 h-4 w-1/3 animate-pulse motion-reduce:animate-none rounded bg-white/5" />
            </div>
            <div className="h-4 w-16 animate-pulse motion-reduce:animate-none rounded bg-white/5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
