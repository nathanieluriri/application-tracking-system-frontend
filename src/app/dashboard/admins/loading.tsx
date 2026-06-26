import { TableSkeleton } from "@/components/feedback/skeletons/TableSkeleton";

export default function Loading() {
  return <TableSkeleton rows={5} columns={4} />;
}
