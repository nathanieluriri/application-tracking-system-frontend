import { TableSkeleton } from "@/components/feedback/skeletons/TableSkeleton";

export default function Loading() {
  return <TableSkeleton rows={8} columns={5} />;
}
