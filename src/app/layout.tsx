import type { Metadata } from "next";
import "./globals.css";
import "./auth-enhancements.css";
import "./ui-enhancements.css";
import ToastHost from "@/components/ToastHost";

export const metadata: Metadata = {
  title: "AI Interview Analyzer",
  description: "Practice interviews shaped around your experience.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">{children}<ToastHost /></body>
    </html>
  );
}
