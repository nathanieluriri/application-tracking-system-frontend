import { useState } from "react";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MOCK_TEMPLATES, type EmailTemplate } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

const TYPE_COLORS: Record<string, string> = {
  acceptance: "bg-success/10 text-success border-success/20",
  rejection: "bg-destructive/10 text-destructive border-destructive/20",
  interview: "bg-accent/10 text-accent border-accent/20",
  custom: "bg-muted text-muted-foreground border-border",
};

export function TemplatesView() {
  const { toast } = useToast();
  const [templates] = useState<EmailTemplate[]>(MOCK_TEMPLATES);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Email Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage reusable email templates</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      <div className="space-y-3">
        {templates.map(template => (
          <div key={template.id} className="bg-card rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.subject}</p>
                </div>
              </div>
              <Badge variant="outline" className={TYPE_COLORS[template.type]}>{template.type}</Badge>
            </button>
            {expandedId === template.id && (
              <div className="px-5 pb-4 border-t border-border pt-3">
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">{template.body}</pre>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm">
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
