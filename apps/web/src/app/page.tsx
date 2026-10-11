"use client";

import { ChangeEvent, useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";
type Highlight = {
  id: string;
  start_seconds: number;
  end_seconds: number;
  peak_seconds: number;
  score: number;
  reason: string;
};
type RenderedClip = {
  id: string;
  file_url: string;
  start_seconds: number;
  end_seconds: number;
  width: number;
  height: number;
};
type Project = {
  id: string;
  source_type: "youtube_url" | "local_file";
  source_url?: string | null;
  original_filename?: string | null;
  status: string;
  created_at: string;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  video_codec?: string | null;
  audio_codec?: string | null;
  frame_rate?: number | null;
  size_bytes?: number | null;
  format_name?: string | null;
};

function formatDuration(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  const total = Math.round(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function formatBytes(value?: number | null) {
  if (value == null) return "—";
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

export default function HomePage() {
  const [mode, setMode] = useState<"upload" | "youtube">("upload");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [status, setStatus] = useState("Ready for a local video");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [highlights, setHighlights] = useState<Record<string, Highlight[]>>({});
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [rendering, setRendering] = useState<string | null>(null);
  const [clips, setClips] = useState<Record<string, RenderedClip>>({});

  async function refreshProjects() {
    try {
      const response = await fetch(`${API_BASE}/api/projects`, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      }
    } catch {
      /* API may not be running during initial render. */
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  async function analyze(projectId: string) {
    setError("");
    setAnalyzing(projectId);
    setStatus(
      "Analyzing local gameplay audio and video… This may take a few minutes.",
    );
    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/analyze`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Analysis failed.");
      setHighlights((prev) => ({ ...prev, [projectId]: result.highlights }));
      setStatus(
        `Found ${result.highlights.length} highlight candidates. Review the timestamps below.`,
      );
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setStatus("Analysis failed");
    } finally {
      setAnalyzing(null);
    }
  }

  async function renderClip(projectId: string, highlight: Highlight) {
    setError("");
    setRendering(highlight.id);
    setStatus("Rendering a vertical 9:16 clip locally with FFmpeg…");
    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/highlights/${highlight.id}/render`,
        { method: "POST" },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Clip rendering failed.");
      setClips((prev) => ({
        ...prev,
        [highlight.id]: { ...result.clip, file_url: result.clip.file_url },
      }));
      setStatus(
        "Vertical clip rendered. Preview it below or download the MP4.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clip rendering failed.");
      setStatus("Clip rendering failed");
    } finally {
      setRendering(null);
    }
  }

  async function loadHighlights(projectId: string) {
    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${projectId}/highlights`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not load highlights.");
      setHighlights((prev) => ({ ...prev, [projectId]: result.highlights }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load highlights.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
    setError("");
  }

  async function createProject() {
    setError("");
    if (!authorized) {
      setError(
        "Confirm that you own this video or have permission to process it.",
      );
      return;
    }
    if (mode === "upload" && !file) {
      setError("Choose a video file first.");
      return;
    }
    if (
      mode === "youtube" &&
      !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url.trim())
    ) {
      setError("Enter a valid HTTPS YouTube URL.");
      return;
    }

    setBusy(true);
    setStatus(
      mode === "upload"
        ? "Uploading and inspecting video locally…"
        : "Importing and inspecting authorized video…",
    );
    try {
      let response: Response;
      if (mode === "upload" && file) {
        const form = new FormData();
        form.append("video", file);
        form.append("authorized", "true");
        response = await fetch(`${API_BASE}/api/projects/upload`, {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch(`${API_BASE}/api/projects/youtube/import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sourceUrl: url.trim(), authorized: true }),
});
      }
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? "Project creation failed.");
      const project = payload.project as Project;
      setStatus(
        mode === "upload"
          ? `Video inspected successfully · ${project.width ?? "?"} × ${project.height ?? "?"}`
          : `Video imported and inspected successfully · ${project.width ?? "?"} × ${project.height ?? "?"}`,
      );
      setUrl("");
      if (mode === "upload") setFile(null);
      await refreshProjects();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reach the local API.",
      );
      setStatus("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">AI</div>
        <div>
          <p className="eyebrow">LOCAL-FIRST CREATOR TOOL</p>
          <h1>Gaming Shorts Generator</h1>
        </div>
        <span className="pill">Milestone 4</span>
      </header>

      <section className="hero">
        <p className="eyebrow">EA SPORTS FC · HIGHLIGHT WORKFLOW</p>
        <h2>
          Find the moment.
          <br />
          <span>Make it a Short.</span>
        </h2>
        <p className="lede">
          Import gameplay, inspect video metadata, and keep project records on
          your own computer. Detect potential highlights using local audio
          intensity and visual changes. Highlight candidates are heuristic
          suggestions. Render selected moments as vertical 9:16 MP4 clips for
          review.
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">NEW PROJECT</p>
            <h3>Add a gameplay video</h3>
          </div>
          <span className="step">02 / 06</span>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Source type">
          <button
            type="button"
            className={mode === "upload" ? "mode-button active" : "mode-button"}
            onClick={() => {
              setMode("upload");
              setError("");
            }}
          >
            Upload from PC
          </button>
          <button
            type="button"
            className={
              mode === "youtube" ? "mode-button active" : "mode-button"
            }
            onClick={() => {
              setMode("youtube");
              setError("");
            }}
          >
            YouTube URL
          </button>
        </div>

        {mode === "upload" ? (
          <>
            <label htmlFor="video-file">Video file (up to 2 GB)</label>
            <input
              id="video-file"
              className="file-input"
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-m4v,video/x-msvideo,.mp4,.mov,.mkv,.webm,.m4v,.avi"
              onChange={onFileChange}
            />
            <p className="fine-print">
              Supported: MP4, MOV, MKV, WEBM, M4V, AVI. Your original file stays
              in the local data/sources folder.
            </p>
            {file && (
              <p className="selected-file">
                Selected: {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </>
        ) : (
          <>
            <label htmlFor="video-url">YouTube video URL</label>
            <input
              id="video-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
            <p className="fine-print">
              Import a video you own or are authorized to download. Import
availability depends on the source platform and its restrictions.
            </p>
          </>
        )}

        <label className="consent">
          <input
            type="checkbox"
            checked={authorized}
            onChange={(event) => setAuthorized(event.target.checked)}
          />
          <span>
            I own this video or have permission to process it, and its use
            complies with the source platform’s terms.
          </span>
        </label>
        <button onClick={createProject} disabled={busy}>
          {busy
            ? "Working…"
            : mode === "upload"
              ? "Upload & inspect video"
              : "Import & inspect video"}
          <span aria-hidden="true">↗</span>
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="status" aria-live="polite">
          <span className="status-dot" />
          {status}
        </p>
      </section>

      <section className="projects-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LOCAL LIBRARY</p>
            <h3>Your projects</h3>
          </div>
          <button
            type="button"
            className="refresh-button"
            onClick={() => void refreshProjects()}
          >
            Refresh ↻
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">
            No projects yet. Upload a gameplay video to begin.
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-title-row">
                  <div>
                    <h4>{project.original_filename || "YouTube reference"}</h4>
                    <p className="project-subtitle">
                      {project.source_type === "local_file"
                        ? "Local video"
                        : "YouTube URL reference"}{" "}
                      · {new Date(project.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="project-status">
                    {project.status.replaceAll("_", " ")}
                  </span>
                </div>
                {project.source_url && (
                  <p className="project-url">{project.source_url}</p>
                )}
                {project.source_type === "local_file" && (
                  <div className="metadata-grid">
                    <div>
                      <span>Duration</span>
                      <strong>
                        {formatDuration(project.duration_seconds)}
                      </strong>
                    </div>
                    <div>
                      <span>Resolution</span>
                      <strong>
                        {project.width ?? "—"} × {project.height ?? "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Frame rate</span>
                      <strong>
                        {project.frame_rate ? `${project.frame_rate} FPS` : "—"}
                      </strong>
                    </div>
                    <div>
                      <span>Video codec</span>
                      <strong>{project.video_codec ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Audio codec</span>
                      <strong>{project.audio_codec ?? "No audio"}</strong>
                    </div>
                    <div>
                      <span>File size</span>
                      <strong>{formatBytes(project.size_bytes)}</strong>
                    </div>
                  </div>
                )}
                {project.source_type === "local_file" && (
                  <div
                    style={{
                      marginTop: 18,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      disabled={analyzing !== null}
                      onClick={() => void analyze(project.id)}
                    >
                      {analyzing === project.id
                        ? "Analyzing…"
                        : "Detect highlights"}
                    </button>
                    <button
                      type="button"
                      className="refresh-button"
                      onClick={() => void loadHighlights(project.id)}
                    >
                      View saved highlights
                    </button>
                  </div>
                )}
                {highlights[project.id] && (
                  <div style={{ marginTop: 14 }}>
                    <h4>Suggested moments ({highlights[project.id].length})</h4>
                    <p className="fine-print">
                      Candidates based on sound and visual changes, not verified
                      goals. Review before using.
                    </p>
                    {highlights[project.id].map((h) => (
                      <div
                        key={h.id}
                        style={{
                          padding: "12px 0",
                          borderBottom: "1px solid #29303b",
                        }}
                      >
                        <p className="project-subtitle">
                          {formatDuration(h.start_seconds)} –{" "}
                          {formatDuration(h.end_seconds)} · Peak{" "}
                          {formatDuration(h.peak_seconds)} · Score{" "}
                          {Math.round(h.score * 100)}% · {h.reason}
                        </p>
                        <button
                          type="button"
                          disabled={rendering !== null}
                          onClick={() => void renderClip(project.id, h)}
                        >
                          {rendering === h.id
                            ? "Rendering clip…"
                            : "Render vertical Short"}
                        </button>
                        {clips[h.id] && (
                          <div style={{ marginTop: 12, maxWidth: 320 }}>
                            <video
                              key={clips[h.id].file_url}
                              controls
                              playsInline
                              style={{
                                width: "100%",
                                maxHeight: 520,
                                background: "#000",
                                borderRadius: 12,
                              }}
                              src={`${API_BASE}${clips[h.id].file_url}`}
                            />
                            <p>
                              <a
                                href={`${API_BASE}${clips[h.id].file_url}`}
                                download={`gaming-short-${clips[h.id].id.slice(0, 8)}.mp4`}
                              >
                                Download MP4
                              </a>
                            </p>
                            <p className="fine-print">
                              1080 × 1920 · Center-cropped to 9:16 ·{" "}
                              {formatDuration(
                                clips[h.id].end_seconds -
                                  clips[h.id].start_seconds,
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {highlights[project.id].length === 0 && (
                      <p className="fine-print">
                        No strong candidate moments detected.
                      </p>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid">
        <article className="mini-card">
          <span className="mini-icon">⌁</span>
          <h4>Local processing</h4>
          <p>Your source files and generated clips stay on your machine.</p>
        </article>
        <article className="mini-card">
          <span className="mini-icon">◈</span>
          <h4>Media inspection</h4>
          <p>
            FFprobe reads duration, resolution, codecs, frame rate, and format.
          </p>
        </article>
        <article className="mini-card">
          <span className="mini-icon">▣</span>
          <h4>Review before export</h4>
          <p>
            Render vertical 9:16 MP4 clips locally with FFmpeg and review before
            download.
          </p>
        </article>
      </section>
      <footer>
        Local SQLite metadata · No cloud AI API configured · Only process videos
        you are authorized to use
      </footer>
    </main>
  );
}
