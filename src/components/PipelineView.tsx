import { useState, useCallback } from "react";
import { MOCK_APPLICANTS, STATUS_CONFIG, type ApplicationStatus, type Applicant } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Star, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PIPELINE_STAGES: ApplicationStatus[] = ["new", "reviewing", "shortlisted", "interview", "offered", "accepted", "rejected"];

export function PipelineView() {
  const { toast } = useToast();
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const groupedByStatus = PIPELINE_STAGES.reduce((acc, status) => {
    acc[status] = applicants.filter(a => a.status === status);
    return acc;
  }, {} as Record<ApplicationStatus, Applicant[]>);

  const handleDragStart = useCallback((id: string) => setDraggedId(id), []);

  const handleDrop = useCallback((status: ApplicationStatus) => {
    if (!draggedId) return;
    setApplicants(prev => prev.map(a => a.id === draggedId ? { ...a, status } : a));
    const applicant = applicants.find(a => a.id === draggedId);
    toast({ title: "Moved", description: `${applicant?.name} → ${STATUS_CONFIG[status].label}` });
    setDraggedId(null);
  }, [draggedId, applicants, toast]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Pipeline</h2>
        <p className="text-sm text-muted-foreground mt-1">Drag applicants between stages</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map(stage => (
          <div
            key={stage}
            className="min-w-[220px] flex-shrink-0"
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(stage)}
          >
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className={STATUS_CONFIG[stage].color}>
                {STATUS_CONFIG[stage].label}
              </Badge>
              <span className="text-xs text-muted-foreground">{groupedByStatus[stage].length}</span>
            </div>
            <div className="space-y-2 min-h-[200px] bg-muted/30 rounded-lg p-2 border border-dashed border-border">
              {groupedByStatus[stage].map(applicant => (
                <div
                  key={applicant.id}
                  draggable
                  onDragStart={() => handleDragStart(applicant.id)}
                  className="bg-card rounded-lg border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{applicant.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{applicant.position}</p>
                      <div className="flex gap-0.5 mt-1.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3 w-3 ${s <= applicant.rating ? "fill-warning text-warning" : "text-border"}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
