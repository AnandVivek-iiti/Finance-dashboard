import { useState } from "react";
import UploadPage from "./pages/UploadPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import useStatements from "./hooks/useStatements.js";
import useAuth from "./hooks/useAuth.js";

export default function App() {
  const { user, loading: authLoading, login, logout } = useAuth();
  const { statements, loading, refresh, removeStatement } = useStatements({ enabled: !!user });
  const [view, setView] = useState("upload"); // "upload" | "dashboard"
  const [selectedIds, setSelectedIds] = useState([]);

  const handleUploadComplete = async (statementId) => {
    await refresh();
    setSelectedIds([statementId]);
    setView("dashboard");
  };

  const handleViewStatements = (ids) => {
    setSelectedIds(ids);
    setView("dashboard");
  };

  const handleDeleteStatement = async (id) => {
    await removeStatement(id);
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  };

  if (authLoading) {
    return <div className="min-h-screen bg-canvas" />;
  }

  if (!user) {
    return <LandingPage onLogin={login} />;
  }

  return view === "dashboard" && selectedIds.length > 0 ? (
    <DashboardPage
      statements={statements}
      selectedIds={selectedIds}
      setSelectedIds={setSelectedIds}
      onUploadNew={() => setView("upload")}
      onDeleteStatement={handleDeleteStatement}
      user={user}
      onLogout={logout}
    />
  ) : (
    <UploadPage
      statements={statements}
      loading={loading}
      onUploadComplete={handleUploadComplete}
      onViewStatements={handleViewStatements}
      onDeleteStatement={handleDeleteStatement}
      user={user}
      onLogout={logout}
    />
  );
}