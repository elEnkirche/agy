import "dotenv/config";
import { app, BrowserWindow, ipcMain, nativeTheme } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppWindow, createOverlayWindow, showOverlayOnCursorDisplay } from "./window/index.js";
import { registerTranscriptionHandlers } from "./ipc/transcription.js";
import { registerChatHandlers } from "./ipc/chat.js";
import { registerSettingsHandlers } from "./ipc/settings.js";
import { registerPermissionsHandlers } from "./ipc/permissions.js";
import {
  registerPushToTalk,
  setPushToTalkKey,
  stopPushToTalk,
} from "./lib/push-to-talk.js";
import { loadSettings } from "./lib/settings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let appWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

const getAppWindow = () => appWindow;
const getOverlayWindow = () => overlayWindow;

registerTranscriptionHandlers(getAppWindow, getOverlayWindow);
registerChatHandlers(getAppWindow, getOverlayWindow);
registerSettingsHandlers();
registerPermissionsHandlers();
registerPushToTalk(getAppWindow);

ipcMain.handle("set-recording-glow", (_event, active: boolean) => {
  if (active && overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isVisible())
    showOverlayOnCursorDisplay(overlayWindow);
  overlayWindow?.webContents.send("recording-glow", active);
});

ipcMain.on("hide-overlay", () => {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible())
    overlayWindow.hide();
});

app.whenReady().then(() => {
  const settings = loadSettings();
  nativeTheme.themeSource = settings.appearance.theme;
  setPushToTalkKey(settings.hotkey.keycode);

  appWindow = createAppWindow(__dirname);
  overlayWindow = createOverlayWindow(__dirname);

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      appWindow = createAppWindow(__dirname);
      overlayWindow = createOverlayWindow(__dirname);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    appWindow = null;
  }
});

app.on("will-quit", () => {
  stopPushToTalk();
});

process.on("message", (msg) => {
  if (msg === "electron-vite&type=hot-reload") {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.reload();
    }
  }
});
