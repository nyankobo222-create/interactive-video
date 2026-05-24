import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import InteractivePlayer from "../components/InteractivePlayer";

export default function PlayerPage() {
  const { id } = useParams();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Not found")))
      .then(setConfig)
      .catch(setError);
  }, [id]);

  if (error) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p>プロジェクトが見つかりません</p>
      <Link to="/admin" style={{ color: "#2a9824" }}>← 管理画面に戻る</Link>
    </div>
  );
  if (!config) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", color:"#546e7a" }}>
      読み込み中...
    </div>
  );

  return (
    <div style={{ background: "#111", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
      <InteractivePlayer config={config} />
    </div>
  );
}
