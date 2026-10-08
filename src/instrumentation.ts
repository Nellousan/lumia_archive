/**
 * Next calls `register()` once per server process, before it serves anything.
 *
 * The dataset is built here so the loader's summary — item/area counts and any
 * data note it had to work around — lands on stdout at startup instead of in the
 * UI. The page still builds it lazily; `reportDataset` only logs once.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getWikiDataset } = await import("@/lib/wiki/dataset");
  getWikiDataset();
}
