import { notFound, redirect } from "next/navigation";
import DeckView from "@/components/DeckView";
import { loadProject } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Project workspace: chat feed + live slide preview + filmstrip (per-page editing). */
export default function ProjectPage({ params }: { params: { id: string } }) {
  // Next's page params can retain percent-encoding for non-ASCII slugs even
  // though route-handler params are decoded. Normalize here so decks created
  // with Chinese/Japanese/etc. titles can be reopened from their preview URL.
  let projectId = params.id;
  try {
    projectId = decodeURIComponent(projectId);
  } catch {
    // A malformed URL is not a valid project id; loadProject will return null.
  }
  const project = loadProject(projectId);
  if (!project) notFound();
  if (project.workflow?.stage === "clarify" || project.workflow?.stage === "outlining") {
    redirect(`/?resume=${encodeURIComponent(projectId)}`);
  }
  return <DeckView key={project.id} projectId={projectId} initialProject={project} />;
}
