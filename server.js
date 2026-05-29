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

const DATA_DIR      = path.join(__dirname, "uploads", "data", "projects");
const ANALYTICS_DIR = path.join(__dirname, "uploads", "data", "analytics");
const UPLOADS_DIR   = path.join(__dirname, "uploads");

fs.mkdirSync(DATA_DIR,      { recursive: true });
fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR,   { recursive: true });

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

// GET /api/projects/:id はプレイヤーが使うため認証不要
// その他の書き込み系ルートは個別に requireAuth を適用

// ── ファイルアップロード設定 ────────────────────────────────
const memStorage = multer.memoryStorage();
const upload        = multer({ storage: memStorage });
const uploadOverlay    = multer({ storage: memStorage });
const uploadEndOverlay = multer({ storage: memStorage });

// ── ヘルパー ───────────────────────────────────────────────
const projectPath = (id) => path.join(DATA_DIR, `${id}.json`);

async function readProject(id) {
  return migrateToV2(JSON.parse(await fsp.readFile(projectPath(id), "utf-8")));
}

async function writeProject(project) {
  project.updatedAt = new Date().toISOString();
  await fsp.writeFile(projectPath(project.id), JSON.stringify(project, null, 2));
  return project;
}

// ── v1 → v2 マイグレーション ───────────────────────────────
function migrateToV2(project) {
  if (project.schemaVersion === 2) return project;

  const chaptersById = {};
  (project.chapters || []).forEach((c) => {
    chaptersById[c.id] = {
      ...c,
      branches: c.branches || [],
      overlay: c.overlay || null,
      nextChapterId: c.nextChapterId || null,
      pauseAt: c.pauseAt ?? null,
    };
  });

  const introId = project.flow?.intro?.chapter || "C01";
  if (chaptersById[introId]) {
    if (project.flow?.intro?.pauseAt != null) {
      chaptersById[introId].pauseAt = project.flow.intro.pauseAt;
    }
    if (project.overlay && !chaptersById[introId].overlay) {
      chaptersById[introId].overlay = project.overlay;
    }
    if (project.flow?.branches?.length > 0 && !chaptersById[introId].branches?.length) {
      chaptersById[introId].branches = project.flow.branches.map((b) => ({
        id: b.id,
        label: b.label || "",
        sublabel: b.sublabel || "",
        nextChapterId: b.chapters?.[0] ?? null,
      }));
      project.flow.branches.forEach((b) => {
        if (!b.chapters) return;
        for (let i = 0; i < b.chapters.length - 1; i++) {
          const curr = b.chapters[i];
          const next = b.chapters[i + 1];
          if (chaptersById[curr] && !chaptersById[curr].nextChapterId) {
            chaptersById[curr].nextChapterId = next;
          }
        }
      });
    }
  }

  const { overlay: _dropped, ...rest } = project;
  return {
    ...rest,
    schemaVersion: 2,
    chapters: (project.chapters || []).map((c) => chaptersById[c.id] || c),
    flow: { endMenu: project.flow?.endMenu ?? null },
  };
}

// ── API ────────────────────────────────────────────────────

