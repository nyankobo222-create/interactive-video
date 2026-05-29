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

// ── 分岐1行（v2: nextChapterId） ──────────────────────────
function BranchRow({ branch, allChapterIds, currentChapterId, onChange, onDelete }) {
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
          value={branch.sublabel || ""}
          onChange={(e) => onChange({ ...branch, sublabel: e.target.value })}
          placeholder="英語サブラベル（例：Zero to Pro）"
        />
        <select
          className="form-input branch-row__next-select"
          value={branch.nextChapterId || ""}
          onChange={(e) => onChange({ ...branch, nextChapterId: e.target.value || null })}
        >
          <option value="">次チャプター未設定</option>
          <option value="__stop__">停止（そのまま終了）</option>
          {allChapterIds.map((cid) => (
            <option key={cid} value={cid}>
              {cid}{cid === currentChapterId ? "（もう一度みる）" : ""}
            </option>
          ))}
        </select>
        <button className="btn-icon btn-icon--danger" onClick={onDelete} title="削除">✕</button>
      </div>
    </div>
  );
}

// ── チャプターごとの分岐設定セクション ──────────────────────
function ChapterBranchSection({ chapter, allChapterIds, onChange }) {
  const [expanded, setExpanded] = useState(!!(chapter.branches?.length > 0 || chapter.pauseAt || chapter.nextChapterId));
  const hasBranches = chapter.branches?.length > 0;

  function addBranch() {
    const num = String((chapter.branches?.length || 0) + 1).padStart(2, "0");
    const newBranch = {
      id: `b${Date.now()}`,
      label: `${num} ブランチ名`,
      sublabel: "Subtitle",
      nextChapterId: null,
    };
    onChange({ ...chapter, branches: [...(chapter.branches || []), newBranch] });
  }

  function updateBranch(updated) {
    onChange({ ...chapter, branches: chapter.branches.map((b) => (b.id === updated.id ? updated : b)) });
  }

  function deleteBranch(bid) {
    onChange({ ...chapter, branches: chapter.branches.filter((b) => b.id !== bid) });
  }

  return (
    <div className={`chapter-branch-section${hasBranches ? " chapter-branch-section--active" : ""}`}>
      <div className="chapter-branch-section__header" onClick={() => setExpanded((v) => !v)}>
        <span className="chapter-branch-section__toggle">{expanded ? "▼" : "▶"}</span>
        <span className="chapter-branch-section__id">{chapter.id}</span>
        <span className="chapter-branch-section__label">{chapter.label}</span>
        {hasBranches && (
          <span className="chapter-branch-section__badge">{chapter.branches.length}分岐</span>
        )}
        {chapter.nextChapterId && !hasBranches && (
          <span className="chapter-branch-section__next-badge">→ {chapter.nextChapterId}</span>
        )}
      </div>

      {expanded && (
        <div className="chapter-branch-section__body">
          <div className="chapter-branch-section__row">
            <label className="form-label">
              一時停止（秒）
              <input
                type="number"
                className="form-input"
                value={chapter.pauseAt ?? ""}
                placeholder="動画終了時"
                min={1}
                style={{ maxWidth: 100 }}
                onChange={(e) => onChange({ ...chapter, pauseAt: e.target.value ? Number(e.target.value) : null })}
              />
              <span className="form-hint">設定すると動画をX秒で止めて分岐を表示</span>
            </label>

            {!hasBranches && (
              <label className="form-label">
                動画終了時の動作
                <select
                  className="form-input"
                  value={chapter.nextChapterId || ""}
                  onChange={(e) => onChange({ ...chapter, nextChapterId: e.target.value || null })}
                  style={{ maxWidth: 220 }}
                >
                  <option value="">エンドメニューへ</option>
                  <option value="__stop__">停止（そのまま終了）</option>
                  {allChapterIds.map((cid) => (
                    <option key={cid} value={cid}>
                      {cid}{cid === chapter.id ? "（このチャプター・もう一度みる）" : ""}
                    </option>
                  ))}
                </select>
                <span className="form-hint">このチャプター終了後の遷移先</span>
              </label>
            )}
          </div>

          <div className="branch-list" style={{ marginTop: 8 }}>
            {(chapter.branches || []).map((branch) => (
              <BranchRow
                key={branch.id}
                branch={branch}
                allChapterIds={allChapterIds}
                currentChapterId={chapter.id}
                onChange={updateBranch}
                onDelete={() => deleteBranch(branch.id)}
              />
            ))}
          </div>
          <button className="btn btn--outline btn--sm" onClick={addBranch} style={{ marginTop: 8 }}>
            ＋ 分岐を追加
          </button>
        </div>
      )}
    </div>
  );
}

