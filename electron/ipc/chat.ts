import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";
import type { ChatCompletionStreamRequestMessages } from "@mistralai/mistralai/models/components/chatcompletionstreamrequest.js";
import type { ToolCall } from "@mistralai/mistralai/models/components/toolcall.js";
import {
  mistral,
  SYSTEM_PROMPT,
  MAX_AGENTIC_ITERATIONS,
  parseToolCallArgs,
} from "../lib/ai.js";
import { toolDefinitions, executeTool } from "../lib/tools.js";
import { captureContext } from "../lib/context.js";
import { showOverlayOnCursorDisplay } from "../window/overlay.js";

export function registerChatHandlers(
  getAppWindow: () => BrowserWindow | null,
  getOverlayWindow: () => BrowserWindow | null,
) {
  ipcMain.handle("chat-with-mistral", async (_event, prompt: string) => {
    const appWindow = getAppWindow();
    if (!appWindow || !prompt.trim()) return;

    const sendOverlay = (channel: string, ...args: unknown[]) =>
      getOverlayWindow()?.webContents.send(channel, ...args);

    const overlayWin = getOverlayWindow();
    if (overlayWin && !overlayWin.isDestroyed() && !overlayWin.isVisible())
      showOverlayOnCursorDisplay(overlayWin);

    sendOverlay("glow-phase", "thinking");

    // Capture context (overlay is content-protected, won't appear in screenshot)
    const ctx = await captureContext();

    const messages: ChatCompletionStreamRequestMessages[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + ctx.text },
      {
        role: "user",
        content: [
          {
            type: "image_url" as const,
            imageUrl: {
              url: `data:image/png;base64,${ctx.screenshotBase64}`,
            },
          },
          { type: "text" as const, text: prompt },
        ],
      },
    ];

    try {
      for (let iteration = 0; iteration < MAX_AGENTIC_ITERATIONS; iteration++) {
        const stream = await mistral.chat.stream({
          model: "mistral-large-latest",
          messages,
          tools: toolDefinitions,
          toolChoice: "auto",
        });

        let textContent = "";
        const toolCalls: ToolCall[] = [];

        for await (const event of stream) {
          const choice = event.data?.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          if (typeof delta.content === "string" && delta.content) {
            textContent += delta.content;
            appWindow.webContents.send("chat-chunk", delta.content);
            sendOverlay("chat-chunk", delta.content);
          }

          if (delta.toolCalls) {
            for (const tc of delta.toolCalls) {
              const idx = tc.index ?? toolCalls.length;
              if (!toolCalls[idx]) {
                toolCalls[idx] = {
                  id: tc.id,
                  function: { name: "", arguments: "" },
                  index: idx,
                };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function.name)
                toolCalls[idx].function.name += tc.function.name;
              const argChunk =
                typeof tc.function.arguments === "string"
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments);
              toolCalls[idx].function.arguments =
                (toolCalls[idx].function.arguments as string) + argChunk;
            }
          }
        }

        if (toolCalls.length === 0) break;

        messages.push({
          role: "assistant",
          content: textContent || null,
          toolCalls: toolCalls.map((tc) => ({
            id: tc.id!,
            type: "function" as const,
            function: tc.function,
            index: tc.index!,
          })),
        });

        const toolResults = await Promise.all(
          toolCalls.map(async (tc) => {
            const args = parseToolCallArgs(tc.function.arguments);

            const payload = { name: tc.function.name, arguments: args };
            appWindow.webContents.send("tool-executing", payload);
            sendOverlay("tool-executing", payload);

            const result = await executeTool(tc.function.name, args);

            appWindow.webContents.send("tool-result", result);

            return { toolCallId: tc.id!, result };
          }),
        );

        for (const { toolCallId, result } of toolResults) {
          const isImage = result.result.startsWith("data:image/");
          messages.push({
            role: "tool",
            content: isImage
              ? [
                  {
                    type: "image_url" as const,
                    imageUrl: { url: result.result },
                  },
                ]
              : result.result,
            toolCallId,
            name: result.name,
          });
        }
      }
    } finally {
      sendOverlay("glow-phase", "idle");
    }
  });
}
