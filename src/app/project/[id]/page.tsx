import DeckView from "@/components/DeckView";

export const dynamic = "force-dynamic";

/** Project workspace: chat feed + live slide preview + filmstrip (per-page editing). */
export default function ProjectPage({ params }: { params: { id: string } }) {
  return <DeckView projectId={params.id} />;
}