// ── ビジュアルエディター ────────────────────────────────────
function VisualEditor({ project, onChange, onSave }) {
  const firstChapterId = project.chapters[0]?.id || "__end__";
  const [selectedTarget, setSelectedTarget] = useState(firstChapterId);
  const containerRef = useRef();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [drawCur, setDrawCur] = useState(null);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => { setSelected(null); }, [selectedTarget]);

  const isEndOverlay = selectedTarget === "__end__";
  const currentChapter = isEndOverlay ? null : project.chapters.find((c) => c.id === selectedTarget);
  const overlay = isEndOverlay
    ? (project.endOverlay || { imageUrl: null, buttons: [] })
    : (currentChapter?.overlay || { imageUrl: null, buttons: [] });
  const branches = isEndOverlay ? [] : (currentChapter?.branches || []);
  const uploadPath = isEndOverlay ? "end-overlay" : `chapter-overlay/${selectedTarget}`;

  function updateOverlay(newOverlay) {
    if (isEndOverlay) {
      const updated = { ...project, endOverlay: newOverlay };
      onChange(updated);
      return updated;
    } else {
      const updated = {
        ...project,
        chapters: project.chapters.map((c) =>
          c.id === selectedTarget ? { ...c, overlay: newOverlay } : c
        ),
      };
      onChange(updated);
      return updated;
    }
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
      alert(`アップロード失敗: ${err.message}`);
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

  function clientXY(e) {
    return e.touches?.length
      ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }
      : { clientX: e.clientX, clientY: e.clientY };
  }

  function startMove(btn, e) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const { clientX, clientY } = clientXY(e);
    setSelected(btn.id);
    setDrawStart(null);
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = { type: "move", btnId: btn.id, startBtn: { ...btn }, startX: clientX, startY: clientY, rect };
    setDragging(true);
  }

  function startResize(btn, dir, e) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const { clientX, clientY } = clientXY(e);
    const rect = containerRef.current.getBoundingClientRect();
    dragRef.current = { type: "resize", btnId: btn.id, dir, startBtn: { ...btn }, startX: clientX, startY: clientY, rect };
    setDragging(true);
  }

  function applyPointerMove(cx, cy) {
    if (dragRef.current) {
      const { type, startBtn, startX, startY, rect, dir } = dragRef.current;
      const dx = ((cx - startX) / rect.width)  * 100;
      const dy = ((cy - startY) / rect.height) * 100;
      let { x, y, width, height } = startBtn;
      if (type === "move") {
        x = Math.max(0, Math.min(100 - width,  startBtn.x + dx));
        y = Math.max(0, Math.min(100 - height, startBtn.y + dy));
      } else {
        if (dir.includes("e")) width  = Math.max(2, startBtn.width  + dx);
        if (dir.includes("s")) height = Math.max(2, startBtn.height + dy);
        if (dir.includes("w")) { const nw = Math.max(2, startBtn.width  - dx); x = startBtn.x + (startBtn.width  - nw); width  = nw; }
        if (dir.includes("n")) { const nh = Math.max(2, startBtn.height - dy); y = startBtn.y + (startBtn.height - nh); height = nh; }
        x = Math.max(0, x); y = Math.max(0, y);
        width  = Math.min(width,  100 - x);
        height = Math.min(height, 100 - y);
      }
      updateButton({ ...startBtn, x, y, width, height });
      return;
    }
    if (!drawStart) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDrawCur({
      x: Math.max(0, Math.min(100, ((cx - rect.left) / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((cy - rect.top)  / rect.height) * 100)),
    });
  }

  function handleMouseDown(e) {
    if (dragging) return;
    setDrawStart(getPos(e));
    setDrawCur(getPos(e));
    setSelected(null);
  }

  function handleTouchStart(e) {
    if (dragging) return;
    e.preventDefault();
    const { clientX, clientY } = clientXY(e);
    const rect = containerRef.current.getBoundingClientRect();
    const pos = {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top)  / rect.height) * 100)),
    };
    setDrawStart(pos);
    setDrawCur(pos);
    setSelected(null);
  }

  function handleMouseMove(e) { applyPointerMove(e.clientX, e.clientY); }
  function handleTouchMove(e)  { e.preventDefault(); const { clientX, clientY } = clientXY(e); applyPointerMove(clientX, clientY); }

  function handlePointerEnd() {
    if (dragRef.current) {
      dragRef.current = null;
      setDragging(false);
      return;
    }
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
      action: isEndOverlay ? "top" : "branch",
      branchId: isEndOverlay ? "" : (branches[0]?.id || ""),
      url: "",
      x, y, width: w, height: h,
    };
    updateOverlay({ ...overlay, buttons: [...(overlay.buttons || []), newBtn] });
    setSelected(newBtn.id);
  }

  function handleMouseLeave() {
    if (dragRef.current) { dragRef.current = null; setDragging(false); }
    setDrawStart(null);
    setDrawCur(null);
  }

  function updateButton(updated) {
    updateOverlay({ ...overlay, buttons: (overlay.buttons || []).map((b) => (b.id === updated.id ? updated : b)) });
  }

  function deleteButton(btnId) {
    updateOverlay({ ...overlay, buttons: (overlay.buttons || []).filter((b) => b.id !== btnId) });
    setSelected(null);
  }

  const drawRect = drawStart && drawCur ? {
    left: `${Math.min(drawStart.x, drawCur.x)}%`,
    top:  `${Math.min(drawStart.y, drawCur.y)}%`,
    width:  `${Math.abs(drawCur.x - drawStart.x)}%`,
    height: `${Math.abs(drawCur.y - drawStart.y)}%`,
  } : null;

  const buttons = overlay.buttons || [];
  const selectedBtn = buttons.find((b) => b.id === selected);

  return (
    <div className="editor__section ve-section">
      {/* チャプター選択 */}
      <div className="ve-target-selector">
        <label className="form-label">
          編集するチャプター
          <select
            className="form-input"
            value={selectedTarget}
            onChange={(e) => setSelectedTarget(e.target.value)}
            style={{ maxWidth: 340 }}
          >
            {project.chapters
              .filter((ch) => ch.id !== project.flow.endMenu)
              .map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.id}：{ch.label}
                  {ch.branches?.length > 0 ? `（${ch.branches.length}分岐）` : ""}
                  {ch.overlay?.imageUrl ? " ✓" : ""}
                </option>
              ))}
            <option value="__end__">
              ── エンドオーバーレイ（終了後のボタン画面）{project.endOverlay?.imageUrl ? " ✓" : ""}
            </option>
          </select>
        </label>
        {!isEndOverlay && branches.length === 0 && (
          <p className="ve-target-selector__hint">
            このチャプターに分岐がありません。先に「分岐設定」タブで分岐を追加してください。
          </p>
        )}
      </div>

      <div className="editor__section-header" style={{ marginTop: 16 }}>
        <h2 className="editor__section-title">
          {isEndOverlay
            ? "エンドオーバーレイ（終了後のボタン画面）"
            : `${selectedTarget}：${currentChapter?.label || ""} のオーバーレイ`}
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
            onTouchStart={handleTouchStart}
            onMouseLeave={handleMouseLeave}
          >
            <img src={overlay.imageUrl} className="ve-image" draggable={false} alt="overlay" style={{ opacity: overlay.opacity ?? 1 }} />

            {buttons.map((btn) => {
              const branch = branches.find((b) => b.id === btn.branchId);
              const isSel = selected === btn.id;
              return (
                <div
                  key={btn.id}
                  className={`ve-button ${isSel ? "ve-button--selected" : ""}`}
                  style={{ left: `${btn.x}%`, top: `${btn.y}%`, width: `${btn.width}%`, height: `${btn.height}%`, cursor: "move" }}
                  onMouseDown={(e) => startMove(btn, e)}
                  onTouchStart={(e) => startMove(btn, e)}
                >
                  <span className="ve-button__label">{branch?.label || "未設定"}</span>
                  {isSel && ["nw","n","ne","e","se","s","sw","w"].map((dir) => (
                    <div
                      key={dir}
                      className={`ve-handle ve-handle--${dir}`}
                      onMouseDown={(e) => startResize(btn, dir, e)}
                      onTouchStart={(e) => startResize(btn, dir, e)}
                    />
                  ))}
                </div>
              );
            })}

            {drawStart && (
              <div
                className="ve-draw-capture"
                onMouseMove={handleMouseMove}
                onMouseUp={handlePointerEnd}
                onTouchMove={handleTouchMove}
                onTouchEnd={handlePointerEnd}
              />
            )}
            {dragging && (
              <div
                className="ve-draw-capture"
                style={{ cursor: "grabbing" }}
                onMouseMove={handleMouseMove}
                onMouseUp={handlePointerEnd}
                onTouchMove={handleTouchMove}
                onTouchEnd={handlePointerEnd}
              />
            )}
            {drawRect && <div className="ve-drawing" style={drawRect} />}
          </div>

          <div className="ve-panel">
            {/* オーバーレイ設定 */}
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
              {!isEndOverlay && (
                <label className="ve-toggle-label">
                  <input
                    type="checkbox"
                    checked={overlay.showFromIntro ?? false}
                    onChange={(e) => onSave(updateOverlay({ ...overlay, showFromIntro: e.target.checked }))}
                  />
                  再生開始から表示
                </label>
              )}
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
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.label}</option>
                        ))}
                      </select>
                      {branches.length === 0 && (
                        <span className="form-hint">先に分岐設定タブで分岐を追加してください</span>
                      )}
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
                    {[["X", "x"], ["Y", "y"], ["W", "width"], ["H", "height"]].map(([label, key]) => (
                      <label key={key} className="ve-panel__pos-item">
                        {label}
                        <input
                          type="number"
                          className="ve-panel__pos-input"
                          value={Number(selectedBtn[key].toFixed(1))}
                          min={0} max={100} step={0.5}
                          onChange={(e) => updateButton({ ...selectedBtn, [key]: Number(e.target.value) })}
                        />
                        <span>%</span>
                      </label>
                    ))}
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
      chapters: [...p.chapters, {
        id: newId,
        label: `チャプター${newId}`,
        url: null,
        demoDuration: 8,
        pauseAt: null,
        overlay: null,
        branches: [],
        nextChapterId: null,
      }],
    }));
  }

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", color: "#546e7a" }}>
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
        {[
          ["basic",    "⚙ 基本設定"],
          ["chapters", "🎬 チャプター管理"],
          ["branches", "🔀 分岐設定"],
          ["visual",   "🖼 ビジュアルエディター"],
        ].map(([key, label]) => (
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
                    background: project.theme.primary, color: "#fff",
                    padding: "6px 16px", borderRadius: 6, fontSize: "0.85rem", fontWeight: 700,
                  }}>
                    ボタンプレビュー
                  </span>
                </div>
              </label>
            </div>

            <h2 className="editor__section-title" style={{ marginTop: 32 }}>フロー設定</h2>
            <div className="form-grid">
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
                <span className="form-hint">全ルート終了後に再生するチャプター</span>
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
            </div>
            <p className="editor__section-desc">
              チャプターごとに分岐先を設定します。▶ をクリックして展開し、分岐を追加してください。
              「一時停止（秒）」を設定すると動画の途中で選択画面を表示できます。
            </p>
            <div className="chapter-branch-list">
              {project.chapters.map((chapter) => (
                <ChapterBranchSection
                  key={chapter.id}
                  chapter={chapter}
                  allChapterIds={allChapterIds}
                  onChange={updateChapter}
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
