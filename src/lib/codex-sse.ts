// Low-level client for the ChatGPT Codex Responses endpoint that both text and
// image generation share. Zero-config: authenticated by the Codex CLI's token.

import { getCodexAccessToken } from "./codex-auth";

export const CODEX_RESPONSES_ENDPOINT =
  "https://chatgpt.com/backend-api/codex/responses";

/** Top-level Responses model used for the codex backend request envelope. */
export const CODEX_RESPONSES_MODEL = "gpt-5.4";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class CodexResponsesError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface PostOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
}

/** POST a Responses payload, retrying transient failures. Returns the streaming Response. */
export async function postCodexResponses(
  payload: unknown,
  opts: PostOptions = {},
): Promise<Response> {
  const { timeoutMs = 300_000, maxAttempts = 5, signal } = opts;
  const token = getCodexAccessToken();
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    if (signal) signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(CODEX_RESPONSES_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (resp.status === 401) {
        throw new CodexResponsesError(
          "Codex rejected the token (401). Run `codex login` again (Sign in with ChatGPT).",
          401,
        );
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const err = new CodexResponsesError(
          `Codex responses HTTP ${resp.status}: ${body.slice(0, 300)}`,
          resp.status,
        );
        if (RETRYABLE_STATUS.has(resp.status) && attempt < maxAttempts) {
          lastErr = err;
          await sleep(Math.min(60_000, 2 ** attempt * 1000));
          continue;
        }
        throw err;
      }
      return resp;
    } catch (e: any) {
      lastErr = e;
      const retryable =
        e?.name === "AbortError" ||
        e?.name === "TypeError" || // fetch network error
        (e instanceof CodexResponsesError && e.status && RETRYABLE_STATUS.has(e.status));
      if (!retryable || attempt === maxAttempts) throw e;
      await sleep(Math.min(60_000, 2 ** attempt * 1000));
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Yield parsed JSON objects from the SSE `data:` lines of a Responses stream. */
export async function* sseEvents(resp: Response): AsyncGenerator<any> {
  if (!resp.body) throw new CodexResponsesError("Codex responses returned no body");
  const decoder = new TextDecoder();
  let buf = "";
  // Node's fetch body is an async-iterable of Uint8Array chunks.
  for await (const chunk of resp.body as any) {
    buf += decoder.decode(chunk as Uint8Array, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (raw === "[DONE]") return;
      try {
        yield JSON.parse(raw);
      } catch {
        /* ignore keep-alive / partial */
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
