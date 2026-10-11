# AI Gaming Shorts Generator

Local-first Windows project for an EA SPORTS FC highlight-to-Shorts workflow.

## Milestone 2
- Upload a video file from the PC (MP4, MOV, MKV, WEBM, M4V, AVI; maximum 2 GB).
- Inspect the file with FFprobe for duration, dimensions, frame rate, codecs, and format.
- Save project metadata in local SQLite at `data/shorts.db`.
- Save uploaded source files under `data/sources/`.
- Save an authorized YouTube URL as a project reference. This app does not download from YouTube or bypass access restrictions; upload an authorized local copy for inspection.

## Run after the first-time setup
Open three VS Code PowerShell terminals in `D:\ai-gaming-shorts`.

Terminal 1 — Python worker:
```powershell
.\workers\video-ai\.venv\Scripts\python.exe -m uvicorn main:app --app-dir workers\video-ai\src --host 127.0.0.1 --port 8001
```

Terminal 2 — Express API:
```powershell
pnpm --filter @shorts/api dev
```

Terminal 3 — Next.js frontend:
```powershell
pnpm --filter @shorts/web dev
```

Open `http://localhost:3000`. API health is `http://localhost:4000/health`, and worker health is `http://localhost:8001/health`.

## Milestone 2 upgrade
After copying these updated source files over an existing Milestone 1 checkout, run:
```powershell
pnpm install
```
Then stop and restart all three services. Ensure `ffprobe -version` works in a newly opened VS Code terminal.

## Notes
- The app is local-only by default and does not use cloud AI APIs.
- Project metadata is stored in SQLite at `data/shorts.db`; the database is created automatically when the worker starts.
- Uploaded videos are stored locally. Keep enough disk space available; upload limit is 2 GB.
- Only process videos you own or have permission to use. Do not bypass platform restrictions.
- Highlight detection, clip generation, and download UI are not yet implemented.


## delete 
- Remove-Item .\data\sources\*, .\data\clips\* -Force; Remove-Item .\data\shorts.db -Force