import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APS Issue Manager",
  description: "BIM 3D指摘管理ツール - APS Viewer × 施工現場向け",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
