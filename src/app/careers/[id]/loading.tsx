export default function RoleDetailLoading() {
  return (
    <div className="py-12">
      <div className="h-4 w-20 animate-pulse motion-reduce:animate-none rounded bg-white/5" />
      <div className="mt-8 border-b border-white/10 pb-8">
        <div className="h-12 w-2/3 animate-pulse motion-reduce:animate-none rounded bg-white/10" />
        <div className="mt-5 flex gap-2">
          <div className="h-7 w-24 animate-pulse motion-reduce:animate-none rounded-full bg-white/5" />
          <div className="h-7 w-20 animate-pulse motion-reduce:animate-none rounded-full bg-white/5" />
        </div>
      </div>
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full animate-pulse motion-reduce:animate-none rounded bg-white/5" />
        <div className="h-4 w-5/6 animate-pulse motion-reduce:animate-none rounded bg-white/5" />
        <div className="h-4 w-4/6 animate-pulse motion-reduce:animate-none rounded bg-white/5" />
      </div>
    </div>
  );
}
