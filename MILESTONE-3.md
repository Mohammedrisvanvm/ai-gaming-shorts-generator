# Milestone 3 — Local highlight candidate detection

This update adds **heuristic** detection, not a trained EA SPORTS FC goal-recognition model. It scores one-second windows from audio RMS peaks and grayscale frame differences and proposes up to eight separated 21-second windows. Review results manually. It analyzes up to the first 30 minutes of a video and may miss goals or suggest irrelevant action.

## Install

Stop the three services. Extract this overlay into D:\ so it merges with D:\ai-gaming-shorts (back up your project first). Restart the worker, API, and web app with your existing commands. No new pip/npm dependencies required.

1. Upload a video as before.
2. Click **Detect highlights** in the project card. Wait for analysis to complete; large files can take minutes.
3. Click **View saved highlights** later to reload saved candidates.

Highlights persist in the existing `data/shorts.db`. Source videos and existing projects are not deleted. Processing runs locally, using CPU-based FFmpeg decode; NVIDIA acceleration is not yet enabled. No vertical video export in this milestone.

API: `POST /api/projects/:id/analyze`, `GET /api/projects/:id/highlights`.

Only process video you own or are authorized to use. YouTube URLs are references only, not downloaded.
