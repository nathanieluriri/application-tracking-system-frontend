"use client";

import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { POSITION_STATUS_ORDER, positionStatusConfig } from "@/types/position";

// The positions list API supports `status` and `department` (exact-match) —
// there is no free-text search param, so we expose two selects only.
export const POSITION_FILTER_PARSERS = {
  status: parseAsString.withDefault("all"),
  department: parseAsString.withDefault("all"),
  page: parseAsInteger.withDefault(1),
};

export const POSITION_PAGE_SIZE = 25;

export function usePositionFilters() {
  return useQueryStates(POSITION_FILTER_PARSERS, {
    history: "replace",
    shallow: false,
  });
}

interface PositionFiltersProps {
  departments: string[];
}

export function PositionFilters({ departments }: PositionFiltersProps) {
  const [filters, setFilters] = usePositionFilters();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      {departments.length > 0 ? (
        <Select
          value={filters.department}
          onValueChange={(v) => void setFilters({ department: v, page: 1 })}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by department">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Select
        value={filters.status}
        onValueChange={(v) => void setFilters({ status: v, page: 1 })}
      >
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {POSITION_STATUS_ORDER.map((s) => (
            <SelectItem key={s} value={s}>
              {positionStatusConfig(s).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
