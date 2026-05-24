import { Routes, Route, Navigate } from "react-router-dom";
import AdminHome from "./pages/AdminHome";
import ProjectEditor from "./pages/ProjectEditor";
import PlayerPage from "./pages/PlayerPage";

export default function App() {
  return (
    <Routes>
      <Route path="/"          element={<Navigate to="/admin" replace />} />
      <Route path="/admin"     element={<AdminHome />} />
      <Route path="/admin/:id" element={<ProjectEditor />} />
      <Route path="/play/:id"  element={<PlayerPage />} />
    </Routes>
  );
}
