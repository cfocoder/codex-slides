import type { Metadata } from "next";
import GlobalSettings from "@/components/GlobalSettings";
import { I18nProvider } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codex Slides — the open-source AI slide studio inside Codex",
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
