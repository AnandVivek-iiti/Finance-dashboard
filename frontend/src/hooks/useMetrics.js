import { useEffect, useState } from "react";
import { fetchMetrics } from "../utils/api.js";

export default function useMetrics(selectedStatementIds, filters) {
  const [metrics, setMetrics] = useState(null);
  const [perStatement, setPerStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedStatementIds || selectedStatementIds.length === 0) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = {
      statementIds: selectedStatementIds.join(","),
      compare: selectedStatementIds.length > 1 ? "true" : undefined,
      ...filters,
    };

    fetchMetrics(params)
      .then((data) => {
        if (cancelled) return;
        setMetrics(data.metrics);
        setPerStatement(data.perStatement);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStatementIds, JSON.stringify(filters)]);

  return { metrics, perStatement, loading, error };
}
