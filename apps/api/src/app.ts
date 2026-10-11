import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdirSync, unlink } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const app = express();
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 4000);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceDir = path.join(projectRoot, "data", "sources");
const clipsDir = path.join(projectRoot, "data", "clips");
mkdirSync(clipsDir, { recursive: true });
const workerBase = process.env.WORKER_BASE_URL ?? "http://127.0.0.1:8001";
const unlinkAsync = promisify(unlink);

mkdirSync(sourceDir, { recursive: true });
app.disable("x-powered-by");
app.use(cors({ origin: ["http://localhost:3000", "http://127.0.0.1:3000"] }));
app.use(express.json({ limit: "32kb" }));
app.use("/clips", express.static(clipsDir, { fallthrough: false, dotfiles: "deny", index: false }));

const createProjectSchema = z.object({
  sourceUrl: z.string().url().max(2048),
  authorized: z.literal(true)
}).strict();

function isYoutubeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:" &&
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(hostname);
  } catch {
    return false;
  }
}

const allowedExtensions = new Set([".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"]);
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, sourceDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      callback(new Error("Unsupported video format. Use MP4, MOV, MKV, WEBM, M4V, or AVI."));
      return;
    }
    callback(null, true);
  }
});

async function workerRequest(route: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${workerBase}${route}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(600_000)
  });
  const payload: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "detail" in payload
      ? String((payload as { detail: unknown }).detail)
      : `Video worker returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api", milestone: 3 });
});

app.post("/api/projects", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A valid sourceUrl and explicit authorization confirmation are required." });
  }
  if (!isYoutubeUrl(parsed.data.sourceUrl)) {
    return res.status(400).json({ error: "Only HTTPS YouTube URLs are accepted." });
  }

  try {
    const result = await workerRequest("/projects/youtube", {
      method: "POST",
      body: JSON.stringify({ source_url: parsed.data.sourceUrl })
    });
    return res.status(201).json({ ...result as object, message: "Project saved locally. For processing, upload a video file you are authorized to use; this app does not download from YouTube." });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not reach the local video worker." });
  }
});

app.post("/api/projects/youtube/import", async (req, res) => {
  const parsed = z.object({
    sourceUrl: z.string().url().max(2048),
    authorized: z.literal(true),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Provide a valid YouTube URL and confirm you have permission to download and process the video.",
    });
  }

  if (!isYoutubeUrl(parsed.data.sourceUrl)) {
    return res.status(400).json({
      error: "Only HTTPS YouTube URLs are accepted.",
    });
  }

  try {
    const result = await workerRequest("/projects/youtube/import", {
      method: "POST",
      body: JSON.stringify({
        source_url: parsed.data.sourceUrl,
        authorized: parsed.data.authorized,
      }),
    });

    return res.status(201).json(result);
  } catch (error) {
    return res.status(422).json({
      error: error instanceof Error
        ? error.message
        : "Could not import the video.",
    });
  }
});

app.post("/api/projects/upload", (req: Request, res: Response, next: NextFunction) => {
  upload.single("video")(req, res, async (uploadError?: unknown) => {
    if (uploadError) return next(uploadError);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Choose a video file to upload." });
    if (req.body?.authorized !== "true") {
      await unlinkAsync(file.path).catch(() => undefined);
      return res.status(400).json({ error: "Confirm that you own this video or have permission to process it." });
    }

    try {
      const result = await workerRequest("/inspect", {
        method: "POST",
        body: JSON.stringify({ file_path: file.path, original_filename: file.originalname })
      });
      return res.status(201).json({ ...result as object, message: "Video uploaded and inspected locally." });
    } catch (error) {
      await unlinkAsync(file.path).catch(() => undefined);
      return res.status(502).json({ error: error instanceof Error ? error.message : "Video inspection failed." });
    }
  });
});

app.get("/api/projects", async (_req, res) => {
  try {
    const result = await workerRequest("/projects");
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not load projects." });
  }
});

app.post("/api/projects/:id/analyze", async (req, res) => {
  try {
    const result = await workerRequest(`/projects/${encodeURIComponent(req.params.id)}/analyze`, { method: "POST" });
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Analysis failed." });
  }
});

app.get("/api/projects/:id/highlights", async (req, res) => {
  try {
    return res.json(await workerRequest(`/projects/${encodeURIComponent(req.params.id)}/highlights`));
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not load highlights." });
  }
});

app.post("/api/projects/:id/analyze", async (req, res) => {
  try {
    const result = await workerRequest(`/projects/${encodeURIComponent(req.params.id)}/analyze`, { method: "POST" });
    return res.json(result);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Analysis failed." });
  }
});

app.get("/api/projects/:id/highlights", async (req, res) => {
  try {
    return res.json(await workerRequest(`/projects/${encodeURIComponent(req.params.id)}/highlights`));
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not load highlights." });
  }
});


app.post(
  "/api/projects/:id/highlights/:highlightId/render",
  async (req, res) => {
    try {
      const projectId = encodeURIComponent(req.params.id);
      const highlightId = encodeURIComponent(req.params.highlightId);

      const result = await workerRequest(
        `/projects/${projectId}/highlights/${highlightId}/render`,
        { method: "POST" }
      );

      return res.json(result);
    } catch (error) {
      return res.status(502).json({
        error: error instanceof Error
          ? error.message
          : "Clip rendering failed."
      });
    }
  }
);
app.use("/clips", express.static(clipsDir, { fallthrough: false, dotfiles: "deny", index: false }));

app.get("/api/clips/:clipId/file", async (req, res) => {
  try {
    const workerResponse = await fetch(
      `${workerBase}/clips/${encodeURIComponent(req.params.clipId)}/file`,
      {
        headers: {
          ...(req.headers.range ? { Range: req.headers.range } : {}),
        },
      }
    );

    if (!workerResponse.ok && workerResponse.status !== 206) {
      return res.status(workerResponse.status).json({
        error: `Video worker returned HTTP ${workerResponse.status}`,
      });
    }

    res.status(workerResponse.status);
    res.setHeader(
      "Content-Type",
      workerResponse.headers.get("content-type") ?? "video/mp4"
    );

    for (const header of [
      "content-length",
      "content-range",
      "accept-ranges",
      "content-disposition",
    ]) {
      const value = workerResponse.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (!workerResponse.body) return res.end();

    const { Readable } = await import("node:stream");
    Readable.fromWeb(workerResponse.body as import("node:stream/web").ReadableStream).pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(502).json({
        error: error instanceof Error ? error.message : "Could not retrieve clip.",
      });
    } else {
      res.end();
    }
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Video exceeds the 2 GB upload limit." : error.message;
    return res.status(400).json({ error: message });
  }
  return res.status(400).json({ error: error instanceof Error ? error.message : "Request failed." });
});

app.listen(port, host, () => {
  console.log(`API listening at http://${host}:${port}`);
  console.log(`Video worker: ${workerBase}`);
});
