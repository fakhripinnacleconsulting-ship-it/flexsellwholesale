import * as React from "react";
import { Button } from "@/components/ui/Button";
import { CheckCircle, AlertTriangle, XCircle, ExternalLink } from "lucide-react";
import { type ExcelValidationError } from "@/lib/excelHelper";

interface BulkValidationPanelProps {
  importStats: {
    productsCount: number;
    variantsCount: number;
    combinationsCount: number;
  } | null;
  validationErrors: ExcelValidationError[];
}

export function BulkValidationPanel({
  importStats,
  validationErrors,
}: BulkValidationPanelProps) {
  const criticalErrors = validationErrors.filter((e) => e.type === "error");
  const warnings = validationErrors.filter((e) => e.type === "warning");
  const hasErrors = criticalErrors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/10 border p-4 rounded-xl text-xs border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Total Products</span>
          <span className="text-base font-black text-foreground">{importStats?.productsCount || 0}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Color Variants</span>
          <span className="text-base font-black text-foreground">{importStats?.variantsCount || 0}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Total SKU Combos</span>
          <span className="text-base font-black text-foreground">{importStats?.combinationsCount || 0}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Validation Status</span>
          <div className="flex items-center gap-1.5 font-bold mt-0.5">
            {hasErrors ? (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="h-3.5 w-3.5" /> {criticalErrors.length} Errors
              </span>
            ) : (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle className="h-3.5 w-3.5" /> {hasWarnings ? "Valid w/ Warnings" : "Ready to Import"}
              </span>
            )}
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="border border-border/80 rounded-xl overflow-hidden">
          <div className="bg-secondary/40 px-4 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Validation Errors & Warnings</span>
            <span className="text-[10px] text-muted-foreground">Fix errors to enable upload</span>
          </div>
          <div className="divide-y max-h-[220px] overflow-y-auto">
            {validationErrors.map((err, i) => (
              <div key={i} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  {err.type === "error" ? (
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold text-foreground">
                      Row {err.row} | Column: <span className="underline">{err.column}</span>
                    </p>
                    <p className="text-muted-foreground mt-0.5">{(err as any).message}</p>
                  </div>
                </div>
                {err.productId && (
                  <a
                    href={`/admin/products/${err.productId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start sm:self-center shrink-0"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2 font-black flex items-center gap-1 text-primary border-primary/20 hover:border-primary hover:bg-primary/5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Product
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasErrors && hasWarnings && (
        <div className="p-3 bg-warning/10 border border-warning/20 text-warning rounded-lg text-xs flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="font-semibold">
            The sheet has warnings but can still be uploaded. Unrecognized categories or HSN records will fall back to default values.
          </p>
        </div>
      )}
    </div>
  );
}
