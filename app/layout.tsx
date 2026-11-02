import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elasticoach",
  description: "אפליקציית ליווי תזונה ואימון למאמנים ומתאמנים",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
