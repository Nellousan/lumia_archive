import type { Metadata } from "next";
import { Barlow_Condensed, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

/**
 * Where the app is published. Link unfurlers — Discord, Slack, the rest — fetch
 * the card from their own servers, so every social URL has to be absolute and
 * publicly reachable; this is the origin they are resolved against.
 *
 * The production origin is the default, because a card is only ever fetched from
 * the deployed site: a localhost base would put a URL in the tags that nobody
 * outside this machine can open. `NEXT_PUBLIC_SITE_URL` overrides it, and on
 * Vercel the project's own production domain wins over the literal below, so
 * pointing a custom domain at the deployment needs no change here.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://lumia-archive.vercel.app");

const TITLE = "Lumia Archive — Black Survival Wiki";
const DESCRIPTION = "Interactive item and resource map for Black Survival Project Lumia";

/**
 * The card as Discord draws it: `summary` with a square image is the shape that
 * puts the site's mark in the corner of the embed, which is what a shared link
 * looks like when it carries an icon. `summary_large_image` would stretch the
 * same file across the top of the card instead.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Lumia Archive",
  // One page, so it is its own canonical: this is also what fills `og:url`,
  // which some unfurlers use to key their cache.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Lumia Archive",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/og.png",
        width: 256,
        height: 256,
        alt: "Lumia Archive",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${barlowCondensed.variable}`}>
      <body>{children}</body>
    </html>
  );
}
