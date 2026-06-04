import { TableSkeleton } from "@/components/feedback/skeletons/TableSkeleton";

export default function Loading() {
  return <TableSkeleton rows={10} columns={6} />;
}