// プロジェクト一覧（管理画面用・認証必要）
app.get("/api/projects", requireAuth, async (_req, res) => {
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
app.post("/api/projects", requireAuth, async (_req, res) => {
  const id = uuidv4().slice(0, 8);
  const ch = (id, label, dur, extra = {}) => ({
    id, label, url: null, demoDuration: dur,
    pauseAt: null, overlay: null, branches: [], nextChapterId: null,
    ...extra,
  });
  const project = {
    id,
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    company: { name: "新しいプロジェクト", phone: "", contactUrl: "" },
    theme: { primary: "#2a9824" },
    chapters: [
      ch("C01", "オープニング",    15, {
        pauseAt: 15,
        branches: [
          { id: "b1", label: "01 ブランチ名", sublabel: "Subtitle", nextChapterId: "C02" },
          { id: "b2", label: "02 ブランチ名", sublabel: "Subtitle", nextChapterId: "C06" },
          { id: "b3", label: "03 ブランチ名", sublabel: "Subtitle", nextChapterId: "C10" },
        ],
      }),
      ch("C02", "タイトル①",        4, { nextChapterId: "C03" }),
      ch("C03", "インタビュー①-1",  8, { nextChapterId: "C04" }),
      ch("C04", "インタビュー①-2",  8, { nextChapterId: "C05" }),
      ch("C05", "インタビュー①-3",  8),
      ch("C06", "タイトル②",        4, { nextChapterId: "C07" }),
      ch("C07", "インタビュー②-1",  8, { nextChapterId: "C08" }),
      ch("C08", "インタビュー②-2",  8, { nextChapterId: "C09" }),
      ch("C09", "インタビュー②-3",  8),
      ch("C10", "タイトル③",        4, { nextChapterId: "C11" }),
      ch("C11", "インタビュー③-1",  8, { nextChapterId: "C12" }),
      ch("C12", "インタビュー③-2",  8, { nextChapterId: "C13" }),
      ch("C13", "インタビュー③-3",  8),
      ch("C14", "エンドメニュー",   15),
    ],
    flow: { endMenu: "C14" },
  };
  res.json(await writeProject(project));
});

// プロジェクト取得
app.get("/api/projects/:id", async (req, res) => {
  try { res.json(await readProject(req.params.id)); }
  catch { res.status(404).json({ error: "Not found" }); }
});

// プロジェクト更新
app.put("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const existing = await readProject(req.params.id);
    const updated = { ...existing, ...req.body, id: existing.id, createdAt: existing.createdAt };
    res.json(await writeProject(updated));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// プロジェクト複製
app.post("/api/projects/:id/duplicate", requireAuth, async (req, res) => {
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
app.delete("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    await fsp.unlink(projectPath(req.params.id));
    const uploadsDir = path.join(UPLOADS_DIR, req.params.id);
    await fsp.rm(uploadsDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// エンドオーバーレイ画像アップロード
app.post("/api/projects/:id/upload/end-overlay",
  requireAuth, uploadEndOverlay.single("image"),
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
  requireAuth, uploadOverlay.single("image"),
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

// チャプター別オーバーレイ画像アップロード
app.post("/api/projects/:id/upload/chapter-overlay/:chapterId",
  requireAuth, uploadOverlay.single("image"),
  async (req, res) => {
    const { id, chapterId } = req.params;
    const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
    const key = `${id}/overlay_${chapterId}${ext}`;
    let url;
    if (useR2) {
      url = await uploadToR2(key, req.file.buffer, req.file.mimetype || "image/png");
    } else {
      const dir = path.join(UPLOADS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, `overlay_${chapterId}${ext}`), req.file.buffer);
      url = `/uploads/${key}`;
    }
    const project = await readProject(id);
    const chapter = project.chapters.find((c) => c.id === chapterId);
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    if (!chapter.overlay) chapter.overlay = { imageUrl: url, buttons: [] };
    else chapter.overlay.imageUrl = url;
    await writeProject(project);
    res.json({ url });
  }
);

// 動画アップロード
app.post("/api/projects/:projectId/upload/:chapterId",
  requireAuth, upload.single("video"),
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

// ── アナリティクス ─────────────────────────────────────────

const analyticsPath = (id) => path.join(ANALYTICS_DIR, `${id}.json`);

async function readAnalytics(id) {
  try {
    return JSON.parse(await fsp.readFile(analyticsPath(id), "utf-8"));
  } catch {
    return { events: [] };
  }
}

// イベント記録（認証不要・プレーヤーから送信）
app.post("/api/analytics/:id/event", async (req, res) => {
  const { id } = req.params;
  const event = req.body;
  if (!event.type || !event.sessionId) return res.status(400).json({ error: "Invalid" });
  const data = await readAnalytics(id);
  data.events.push(event);
  await fsp.writeFile(analyticsPath(id), JSON.stringify(data));
  res.json({ ok: true });
});

// 分析サマリー取得（管理画面用・認証必要）
app.get("/api/analytics/:id", requireAuth, async (req, res) => {
  const data = await readAnalytics(req.params.id);
  const events = data.events;

  // セッション別集計
  const sessions = {};
  for (const e of events) {
    if (!sessions[e.sessionId]) sessions[e.sessionId] = [];
    sessions[e.sessionId].push(e);
  }

  const totalSessions = Object.keys(sessions).length;
  const completedSessions = Object.values(sessions).filter(
    (s) => s.some((e) => e.type === "end_reached")
  ).length;
  const completionRate = totalSessions > 0
    ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // ブランチ選択集計
  const branchMap = {};
  for (const e of events) {
    if (e.type !== "branch_select") continue;
    if (!branchMap[e.branchId]) branchMap[e.branchId] = { label: e.branchLabel, count: 0 };
    branchMap[e.branchId].count++;
  }
  const totalBranchSelects = Object.values(branchMap).reduce((s, b) => s + b.count, 0);
  const branchCounts = Object.entries(branchMap).map(([id, { label, count }]) => ({
    id, label, count,
    rate: totalBranchSelects > 0 ? Math.round((count / totalBranchSelects) * 100) : 0,
  }));

  // 日別視聴数（過去30日）
  const dailyMap = {};
  for (const e of events) {
    if (e.type !== "play_start") continue;
    const date = e.timestamp.slice(0, 10);
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  }
  const dailyCounts = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, count]) => ({ date, count }));

  // トップ戻り回数
  const topReturnCount = events.filter((e) => e.type === "top_return").length;

  res.json({
    totalSessions,
    completedSessions,
    completionRate,
    topReturnCount,
    branchCounts,
    dailyCounts,
  });
});

// ── フロントエンド配信 ─────────────────────────────────────
app.use(express.static(path.join(__dirname, "dist")));
app.get("*", (_, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
