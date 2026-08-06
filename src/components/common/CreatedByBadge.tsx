"use client";

import * as React from "react";
import { CreatedByInfo } from "@/types";

interface CreatedByBadgeProps {
  createdBy?: CreatedByInfo;
  generatedBy?: string;
  customerName?: string;
  origin?: "self" | "website";
  docType?: "quote" | "invoice" | "receipt" | "order";
  className?: string;
}

export function CreatedByBadge({
  createdBy,
  generatedBy,
  customerName,
  origin,
  docType,
  className = "",
}: CreatedByBadgeProps) {
  // Helper to format emails or raw handles into clean capitalized full names
  const formatName = (val?: string) => {
    if (!val) return "";
    let clean = val.trim();
    if (clean.includes("@")) {
      clean = clean.split("@")[0];
    }
    if (clean.includes(".") || clean.includes("_") || clean.includes("-")) {
      clean = clean.replace(/[._-]/g, " ");
    }
    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  let role: "Admin" | "Manager" | "Customer" | "System" | null = null;
  let name: string | null = null;

  if (createdBy && createdBy.role) {
    role = createdBy.role;
    if (createdBy.name && createdBy.name.trim() !== "" && createdBy.name !== "Unknown") {
      name = formatName(createdBy.name);
    } else if (createdBy.email) {
      name = formatName(createdBy.email);
    }
  } else if (generatedBy) {
    const gen = generatedBy.toLowerCase().trim();
    if (gen === "system" || gen === "website-public") {
      role = "System";
      name = "System";
    } else if (gen.includes("admin")) {
      role = "Admin";
      name = formatName(generatedBy);
    } else if (gen.includes("manager") || gen.includes("staff")) {
      role = "Manager";
      name = formatName(generatedBy);
    } else {
      name = formatName(generatedBy);
    }
  } else if (origin === "website" && customerName) {
    role = "Customer";
    name = formatName(customerName);
  }

  // If creator information is missing or unverified, display "-" line as requested
  if (!name && !role) {
    return (
      <span className="text-muted-foreground text-xs font-semibold select-none">
        —
      </span>
    );
  }

  const roleTextColors = {
    Admin: "text-purple-600 dark:text-purple-400 font-semibold",
    Manager: "text-blue-600 dark:text-blue-400 font-semibold",
    Customer: "text-emerald-600 dark:text-emerald-400 font-semibold",
    System: "text-muted-foreground font-medium",
  };

  return (
    <div className={`inline-flex flex-col items-start gap-0 ${className}`}>
      {/* Primary Line: Prominent Creator Name */}
      <span
        className="text-xs font-semibold text-foreground truncate max-w-[150px]"
        title={name || "—"}
      >
        {name || "—"}
      </span>

      {/* Secondary Line: Small Light Role Subtext */}
      {role ? (
        <span
          className={`text-[10px] tracking-tight ${
            roleTextColors[role] || roleTextColors.System
          }`}
        >
          {role}
        </span>
      ) : null}
    </div>
  );
}
