import { NextResponse } from "next/server";
import { planChatEdit } from "@/lib/chat";
import { attachMaterialsToProject, loadProjectInputAttachments } from "@/lib/materials";
import { loadProject, saveProject } from "@/lib/store";
import type { StoredChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Persist the full conversation so reopening the project restores the dialogue. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const chat: StoredChatMessage[] = raw
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
    .map((m: any) => ({
      id: m.id ? String(m.id) : undefined,
      role: m.role,
      content: String(m.content ?? ""),
      ran: m.ran ? String(m.ran) : undefined,
      doc: m.doc,
      attachment: m.attachment,
      contextItems: m.contextItems,
      contextOptions: Array.isArray(m.contextOptions)
        ? m.contextOptions.slice(0, 12).map((item: any, index: number) => ({
            id: String(item?.id ?? `option-${index}`),
            kind: ["research", "style", "setting"].includes(item?.kind) ? item.kind : "setting",
            label: String(item?.label ?? "Option"),
            value: item?.value ? String(item.value) : undefined,
          }))
        : undefined,
      suggestions: Array.isArray(m.suggestions) ? m.suggestions.map(String) : undefined,
      process: m.process && typeof m.process === "object"
        ? {
            state: ["running", "complete", "error"].includes(m.process.state) ? m.process.state : "complete",
            title: String(m.process.title ?? "Agent activity"),
            notes: Array.isArray(m.process.notes) ? m.process.notes.map(String).slice(0, 12) : undefined,
            tools: Array.isArray(m.process.tools)
              ? m.process.tools.slice(0, 40).map((tool: any, index: number) => ({
                  id: String(tool?.id ?? `tool-${index}`),
                  name: String(tool?.name ?? "tool"),
                  label: String(tool?.label ?? "Tool call"),
                  detail: tool?.detail ? String(tool.detail) : undefined,
                  state: ["pending", "running", "complete", "error"].includes(tool?.state)
                    ? tool.state
                    : "complete",
                }))
              : [],
          }
        : undefined,
      ts: typeof m.ts === "number" ? m.ts : undefined,
    }))
    .slice(-200);
  project.chat = chat;
  saveProject(project);
  return NextResponse.json({ ok: true, count: chat.length });
}

/** Classify a natural-language edit into a plan. Execution happens via /regenerate. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const message = String(body?.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  try {
    const contextIndex = Math.trunc(Number(body?.context?.slideIndex));
    const context = Number.isInteger(contextIndex) && contextIndex >= 1 && contextIndex <= project.pages.length
      ? { slideIndex: contextIndex, title: String(body?.context?.title ?? "") }
      : undefined;
    const rawAttachmentIds: unknown[] = Array.isArray(body?.attachmentIds) ? body.attachmentIds : [];
    const attachmentIds: string[] = Array.from(
      new Set(rawAttachmentIds.map((id) => String(id))),
    ).slice(0, 8);
    const existingIds = new Set((project.materials ?? []).map((item) => item.id));
    const newRecords = attachMaterialsToProject(
      project.id,
      attachmentIds.filter((id) => !existingIds.has(id)),
    );
    if (newRecords.length) {
      project.materials = [...(project.materials ?? []), ...newRecords];
      project.config.materialIds = Array.from(new Set([
        ...(project.config.materialIds ?? []),
        ...newRecords.map((item) => item.id),
      ]));
      saveProject(project);
    }
    const turnRecords = (project.materials ?? []).filter((item) => attachmentIds.includes(item.id));
    const attachments = loadProjectInputAttachments(project.id, turnRecords);
    const plan = await planChatEdit(project, message, context, attachments);
    return NextResponse.json({ plan });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
