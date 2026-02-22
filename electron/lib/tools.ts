import { execFile as execFileCb } from "node:child_process";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { Tool } from "@mistralai/mistralai/models/components/tool.js";

const execFile = promisify(execFileCb);

// ─── Tool Definitions (Mistral format) ────────────────────────────────────────

export const toolDefinitions: Tool[] = [
  {
    type: "function",
    function: {
      name: "open_application",
      description: "Open a macOS application by name",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Application name, e.g. 'Visual Studio Code'",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "quit_application",
      description: "Quit a running macOS application by name",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Application name to quit",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_running_applications",
      description: "List all currently running applications on macOS",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_frontmost_application",
      description:
        "Get the name and details of the currently focused application",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_url",
      description: "Open a URL in the default browser",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to open",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_files",
      description: "Search for files by name using Spotlight (mdfind)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "File name or partial name to search for",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the text content of a file at the given path",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Absolute file path to read",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_volume",
      description: "Set the macOS system volume (0-100)",
      parameters: {
        type: "object",
        properties: {
          level: {
            type: "number",
            description: "Volume level between 0 and 100",
          },
        },
        required: ["level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "click_at",
      description:
        "Click at specific screen coordinates (x, y). A fresh screenshot is automatically provided at each step, use it to identify the position of UI elements to click.",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "number",
            description: "X coordinate (pixels from left edge of screen)",
          },
          y: {
            type: "number",
            description: "Y coordinate (pixels from top edge of screen)",
          },
          button: {
            type: "string",
            description:
              "Mouse button to click: 'left' (default), 'right', or 'double'",
          },
        },
        required: ["x", "y"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Type text into the currently active application",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text to type",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "press_key",
      description:
        "Press a keyboard shortcut (e.g. 'command+c', 'command+shift+z')",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description:
              "Key name, e.g. 'return', 'tab', 'escape', 'space', 'delete'",
          },
          modifiers: {
            type: "array",
            items: { type: "string" },
            description:
              "Modifier keys: 'command', 'shift', 'option', 'control'",
          },
        },
        required: ["key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_clipboard",
      description: "Read the current clipboard text content",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_clipboard",
      description: "Set the clipboard text content",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to copy to clipboard",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_applescript",
      description:
        "Execute an arbitrary AppleScript. Use for advanced macOS automation not covered by other tools.",
      parameters: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "The AppleScript source code to execute",
          },
        },
        required: ["script"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_action",
      description:
        "Control a visible headed Chrome browser with the user's real profile (logged-in sessions preserved). The browser window is visible on screen. It persists across calls within the same conversation. Workflow: open URL → state (get clickable element indices) → interact using indices (click, input, select) → state again to verify. Always run 'state' before interacting to get fresh element indices.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description:
              'The browser-use command and arguments. Examples: \'open https://gmail.com\', \'state\', \'click 5\', \'input 3 "some text"\', \'keys "Enter"\', \'select 7 "option"\', \'scroll down\', \'back\', \'screenshot page.png\', \'wait text "Inbox"\', \'eval "document.title"\'',
          },
        },
        required: ["command"],
      },
    },
  },
];

// ─── Tool Executors ───────────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>;

export async function runAppleScript(script: string): Promise<string> {
  const { stdout } = await execFile("osascript", ["-e", script]);
  return stdout.trim();
}

