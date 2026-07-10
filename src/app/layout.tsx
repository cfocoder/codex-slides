import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PPT Anything — zero-config decks via Codex",
  description:
    "Generate a slide deck by image generation, driven entirely by your local Codex agent. No API key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
