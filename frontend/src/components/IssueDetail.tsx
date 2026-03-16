"use client";

import { useState, useEffect } from "react";
import type { Issue, IssueStatus, Photo } from "@/types/issue";
import { uploadPhoto, getPhotoUrl } from "@/lib/api";
import StatusBadge from "./StatusBadge";
import StatusTransitionButtons from "./StatusTransitionButtons";
import PhotoLightbox from "./PhotoLightbox";

interface IssueDetailProps {
  issue: Issue;
  onStatusChange: (issueId: string, newStatus: string) => void;
  onPhotoUploaded: () => void;
  onClose: () => void;
  showToast?: (type: "success" | "error", message: string, thumbnail?: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001";

export default function IssueDetail({ issue, onStatusChange, onPhotoUploaded, onClose, showToast }: IssueDetailProps) {
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [newPhotoIds, setNewPhotoIds] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null);

  // 写真URLを取得（issue.id が変わったときのみ実行）
  useEffect(() => {
    // issue.id が変わったら photoUrls をリセットして新しく取得
    let cancelled = false;

    const fetchUrls = async () => {
      if (!issue.photos || issue.photos.length === 0) {
        setPhotoUrls({});
        return;
      }

      const newUrls: Record<string, string> = {};
      for (const photo of issue.photos) {
        if (cancelled) return;
        try {
          const { url } = await getPhotoUrl(issue.id, photo.id);
          newUrls[photo.id] = url;
        } catch {
          // URL取得失敗時はスキップ
        }
      }
      if (!cancelled) {
        setPhotoUrls(newUrls);
      }
    };

    setPhotoUrls({}); // リセット
    fetchUrls();

    return () => { cancelled = true; };
  }, [issue.id]); // issue.id のみを依存配列に

  const handleTransition = async (target: IssueStatus): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/issues/${issue.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "状態遷移に失敗");
    }
    onStatusChange(issue.id, target);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    // Create thumbnail preview for toast
    let thumbnailUrl: string | undefined;
    try {
      thumbnailUrl = URL.createObjectURL(file);
    } catch {
      // Ignore thumbnail creation errors
    }

    try {
      const photoType = issue.status === "Done" || issue.status === "InProgress" ? "After" : "Before";
      const result = await uploadPhoto(issue.id, file, photoType);

      // Mark as new photo for NEW badge
      if (result?.id) {
        setNewPhotoIds((prev) => new Set(prev).add(result.id));
        // Remove NEW badge after 3 seconds
        setTimeout(() => {
          setNewPhotoIds((prev) => {
            const next = new Set(prev);
            next.delete(result.id);
            return next;
          });
        }, 3000);
      }

      showToast?.("success", "写真をアップロードしました", thumbnailUrl);
      onPhotoUploaded();
    } catch (err: any) {
      showToast?.("error", "アップロードに失敗しました。再試行してください");
    } finally {
      setUploading(false);
      e.target.value = "";
      // Clean up thumbnail URL
      if (thumbnailUrl) {
        setTimeout(() => URL.revokeObjectURL(thumbnailUrl), 5000);
      }
    }
  };

  const TYPE_LABELS: Record<string, string> = {
    Quality: "品質", Safety: "安全", Construction: "施工", DesignChange: "設計変更",
  };

  return (
    <div className="p-4 overflow-auto h-full">
      <div className="flex justify-between items-center mb-3">
        <h3 className="m-0 text-base font-semibold">{issue.title}</h3>
        <button onClick={onClose} className="bg-transparent border-none text-lg cursor-pointer hover:text-gray-600">✕</button>
      </div>

      <div className="mb-3 text-sm text-gray-600 space-y-1">
        <div>カテゴリ: {TYPE_LABELS[issue.issueType] || issue.issueType}</div>
        <div className="flex items-center gap-2">
          <span>ステータス:</span>
          <StatusBadge status={issue.status} size="md" />
        </div>
        <div>位置: {issue.location.type === "Element" ? `部材 #${issue.location.dbId}` : "空間"}
          {issue.location.worldPosition &&
            ` (${issue.location.worldPosition.x.toFixed(1)}, ${issue.location.worldPosition.y.toFixed(1)}, ${issue.location.worldPosition.z.toFixed(1)})`}
        </div>
      </div>

      {/* 状態遷移ボタン */}
      <div className="mb-4">
        <StatusTransitionButtons currentStatus={issue.status} onTransition={handleTransition} />
      </div>

      {issue.description && (
        <div className="mb-3 text-sm p-2 bg-gray-50 rounded">
          {issue.description}
        </div>
      )}

      {/* 写真セクション */}
      <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
        写真 ({issue.photos?.length || 0})
      </div>

      {issue.photos && issue.photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 relative">
          {issue.photos.map((p) => {
            const isNew = newPhotoIds.has(p.id);
            const isHovered = hoveredPhotoId === p.id;
            const formatDate = (dateString: string) => {
              try {
                return new Date(dateString).toLocaleString("ja-JP", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                });
              } catch { return dateString; }
            };

            return (
              <div
                key={p.id}
                className={`
                  w-20 h-20 bg-gray-100 rounded flex flex-col items-center justify-center
                  text-xs text-gray-500 overflow-hidden relative cursor-pointer
                  hover:ring-2 hover:ring-blue-400 transition-all
                  ${isNew ? "ring-2 ring-blue-500 animate-pulse" : ""}
                `}
                onClick={() => photoUrls[p.id] && setLightboxPhoto(p)}
                onMouseEnter={() => setHoveredPhotoId(p.id)}
                onMouseLeave={() => setHoveredPhotoId(null)}
              >
                {photoUrls[p.id] ? (
                  <>
                    <img
                      src={photoUrls[p.id]}
                      alt={p.photoType === "Before" ? "是正前" : "是正後"}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                      {p.photoType === "Before" ? "是正前" : "是正後"}
                    </span>
                  </>
                ) : (
                  <>
                    <span>📷</span>
                    <span>{p.photoType === "Before" ? "是正前" : "是正後"}</span>
                  </>
                )}
                {/* NEW badge */}
                {isNew && (
                  <span className="absolute top-1 right-1 bg-blue-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold">
                    NEW
                  </span>
                )}
                {/* Hover tooltip */}
                {isHovered && (
                  <div className="absolute left-full ml-2 top-0 z-50 bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg whitespace-nowrap">
                    <div>ストレージ: MinIO (localhost:9000)</div>
                    <div>日時: {formatDate(p.uploadedAt)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div>
        <label className="inline-block px-3 py-1.5 bg-gray-100 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-200 transition-colors">
          {uploading ? "アップロード中..." : "📷 写真追加"}
          <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
        </label>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && photoUrls[lightboxPhoto.id] && (
        <PhotoLightbox
          photo={lightboxPhoto}
          photoUrl={photoUrls[lightboxPhoto.id]}
          allPhotos={issue.photos}
          allPhotoUrls={photoUrls}
          onClose={() => setLightboxPhoto(null)}
          onNavigate={(photoId) => {
            const photo = issue.photos.find((p) => p.id === photoId);
            if (photo) setLightboxPhoto(photo);
          }}
        />
      )}
    </div>
  );
}
