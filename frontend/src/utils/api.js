import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  withCredentials: true,
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

export async function uploadStatement(file, onProgress, password) {
  const formData = new FormData();
  formData.append("statement", file);
  if (password) formData.append("password", password);
  const { data } = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data;
}

export async function fetchStatements() {
  const { data } = await api.get("/statements");
  return data.statements;
}

export async function fetchStatement(id) {
  const { data } = await api.get(`/statements/${id}`);
  return data.statement;
}

export async function fetchParseErrors(id) {
  const { data } = await api.get(`/statements/${id}/parse-errors`);
  return data.parseErrors;
}

export async function deleteStatement(id) {
  const { data } = await api.delete(`/statements/${id}`);
  return data;
}

export async function fetchMetrics(params) {
  const { data } = await api.get("/metrics", { params });
  return data;
}

export async function fetchTransactions(params) {
  const { data } = await api.get("/transactions", { params });
  return data;
}

export async function fetchCategories(params) {
  const { data } = await api.get("/transactions/categories", { params });
  return data.categories;
}

export async function updateTransactionCategory(id, category, merchantOrSource) {
  const { data } = await api.patch(`/transactions/${id}/category`, { category, merchantOrSource });
  return data.transaction;
}

export default api;