"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useQueryStates, parseAsString, parseAsInteger } from "nuqs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_ORDER, statusConfig } from "@/types/applicant";

export const APPLICANT_FILTER_PARSERS = {
  search: parseAsString.withDefault(""),
  status: parseAsString.withDefault("all"),
  position_id: parseAsString.withDefault("all"),
  page: parseAsInteger.withDefault(1),
};

export const APPLICANT_PAGE_SIZE = 25;

export function useApplicantFilters() {
  return useQueryStates(APPLICANT_FILTER_PARSERS, {
    history: "replace",
    shallow: false,
  });
}

interface ApplicantFiltersProps {
  positions: Array<{ id: string; label: string }>;
}

export function ApplicantFilters({ positions }: ApplicantFiltersProps) {
  const [filters, setFilters] = useApplicantFilters();
  // Local input for debouncing the search to keep typing snappy.
  const [searchLocal, setSearchLocal] = useState(filters.search);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchLocal !== filters.search) {
        void setFilters({ search: searchLocal, page: 1 });
      }
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchLocal]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="relative w-full md:max-w-sm">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchLocal}
          onChange={(e) => setSearchLocal(e.target.value)}
          placeholder="Search name, email, or position…"
          className="pl-9"
          aria-label="Search applicants"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          value={filters.status}
          onValueChange={(v) => void setFilters({ status: v, page: 1 })}
        >
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {statusConfig(s).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.position_id}
          onValueChange={(v) => void setFilters({ position_id: v, page: 1 })}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by position">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All positions</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
