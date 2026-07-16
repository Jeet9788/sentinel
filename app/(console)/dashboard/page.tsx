import { Overview } from "@/components/overview";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { tLow, tHigh } = await getSettings();
  return <Overview tLow={tLow} tHigh={tHigh} />;
}
