import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildmates.yashns.chatgpt.site"),
  title: { default: "Buildmates", template: "%s | Buildmates" },
  description: "A builder network shaped by what people are working on now.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Buildmates",
    title: "Buildmates",
    description: "Meet builders through what they are working on now.",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "Find your people through what you build." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Buildmates",
    description: "Meet builders through what they are working on now.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><a className="skip-link" href="#main-content">Skip to main content</a><div id="main-content" tabIndex={-1}>{children}</div></body>
    </html>
  );
}
