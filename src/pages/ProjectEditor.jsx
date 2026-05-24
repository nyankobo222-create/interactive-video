import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import "./ProjectEditor.css";
import { authHeaders, logout } from "../auth";

// ── チャプター1枚 ────────────────────────────────────────
function ChapterRow({ chapter, projectId, onChange, onDelete, onMove, isFirst, isLast }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("video", file);
    const res = await fetch(`/api/projects/${projectId}/upload/${chapter.id}`, {
      method: "POST", body: fd, headers: authHeaders(),
    });
    const { url } = await res.json();
    onChange({ ...chapter, url });
    setUploading(false);
  }

  return (
    <div className="chapter-row">
      <div className="chapter-row__top">
        <div className="chapter-row__move">
          <button className="btn-icon btn-icon--gray" onClick={() => onMove(-1)} disabled={isFirst} title="上へ">▲</button>
          <button className="btn-icon btn-icon--gray" onClick={() => onMove(1)}  disabled={isLast}  title="下へ">▼</button>
        </div>
        <span className="chapter-row__id">{chapter.id}</span>
        <input
          className="chapter-row__label"
          value={chapter.label}
          onChange={(e) => onChange({ ...chapter, label: e.target.value })}
          placeholder="チャプター名"
        />
        <button className="btn-icon btn-icon--danger" onClick={onDelete} title="削除">✕</button>
      </div>
      <div className="chapter-row__bottom">
        {chapter.url ? (
          <span className="chapter-row__uploaded">✓ {chapter.url.split("/").pop()}</span>
        ) : (
          <>
            <span className="chapter-row__no-video">動画未アップロード</span>
            <label className="chapter-row__demo-label">
              デモ時間
              <input
                type="number"
                className="chapter-row__demo-input"
                value={chapter.demoDuration}
                min={1} max={120}
                onChange={(e) => onChange({ ...chapter, demoDuration: Number(e.target.value) })}
              />
              秒
            </label>
          </>
        )}
        <button
          className="btn btn--outline btn--sm"
          onClick={() => fileRef.current.click()}
          disabled={uploading}
        >
          {uploading ? "アップロード中..." : chapter.url ? "動画を差し替え" : "動画をアップロード"}
        </button>
        <input ref={fileRef} type="file" accept="video/mp4,video/*" style={{ display: "none" }} onChange={handleUpload} />
      </div>
    </div>
  );
}

