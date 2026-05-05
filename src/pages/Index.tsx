import { useState, useCallback } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { OverviewView } from "@/components/OverviewView";
import { ApplicantsView } from "@/components/ApplicantsView";
import { PipelineView } from "@/components/PipelineView";
import { EmailComposer } from "@/components/EmailComposer";
import { EmailsView } from "@/components/EmailsView";
import { TemplatesView } from "@/components/TemplatesView";
import { PositionsView } from "@/components/PositionsView";
import { SettingsView } from "@/components/SettingsView";
import type { Applicant } from "@/lib/mock-data";

const Index = () => {
  const [activeView, setActiveView] = useState("overview");
  const [emailRecipients, setEmailRecipients] = useState<Applicant[] | null>(null);

  const handleComposeEmail = useCallback((applicants: Applicant[]) => {
    setEmailRecipients(applicants);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case "overview": return <OverviewView />;
      case "applicants": return <ApplicantsView onComposeEmail={handleComposeEmail} />;
      case "pipeline": return <PipelineView />;
      case "emails": return <EmailsView />;
      case "templates": return <TemplatesView />;
      case "positions": return <PositionsView />;
      case "settings": return <SettingsView />;
      default: return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardSidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="ml-64 p-8">
        {renderView()}
      </main>
      {emailRecipients && (
        <EmailComposer recipients={emailRecipients} onClose={() => setEmailRecipients(null)} />
      )}
    </div>
  );
};

export default Index;
