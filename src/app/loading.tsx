"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Skeleton for Header/Title */}
      <Skeleton className="h-10 w-48 mb-8" />
      
      {/* Skeleton Grid for Products/Content */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="w-full aspect-[4/5] rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-1/3 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
