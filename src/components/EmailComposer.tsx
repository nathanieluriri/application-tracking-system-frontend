import { useState, useCallback, useMemo } from "react";
import { X, Send, ChevronDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Applicant, MOCK_TEMPLATES } from "@/lib/mock-data";
import { useToast } from "@/hooks/use-toast";

interface EmailComposerProps {
  recipients: Applicant[];
  onClose: () => void;
}

function interpolate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || `{{${key}}}`);
}

export function EmailComposer({ recipients, onClose }: EmailComposerProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [sending, setSending] = useState(false);

  const isBulk = recipients.length > 1;

  const applyTemplate = useCallback((templateId: string) => {
    setSelectedTemplate(templateId);
    const template = MOCK_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    if (recipients.length === 1) {
      const data = { name: recipients[0].name, position: recipients[0].position, email: recipients[0].email };
      setSubject(interpolate(template.subject, data));
      setBody(interpolate(template.body, data));
    } else {
      setSubject(template.subject);
      setBody(template.body + "\n\n(Variables like {{name}} and {{position}} will be personalized for each recipient)");
    }
  }, [recipients]);

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Missing fields", description: "Please fill in subject and body", variant: "destructive" });
      return;
    }
    setSending(true);
    // Simulate API call
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    toast({
      title: "Email sent!",
      description: `Successfully sent to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}`,
    });
    onClose();
  }, [subject, body, recipients.length, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              {isBulk ? "Bulk Email" : "Compose Email"}
            </h3>
            {isBulk && (
              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                <Users className="h-3 w-3 mr-1" />
                {recipients.length} recipients
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          {/* Recipients */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">To</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-muted/50 rounded-lg border border-border min-h-[40px]">
              {recipients.slice(0, 5).map(r => (
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {r.name} &lt;{r.email}&gt;
                </Badge>
              ))}
              {recipients.length > 5 && (
                <Badge variant="secondary" className="text-xs">+{recipients.length - 5} more</Badge>
              )}
            </div>
          </div>

          {/* Template Selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Template</label>
            <Select value={selectedTemplate} onValueChange={applyTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template or write custom..." />
              </SelectTrigger>
              <SelectContent>
                {MOCK_TEMPLATES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subject</label>
            <Input
              placeholder="Email subject..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Body</label>
            <Textarea
              placeholder="Write your email..."
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              className="resize-none"
            />
          </div>

          {/* Variables hint */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs text-muted-foreground">
              <strong>Available variables:</strong>{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{name}}"}</code>{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{position}}"}</code>{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{email}}"}</code>
              {" — these will be replaced with each recipient's data."}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? "Sending..." : (
              <>
                <Send className="h-4 w-4 mr-1" />
                {isBulk ? `Send to ${recipients.length} recipients` : "Send Email"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
