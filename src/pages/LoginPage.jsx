import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./LoginPage.css";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/admin";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem("admin_token", token);
        navigate(from, { replace: true });
      } else {
        setError("パスワードが違います");
      }
    } catch {
      setError("接続エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login__box">
        <div className="login__logo">▶</div>
        <h1 className="login__title">管理画面ログイン</h1>
        <form onSubmit={handleSubmit} className="login__form">
          <input
            className="login__input"
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="login__error">{error}</p>}
          <button className="login__btn" type="submit" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
