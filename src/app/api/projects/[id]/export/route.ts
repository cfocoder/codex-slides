import { buildPdf, buildPptx } from "@/lib/assemble";
import { loadProject, slugify } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) return new Response("not found", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") ?? "pdf";
  const base = slugify(project.title);

  try {
    if (format === "pptx") {
      const buf = await buildPptx(project);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "Content-Disposition": `attachment; filename="${base}.pptx"`,
        },
      });
    }
    const buf = await buildPdf(project);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${base}.pdf"`,
      },
    });
  } catch (e: any) {
    return new Response(String(e?.message ?? e), { status: 500 });
  }
}
