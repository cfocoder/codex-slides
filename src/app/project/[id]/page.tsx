import { notFound } from "next/navigation";
import DeckView from "@/components/DeckView";
import { loadProject } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Project workspace: chat feed + live slide preview + filmstrip (per-page editing). */
export default function ProjectPage({ params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) notFound();
  return <DeckView projectId={params.id} initialProject={project} />;
}
