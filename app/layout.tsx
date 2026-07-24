import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://waxm.github.io"),
  title: "WAXM Playground — 独立游戏实验室",
  description: "收录 WAXM 的游戏实验、交互原型和可在线体验作品。",
  openGraph: {
    title: "WAXM Playground — 独立游戏实验室",
    description: "选择一款游戏，直接开始。",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "WAXM Playground — 独立游戏实验室",
    description: "选择一款游戏，直接开始。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
