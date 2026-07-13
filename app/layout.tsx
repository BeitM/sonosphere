import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return {
    title: { default: "Sonosphere", template: "%s · Sonosphere" },
    description: "Translate musical meaning into a coherent, explorable 3D world prompt.",
    openGraph: { title: "Sonosphere — Turn a song into a world.", description: "Translate sound, meaning, and emotional structure into a coherent, explorable 3D environment prompt.", type: "website", images: [{ url: image, width: 1200, height: 630, alt: "Sonosphere — Turn a song into a world." }] },
    twitter: { card: "summary_large_image", title: "Sonosphere — Turn a song into a world.", description: "Music understanding for worlds not yet built.", images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>;
}
