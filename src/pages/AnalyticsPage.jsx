import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { authHeaders } from "../auth";
import "./AnalyticsPage.css";

function KpiCard({ label, value, sub }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card__value">{value}</div>
      <div className="kpi-card__label">{label}</div>
      {sub && <div className="kpi-card__sub">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [analyticsRes, projectRes] = await Promise.all([
        fetch(`/api/analytics/${id}`, { headers: authHeaders() }),
        fetch(`/api/projects/${id}`),
      ]);
      if (analyticsRes.status === 401) { nav("/admin/login"); return; }
      setData(await analyticsRes.json());
      setProject(await projectRes.json());
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <div className="analytics-page__loading">読み込み中...</div>;

  const isEmpty = data.totalSessions === 0;

  return (
    <div className="analytics-page">
      <header className="analytics-page__header">
        <button className="btn btn--gray btn--sm" onClick={() => nav("/admin")}>
          ← 一覧に戻る
        </button>
        <h1 className="analytics-page__title">
          {project?.company?.name || id} の分析
        </h1>
        <a
          className="btn btn--outline btn--sm"
          href={`/play/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          プレビュー
        </a>
      </header>

      {isEmpty ? (
        <div className="analytics-page__empty">
          <p>まだ視聴データがありません。</p>
          <p>プレーヤーを公開して視聴者が増えると、ここにデータが表示されます。</p>
        </div>
      ) : (
        <main className="analytics-page__main">

          {/* KPIカード */}
          <section className="analytics-section">
            <h2 className="analytics-section__title">概要</h2>
            <div className="kpi-grid">
              <KpiCard
                label="視聴開始"
                value={data.totalSessions.toLocaleString()}
                sub="セッション"
              />
              <KpiCard
                label="完走率"
                value={`${data.completionRate}%`}
                sub={`${data.completedSessions} / ${data.totalSessions} 人が最後まで視聴`}
              />
              <KpiCard
                label="ブランチ選択"
                value={data.branchCounts.reduce((s, b) => s + b.count, 0).toLocaleString()}
                sub="回"
              />
              <KpiCard
                label="トップに戻る"
                value={data.topReturnCount.toLocaleString()}
                sub="回"
              />
            </div>
          </section>

          {/* ブランチ選択割合 */}
          {data.branchCounts.length > 0 && (
            <section className="analytics-section">
              <h2 className="analytics-section__title">ブランチ選択割合</h2>
              <div className="analytics-chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={data.branchCounts}
                    margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(v, _name, props) =>
                        [`${v}%（${props.payload.count}回）`, "選択率"]
                      }
                    />
                    <Bar dataKey="rate" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="branch-table">
                {data.branchCounts.map((b) => (
                  <div key={b.id} className="branch-table__row">
                    <span className="branch-table__label">{b.label}</span>
                    <div className="branch-table__bar-wrap">
                      <div
                        className="branch-table__bar"
                        style={{ width: `${b.rate}%` }}
                      />
                    </div>
                    <span className="branch-table__rate">{b.rate}%</span>
                    <span className="branch-table__count">{b.count}回</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 日別視聴数 */}
          {data.dailyCounts.length > 0 && (
            <section className="analytics-section">
              <h2 className="analytics-section__title">日別視聴数</h2>
              <div className="analytics-chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={data.dailyCounts}
                    margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(d) => `日付: ${d}`} formatter={(v) => [v, "視聴数"]} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#4f46e5"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

        </main>
      )}
    </div>
  );
}
