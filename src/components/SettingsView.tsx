import { Bell, Mail, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export function SettingsView() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your recruitment portal</p>
      </div>

      {/* Notifications */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "New application received", defaultChecked: true },
            { label: "Application status changed", defaultChecked: true },
            { label: "Interview reminder (24h before)", defaultChecked: true },
            { label: "Weekly summary report", defaultChecked: false },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{item.label}</span>
              <Switch defaultChecked={item.defaultChecked} />
            </div>
          ))}
        </div>
      </div>

      {/* Email Config */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Email Configuration</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Reply-To Email</label>
            <Input defaultValue="hr@hireboard.ng" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Sender Name</label>
            <Input defaultValue="HireBoard HR" />
          </div>
        </div>
      </div>

      {/* Portal */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Application Portal</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Accept new applications</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Require CV upload</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Auto-acknowledge applications</span>
            <Switch defaultChecked />
          </div>
        </div>
      </div>

      <Button>Save Changes</Button>
    </div>
  );
}
