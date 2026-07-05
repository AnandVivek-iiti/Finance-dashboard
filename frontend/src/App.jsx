import { useState } from "react";
import UploadPage from "./pages/UploadPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import useStatements from "./hooks/useStatements.js";

export default function App() {
  const { statements, loading, refresh, removeStatement } = useStatements();
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

  if (view === "dashboard" && selectedIds.length > 0) {
    return (
      <DashboardPage
        statements={statements}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        onUploadNew={() => setView("upload")}
        onDeleteStatement={handleDeleteStatement}
      />
    );
  }

  return (
    <UploadPage
      statements={statements}
      loading={loading}
      onUploadComplete={handleUploadComplete}
      onViewStatements={handleViewStatements}
      onDeleteStatement={handleDeleteStatement}
    />
  );
}