/**
 * API Client — Backend Token Proxy 経由で APS + 指摘 API にアクセス
 *
 * 重要: Client Secret はフロントに露出させない。
 * APS トークン取得は必ず Backend /api/aps/token 経由。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/** APS Viewer トークン取得（Backend Token Proxy 経由） */
export async function getViewerToken(): Promise<{ access_token: string; expires_in: number }> {
  return request("/api/aps/token");
}

/** 指摘一覧取得 */
export async function getIssues(page = 1, pageSize = 20) {
  return request(`/api/issues?page=${page}&pageSize=${pageSize}`);
}

/** 指摘作成 */
export async function createIssue(command: unknown) {
  return request("/api/issues", { method: "POST", body: JSON.stringify(command) });
}

/** 写真アップロード */
export async function uploadPhoto(issueId: string, file: File, photoType: "Before" | "After") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("photoType", photoType);
  const res = await fetch(`${API_BASE}/api/issues/${issueId}/photos`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload error: ${res.status}`);
  return res.json();
}

/** 写真Presigned URL取得 */
export async function getPhotoUrl(issueId: string, photoId: string): Promise<{ url: string; expiresIn: number }> {
  return request(`/api/issues/${issueId}/photos/${photoId}/url`);
}
