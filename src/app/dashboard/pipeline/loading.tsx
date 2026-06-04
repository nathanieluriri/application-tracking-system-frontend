import { CardSkeleton } from "@/components/feedback/skeletons/CardSkeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
