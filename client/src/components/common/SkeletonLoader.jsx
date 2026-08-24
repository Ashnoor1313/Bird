import React from 'react';

export function PageSkeletonLoader() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div className="space-y-2">
          <div className="h-4 w-24 bg-zinc-200 rounded-md"></div>
          <div className="h-8 w-48 bg-zinc-300 rounded-lg"></div>
          <div className="h-3 w-64 bg-zinc-200 rounded-md"></div>
        </div>
        <div className="h-10 w-28 bg-zinc-200 rounded-xl"></div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 bg-white rounded-2xl border border-zinc-200 space-y-3">
            <div className="h-3 w-16 bg-zinc-200 rounded"></div>
            <div className="h-7 w-24 bg-zinc-300 rounded-md"></div>
          </div>
        ))}
      </div>

      {/* Main Content Skeleton Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-6 bg-white rounded-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-200"></div>
              <div className="space-y-2">
                <div className="h-5 w-32 bg-zinc-300 rounded"></div>
                <div className="h-3 w-20 bg-zinc-200 rounded"></div>
              </div>
            </div>
            <div className="h-14 bg-zinc-100 rounded-xl"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeletonLoader({ rows = 6 }) {
  return (
    <div className="w-full bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100 animate-pulse overflow-hidden">
      <div className="p-4 bg-zinc-50 flex items-center justify-between">
        <div className="h-4 w-32 bg-zinc-200 rounded"></div>
        <div className="h-4 w-20 bg-zinc-200 rounded"></div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-200"></div>
            <div className="space-y-1.5">
              <div className="h-4 w-40 bg-zinc-300 rounded"></div>
              <div className="h-3 w-24 bg-zinc-200 rounded"></div>
            </div>
          </div>
          <div className="h-5 w-20 bg-zinc-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}
