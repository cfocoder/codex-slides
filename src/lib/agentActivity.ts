import { translate, type UiLocale } from "@/i18n/messages";

export type AgentToolState = "pending" | "running" | "complete" | "error";

export interface AgentToolCall {
  id: string;
  name: string;
  label: string;
  detail?: string;
  state: AgentToolState;
}

export interface AgentProcess {
  state: "running" | "complete" | "error";
  title: string;
  notes?: string[];
  tools: AgentToolCall[];
}

export function createAgentRunId(prefix = "run") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function elapsedRunLabel(startedAt: number, locale: UiLocale = "en") {
  const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  if (seconds < 60) return translate(locale, "agent.ranSeconds", { seconds });
  const minutes = Math.floor(seconds / 60);
  return translate(locale, "agent.ranMinutes", { minutes, seconds: seconds % 60 });
}

export function patchAgentTool(
  process: AgentProcess,
  id: string,
  patch: Partial<Omit<AgentToolCall, "id">>,
): AgentProcess {
  return {
    ...process,
    tools: process.tools.map((tool) => (tool.id === id ? { ...tool, ...patch } : tool)),
  };
}

export function stopRunningTools(process: AgentProcess, detail?: string): AgentProcess {
  return {
    ...process,
    tools: process.tools.map((tool) =>
      tool.state === "running" || tool.state === "pending"
        ? { ...tool, state: "error", detail: detail ?? tool.detail }
        : tool,
    ),
  };
}
