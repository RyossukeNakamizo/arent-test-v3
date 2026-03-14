"use client";

import { useEffect, useCallback } from "react";
import type { Photo } from "@/types/issue";

interface PhotoLightboxProps {
  photo: Photo;
  photoUrl: string;
  allPhotos: Photo[];
  allPhotoUrls: Record<string, string>;
  onClose: () => void;
  onNavigate: (photoId: string) => void;
}

export default function PhotoLightbox({
  photo,
  photoUrl,
  allPhotos,
  allPhotoUrls,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const currentIndex = allPhotos.findIndex((p) => p.id === photo.id);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < allPhotos.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && canGoPrev) {
        onNavigate(allPhotos[currentIndex - 1].id);
      } else if (e.key === "ArrowRight" && canGoNext) {
        onNavigate(allPhotos[currentIndex + 1].id);
      }
    },
    [onClose, onNavigate, canGoPrev, canGoNext, currentIndex, allPhotos]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-50"
      >
        ✕
      </button>

      {/* Navigation arrows */}
      {canGoPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(allPhotos[currentIndex - 1].id);
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-50"
        >
          ←
        </button>
      )}
      {canGoNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(allPhotos[currentIndex + 1].id);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-50"
        >
          →
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photoUrl}
          alt={photo.photoType === "Before" ? "是正前" : "是正後"}
          className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Meta info */}
        <div className="mt-4 bg-black/70 text-white px-6 py-3 rounded-lg text-sm space-y-1">
          <div className="flex items-center gap-4">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                photo.photoType === "Before"
                  ? "bg-blue-600"
                  : "bg-green-600"
              }`}
            >
              {photo.photoType === "Before" ? "是正前" : "是正後"}
            </span>
            <span>アップロード: {formatDate(photo.uploadedAt)}</span>
          </div>
          <div className="text-gray-400 text-xs">
            ストレージ: MinIO (localhost:9000) | {currentIndex + 1} / {allPhotos.length}
          </div>
        </div>
      </div>
    </div>
  );
}