const executors: Record<string, (args: ToolArgs) => Promise<string>> = {
  async open_application(args) {
    const name = args.name as string;
    await execFile("open", ["-a", name]);
    return `Opened ${name}`;
  },

  async quit_application(args) {
    const name = args.name as string;
    await runAppleScript(`tell application "${name}" to quit`);
    return `Quit ${name}`;
  },

  async list_running_applications() {
    return runAppleScript(
      'tell application "System Events" to get name of every application process whose background only is false',
    );
  },

  async get_frontmost_application() {
    return runAppleScript(
      'tell application "System Events" to get name of first application process whose frontmost is true',
    );
  },

  async open_url(args) {
    const url = args.url as string;
    await execFile("open", [url]);
    return `Opened ${url}`;
  },

  async search_files(args) {
    const query = args.query as string;
    const { stdout } = await execFile("mdfind", ["-name", query]);
    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return "No files found";
    return lines.slice(0, 20).join("\n");
  },

  async read_file(args) {
    const filePath = args.path as string;
    const content = await readFile(filePath, "utf-8");
    // Truncate to avoid sending huge files to the LLM
    const maxLength = 10_000;
    if (content.length > maxLength)
      return content.slice(0, maxLength) + "\n... (truncated)";
    return content;
  },

  async set_volume(args) {
    const level = Math.round(Math.min(100, Math.max(0, args.level as number)));
    // macOS volume is 0-100 in AppleScript
    await runAppleScript(`set volume output volume ${level}`);
    return `Volume set to ${level}%`;
  },

  async click_at(args) {
    const x = Math.round(args.x as number);
    const y = Math.round(args.y as number);
    const button = (args.button as string) ?? "left";

    let cmd: string;
    switch (button) {
      case "right":
        cmd = `rc:${x},${y}`;
        break;
      case "double":
        cmd = `dc:${x},${y}`;
        break;
      default:
        cmd = `c:${x},${y}`;
    }

    console.log(`[click_at] ${button} click at (${x}, ${y}) → cliclick ${cmd}`);
    await execFile("cliclick", [cmd]);
    const { stdout } = await execFile("cliclick", ["p"]);
    console.log(`[click_at] cursor now at ${stdout.trim()}`);
    return `Clicked ${button} at (${x}, ${y})`;
  },

  async type_text(args) {
    const text = args.text as string;
    await runAppleScript(
      `tell application "System Events" to keystroke "${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    );
    return `Typed text`;
  },

  async press_key(args) {
    const key = args.key as string;
    const modifiers = (args.modifiers as string[] | undefined) ?? [];

    // Map modifier names to AppleScript key codes
    const modMap: Record<string, string> = {
      command: "command down",
      shift: "shift down",
      option: "option down",
      control: "control down",
    };

    const modParts = modifiers
      .map((m) => modMap[m.toLowerCase()])
      .filter(Boolean);

    const script =
      modParts.length > 0
        ? `tell application "System Events" to keystroke "${key}" using {${modParts.join(", ")}}`
        : `tell application "System Events" to keystroke "${key}"`;

    await runAppleScript(script);
    return `Pressed ${modifiers.length > 0 ? modifiers.join("+") + "+" : ""}${key}`;
  },

  async get_clipboard() {
    const { stdout } = await execFile("pbpaste", []);
    return stdout || "(clipboard is empty)";
  },

  async set_clipboard(args) {
    const text = args.text as string;
    // Use osascript to set clipboard to avoid shell injection with pipe
    await runAppleScript(
      `set the clipboard to "${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    );
    return "Clipboard updated";
  },

  async run_applescript(args) {
    const script = args.script as string;
    return runAppleScript(script);
  },

  async browser_action(args) {
    const command = args.command as string;
    const argv = parseCommandArgs(command);
    const bin = "browser-use";
    const fullArgs = ["--browser", "real", "--profile", "Default", "--headed", ...argv];

    console.log(`[browser_action] > ${bin} ${fullArgs.join(" ")}`);
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execFile(bin, fullArgs, {
        timeout: 60_000,
      });
      const elapsed = Date.now() - startTime;
      const output = (stdout || stderr).trim();
      console.log(
        `[browser_action] ✓ completed in ${elapsed}ms (${output.length} chars)`,
      );
      console.log(
        `[browser_action] output: ${output.slice(0, 500)}${output.length > 500 ? "…" : ""}`,
      );
      return output || "(no output)";
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[browser_action] ✗ failed after ${elapsed}ms: ${message}`);
      throw err;
    }
  },
};

/** Parse a command string into argv, respecting quoted arguments. */
function parseCommandArgs(command: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === " ") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }
  if (current) args.push(current);
  return args;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ToolExecutionResult {
  name: string;
  success: boolean;
  result: string;
}

export async function executeTool(
  name: string,
  args: ToolArgs,
): Promise<ToolExecutionResult> {
  const executor = executors[name];
  if (!executor)
    return { name, success: false, result: `Unknown tool: ${name}` };

  try {
    const result = await executor(args);
    return { name, success: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { name, success: false, result: `Error: ${message}` };
  }
}
