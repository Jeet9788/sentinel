import { Overview } from "@/components/overview";
import { getSettings } from "@/lib/settings";

import metrics from "@/models/v1/metrics.json";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { tLow, tHigh } = await getSettings();
  return (
    <Overview
      tLow={tLow}
      tHigh={tHigh}
      prAuc={metrics.prAuc}
      rocAuc={metrics.rocAuc}
    />
  );
}
