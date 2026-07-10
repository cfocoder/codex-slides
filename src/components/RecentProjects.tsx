"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ProjectLoadingShell from "@/components/ProjectLoadingShell";

interface ProjectSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  aspect: string;
  total: number;
  rendered: number;
  cover: string | null;
}

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "Just now";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

/** Persisted decks on disk, surfaced as first-class projects on the launcher. */
export default function RecentProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const openingProject = projects.find((project) => project.id === openingId);

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
          <h2 id="projects-heading">Projects</h2>
          <p>Pick up where you left off</p>
        </div>
        {!loading && projects.length > 0 && (
          <span className="section-count">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {loading ? (
        <div className="project-grid" aria-label="Loading projects">
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
          {projects.map((project) => (
            <Link
              className={`project-card${openingId === project.id ? " is-opening" : ""}`}
              href={`/project/${project.id}`}
              key={project.id}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                setOpeningId(project.id);
              }}
              aria-label={`Open ${project.title}`}
            >
              <div className="project-cover" style={{ aspectRatio: project.aspect.replace(":", " / ") }}>
                {project.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${project.id}/${project.cover}`} alt="" />
                ) : (
                  <span className="project-empty-cover">No preview yet</span>
                )}
                <span className="project-open" aria-hidden="true">
                  {openingId === project.id ? <span className="project-open-spinner" /> : "↗"}
                </span>
              </div>
              <div className="project-copy">
                <strong>{project.title}</strong>
                <span>
                  {project.rendered}/{project.total} slides
                  <i aria-hidden="true" />
                  {relativeTime(project.updatedAt ?? project.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="project-empty">
          <span className="project-empty-icon">▤</span>
          <div>
            <strong>Your projects will live here</strong>
            <p>Describe a presentation above to create the first one.</p>
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
