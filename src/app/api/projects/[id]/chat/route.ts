import { NextResponse } from "next/server";
import { planChatEdit } from "@/lib/chat";
import { attachMaterialsToProject, loadProjectInputAttachments } from "@/lib/materials";
import { loadProject, saveProject } from "@/lib/store";
import type { StoredChatMessage, StoredConversation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function finiteNonNegative(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function sanitizeMessages(raw: unknown): StoredChatMessage[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant"))
    .map((m: any) => ({
      id: m.id ? String(m.id) : undefined,
      role: m.role,
      content: String(m.content ?? ""),
      ran: m.ran ? String(m.ran) : undefined,
      doc: m.doc && typeof m.doc === "object"
        ? {
            title: String(m.doc.title ?? "Presentation"),
            subtitle: String(m.doc.subtitle ?? ""),
            icon: m.doc.icon ? String(m.doc.icon) : undefined,
            pages: Array.isArray(m.doc.pages)
              ? m.doc.pages.slice(0, 100).map((page: any) => ({
                  title: String(page?.title ?? ""),
                  points: Array.isArray(page?.points) ? page.points.map(String).slice(0, 20) : [],
                }))
              : undefined,
          }
        : undefined,
      attachment: m.attachment,
      contextItems: m.contextItems,
      contextOptions: Array.isArray(m.contextOptions)
        ? m.contextOptions.slice(0, 12).map((item: any, index: number) => ({
            id: String(item?.id ?? `option-${index}`),
            kind: ["research", "style", "setting", "speed"].includes(item?.kind) ? item.kind : "setting",
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
      inspiration: m.inspiration && typeof m.inspiration === "object"
        ? {
            query: String(m.inspiration.query ?? ""),
            coverIds: Array.isArray(m.inspiration.coverIds)
              ? m.inspiration.coverIds.map(String).slice(0, 12)
              : [],
            total: finiteNonNegative(m.inspiration.total) ?? 0,
            chosen: m.inspiration.chosen ? String(m.inspiration.chosen) : undefined,
            resolved: Boolean(m.inspiration.resolved),
          }
        : undefined,
      usage: m.usage && typeof m.usage === "object"
        ? {
            inputTokens: finiteNonNegative(m.usage.inputTokens),
            outputTokens: finiteNonNegative(m.usage.outputTokens),
            totalTokens: finiteNonNegative(m.usage.totalTokens),
            costUsd: finiteNonNegative(m.usage.costUsd),
            model: m.usage.model ? String(m.usage.model).slice(0, 120) : undefined,
            estimated: Boolean(m.usage.estimated),
          }
        : undefined,
      ts: typeof m.ts === "number" ? m.ts : undefined,
    }))
    .slice(-200);
}

function sanitizeConversations(raw: unknown): StoredConversation[] {
  const now = Date.now();
  return (Array.isArray(raw) ? raw : [])
    .filter((conversation: any) => conversation && conversation.id)
    .slice(-50)
    .map((conversation: any, index: number) => {
      const createdAt = finiteNonNegative(conversation.createdAt) ?? now;
      return {
        id: String(conversation.id).slice(0, 120),
        title: String(conversation.title ?? `新会话 ${index + 1}`).trim().slice(0, 80) || `新会话 ${index + 1}`,
        createdAt,
        updatedAt: finiteNonNegative(conversation.updatedAt) ?? createdAt,
        messages: sanitizeMessages(conversation.messages),
      };
    });
}

/** Persist one or many conversations so reopening the project restores the dialogue. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const chat = sanitizeMessages(body?.messages);
  const conversations = sanitizeConversations(body?.conversations);
  // Read the project only after the request body has been consumed. Chat saves
  // run in the background and can overlap a structural slide edit; loading
  // before the await allowed an old page array to overwrite a just-inserted
  // slide when this PUT eventually reached saveProject().
  const project = loadProject(params.id);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });
  if (conversations.length) {
    const requestedActiveId = String(body?.activeConversationId ?? "");
    const activeConversation = conversations.find((conversation) => conversation.id === requestedActiveId)
      ?? conversations[0];
    project.conversations = conversations;
    project.activeConversationId = activeConversation.id;
    project.chat = activeConversation.messages;
  } else {
    project.chat = chat;
    // A legacy client saving only `messages` should update the selected modern
    // conversation instead of silently discarding the multi-session history.
    if (project.conversations?.length) {
      const activeConversation = project.conversations.find(
        (conversation) => conversation.id === project.activeConversationId,
      ) ?? project.conversations[0];
      activeConversation.messages = chat;
      activeConversation.updatedAt = Date.now();
      project.activeConversationId = activeConversation.id;
    }
  }
  saveProject(project);
  return NextResponse.json({
    ok: true,
    count: project.chat?.length ?? 0,
    conversations: project.conversations?.length ?? 0,
    activeConversationId: project.activeConversationId,
  });
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
