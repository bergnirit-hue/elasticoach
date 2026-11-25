import type { Metadata } from "next";
import { Assistant, Secular_One } from "next/font/google";
import "./globals.css";

// Body text — supports Hebrew, variable weight.
const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-assistant",
  display: "swap",
});

// Display / headings — the warm single-weight face from the original app.
const secular = Secular_One({
  subsets: ["hebrew", "latin"],
  weight: "400",
  variable: "--font-secular",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Elasticoach",
  description: "אפליקציית ליווי תזונה ואימון למאמנים ומתאמנים",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" className={`${assistant.variable} ${secular.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
