import { QueueView } from "@/components/queue/queue-view";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const { tLow, tHigh } = await getSettings();
  return <QueueView tLow={tLow} tHigh={tHigh} />;
}
