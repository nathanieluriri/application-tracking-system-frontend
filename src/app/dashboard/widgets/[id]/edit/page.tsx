import { WidgetBuilder } from "@/components/widgets/WidgetBuilder";

export default async function WidgetEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WidgetBuilder widgetId={id} />;
}
