# Three Things · Pixel Companions (Windows trial v0.1.7)

[简体中文](README.md) | **English**

## Usage

Quit the old version using the manager or system tray, then [download Windows v0.1.7](https://github.com/guiii007/three-things-daily/releases/download/v0.1.7/ThreeThings-0.1.7-Windows.exe) and double-click to run it. No Node.js installation is required. Existing tasks, notes, and size settings are retained. The app interface currently uses Chinese.

1. Enter a task and click “召唤伙伴” (Summon companion). Up to three pixel capsules are created each day, in red, yellow, and green order.
2. Close the manager to keep your companions above other apps.
3. Tap a capsule to edit the task and write notes. Text is saved automatically.
4. Hold a capsule for about half a second to see the pickup animation, then drag while holding the mouse button. Release to save its position. A long press does not open the editor; double-clicking is not required.
5. Click “这件事完成啦 √” (Task complete) to save a TXT record. The companion disappears, and a pixel smile with colorful encouragement appears and gently fades away.
6. Double-click the capsule icon in the system tray to reopen the manager. Right-click to hide companions or quit.
7. Use the size slider or number field to set 20%–200%. Changes apply immediately, stay in sync, and are saved. Use “恢复 100%” (Reset to 100%) to restore the default. Blank, fractional, or out-of-range inputs are not applied; leaving the field restores the last valid value.

Completing a task does not free up its daily slot. The daily limit resets the next day. Past tasks remain in history, and unfinished companions remain on the desktop.

## Data and TXT files

TXT files are saved directly to the Windows desktop, without date subfolders. “打开 TXT 文件夹” (Open TXT folder) opens the desktop. “补存 TXT” (Export TXT again) saves a completed task's record there. Older files stay in their original location. Reopening and completing a task again creates a new file and preserves the previous completion record.

Tasks, notes, positions, and size settings are stored in `%APPDATA%/three-things-companion/tasks.json` and are not uploaded to a server. TXT records are plain-text snapshots. Back up both this data file and your TXT files.

The desktop app, original `index.html`, and browser prototype store data separately. Browser records are not imported automatically. The original web app remains usable independently. Automatic updates and additional characters are not yet available.

## Development

```powershell
npm.cmd ci
npm.cmd run prepare:assets
npm.cmd start
npm.cmd test
npm.cmd run build
```

`desktop/test/smoke.js` uses Playwright to launch real Electron windows with isolated data in `.desktop-test`. After installing Playwright, run `npm.cmd run test:desktop`. The test also supports an existing Playwright installation in the Codex environment.

The Windows transparent window uses native `setShape` to match the character and hands; transparent areas pass mouse input through. Characters are drawn as SVG pixel blocks. The rendered size and click area scale together. List thumbnails and the task editor retain their original size.

File writes run in the main process. Renderer pages have Node.js disabled, with sandboxing and context isolation enabled. During a press, the main process reads the current Windows mouse position and button state, allowing dragging and release outside the window. It does not install global mouse hooks or record input.

`npm.cmd test` covers long-press timing, movement outside the window, final release positions, short-press behavior, size persistence, and TXT storage. `npm.cmd run test:interaction` checks immediate tap behavior. For isolated native input tests, set `CAPSULE_TEST_ROOT` to a separate test directory and `CAPSULE_NATIVE_UI_TEST=1` to use a larger framed character window; this does not use your regular task data.

## Version notes

- **0.1.2:** Tap to open, hold for 500ms to pick up and drag, release to put down.
- **0.1.3:** Simplified the manager and plain-text records while retaining compatibility with existing tasks and notes.
- **0.1.4:** Completion records and TXT re-exports are saved directly to the Windows desktop.
- **0.1.5:** Added a 20%–200% size slider and reset button, SVG pixel rendering, and matching scaled click areas.
- **0.1.7:** Remembers the last task-window dimensions and text-field heights across closing, reopening, restarting, and newly opened task editors. Windows fit the available screen area. Pending text and field sizes are saved before closing.
- **0.1.6:** Added a number field with immediate adjustment, slider synchronization, and invalid-input protection.

## Font and runtime licenses

The offline font is Fusion Pixel 12px Proportional SC, licensed under the SIL Open Font License. Its license is distributed with the app. Electron and Chromium license files are included with the runtime.
