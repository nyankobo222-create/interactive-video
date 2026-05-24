import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AdminHome from "./pages/AdminHome";
import ProjectEditor from "./pages/ProjectEditor";
import PlayerPage from "./pages/PlayerPage";
import LoginPage from "./pages/LoginPage";
import { getToken } from "./auth";

function RequireAuth({ children }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"              element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login"   element={<LoginPage />} />
      <Route path="/admin"         element={<RequireAuth><AdminHome /></RequireAuth>} />
      <Route path="/admin/:id"     element={<RequireAuth><ProjectEditor /></RequireAuth>} />
      <Route path="/play/:id"      element={<PlayerPage />} />
    </Routes>
  );
}
