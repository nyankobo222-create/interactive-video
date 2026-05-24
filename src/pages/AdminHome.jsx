import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminHome.css";

export default function AdminHome() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  async function load() {
    const res = await fetch("/api/projects");
    setProjects(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createProject() {
    const res = await fetch("/api/projects", { method: "POST" });
    const p = await res.json();
    nav(`/admin/${p.id}`);
  }

  async function duplicateProject(id) {
    await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
    load();
  }

  async function deleteProject(id, name) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="admin-home">
      <header className="admin-home__header">
        <div className="admin-home__logo">🎬 インタラクティブ動画 管理システム</div>
        <button className="btn btn--primary" onClick={createProject}>
          ＋ 新規プロジェクト作成
        </button>
      </header>

      <main className="admin-home__main">
        {loading && <p className="admin-home__empty">読み込み中...</p>}
        {!loading && projects.length === 0 && (
          <div className="admin-home__empty">
            <p>プロジェクトがまだありません</p>
            <button className="btn btn--primary" onClick={createProject}>
              最初のプロジェクトを作成する
            </button>
          </div>
        )}
        <div className="project-grid">
          {projects.map((p) => (
            <div key={p.id} className="project-card">
              <div className="project-card__name">{p.name}</div>
              <div className="project-card__meta">
                チャプター {p.chapterCount} 本 ／
                更新 {new Date(p.updatedAt).toLocaleDateString("ja-JP")}
              </div>
              <div className="project-card__actions">
                <button className="btn btn--primary btn--sm" onClick={() => nav(`/admin/${p.id}`)}>
                  編集
                </button>
                <a className="btn btn--outline btn--sm" href={`/play/${p.id}`} target="_blank" rel="noreferrer">
                  プレビュー
                </a>
                <button className="btn btn--gray btn--sm" onClick={() => duplicateProject(p.id)}>
                  複製
                </button>
                <button className="btn btn--danger btn--sm" onClick={() => deleteProject(p.id, p.name)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
