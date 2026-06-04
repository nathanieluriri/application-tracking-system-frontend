import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReactNode } from "react";
import "@/styles/globals.css";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Applicant Tracking System",
  description: "Track applicants through the hiring pipeline.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            {children}
            <ToastProvider />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
