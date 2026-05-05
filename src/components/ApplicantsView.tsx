import { useState, useMemo, useCallback } from "react";
import { Search, Filter, ChevronDown, Mail, MoreHorizontal, Download, Star, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useDebounce } from "@/hooks/use-debounce";
import { type Applicant, type ApplicationStatus, STATUS_CONFIG, MOCK_APPLICANTS } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

interface ApplicantsViewProps {
  onComposeEmail: (applicants: Applicant[]) => void;
}

export function ApplicantsView({ onComposeEmail }: ApplicantsViewProps) {
  const { toast } = useToast();
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounce(searchQuery, 300);

  const positions = useMemo(() => [...new Set(applicants.map(a => a.position))], [applicants]);

  const filtered = useMemo(() => {
    return applicants.filter(a => {
      const matchesSearch = !debouncedSearch ||
        a.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.email.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        a.position.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesStatus = statusFilter === "all" || a.status === statusFilter;
      const matchesPosition = positionFilter === "all" || a.position === positionFilter;
      return matchesSearch && matchesStatus && matchesPosition;
    });
  }, [applicants, debouncedSearch, statusFilter, positionFilter]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  }, [filtered, selectedIds.size]);

  const updateStatus = useCallback((id: string, status: ApplicationStatus) => {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    toast({ title: "Status updated", description: `Applicant status changed to ${STATUS_CONFIG[status].label}` });
  }, [toast]);

  const bulkUpdateStatus = useCallback((status: ApplicationStatus) => {
    setApplicants(prev => prev.map(a => selectedIds.has(a.id) ? { ...a, status } : a));
    toast({ title: "Bulk update", description: `${selectedIds.size} applicants updated to ${STATUS_CONFIG[status].label}` });
    setSelectedIds(new Set());
  }, [selectedIds, toast]);

  const selectedApplicants = useMemo(() => applicants.filter(a => selectedIds.has(a.id)), [applicants, selectedIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Applicants</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} applicants found</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserCheck className="h-4 w-4 mr-1" />
                    Bulk Status
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map(s => (
                    <DropdownMenuItem key={s} onClick={() => bulkUpdateStatus(s)}>
                      {STATUS_CONFIG[s].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="accent" size="sm" onClick={() => onComposeEmail(selectedApplicants)}>
                <Mail className="h-4 w-4 mr-1" />
                Email ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, position..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Applicant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Applied</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((applicant) => (
                <tr key={applicant.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selectedIds.has(applicant.id)}
                      onCheckedChange={() => toggleSelect(applicant.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{applicant.name}</p>
                      <p className="text-xs text-muted-foreground">{applicant.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{applicant.position}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_CONFIG[applicant.status].color}>
                      {STATUS_CONFIG[applicant.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`h-3.5 w-3.5 ${s <= applicant.rating ? "fill-warning text-warning" : "text-border"}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(applicant.appliedDate).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onComposeEmail([applicant])}>
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-xs font-medium text-muted-foreground" disabled>
                            Change Status
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map(s => (
                            <DropdownMenuItem key={s} onClick={() => updateStatus(applicant.id, s)}>
                              {STATUS_CONFIG[s].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No applicants found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
