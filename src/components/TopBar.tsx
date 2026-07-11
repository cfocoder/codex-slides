"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/** Slim app bar: workspace pill (left) + agent status / credits (right). */
export default function TopBar({
  workspace = "PPT Anything",
  codexReady,
  agentLabel,
}: {
  workspace?: string;
  codexReady?: boolean | null;
  agentLabel?: string;
}) {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={`appbar${scrolled ? " scrolled" : ""}`}>
      <Link href="/" className="ws-pill">
        <span className="glyph">◈</span>
        {workspace}
        <span className="caret">▾</span>
      </Link>
      <div className="appbar-right">
        {codexReady !== undefined && (
          <span className="credits" title={agentLabel}>
            <span className={`status-dot ${codexReady == null ? "" : codexReady ? "on" : "off"}`} />
            {codexReady == null ? "…" : codexReady ? t("topbar.codexReady") : t("topbar.codexMissing")}
          </span>
        )}
      </div>
    </header>
  );
}
