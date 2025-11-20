"use client";
import React from 'react';
import Sidebar from './Sidebar';
import TopBarMetrics from './TopBarMetrics';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-dex-bg text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBarMetrics />
        <main className="p-4 md:p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
