import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR    = path.join(__dirname, "uploads", "data", "projects");
const UPLOADS_DIR = path.join(__dirname, "uploads");

fs.mkdirSync(DATA_DIR,    { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));

// ── Cloudflare R2 ──────────────────────────────────────────
const R2_ACCOUNT_ID = "6e9a6b53e185412fea8e54ac27686b26";
const R2_BUCKET     = "interactive-video";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
const useR2 = !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

const r2 = useR2 ? new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}) : null;

async function uploadToR2(key, buffer, contentType) {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}

// ── 認証 ──────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ADMIN_TOKEN = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest("hex");

app.post("/api/auth/login", (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.json({ token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ error: "パスワードが違います" });
  }
});

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (token === ADMIN_TOKEN) return next();
  res.status(401).json({ error: "Unauthorized" });
}

app.use("/api/projects", requireAuth);

// ── ファイルアップロード設定 ────────────────────────────────
const memStorage = multer.memoryStorage();
const upload        = multer({ storage: memStorage });
const uploadOverlay    = multer({ storage: memStorage });
const uploadEndOverlay = multer({ storage: memStorage });

// ── ヘルパー ───────────────────────────────────────────────
const projectPath = (id) => path.join(DATA_DIR, `${id}.json`);

async function readProject(id) {
  return JSON.parse(await fsp.readFile(projectPath(id), "utf-8"));
}

async function writeProject(project) {
  project.updatedAt = new Date().toISOString();
  await fsp.writeFile(projectPath(project.id), JSON.stringify(project, null, 2));
  return project;
}

// ── API ────────────────────────────────────────────────────

// プロジェクト一覧
app.get("/api/projects", async (_req, res) => {
  try {
    const files = (await fsp.readdir(DATA_DIR)).filter((f) => f.endsWith(".json"));
    const list = await Promise.all(
      files.map(async (f) => {
        const p = JSON.parse(await fsp.readFile(path.join(DATA_DIR, f), "utf-8"));
        return { id: p.id, name: p.company.name, updatedAt: p.updatedAt, chapterCount: p.chapters.length };
      })
    );
    res.json(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  } catch { res.json([]); }
});

// 新規プロジェクト作成
app.post("/api/projects", async (_req, res) => {
  const id = uuidv4().slice(0, 8);
  const project = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    company: { name: "新しいプロジェクト", phone: "", contactUrl: "" },
    theme: { primary: "#2a9824" },
    chapters: [
      { id: "C01", label: "オープニング",    url: null, demoDuration: 15 },
      { id: "C02", label: "タイトル①",       url: null, demoDuration: 4  },
      { id: "C03", label: "インタビュー①-1", url: null, demoDuration: 8  },
      { id: "C04", label: "インタビュー①-2", url: null, demoDuration: 8  },
      { id: "C05", label: "インタビュー①-3", url: null, demoDuration: 8  },
      { id: "C06", label: "タイトル②",       url: null, demoDuration: 4  },
      { id: "C07", label: "インタビュー②-1", url: null, demoDuration: 8  },
      { id: "C08", label: "インタビュー②-2", url: null, demoDuration: 8  },
      { id: "C09", label: "インタビュー②-3", url: null, demoDuration: 8  },
      { id: "C10", label: "タイトル③",       url: null, demoDuration: 4  },
      { id: "C11", label: "インタビュー③-1", url: null, demoDuration: 8  },
      { id: "C12", label: "インタビュー③-2", url: null, demoDuration: 8  },
      { id: "C13", label: "インタビュー③-3", url: null, demoDuration: 8  },
      { id: "C14", label: "エンドメニュー",  url: null, demoDuration: 15 },
    ],
    flow: {
      intro: { chapter: "C01", pauseAt: 15 },
      branches: [
        { id: "b1", label: "01 ブランチ名", sublabel: "Subtitle", chapters: ["C02","C03","C04","C05"] },
        { id: "b2", label: "02 ブランチ名", sublabel: "Subtitle", chapters: ["C06","C07","C08","C09"] },
        { id: "b3", label: "03 ブランチ名", sublabel: "Subtitle", chapters: ["C10","C11","C12","C13"] },
      ],
      endMenu: "C14",
    },
  };
  res.json(await writeProject(project));
});

// プロジェクト取得
app.get("/api/projects/:id", async (req, res) => {
  try { res.json(await readProject(req.params.id)); }
  catch { res.status(404).json({ error: "Not found" }); }
});

// プロジェクト更新
app.put("/api/projects/:id", async (req, res) => {
  try {
    const existing = await readProject(req.params.id);
    const updated = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt };
    res.json(await writeProject(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// プロジェクト複製
app.post("/api/projects/:id/duplicate", async (req, res) => {
  try {
    const src = await readProject(req.params.id);
    const newId = uuidv4().slice(0, 8);
    const copy = {
      ...src,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      company: { ...src.company, name: src.company.name + "（コピー）" },
      // 動画URLはリセット（ファイルはコピーしない）
      chapters: src.chapters.map((c) => ({ ...c, url: null })),
    };
    res.json(await writeProject(copy));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// プロジェクト削除
app.delete("/api/projects/:id", async (req, res) => {
  try {
    await fsp.unlink(projectPath(req.params.id));
    const uploadsDir = path.join(UPLOADS_DIR, req.params.id);
    await fsp.rm(uploadsDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// エンドオーバーレイ画像アップロード
app.post("/api/projects/:id/upload/end-overlay",
  uploadEndOverlay.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
    const key = `${id}/end_overlay${ext}`;
    let url;
    if (useR2) {
      url = await uploadToR2(key, req.file.buffer, req.file.mimetype || "image/png");
    } else {
      const dir = path.join(UPLOADS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `end_overlay${ext}`), req.file.buffer);
      url = `/uploads/${key}`;
    }
    const project = await readProject(id);
    if (!project.endOverlay) project.endOverlay = { imageUrl: url, buttons: [] };
    else project.endOverlay.imageUrl = url;
    await writeProject(project);
    res.json({ url });
  }
);

// オーバーレイ画像アップロード（動画ルートより先に定義すること）
app.post("/api/projects/:id/upload/overlay",
  uploadOverlay.single("image"),
  async (req, res) => {
    const { id } = req.params;
    const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
    const key = `${id}/overlay${ext}`;
    let url;
    if (useR2) {
      url = await uploadToR2(key, req.file.buffer, req.file.mimetype || "image/png");
    } else {
      const dir = path.join(UPLOADS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `overlay${ext}`), req.file.buffer);
      url = `/uploads/${key}`;
    }
    const project = await readProject(id);
    if (!project.overlay) project.overlay = { imageUrl: url, buttons: [] };
    else project.overlay.imageUrl = url;
    await writeProject(project);
    res.json({ url });
  }
);

// 動画アップロード
app.post("/api/projects/:projectId/upload/:chapterId",
  upload.single("video"),
  async (req, res) => {
    const { projectId, chapterId } = req.params;
    const key = `${projectId}/${chapterId}.mp4`;
    let url;
    if (useR2) {
      url = await uploadToR2(key, req.file.buffer, req.file.mimetype || "video/mp4");
    } else {
      const dir = path.join(UPLOADS_DIR, projectId);
      fs.mkdirSync(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `${chapterId}.mp4`), req.file.buffer);
      url = `/uploads/${key}`;
    }
    const project = await readProject(projectId);
    const chapter = project.chapters.find((c) => c.id === chapterId);
    if (chapter) chapter.url = url;
    await writeProject(project);
    res.json({ url });
  }
);

// ── フロントエンド配信 ─────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
