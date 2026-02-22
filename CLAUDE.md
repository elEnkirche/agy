# CLAUDE.md

## What is AGY

AGY is a macOS vocal assistant that controls your desktop through voice commands. It captures speech via a push-to-talk hotkey, transcribes it with Mistral's Voxtral models, sends the transcript + a screenshot to `mistral-large-latest` with 14 macOS-specific tools, and displays results in a transparent always-on-top overlay.

## Tech Stack

| Layer           | Technology                                                                             |
| --------------- | -------------------------------------------------------------------------------------- |
| Desktop         | Electron 40                                                                            |
| Frontend        | React 19, TypeScript 5.9                                                               |
| Bundler         | Vite 7 + `vite-plugin-electron`                                                        |
| Styling         | Tailwind CSS 4, shadcn/ui (base-mira style)                                            |
| AI              | Mistral AI SDK (`@mistralai/mistralai`)                                                |
| Voice           | `voxtral-mini-latest` (batch) + `voxtral-mini-transcribe-realtime-2602` (streaming WS) |
| Chat model      | `mistral-large-latest` (vision + tool use)                                             |
| Global hotkeys  | `uiohook-napi`                                                                         |
| Package manager | pnpm                                                                                   |

## Architecture

```
┌──────────────────── Electron Main Process ────────────────────┐
│  main.ts ─── ipc/     ─── chat.ts             lib/ ── ai.ts  │
│              │             transcription.ts        context.ts  │
│              │             settings.ts          push-to-talk.ts│
│              │             permissions.ts          settings.ts │
│              │                                     tools.ts   │
│              └── window/ ── app.ts (settings)                 │
│                             overlay.ts (overlay)              │
└───────────────────────────┬───────────────────────────────────┘
                      IPC (preload.ts)
┌───────────────────────────┴───────────────────────────────────┐
│                   Renderer Processes                          │
│  app.html     → src/main.tsx → pages/settings/ (App window)  │
│  overlay.html → pages/overlay/main.tsx         (Overlay)     │
└───────────────────────────────────────────────────────────────┘
```

### Two Windows

- **App window** (`app.html`): 640x460 settings UI with sidebar nav (Audio, Hotkey, Appearance, Permissions). Also drives audio recording and assistant event listeners.
- **Overlay window** (`overlay.html`): Fullscreen transparent frameless always-on-top HUD. Click-through (`setIgnoreMouseEvents(true)`), content-protected (invisible to screenshots). Shows animated border glow + conversation. Auto-hides after 3s idle. Repositions to the display where the cursor is.

## Voice Pipeline

```
Hotkey held → uiohook keydown → IPC → renderer starts MediaStream (16kHz)
    → ScriptProcessorNode → float32→PCM S16LE → IPC "send-audio-chunk"
        → Dual transcription:
            1. Realtime WebSocket (voxtral-mini-transcribe-realtime) → delta text
            2. Batch API every 3s (voxtral-mini-latest) → confirmed text
Hotkey released → final batch → chatWithMistral(confirmedText)
```

## Tool System (14 tools in `electron/lib/tools.ts`)

`open_application`, `quit_application`, `list_running_applications`, `get_frontmost_application`, `open_url`, `search_files` (Spotlight `mdfind`), `read_file`, `set_volume`, `take_screenshot`, `type_text`, `press_key`, `get_clipboard`, `set_clipboard`, `run_applescript` (escape hatch).

All macOS-specific. The agentic loop runs up to 10 iterations of tool calls before requiring a text response.

## Context Capture (`electron/lib/context.ts`)

Before each chat, captures:

- Frontmost application name (AppleScript)
- Browser URL/title if Chrome/Safari/Arc/Firefox/Edge is active
- Screenshot → base64 PNG (via `screencapture -x`)

## Settings (`electron/lib/settings.ts`)

JSON file at `app.getPath("userData")/settings.json`. Three sections:

- `audio`: deviceId
- `hotkey`: keycode (default: Right Alt / 3640), keyName, mode (hold/toggle)
- `appearance`: theme (system/light/dark)

## Commands

```bash
pnpm dev             # Dev server + Electron with hot reload
pnpm build           # tsc -b && vite build
pnpm build:electron  # electron-builder (packaging)
pnpm lint            # ESLint
```

## Code Conventions

- No router: each window has its own HTML entry + React root
- No state management library: plain `useState`/`useRef` with IPC listeners
- `useRef` used heavily to avoid stale closures in async callbacks
- `ScriptProcessorNode` for audio capture (deprecated API, works for now)
- CSS Houdini `@property` for animated conic gradient glow effect
- `@` path alias maps to `./src/`
- Vite externalizes `bufferutil`, `utf-8-validate`, `uiohook-napi` for Electron main

## IPC Channels

**Main → Renderer:** `push-to-talk-down/up`, `transcription-delta`, `transcription-done`, `transcription-confirmed`, `transcription-confirmed-error`, `transcription-error`, `chat-chunk`, `tool-executing`, `tool-result`, `recording-glow`, `glow-phase`, `hotkey-captured`

**Renderer → Main:** `start-transcription`, `stop-transcription`, `send-audio-chunk`, `chat-with-mistral`, `set-recording-glow`, `hide-overlay`, `get-settings`, `set-audio-settings`, `set-hotkey-settings`, `set-appearance-settings`, `start-hotkey-capture`, `cancel-hotkey-capture`, `check-permissions`, `request-permission`
