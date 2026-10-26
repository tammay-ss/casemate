import axios from "axios";
import { TOKEN_KEY } from "../App";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  timeout: 60000, // 60 s — accommodates Render free-tier cold starts
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const messageFrom = (error) => {
  if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
    return "The server is taking longer than expected to respond (possibly waking up from cold sleep). Please wait a moment and try again.";
  }
  if (!error.response) {
    return "Unable to reach the server. Please check your network connection and confirm the backend service is running.";
  }
  if (error.response.status === 503) {
    return error.response.data?.message || "The database or server is temporarily initializing. Please try again in a moment.";
  }
  return error.response?.data?.message || "Unable to complete the request. Please try again.";
};

export async function checkHealth(timeoutMs = 15000) {
  try {
    const res = await api.get("/health", { timeout: timeoutMs });
    return { ok: true, data: res.data };
  } catch (err) {
    return { ok: false, error: messageFrom(err) };
  }
}

export default api;
