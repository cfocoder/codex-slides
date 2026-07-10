/** Immediate route shell: keeps the click responsive while the project RSC streams in. */
export default function ProjectLoading() {
  return (
    <div className="ws project-ws project-route-loading" role="status" aria-live="polite" aria-label="Opening project">
      <aside className="project-loading-agent" aria-hidden="true">
        <div className="project-loading-head">
          <span className="project-loading-logo">◇</span>
          <span className="project-loading-line wide" />
          <span className="project-loading-pill" />
        </div>
        <div className="project-loading-feed">
          <span className="project-loading-line short" />
          <div className="project-loading-message">
            <span className="project-loading-line wide" />
            <span className="project-loading-line" />
            <span className="project-loading-line short" />
          </div>
        </div>
        <div className="project-loading-composer" />
      </aside>

      <main className="project-loading-stage" aria-hidden="true">
        <div className="project-loading-stage-head">
          <span className="project-loading-line title" />
          <span className="project-loading-pill count" />
          <span className="project-loading-action" />
          <span className="project-loading-action" />
          <span className="project-loading-action long" />
        </div>
        <div className="project-loading-canvas-wrap">
          <div className="project-loading-canvas">
            <span className="project-loading-spinner" />
            <strong>Opening your project</strong>
          </div>
        </div>
        <div className="project-loading-filmstrip">
          {[0, 1, 2, 3].map((item) => (
            <span className="project-loading-thumb" key={item} />
          ))}
        </div>
      </main>
      <span className="sr-only">Opening project…</span>
    </div>
  );
}
