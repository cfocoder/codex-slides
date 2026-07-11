import type { Metadata } from "next";
import GlobalSettings from "@/components/GlobalSettings";
import I18nProvider from "@/i18n/I18nProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PPT Anything — zero-config decks via Codex",
  description:
    "Generate a slide deck by image generation, driven entirely by your local Codex agent. No API key.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <I18nProvider>
          <GlobalSettings />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
