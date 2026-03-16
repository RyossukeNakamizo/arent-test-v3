"use client";

import { useState } from "react";
import type { HitTestResult } from "./ApsViewer";
import { createIssue, uploadPhoto } from "@/lib/api";

interface IssueFormProps {
  hitResult: HitTestResult | null;
  onCreated: () => void;
  onCancel: () => void;
}

const ISSUE_TYPES = ["Quality", "Safety", "Construction", "DesignChange"] as const;

export default function IssueForm({ hitResult, onCreated, onCancel }: IssueFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issueType, setIssueType] = useState<string>("Quality");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!hitResult) return null;

  const locationType = hitResult.dbId ? "Element" : "Space";

  const handleSubmit = async () => {
    console.log("[IssueForm] handleSubmit called", { title, files: files?.length });
    if (!title.trim()) {
      console.log("[IssueForm] Title is empty, returning");
      return;
    }
    setSubmitting(true);
    try {
      console.log("[IssueForm] Creating issue...");
      const result: any = await createIssue({
        title,
        description,
        issueType,
        location: {
          type: locationType,
          dbId: hitResult.dbId,
          worldPosition: hitResult.worldPosition,
        },
      });
      console.log("[IssueForm] Issue created:", result);

      // Upload photos if any
      if (files && files.length > 0 && result.id) {
        console.log("[IssueForm] Uploading", files.length, "photos to issue", result.id);
        for (let i = 0; i < files.length; i++) {
          console.log("[IssueForm] Uploading photo", i + 1, files[i].name);
          await uploadPhoto(result.id, files[i], "Before");
          console.log("[IssueForm] Photo", i + 1, "uploaded");
        }
      } else {
        console.log("[IssueForm] No photos to upload", { files, resultId: result.id });
      }

      setTitle("");
      setDescription("");
      setFiles(null);
      onCreated();
      console.log("[IssueForm] Success, form cleared");
    } catch (err: any) {
      console.error("[IssueForm] Error:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      padding: 16, background: "white", borderRadius: 8,
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)", maxWidth: 400,
    }}>
      <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>新規指摘登録</h3>
      <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
        位置: {locationType}
        {hitResult.dbId && <> | dbId: {hitResult.dbId}</>}
        {" "}| ({hitResult.worldPosition.x.toFixed(1)}, {hitResult.worldPosition.y.toFixed(1)}, {hitResult.worldPosition.z.toFixed(1)})
      </div>

      <input
        type="text"
        placeholder="タイトル（必須）"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px", marginBottom: 8,
          border: "1px solid #ddd", borderRadius: 4, boxSizing: "border-box",
        }}
      />

      <select
        value={issueType}
        onChange={(e) => setIssueType(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px", marginBottom: 8,
          border: "1px solid #ddd", borderRadius: 4, boxSizing: "border-box",
        }}
      >
        {ISSUE_TYPES.map((t) => (
          <option key={t} value={t}>{t === "Quality" ? "品質不良" : t === "Safety" ? "安全不備" : t === "Construction" ? "施工不備" : "設計変更"}</option>
        ))}
      </select>

      <textarea
        placeholder="指摘内容"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{
          width: "100%", padding: "8px 12px", marginBottom: 8,
          border: "1px solid #ddd", borderRadius: 4, boxSizing: "border-box", resize: "vertical",
        }}
      />

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, color: "#555" }}>写真（是正前）</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          style={{ display: "block", marginTop: 4, fontSize: 13 }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          style={{
            flex: 1, padding: "8px 16px", background: submitting ? "#999" : "#2563eb",
            color: "white", border: "none", borderRadius: 4, cursor: submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "登録中..." : "登録"}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: "8px 16px", background: "#f3f4f6",
            border: "1px solid #ddd", borderRadius: 4, cursor: "pointer",
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
