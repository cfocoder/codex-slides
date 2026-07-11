"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent } from "react";
import ProjectLoadingShell from "@/components/ProjectLoadingShell";
import { useI18n } from "@/i18n/I18nProvider";
import { translate, type UiLocale } from "@/i18n/messages";

interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  aspect: string;
  total: number;
  rendered: number;
  cover: string | null;
  workflowStage?: "clarify" | "outlining" | "outline" | "inspire" | "rendering" | "deck";
}

function relativeTime(value: string, locale: UiLocale) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return translate(locale, "time.justNow");
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return translate(locale, "time.justNow");
  if (minutes < 60) return translate(locale, "time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(locale, "time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate(locale, "time.daysAgo", { count: days });
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(value));
}

/** Persisted decks on disk, surfaced as first-class projects on the launcher. */
export default function RecentProjects() {
  const { locale, t } = useI18n();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const openingProject = projects.find((project) => project.id === openingId);

  function progressLabel(project: ProjectSummary) {
    switch (project.workflowStage) {
      case "clarify": return t("projects.stageClarify");
      case "outlining": return t("projects.stageOutlining");
      case "outline": return t("projects.stageOutline");
      case "inspire": return t("projects.stageInspire");
      case "rendering": return t("projects.stageRendering", { rendered: project.rendered, total: project.total });
      default: return t("projects.slides", { rendered: project.rendered, total: project.total });
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/projects", { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Unable to load projects"))))
      .then((data) => setProjects(data.projects ?? []))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setProjects([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="project-section" aria-labelledby="projects-heading">
      <div className="section-head">
        <div>
          <h2 id="projects-heading">{t("projects.title")}</h2>
          <p>{t("projects.subtitle")}</p>
        </div>
        {!loading && projects.length > 0 && (
          <span className="section-count">
            {t(projects.length === 1 ? "projects.countOne" : "projects.countMany", { count: projects.length })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="project-grid" aria-label={t("projects.loading")}>
          {[0, 1, 2].map((item) => (
            <div className="project-card project-skeleton" key={item}>
              <div className="project-cover skeleton" />
              <div className="project-copy">
                <span className="skeleton" />
                <small className="skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length ? (
        <div className="project-grid" aria-busy={Boolean(openingId)}>
          {projects.map((project) => {
            const resumeOnHome = project.workflowStage === "clarify" || project.workflowStage === "outlining";
            const href = resumeOnHome
              ? `/?resume=${encodeURIComponent(project.id)}`
              : `/project/${encodeURIComponent(project.id)}`;
            const content = <>
              <div className="project-cover" style={{ aspectRatio: project.aspect.replace(":", " / ") }}>
                {project.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${project.id}/${project.cover}`} alt="" />
                ) : (
                  <span className="project-empty-cover">{t("projects.noPreview")}</span>
                )}
                <span className="project-open" aria-hidden="true">
                  {openingId === project.id ? <span className="project-open-spinner" /> : "↗"}
                </span>
              </div>
              <div className="project-copy">
                <strong>{project.title}</strong>
                <span>
                  {progressLabel(project)}
                  <i aria-hidden="true" />
                  {relativeTime(project.updatedAt ?? project.createdAt, locale)}
                </span>
              </div>
            </>;
            const className = `project-card${openingId === project.id ? " is-opening" : ""}`;
            const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              setOpeningId(project.id);
            };
            return resumeOnHome ? (
              <a
                className={className}
                href={href}
                key={project.id}
                onClick={onClick}
                aria-label={t("projects.open", { title: project.title })}
              >
                {content}
              </a>
            ) : (
              <Link
                className={className}
                href={href}
                key={project.id}
                onClick={onClick}
                aria-label={t("projects.open", { title: project.title })}
              >
                {content}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="project-empty">
          <span className="project-empty-icon">▤</span>
          <div>
            <strong>{t("projects.emptyTitle")}</strong>
            <p>{t("projects.emptyBody")}</p>
          </div>
        </div>
      )}
      {openingProject && (
        <div className="project-opening-overlay">
          <ProjectLoadingShell title={openingProject.title} />
        </div>
      )}
    </section>
  );
}
