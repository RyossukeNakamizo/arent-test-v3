"use client";

import { useEffect, useState, useCallback } from "react";
import { getIssues } from "@/lib/api";
import type { Issue, IssueStatus } from "@/types/issue";
import StatusBadge from "./StatusBadge";

interface IssueListProps {
  refreshKey: number;
  onSelectIssue: (issue: Issue) => void;
  selectedIssueId: string | null;
}

const BORDER_COLORS: Record<IssueStatus, string> = {
  Open: "border-l-red-500",
  InProgress: "border-l-amber-500",
  Done: "border-l-green-500",
};

const TYPE_LABELS: Record<string, string> = {
  Quality: "品質",
  Safety: "安全",
  Construction: "施工",
  DesignChange: "設計変更",
};

export default function IssueList({ refreshKey, onSelectIssue, selectedIssueId }: IssueListProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await getIssues(page, pageSize);
      setIssues(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error("Failed to fetch issues:", err);
    } finally {
      setLoading(false);
    }
  }, [page, refreshKey]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid #e5e7eb",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>指摘一覧 ({totalCount})</h3>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>読込中...</div>
        ) : issues.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
            指摘がありません。<br />3Dモデル上をクリックしてピンを配置してください。
          </div>
        ) : (
          issues.map((issue) => (
            <div
              key={issue.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectIssue(issue);
              }}
              className={`
                py-2.5 px-4 border-b border-gray-100 cursor-pointer transition-all duration-150
                border-l-4 ${BORDER_COLORS[issue.status]}
                ${selectedIssueId === issue.id ? "bg-blue-50 ring-2 ring-blue-400 ring-offset-1" : "hover:bg-gray-50"}
              `}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-sm flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {issue.title}
                </span>
                <StatusBadge status={issue.status} size="sm" />
              </div>
              <div className="text-xs text-gray-500 flex gap-3">
                <span>{TYPE_LABELS[issue.issueType] || issue.issueType}</span>
                <span>{issue.location.type === "Element" ? `部材 #${issue.location.dbId}` : "空間"}</span>
                {issue.photos && issue.photos.length > 0 && <span>📷 {issue.photos.length}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {totalCount > pageSize && (
        <div style={{
          padding: "8px 16px", borderTop: "1px solid #e5e7eb",
          display: "flex", justifyContent: "center", gap: 8,
        }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 4, cursor: page <= 1 ? "default" : "pointer" }}>
            ←
          </button>
          <span style={{ fontSize: 13, lineHeight: "30px" }}>{page} / {Math.ceil(totalCount / pageSize)}</span>
          <button disabled={page >= Math.ceil(totalCount / pageSize)} onClick={() => setPage(p => p + 1)}
            style={{ padding: "4px 12px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
