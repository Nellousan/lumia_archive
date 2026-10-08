import { WikiExplorer } from "@/components/explorer/WikiExplorer";
import { getWikiDataset } from "@/lib/wiki/dataset";

/**
 * Server entry point. The dataset is built here and handed to the interactive
 * explorer, so the JSON stays out of the client-only code paths and the data
 * source can later become async (CMS, API) without touching the components.
 */
export default function Page() {
  const dataset = getWikiDataset();

  return <WikiExplorer dataset={dataset} />;
}