// ── ブランチ1個 ────────────────────────────────────────
function BranchRow({ branch, allChapterIds, onChange, onDelete }) {
  function addChapter(cid) {
    if (!cid || branch.chapters.includes(cid)) return;
    onChange({ ...branch, chapters: [...branch.chapters, cid] });
  }
  function removeChapter(cid) {
    onChange({ ...branch, chapters: branch.chapters.filter((c) => c !== cid) });
  }
  function moveChapter(idx, dir) {
    const arr = [...branch.chapters];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    onChange({ ...branch, chapters: arr });
  }

  return (
    <div className="branch-row">
      <div className="branch-row__header">
        <input
          className="branch-row__label"
          value={branch.label}
          onChange={(e) => onChange({ ...branch, label: e.target.value })}
          placeholder="ボタンラベル（例：01 未経験からプロへ）"
        />
        <input
          className="branch-row__sublabel"
          value={branch.sublabel}
          onChange={(e) => onChange({ ...branch, sublabel: e.target.value })}
          placeholder="英語サブラベル（例：Zero to Pro）"
        />
        <button className="btn-icon btn-icon--danger" onClick={onDelete} title="削除">✕</button>
      </div>
      <div className="branch-row__chapters">
        <span className="branch-row__ch-label">再生順：</span>
        {branch.chapters.map((cid, i) => (
          <span key={cid} className="branch-ch-tag">
            {cid}
            <button onClick={() => moveChapter(i, -1)} title="前へ">◀</button>
            <button onClick={() => moveChapter(i,  1)} title="後へ">▶</button>
            <button onClick={() => removeChapter(cid)} title="外す">✕</button>
          </span>
        ))}
        <select
          className="branch-row__add-select"
          defaultValue=""
          onChange={(e) => { addChapter(e.target.value); e.target.value = ""; }}
        >
          <option value="" disabled>＋ チャプターを追加</option>
          {allChapterIds
            .filter((cid) => !branch.chapters.includes(cid))
            .map((cid) => <option key={cid} value={cid}>{cid}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── ビジュアルエディター ────────────────────────────────────
function VisualEditor({ project, onChange, onSave }) {
  const [mode, setMode] = useState("overlay"); // "overlay" | "endOverlay"

  const overlayKey = mode; // "overlay" or "endOverlay"
  const uploadPath = mode === "overlay" ? "overlay" : "end-overlay";
  const overlay = project[overlayKey] || { imageUrl: null, buttons: [] };
  const buttons = overlay.buttons || [];
  const [uploading, setUploading] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCur, setDrawCur] = useState(null);
  const [selected, setSelected] = useState(null);
  const containerRef = useRef();
  const fileRef = useRef();

  // modeが切り替わったら選択解除
  useEffect(() => { setSelected(null); }, [mode]);

  function updateOverlay(newOverlay) {
    const updated = { ...project, [overlayKey]: newOverlay };
    onChange(updated);
    return updated;
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/projects/${project.id}/upload/${uploadPath}`, {
        method: "POST", body: fd, headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`サーバーエラー: ${res.status}`);
      const { url } = await res.json();
      updateOverlay({ ...overlay, imageUrl: url });
    } catch (err) {
      alert(`アップロード失敗: ${err.message}\nサーバーを再起動してください。`);
    } finally {
      setUploading(false);
    }
  }

  function getPos(e) {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  function handleMouseDown(e) {
    setDrawStart(getPos(e));
    setDrawCur(getPos(e));
    setSelected(null);
  }

  function handleMouseMove(e) {
    if (!drawStart) return;
    setDrawCur(getPos(e));
  }

  function handleMouseUp() {
    if (!drawStart || !drawCur) return;
    const x = Math.min(drawStart.x, drawCur.x);
    const y = Math.min(drawStart.y, drawCur.y);
    const w = Math.abs(drawCur.x - drawStart.x);
    const h = Math.abs(drawCur.y - drawStart.y);
    setDrawStart(null);
    setDrawCur(null);
    if (w < 2 || h < 2) return;
    const newBtn = {
      id: `btn${Date.now()}`,
      action: mode === "endOverlay" ? "top" : "branch",
      branchId: mode === "endOverlay" ? "" : (project.flow.branches[0]?.id || ""),
      url: "",
      x, y, width: w, height: h,
    };
    updateOverlay({ ...overlay, buttons: [...buttons, newBtn] });
    setSelected(newBtn.id);
  }

  function handleMouseLeave() {
    setDrawStart(null);
    setDrawCur(null);
  }

  function updateButton(updated) {
    updateOverlay({ ...overlay, buttons: buttons.map((b) => (b.id === updated.id ? updated : b)) });
  }

  function deleteButton(btnId) {
    updateOverlay({ ...overlay, buttons: buttons.filter((b) => b.id !== btnId) });
    setSelected(null);
  }

  const drawRect = drawStart && drawCur ? {
    left: `${Math.min(drawStart.x, drawCur.x)}%`,
    top:  `${Math.min(drawStart.y, drawCur.y)}%`,
    width:  `${Math.abs(drawCur.x - drawStart.x)}%`,
    height: `${Math.abs(drawCur.y - drawStart.y)}%`,
  } : null;

  const selectedBtn = buttons.find((b) => b.id === selected);

  return (
    <div className="editor__section ve-section">
      {/* モード切り替え */}
      <div className="ve-mode-tabs">
        <button
          className={`ve-mode-tab ${mode === "overlay" ? "ve-mode-tab--active" : ""}`}
          onClick={() => setMode("overlay")}
        >
          ブランチ選択用
        </button>
        <button
          className={`ve-mode-tab ${mode === "endOverlay" ? "ve-mode-tab--active" : ""}`}
          onClick={() => setMode("endOverlay")}
        >
          エンドメニュー用
        </button>
      </div>

      <div className="editor__section-header">
        <h2 className="editor__section-title">
          {mode === "overlay" ? "ブランチ選択オーバーレイ" : "エンドメニューオーバーレイ"}
        </h2>
        <button className="btn btn--outline btn--sm" onClick={() => fileRef.current.click()} disabled={uploading}>
          {uploading ? "アップロード中..." : overlay.imageUrl ? "画像を差し替え" : "UI画像をアップロード"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,.svg" style={{ display: "none" }} onChange={handleImageUpload} />
      </div>
      <p className="editor__section-desc">
        イラレから書き出したSVG・PNG画像をアップロードし、ボタン領域を画像上でドラッグして配置してください。
      </p>

      {!overlay.imageUrl ? (
        <div className="ve-empty" onClick={() => fileRef.current.click()}>
          <span>クリックしてUI画像をアップロード（PNG / SVG）</span>
        </div>
      ) : (
        <div className="ve-layout">
          <div
            className="ve-container"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
          >
            <img src={overlay.imageUrl} className="ve-image" draggable={false} alt="overlay" style={{ opacity: overlay.opacity ?? 1 }} />

            {buttons.map((btn) => {
              const branch = project.flow.branches.find((b) => b.id === btn.branchId);
              return (
                <div
                  key={btn.id}
                  className={`ve-button ${selected === btn.id ? "ve-button--selected" : ""}`}
                  style={{ left: `${btn.x}%`, top: `${btn.y}%`, width: `${btn.width}%`, height: `${btn.height}%` }}
                  onMouseDown={(e) => { e.stopPropagation(); setSelected(btn.id); setDrawStart(null); }}
                >
                  <span className="ve-button__label">{branch?.label || "未設定"}</span>
                </div>
              );
            })}

            {/* 描画中: マウスイベントをキャプチャする透明オーバーレイ */}
            {drawStart && (
              <div
                className="ve-draw-capture"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            )}
            {drawRect && <div className="ve-drawing" style={drawRect} />}
          </div>

          <div className="ve-panel">
            {/* オーバーレイ設定（常時表示） */}
            <div>
              <h3 className="ve-panel__title">オーバーレイ設定</h3>
              <label className="form-label" style={{ marginTop: 10 }}>
                不透明度：{Math.round((overlay.opacity ?? 1) * 100)}%
                <input
                  type="range"
                  min={0} max={100}
                  value={Math.round((overlay.opacity ?? 1) * 100)}
                  onChange={(e) => updateOverlay({ ...overlay, opacity: Number(e.target.value) / 100 })}
                  onPointerUp={(e) => onSave(updateOverlay({ ...overlay, opacity: Number(e.target.value) / 100 }))}
                  className="ve-opacity-slider"
                />
              </label>
              <label className="ve-toggle-label">
                <input
                  type="checkbox"
                  checked={overlay.showFromIntro ?? false}
                  onChange={(e) => onSave(updateOverlay({ ...overlay, showFromIntro: e.target.checked }))}
                />
                オープニングから表示
              </label>
            </div>
            <hr className="ve-divider" />

            {selectedBtn ? (() => {
              const currentAction = selectedBtn.action
                || (selectedBtn.branchId === "__top__" ? "top" : selectedBtn.branchId ? "branch" : "none");

              function setAction(action) {
                updateButton({ ...selectedBtn, action, branchId: "", url: "" });
              }

              return (
              <>
                <h3 className="ve-panel__title">ボタン設定</h3>

                <label className="form-label">
                  アクション
                  <select
                    className="form-input"
                    value={currentAction}
                    onChange={(e) => setAction(e.target.value)}
                  >
                    <option value="none">なし</option>
                    <option value="branch">ブランチへ移動</option>
                    <option value="top">↩ トップへ戻る</option>
                    <option value="url">URLを開く</option>
                  </select>
                </label>

                {currentAction === "branch" && (
                  <label className="form-label">
                    移動先ブランチ
                    <select
                      className="form-input"
                      value={selectedBtn.branchId || ""}
                      onChange={(e) => updateButton({ ...selectedBtn, branchId: e.target.value })}
                    >
                      <option value="">未設定</option>
                      {project.flow.branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.label}</option>
                      ))}
                    </select>
                  </label>
                )}

                {currentAction === "url" && (
                  <label className="form-label">
                    URL
                    <input
                      className="form-input"
                      value={selectedBtn.url || ""}
                      onChange={(e) => updateButton({ ...selectedBtn, url: e.target.value })}
                      placeholder="https://... または tel:0120-XXX-XXX"
                    />
                    <span className="form-hint">電話は tel:0833-XX-XXXX の形式</span>
                  </label>
                )}

                <div className="ve-panel__pos">
                  <span>X: {selectedBtn.x.toFixed(1)}%</span>
                  <span>Y: {selectedBtn.y.toFixed(1)}%</span>
                  <span>W: {selectedBtn.width.toFixed(1)}%</span>
                  <span>H: {selectedBtn.height.toFixed(1)}%</span>
                </div>
                <button
                  className="btn btn--outline btn--sm ve-panel__delete"
                  onClick={() => deleteButton(selectedBtn.id)}
                >
                  このボタンを削除
                </button>
              </>
              );
            })() : (
              <p className="ve-panel__hint">
                {buttons.length === 0
                  ? "画像の上でドラッグしてボタン領域を追加してください"
                  : `ボタンをクリックして設定（${buttons.length}個配置済み）`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── メインエディター ────────────────────────────────────
export default function ProjectEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("basic");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${id}`, { headers: authHeaders() })
      .then((r) => { if (r.status === 401) { logout(); throw new Error(); } return r.json(); })
      .then(setProject)
      .catch(() => {});
  }, [id]);

  async function save(overrideProject) {
    setSaving(true);
    try {
      const data = overrideProject ?? project;
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      setProject(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert(`保存失敗: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  function setCompany(field, val) {
    setProject((p) => ({ ...p, company: { ...p.company, [field]: val } }));
  }
  function setTheme(field, val) {
    setProject((p) => ({ ...p, theme: { ...p.theme, [field]: val } }));
  }
  function setFlow(field, val) {
    setProject((p) => ({ ...p, flow: { ...p.flow, [field]: val } }));
  }

  function updateChapter(updated) {
    setProject((p) => ({
      ...p,
      chapters: p.chapters.map((c) => (c.id === updated.id ? updated : c)),
    }));
  }
  function deleteChapter(cid) {
    setProject((p) => ({ ...p, chapters: p.chapters.filter((c) => c.id !== cid) }));
  }
  function moveChapterRow(idx, dir) {
    setProject((p) => {
      const arr = [...p.chapters];
      const swap = idx + dir;
      if (swap < 0 || swap >= arr.length) return p;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return { ...p, chapters: arr };
    });
  }
  function addChapter() {
    const ids = project.chapters.map((c) => c.id);
    let n = project.chapters.length + 1;
    let newId = `C${String(n).padStart(2, "0")}`;
    while (ids.includes(newId)) { n++; newId = `C${String(n).padStart(2, "0")}`; }
    setProject((p) => ({
      ...p,
      chapters: [...p.chapters, { id: newId, label: `チャプター${newId}`, url: null, demoDuration: 8 }],
    }));
  }

  function updateBranch(updated) {
    setProject((p) => ({
      ...p,
      flow: { ...p.flow, branches: p.flow.branches.map((b) => (b.id === updated.id ? updated : b)) },
    }));
  }
  function deleteBranch(bid) {
    setProject((p) => ({
      ...p,
      flow: { ...p.flow, branches: p.flow.branches.filter((b) => b.id !== bid) },
    }));
  }
  function addBranch() {
    const newBranch = {
      id: `b${Date.now()}`,
      label: `0${project.flow.branches.length + 1} ブランチ名`,
      sublabel: "Subtitle",
      chapters: [],
    };
    setProject((p) => ({
      ...p,
      flow: { ...p.flow, branches: [...p.flow.branches, newBranch] },
    }));
  }

  if (!project) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", color:"#546e7a" }}>
      読み込み中...
    </div>
  );

  const allChapterIds = project.chapters.map((c) => c.id);

  return (
    <div className="editor">
      {/* ── トップバー ── */}
      <header className="editor__topbar">
        <Link to="/admin" className="editor__back">← 一覧</Link>
        <div className="editor__title">{project.company.name}</div>
        <div className="editor__topbar-right">
          <a
            className="btn btn--outline btn--sm"
            href={`/play/${id}`}
            target="_blank"
            rel="noreferrer"
          >
            プレビュー ↗
          </a>
          <button className="btn btn--primary btn--sm" onClick={() => save()} disabled={saving}>
            {saving ? "保存中..." : saved ? "✓ 保存済み" : "保存"}
          </button>
        </div>
      </header>

      {/* ── タブ ── */}
      <nav className="editor__tabs">
        {[["basic","⚙ 基本設定"], ["chapters","🎬 チャプター管理"], ["branches","🔀 分岐設定"], ["visual","🖼 ビジュアルエディター"]].map(([key, label]) => (
          <button
            key={key}
            className={`editor__tab ${tab === key ? "editor__tab--active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* ── コンテンツ ── */}
      <main className="editor__content">

        {/* ────── 基本設定タブ ────── */}
        {tab === "basic" && (
          <div className="editor__section">
            <h2 className="editor__section-title">公開URL</h2>
            <div className="player-url-box">
              <span className="player-url-box__label">プレイヤーURL（共有用）</span>
              <div className="player-url-box__row">
                <input
                  className="form-input player-url-box__input"
                  readOnly
                  value={`${window.location.origin}/play/${project.id}`}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/play/${project.id}`);
                  }}
                >コピー</button>
                <a
                  className="btn btn--primary btn--sm"
                  href={`/play/${project.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >開く</a>
              </div>
            </div>

            <h2 className="editor__section-title" style={{ marginTop: 32 }}>会社・プロジェクト情報</h2>
            <div className="form-grid">
              <label className="form-label">
                会社名
                <input
                  className="form-input"
                  value={project.company.name}
                  onChange={(e) => setCompany("name", e.target.value)}
                  placeholder="株式会社〇〇"
                />
              </label>
              <label className="form-label">
                電話番号
                <input
                  className="form-input"
                  value={project.company.phone}
                  onChange={(e) => setCompany("phone", e.target.value)}
                  placeholder="0120-XXX-XXX"
                />
              </label>
              <label className="form-label" style={{ gridColumn: "1 / -1" }}>
                問い合わせURL
                <input
                  className="form-input"
                  value={project.company.contactUrl}
                  onChange={(e) => setCompany("contactUrl", e.target.value)}
                  placeholder="https://example.com/contact"
                />
              </label>
              <label className="form-label">
                テーマカラー（ボタン色）
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
                  <input
                    type="color"
                    value={project.theme.primary}
                    onChange={(e) => setTheme("primary", e.target.value)}
                    style={{ width: 48, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }}
                  />
                  <input
                    className="form-input"
                    value={project.theme.primary}
                    onChange={(e) => setTheme("primary", e.target.value)}
                    placeholder="#2a9824"
                    style={{ maxWidth: 120 }}
                  />
                  <span style={{
                    background: project.theme.primary, color:"#fff",
                    padding: "6px 16px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 700
                  }}>
                    ボタンプレビュー
                  </span>
                </div>
              </label>
            </div>

            <h2 className="editor__section-title" style={{ marginTop: 32 }}>フロー設定</h2>
            <div className="form-grid">
              <label className="form-label">
                イントロ（C01）停止タイミング（秒）
                <input
                  className="form-input"
                  type="number"
                  value={project.flow.intro.pauseAt}
                  onChange={(e) => setFlow("intro", { ...project.flow.intro, pauseAt: Number(e.target.value) })}
                  style={{ maxWidth: 100 }}
                />
                <span className="form-hint">C01動画を何秒で止めてブランチ選択画面を表示するか</span>
              </label>
              <label className="form-label">
                エンドメニューチャプター
                <select
                  className="form-input"
                  value={project.flow.endMenu || ""}
                  onChange={(e) => setFlow("endMenu", e.target.value)}
                  style={{ maxWidth: 160 }}
                >
                  <option value="">なし</option>
                  {project.chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.id}：{c.label}</option>
                  ))}
                </select>
                <span className="form-hint">全ブランチ終了後に再生するチャプター</span>
              </label>
            </div>
          </div>
        )}

        {/* ────── チャプター管理タブ ────── */}
        {tab === "chapters" && (
          <div className="editor__section">
            <div className="editor__section-header">
              <h2 className="editor__section-title">チャプター管理</h2>
              <button className="btn btn--primary btn--sm" onClick={addChapter}>
                ＋ チャプターを追加
              </button>
            </div>
            <p className="editor__section-desc">
              各チャプターに動画ファイル（MP4）をアップロードしてください。
              動画がない場合はデモ再生モードで動作します。
            </p>
            <div className="chapter-list">
              {project.chapters.map((ch, idx) => (
                <ChapterRow
                  key={ch.id}
                  chapter={ch}
                  projectId={id}
                  onChange={updateChapter}
                  onDelete={() => deleteChapter(ch.id)}
                  onMove={(dir) => moveChapterRow(idx, dir)}
                  isFirst={idx === 0}
                  isLast={idx === project.chapters.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* ────── 分岐設定タブ ────── */}
        {tab === "branches" && (
          <div className="editor__section">
            <div className="editor__section-header">
              <h2 className="editor__section-title">分岐（ブランチ）設定</h2>
              <button className="btn btn--primary btn--sm" onClick={addBranch}>
                ＋ ブランチを追加
              </button>
            </div>
            <p className="editor__section-desc">
              ボタンのラベルと、そのボタンを押したときに再生するチャプターの順番を設定してください。
            </p>
            {project.flow.branches.length === 0 && (
              <p style={{ color: "#90a4ae", marginTop: 24 }}>ブランチがまだありません。「＋ ブランチを追加」から作成してください。</p>
            )}
            <div className="branch-list">
              {project.flow.branches.map((branch) => (
                <BranchRow
                  key={branch.id}
                  branch={branch}
                  allChapterIds={allChapterIds}
                  onChange={updateBranch}
                  onDelete={() => deleteBranch(branch.id)}
                />
              ))}
            </div>
          </div>
        )}
        {/* ────── ビジュアルエディタータブ ────── */}
        {tab === "visual" && (
          <VisualEditor project={project} onChange={setProject} onSave={save} />
        )}

      </main>
    </div>
  );
}
