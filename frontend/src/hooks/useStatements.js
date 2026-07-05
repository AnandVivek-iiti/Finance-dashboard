import { useCallback, useEffect, useState } from "react";
import { fetchStatements, deleteStatement as apiDeleteStatement } from "../utils/api.js";

export default function useStatements({ enabled = true } = {}) {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStatements();
      setStatements(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  const removeStatement = useCallback(
    async (id) => {
      await apiDeleteStatement(id);
      await refresh();
    },
    [refresh]
  );

  return { statements, loading, error, refresh, removeStatement };
}
