"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getViewerToken } from "@/lib/api";

/** APS Viewer v7 の型定義（最小限） */
declare global {
  interface Window {
    Autodesk: any;
    THREE: any;
  }
}

export interface HitTestResult {
  dbId: number | null;
  worldPosition: { x: number; y: number; z: number };
}

export interface PinData {
  id: string;
  position: { x: number; y: number; z: number } | null;
  title: string;
  status: "Open" | "InProgress" | "Done";
}

interface ViewerProps {
  urn: string;
  onHitTest?: (result: HitTestResult) => void;
  pins?: PinData[];
  onPinClick?: (pinId: string) => void;
  selectedIssueId?: string | null;
  focusPosition?: { x: number; y: number; z: number } | null;
  focusDbId?: number | null;
}

const PIN_COLORS = {
  Open: { bg: "#ef4444", border: "#b91c1c" },
  InProgress: { bg: "#f59e0b", border: "#b45309" },
  Done: { bg: "#22c55e", border: "#15803d" },
};

export default function ApsViewer({ urn, onHitTest, pins, onPinClick, selectedIssueId, focusPosition, focusDbId }: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinPositions, setPinPositions] = useState<Record<string, { x: number; y: number; visible: boolean }>>({});
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const programmaticSelectRef = useRef(false);

  // Load APS Viewer SDK script
  useEffect(() => {
    if (document.getElementById("aps-viewer-script")) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id = "aps-viewer-script";
    script.src = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Initialize viewer
  useEffect(() => {
    let viewer: any = null;

    const init = async () => {
      // Wait for script
      while (!window.Autodesk?.Viewing) {
        await new Promise((r) => setTimeout(r, 200));
      }

      try {
        const { access_token } = await getViewerToken();

        const options = {
          env: "AutodeskProduction2",
          api: "streamingV2",
          getAccessToken: (onSuccess: (token: string, expires: number) => void) => {
            getViewerToken().then(({ access_token, expires_in }) => {
              onSuccess(access_token, expires_in);
            });
          },
        };

        await new Promise<void>((resolve, reject) => {
          window.Autodesk.Viewing.Initializer(options, () => resolve());
        });

        if (!containerRef.current) return;

        viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current);
        viewer.start();
        viewerRef.current = viewer;

        // Load model
        const documentId = `urn:${urn}`;
        window.Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable).then(() => {
              setLoading(false);
            });
          },
          (errorCode: number) => {
            setError(`Failed to load document: error code ${errorCode}`);
            setLoading(false);
          }
        );

        // Click handler for pin placement
        viewer.addEventListener(window.Autodesk.Viewing.SELECTION_CHANGED_EVENT, () => {
          // プログラム的なselect（一覧クリック→focusDbId変更）の場合はスキップ
          if (programmaticSelectRef.current) {
            programmaticSelectRef.current = false;
            return;
          }
          if (!onHitTest) return;
          const selected = viewer.getSelection();
          if (selected.length > 0) {
            const dbId = selected[0];
            // Get world position of selected element
            const instanceTree = viewer.model.getInstanceTree();
            const fragList = viewer.model.getFragmentList();
            const bounds = new window.THREE.Box3();

            instanceTree.enumNodeFragments(dbId, (fragId: number) => {
              const box = new window.THREE.Box3();
              fragList.getWorldBounds(fragId, box);
              bounds.union(box);
            }, true);

            const center = bounds.getCenter(new window.THREE.Vector3());
            onHitTest({
              dbId,
              worldPosition: { x: center.x, y: center.y, z: center.z },
            });
          }
        });

        // Right-click for space annotation (worldPosition only)
        containerRef.current.addEventListener("dblclick", (e: MouseEvent) => {
          if (!onHitTest || !viewer) return;
          const screenPoint = {
            x: e.clientX - containerRef.current!.getBoundingClientRect().left,
            y: e.clientY - containerRef.current!.getBoundingClientRect().top,
          };
          const hitResult = viewer.impl.hitTest(screenPoint.x, screenPoint.y, false);
          if (hitResult) {
            onHitTest({
              dbId: hitResult.dbId > 0 ? hitResult.dbId : null,
              worldPosition: {
                x: hitResult.intersectPoint.x,
                y: hitResult.intersectPoint.y,
                z: hitResult.intersectPoint.z,
              },
            });
          }
        });
      } catch (err: any) {
        setError(err.message || "Viewer initialization failed");
        setLoading(false);
      }
    };

    init();

    return () => {
      if (viewer) {
        viewer.finish();
        viewerRef.current = null;
      }
    };
  }, [urn]);

  // Focus on position/dbId when selected from list
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.model) return;

    if (focusDbId) {
      programmaticSelectRef.current = true;
      viewer.select([focusDbId]);
      viewer.fitToView([focusDbId]);
    } else if (focusPosition) {
      // モデルのバウンディングボックスから適切なオフセット距離を計算
      const modelBounds = viewer.model.getBoundingBox();
      const modelSize = modelBounds.getSize(new window.THREE.Vector3());
      const diagonal = modelSize.length();
      // オフセットはモデル対角長の15%（最小50、最大500）
      const offsetDistance = Math.max(50, Math.min(500, diagonal * 0.15));

      const target = new window.THREE.Vector3(focusPosition.x, focusPosition.y, focusPosition.z);
      // 斜め上（45度）からのビュー
      const offsetVector = new window.THREE.Vector3(1, 1, 1).normalize().multiplyScalar(offsetDistance);
      const eye = target.clone().add(offsetVector);

      // setTarget + setPosition でスムーズ遷移
      viewer.navigation.setTarget(target, true);
      viewer.navigation.setPosition(eye);
    }
  }, [focusDbId, focusPosition, selectedIssueId]);

  // Update pin screen positions on camera change
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !pins || pins.length === 0) return;

    const updatePinPositions = () => {
      const newPositions: Record<string, { x: number; y: number; visible: boolean }> = {};

      pins.forEach((pin) => {
        if (!pin.position) {
          newPositions[pin.id] = { x: 0, y: 0, visible: false };
          return;
        }

        const worldPos = new window.THREE.Vector3(pin.position.x, pin.position.y, pin.position.z);
        const screenPos = viewer.worldToClient(worldPos);

        if (screenPos) {
          newPositions[pin.id] = {
            x: screenPos.x,
            y: screenPos.y,
            visible: true,
          };
        } else {
          newPositions[pin.id] = { x: 0, y: 0, visible: false };
        }
      });

      setPinPositions(newPositions);
    };

    // Update on camera change
    viewer.addEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinPositions);

    // Initial update
    const intervalId = setInterval(() => {
      if (viewer.model) {
        updatePinPositions();
        clearInterval(intervalId);
      }
    }, 500);

    return () => {
      viewer.removeEventListener(window.Autodesk.Viewing.CAMERA_CHANGE_EVENT, updatePinPositions);
      clearInterval(intervalId);
    };
  }, [pins]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Pin overlays */}
      {pins && pins.map((pin) => {
        const pos = pinPositions[pin.id];
        if (!pos || !pos.visible) return null;

        const isSelected = selectedIssueId === pin.id;
        const isHovered = hoveredPin === pin.id;
        const colors = PIN_COLORS[pin.status];
        const size = isSelected ? 24 : isHovered ? 20 : 16;

        return (
          <div
            key={pin.id}
            onClick={() => onPinClick?.(pin.id)}
            onMouseEnter={() => setHoveredPin(pin.id)}
            onMouseLeave={() => setHoveredPin(null)}
            style={{
              position: "absolute",
              left: pos.x - size / 2,
              top: pos.y - size / 2,
              width: size,
              height: size,
              borderRadius: "50%",
              background: colors.bg,
              border: `2px solid ${colors.border}`,
              cursor: "pointer",
              zIndex: isSelected ? 100 : 50,
              transition: "all 0.2s ease",
              boxShadow: isSelected
                ? `0 0 0 4px ${colors.bg}40, 0 0 12px ${colors.bg}80`
                : isHovered
                ? `0 0 8px ${colors.bg}60`
                : "0 2px 4px rgba(0,0,0,0.3)",
              animation: isSelected ? "pulse 2s infinite" : "none",
            }}
            title={pin.title}
          />
        );
      })}

      {/* Hovered pin tooltip */}
      {hoveredPin && pins && (() => {
        const pin = pins.find(p => p.id === hoveredPin);
        const pos = pinPositions[hoveredPin];
        if (!pin || !pos || !pos.visible) return null;

        return (
          <div
            style={{
              position: "absolute",
              left: pos.x + 20,
              top: pos.y - 10,
              background: "rgba(0,0,0,0.85)",
              color: "white",
              padding: "6px 10px",
              borderRadius: 4,
              fontSize: 12,
              whiteSpace: "nowrap",
              zIndex: 200,
              pointerEvents: "none",
            }}
          >
            {pin.title}
          </div>
        );
      })()}

      {loading && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.7)", color: "white", fontSize: 16,
        }}>
          3D モデル読込中...
        </div>
      )}
      {error && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(200,0,0,0.8)", color: "white", fontSize: 14, padding: 20,
        }}>
          {error}
        </div>
      )}

      {/* CSS animation for selected pin */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
