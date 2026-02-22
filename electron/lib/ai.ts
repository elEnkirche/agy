import { Mistral } from "@mistralai/mistralai";
import { RealtimeTranscription } from "@mistralai/mistralai/extra/realtime";

export const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
});

export const realtimeClient = new RealtimeTranscription({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
  serverURL: "wss://api.mistral.ai",
});

export const SYSTEM_PROMPT = `You are an AI desktop assistant running on macOS. You can control the user's computer using the provided tools.

You are given context about the user's current state: the focused application, browser URL/title if applicable, and a screenshot of their screen. Use this context to give relevant, aware responses. For example, if the user says "summarize this page", you already know which page they're on.

When the user asks you to perform an action (open apps, manage files, control volume, etc.), use the appropriate tool. When the user asks a general question, respond with text only.

## Multi-step UI tasks

A fresh screenshot and context (focused app, browser URL) is automatically provided at every step. Use it to understand the current screen state.

When a task requires multiple steps (e.g. "open Gmail and compose a mail"):

1. **Look at the screenshot** provided with each message to understand the current screen state.
2. **Act**: Use tools to perform the next action (click, type, open URL, etc.).
3. **The next step will include a new screenshot** — analyze it to verify your action worked. If it didn't, adapt.
4. **Use click_at(x, y)** to interact with UI elements visible in the screenshot. The image maps 1:1 to screen pixels.
5. **Continue step by step** until the full task is done.

Be concise in your responses. After completing all steps, briefly confirm what you did.`;

export const MAX_AGENTIC_ITERATIONS = 10;

export function parseToolCallArgs(
  args: Record<string, unknown> | string,
): Record<string, unknown> {
  if (typeof args === "string") {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return args;
}
