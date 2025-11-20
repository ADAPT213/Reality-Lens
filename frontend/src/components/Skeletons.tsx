import React from 'react';

export function MetricSkeleton() {
  return (
    <div className="bg-dex-surfaceAlt rounded border border-dex-border p-4 animate-pulse">
      <div className="h-3 w-16 bg-dex-border rounded mb-2" />
      <div className="h-5 w-12 bg-dex-border rounded" />
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-dex-surfaceAlt rounded border border-dex-border p-4 animate-pulse space-y-3">
      <div className="h-4 w-24 bg-dex-border rounded" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-dex-border rounded" />
        <div className="h-3 w-5/6 bg-dex-border rounded" />
        <div className="h-3 w-4/6 bg-dex-border rounded" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-8 flex-1 bg-dex-border rounded" />
          <div className="h-8 w-20 bg-dex-border rounded" />
          <div className="h-8 w-16 bg-dex-border rounded" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-dex-border rounded" />
      <div className="grid md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
