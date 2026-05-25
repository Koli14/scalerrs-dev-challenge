import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Article QC — SEO Article Quality + Publisher",
  description: "Parse, audit, and publish SEO articles from Google Docs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
