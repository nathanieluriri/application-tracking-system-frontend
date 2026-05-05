import { Mail, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MOCK_SENT_EMAILS = [
  { id: "1", to: "adaeze@email.com", name: "Adaeze Okonkwo", subject: "Interview Invitation - Frontend Developer", status: "delivered", sentAt: "2026-05-04T10:30:00" },
  { id: "2", to: "chukwuma@email.com", name: "Chukwuma Eze", subject: "Congratulations! You've been selected", status: "delivered", sentAt: "2026-05-03T14:15:00" },
  { id: "3", to: "ibrahim@email.com", name: "Ibrahim Musa", subject: "Update on your application for DevOps", status: "delivered", sentAt: "2026-05-03T09:45:00" },
  { id: "4", to: "fatima@email.com", name: "Fatima Bello", subject: "Interview Invitation - UI/UX Designer", status: "pending", sentAt: "2026-05-05T08:00:00" },
  { id: "5", to: "ngozi@email.com", name: "Ngozi Umeh", subject: "Congratulations! You've been selected", status: "failed", sentAt: "2026-05-02T16:20:00" },
];

const STATUS_MAP: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  delivered: { icon: CheckCircle, color: "text-success", label: "Delivered" },
  pending: { icon: Clock, color: "text-warning", label: "Pending" },
  failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

export function EmailsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Sent Emails</h2>
        <p className="text-sm text-muted-foreground mt-1">Track all sent communications</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-2xl font-semibold text-foreground">47</p>
          <p className="text-xs text-muted-foreground mt-1">Total Sent</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-2xl font-semibold text-success">94%</p>
          <p className="text-xs text-muted-foreground mt-1">Delivery Rate</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-2xl font-semibold text-accent">12</p>
          <p className="text-xs text-muted-foreground mt-1">This Week</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Recipient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SENT_EMAILS.map(email => {
              const statusInfo = STATUS_MAP[email.status];
              const Icon = statusInfo.icon;
              return (
                <tr key={email.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{email.name}</p>
                    <p className="text-xs text-muted-foreground">{email.to}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{email.subject}</td>
                  <td className="px-4 py-3">
                    <div className={`flex items-center gap-1.5 text-sm ${statusInfo.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {statusInfo.label}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(email.sentAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
