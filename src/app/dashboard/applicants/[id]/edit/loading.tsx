import { FormSkeleton } from "@/components/feedback/skeletons/FormSkeleton";

export default function Loading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <FormSkeleton fields={4} />
    </div>
  );
}
