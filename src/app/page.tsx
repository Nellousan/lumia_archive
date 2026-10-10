import type { Metadata } from "next";
import { WikiExplorer } from "@/components/explorer/WikiExplorer";
import { getWikiDataset } from "@/lib/wiki/dataset";
import { linkPreview, type LinkPreview } from "@/lib/wiki/preview";
import { decodeSharedPlan } from "@/lib/wiki/share";

/**
 * Server entry point. The dataset is built here and handed to the interactive
 * explorer, so the JSON stays out of the client-only code paths and the data
 * source can later become async (CMS, API) without touching the components.
 *
 * The page also answers for its own `<head>`: a shared link unfurls into a card
 * that says what it points at — the item, the plan, or the route — and an unfurler
 * runs no JavaScript, so the card has to be built here, from the same payload the
 * browser decodes. That is what makes this route dynamic: the answer depends on the
 * query, so every request renders. The dataset is built once per process, and the
 * solver only runs for a link that names a route.
 */

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** The request's own query, kept so the card is keyed by the URL that was shared. */
function requestPath(searchParams: Record<string, string | string[] | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) for (const entry of value) query.append(key, entry);
  }
  const search = query.toString().replace(/%2C/g, ",");
  return search === "" ? "/" : `/?${search}`;
}

/**
 * One preview, as the tags an unfurler reads.
 *
 * `openGraph` and `twitter` are written whole rather than patched: metadata merges
 * a field at a time, so a half-filled object would inherit the other half from the
 * site's own card and describe two different links at once.
 */
function metadataFor(preview: LinkPreview, path: string): Metadata {
  const image = {
    url: preview.image.url,
    width: preview.image.width,
    height: preview.image.height,
    alt: preview.image.alt,
  };

  return {
    // The whole title, not a page within the site: there is no template to feed.
    title: { absolute: preview.title },
    description: preview.description,
    openGraph: {
      type: "website",
      // The URL that was shared, query and all. Keying every card on the bare
      // origin would tell an unfurler that all plans are the same page.
      url: path,
      siteName: "Lumia Archive",
      title: preview.title,
      description: preview.description,
      images: [image],
    },
    twitter: {
      card: "summary",
      title: preview.title,
      description: preview.description,
      images: [image],
    },
  };
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const payload = params.p;
  const dataset = getWikiDataset();

  // A payload this build cannot read — junk, or from another version — previews as
  // the site itself rather than as a broken card.
  const plan = typeof payload === "string" ? decodeSharedPlan(payload, dataset) : null;

  return metadataFor(linkPreview(dataset, plan), requestPath(params));
}

export default function Page() {
  const dataset = getWikiDataset();

  return <WikiExplorer dataset={dataset} />;
}
