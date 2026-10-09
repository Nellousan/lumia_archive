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
 * the card from their own servers and do not resolve relative paths, so every
 * social URL has to be absolute: this is the origin they are resolved against.
 * Set `NEXT_PUBLIC_SITE_URL` to the deployed origin at build time; the localhost
 * fallback keeps the tags well-formed in development.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
