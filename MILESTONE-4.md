# Milestone 4 — Vertical Shorts Rendering

This overlay adds FFmpeg rendering for detected highlight candidates. It outputs local 1080x1920 MP4 clips, uses H.264/AAC, stores files under `data/clips/`, and exposes preview/download controls in the project UI.

## Apply
1. Stop all three development terminals with Ctrl+C.
2. Extract this ZIP to `D:\` and merge the `ai-gaming-shorts` folder into `D:\ai-gaming-shorts`, replacing the listed files.
3. In `D:\ai-gaming-shorts`, run `pnpm install` (no new Node dependency is required).
4. Restart Python worker, API, and frontend using the commands in README / your normal startup steps.
5. Open the app, click View saved highlights if needed, then click Render vertical Short on a candidate.

Rendering center-crops landscape footage to 9:16. It does not yet track the ball/player, add captions, or guarantee that a candidate contains a goal. Only process videos you own or are authorized to use.
