import "../styles/globals.css";
import React from "react";
import LayoutShell from "../components/LayoutShell";
import ErrorBoundary from "../components/ErrorBoundary";

export const metadata = { 
  title: "SmartPick AI - Clarity Intelligence",
  description: "Human-Machine Bond System for warehouse optimization",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans bg-dex-bg antialiased">
        <ErrorBoundary>
          <LayoutShell>{children}</LayoutShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
