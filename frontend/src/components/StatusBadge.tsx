"use client";

import type { IssueStatus } from "@/types/issue";

interface StatusBadgeProps {
  status: IssueStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<IssueStatus, { label: string; icon: string; bgColor: string; textColor: string; borderColor: string; pulse?: boolean }> = {
  Open: {
    label: "未対応",
    icon: "⚠",
    bgColor: "bg-red-100",
    textColor: "text-red-800",
    borderColor: "border-red-500",
  },
  InProgress: {
    label: "対応中",
    icon: "●",
    bgColor: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-500",
    pulse: true,
  },
  Done: {
    label: "完了",
    icon: "✓",
    bgColor: "bg-green-100",
    textColor: "text-green-800",
    borderColor: "border-green-500",
  },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-xs"
    : "px-3 py-1 text-sm border-l-4";

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-md font-medium
        ${config.bgColor} ${config.textColor} ${size === "md" ? config.borderColor : ""} ${sizeClasses}
        ${config.pulse ? "animate-pulse" : ""}
      `}
    >
      <span className={config.pulse && size === "md" ? "animate-pulse" : ""}>{config.icon}</span>
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
