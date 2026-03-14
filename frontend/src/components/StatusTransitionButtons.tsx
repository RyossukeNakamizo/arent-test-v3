"use client";

import { useState } from "react";
import type { IssueStatus } from "@/types/issue";

interface StatusTransitionButtonsProps {
  currentStatus: IssueStatus;
  onTransition: (targetStatus: IssueStatus) => Promise<void>;
}

// ドメインルール: Open → InProgress → Done（逆行不可・スキップ不可）
const TRANSITION_RULES: Record<IssueStatus, IssueStatus[]> = {
  Open: ["InProgress"],
  InProgress: ["Done"],
  Done: [],
};

const TRANSITION_LABELS: Record<IssueStatus, string> = {
  Open: "未対応に戻す",
  InProgress: "対応開始",
  Done: "完了にする",
};

const BUTTON_COLORS: Record<IssueStatus, { enabled: string; hover: string }> = {
  Open: { enabled: "bg-red-600", hover: "hover:bg-red-700" },
  InProgress: { enabled: "bg-amber-600", hover: "hover:bg-amber-700" },
  Done: { enabled: "bg-green-600", hover: "hover:bg-green-700" },
};

export default function StatusTransitionButtons({ currentStatus, onTransition }: StatusTransitionButtonsProps) {
  const [transitioning, setTransitioning] = useState(false);
  const [successStatus, setSuccessStatus] = useState<IssueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allowedTransitions = TRANSITION_RULES[currentStatus];

  const handleClick = async (target: IssueStatus) => {
    setTransitioning(true);
    setError(null);
    try {
      await onTransition(target);
      setSuccessStatus(target);
      setTimeout(() => setSuccessStatus(null), 500);
    } catch (err: any) {
      setError(err.message || "状態遷移に失敗しました");
    } finally {
      setTransitioning(false);
    }
  };

  // 全ての遷移先を表示（許可/不許可を視覚的に区別）
  const allTargets: IssueStatus[] = ["Open", "InProgress", "Done"].filter(s => s !== currentStatus) as IssueStatus[];

  if (currentStatus === "Done") {
    return (
      <div className="mt-3">
        <div className="text-xs text-gray-500 italic">
          ※ 完了した指摘のステータスは変更できません
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {allTargets.map((target) => {
          const isAllowed = allowedTransitions.includes(target);
          const colors = BUTTON_COLORS[target];

          if (!isAllowed) {
            return (
              <button
                key={target}
                disabled
                title="この状態からは遷移できません"
                className="px-3 py-1.5 text-sm rounded-md bg-gray-200 text-gray-400 cursor-not-allowed opacity-50"
              >
                {TRANSITION_LABELS[target]}
              </button>
            );
          }

          return (
            <button
              key={target}
              onClick={() => handleClick(target)}
              disabled={transitioning}
              className={`
                px-3 py-1.5 text-sm rounded-md text-white cursor-pointer transition-colors
                ${colors.enabled} ${colors.hover}
                ${transitioning ? "opacity-70 cursor-wait" : ""}
              `}
            >
              {successStatus === target ? "✓" : transitioning ? "処理中..." : TRANSITION_LABELS[target]}
            </button>
          );
        })}
      </div>

      {currentStatus === "Open" && (
        <div className="text-xs text-gray-500">
          ※ 完了にするには先に「対応開始」が必要です
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 mt-1">
          {error}
        </div>
      )}
    </div>
  );
}
