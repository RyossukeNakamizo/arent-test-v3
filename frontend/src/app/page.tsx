"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import type { HitTestResult, PinData } from "@/components/ApsViewer";
import IssueForm from "@/components/IssueForm";
import IssueList from "@/components/IssueList";
import IssueDetail from "@/components/IssueDetail";
import Toast, { type ToastMessage } from "@/components/Toast";
import type { Issue } from "@/types/issue";
import { getIssues } from "@/lib/api";

const ApsViewer = dynamic(() => import("@/components/ApsViewer"), { ssr: false });

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

export default function Home() {
  const [urn, setUrn] = useState<string | null>(null);
  const [hitResult, setHitResult] = useState<HitTestResult | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string, thumbnail?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, thumbnail }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch URN
  useEffect(() => {
    fetch(`${API_BASE}/api/aps/urn`)
      .then((r) => r.json())
      .then((data) => setUrn(data.urn))
      .catch((err) => setError(`Backend接続エラー: ${err.message}`));
  }, []);

  // Fetch all issues for pins
  useEffect(() => {
    const fetchAllIssues = async () => {
      try {
        const data: any = await getIssues(1, 100);
        setAllIssues(data.items || []);
      } catch (err) {
        console.error("Failed to fetch issues for pins:", err);
      }
    };
    fetchAllIssues();
  }, [refreshKey]);

  // Convert issues to pins
  const pins: PinData[] = allIssues
    .filter((issue) => issue.location.worldPosition)
    .map((issue) => ({
      id: issue.id,
      position: issue.location.worldPosition!,
      title: issue.title,
      status: issue.status,
    }));

  // Handle pin click
  const handlePinClick = useCallback((pinId: string) => {
    const issue = allIssues.find((i) => i.id === pinId);
    if (issue) {
      console.log("[page] handlePinClick:", pinId);
      setSelectedIssue(issue);
      setShowForm(false);
      setHitResult(null);  // ピン登録モードを完全にOFF
    }
  }, [allIssues]);

  const handleHitTest = useCallback((result: HitTestResult) => {
    // 指摘詳細表示中はピン登録モードに入らない（プログラム的selectの誤発火防止）
    if (selectedIssue) {
      console.log("[page] handleHitTest blocked: selectedIssue is set");
      return;
    }
    setHitResult(result);
    setShowForm(true);
    setSelectedIssue(null);
  }, [selectedIssue]);

  const handleIssueCreated = () => {
    setShowForm(false);
    setHitResult(null);
    setRefreshKey((k) => k + 1);
  };

  const handleSelectIssue = (issue: Issue) => {
    console.log("[page] handleSelectIssue called:", issue.id, issue.title);
    setSelectedIssue(issue);
    setShowForm(false);
    setHitResult(null);  // ピン登録モードを完全にOFF
  };

  const handleStatusChange = (issueId: string, newStatus: string) => {
    if (selectedIssue && selectedIssue.id === issueId) {
      setSelectedIssue({ ...selectedIssue, status: newStatus as any });
    }
    setRefreshKey((k) => k + 1);
  };

  const focusDbId = selectedIssue?.location.type === "Element" ? selectedIssue.location.dbId : null;
  const focusPosition = selectedIssue?.location.worldPosition ?? null;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ flex: 1, position: "relative", background: "#1a1a2e" }}>
        {error ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "white", fontSize: 16, padding: 40, textAlign: "center" }}>
            <div>
              <h2 style={{ marginBottom: 16 }}>APS Issue Manager</h2>
              <p style={{ color: "#ff6b6b" }}>{error}</p>
              <p style={{ fontSize: 13, color: "#999", marginTop: 12 }}>docker compose up でBackendを起動してください</p>
            </div>
          </div>
        ) : !urn ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "white" }}>
            <div style={{ textAlign: "center" }}>
              <h2>APS Issue Manager</h2>
              <p>Backend からURN を取得中...</p>
            </div>
          </div>
        ) : (
          <ApsViewer
            urn={urn}
            onHitTest={handleHitTest}
            pins={pins}
            onPinClick={handlePinClick}
            selectedIssueId={selectedIssue?.id ?? null}
            focusPosition={focusPosition}
            focusDbId={focusDbId ?? null}
          />
        )}

        {showForm && hitResult && (
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 100 }}>
            <IssueForm hitResult={hitResult} onCreated={handleIssueCreated} onCancel={() => { setShowForm(false); setHitResult(null); }} />
          </div>
        )}

        <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 50, padding: "6px 12px", background: "rgba(0,0,0,0.7)", color: "white", borderRadius: 4, fontSize: 12 }}>
          {showForm ? "📍 ピン登録モード — クリックで位置を選択" : "クリック: 部材選択 / ダブルクリック: 空間指摘"}
        </div>
      </div>

      <div style={{ width: 360, borderLeft: "1px solid #e5e7eb", display: "flex", flexDirection: "column", background: "white" }}>
        {selectedIssue ? (
          <IssueDetail
            issue={selectedIssue}
            onStatusChange={handleStatusChange}
            onPhotoUploaded={() => setRefreshKey((k) => k + 1)}
            onClose={() => setSelectedIssue(null)}
            showToast={showToast}
          />
        ) : (
          <IssueList refreshKey={refreshKey} onSelectIssue={handleSelectIssue} selectedIssueId={null} />
        )}
      </div>

      {/* Toast notifications */}
      <Toast messages={toasts} onDismiss={dismissToast} />
    </div>
  );
}
