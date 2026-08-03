import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Copy,
  Plus,
  AlertCircle,
  Layers,
  Sparkles,
  X
} from "lucide-react";
import { usePathname } from "next/navigation";
import { type ExcelValidationError } from "@/lib/excelHelper";

interface BulkValidationPanelProps {
  importStats: {
    productsCount: number;
    variantsCount: number;
    combinationsCount: number;
  } | null;
  validationErrors: ExcelValidationError[];
  parsedData?: any[] | null;
  setParsedData?: React.Dispatch<React.SetStateAction<any[] | null>>;
  setImportStats?: React.Dispatch<React.SetStateAction<{
    productsCount: number;
    variantsCount: number;
    combinationsCount: number;
  } | null>>;
}

interface FlattenedRow {
  productIndex: number;
  colorIndex: number;
  subIndex: number;
  productTitle: string;
  color: string;
  size: string;
  weight: string;
  sku: string;
  b2cPrice: number;
  mrp: number;
  stock: number;
  isNeedsAttention?: boolean;
}

export function BulkValidationPanel({
  importStats,
  validationErrors,
  parsedData,
  setParsedData,
  setImportStats
}: BulkValidationPanelProps) {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/manager") ? "/manager/catalog" : "/admin";
  const criticalErrors = validationErrors.filter((e) => e.type === "error");
  const warnings = validationErrors.filter((e) => e.type === "warning");
  const hasErrors = criticalErrors.length > 0;
  const hasWarnings = warnings.length > 0;

  // State for Duplication Option Modal
  const [duplicateTarget, setDuplicateTarget] = React.useState<FlattenedRow | null>(null);
  const [dupMode, setDupMode] = React.useState<"variation" | "combination">("combination");
  const [newVarName, setNewVarName] = React.useState("");
  const [newSizeName, setNewSizeName] = React.useState("");
  const [newSkuName, setNewSkuName] = React.useState("");

  // Flatten parsed products into rows for the interactive grid
  const flattenedRows = React.useMemo(() => {
    if (!parsedData || !Array.isArray(parsedData)) return [];
    const rows: FlattenedRow[] = [];

    parsedData.forEach((p, pIdx) => {
      (p.colorVariants || []).forEach((cv: any, cIdx: number) => {
        (cv.subVariants || []).forEach((sv: any, sIdx: number) => {
          rows.push({
            productIndex: pIdx,
            colorIndex: cIdx,
            subIndex: sIdx,
            productTitle: p.title || "",
            color: cv.color || "Default",
            size: sv.size || "Standard",
            weight: sv.weight || "",
            sku: sv.sku || "",
            b2cPrice: sv.b2cPrice || 0,
            mrp: sv.mrp || 0,
            stock: sv.stock || 0,
            isNeedsAttention: Boolean(sv.isNeedsAttention || !sv.sku || sv.sku.includes("-COPY")),
          });
        });
      });
    });

    return rows;
  }, [parsedData]);

  // Recalculate stats when parsedData changes
  const updateStats = (data: any[]) => {
    let pCount = data.length;
    let vCount = 0;
    let cCount = 0;
    data.forEach((p) => {
      vCount += p.colorVariants?.length || 0;
      (p.colorVariants || []).forEach((cv: any) => {
        cCount += cv.subVariants?.length || 0;
      });
    });
    if (setImportStats) {
      setImportStats({
        productsCount: pCount,
        variantsCount: vCount,
        combinationsCount: cCount,
      });
    }
  };

  // Open Duplication Modal
  const handleOpenDuplicate = (row: FlattenedRow) => {
    setDuplicateTarget(row);
    setDupMode("combination");
    setNewVarName(`Copy of ${row.color}`);
    setNewSizeName(`${row.size} (Copy)`);
    setNewSkuName(row.sku ? `${row.sku}-COPY` : "");
  };

  // Execute Duplication
  const handleConfirmDuplicate = () => {
    if (!duplicateTarget || !parsedData || !setParsedData) return;

    const nextData = JSON.parse(JSON.stringify(parsedData));
    const targetProduct = nextData[duplicateTarget.productIndex];
    if (!targetProduct) return;

    if (dupMode === "variation") {
      // Option 1: Add New Variation Type
      const targetCv = targetProduct.colorVariants[duplicateTarget.colorIndex];
      if (!targetCv) return;

      const duplicatedCv = JSON.parse(JSON.stringify(targetCv));
      duplicatedCv.color = newVarName.trim() || `Copy of ${targetCv.color}`;
      duplicatedCv.isNeedsAttention = true;
      duplicatedCv.subVariants = (duplicatedCv.subVariants || []).map((sv: any, idx: number) => ({
        ...sv,
        id: `sv-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        sku: idx === 0 && newSkuName ? newSkuName.trim() : (sv.sku ? `${sv.sku}-COPY` : ""),
        isNeedsAttention: true,
      }));

      targetProduct.colorVariants.push(duplicatedCv);
    } else {
      // Option 2: Add New Combination Row to current Variation
      const targetCv = targetProduct.colorVariants[duplicateTarget.colorIndex];
      if (!targetCv) return;

      const targetSv = targetCv.subVariants[duplicateTarget.subIndex];
      if (!targetSv) return;

      const duplicatedSv = JSON.parse(JSON.stringify(targetSv));
      duplicatedSv.id = `sv-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      duplicatedSv.size = newSizeName.trim() || `${targetSv.size} (Copy)`;
      duplicatedSv.sku = newSkuName.trim() || (targetSv.sku ? `${targetSv.sku}-COPY` : "");
      duplicatedSv.isNeedsAttention = true;

      targetCv.subVariants.splice(duplicateTarget.subIndex + 1, 0, duplicatedSv);
    }

    setParsedData(nextData);
    updateStats(nextData);
    setDuplicateTarget(null);
  };

  // Handle cell edit directly in preview grid
  const handleGridCellEdit = (
    pIdx: number,
    cIdx: number,
    sIdx: number,
    field: "sku" | "size" | "color" | "b2cPrice" | "stock",
    value: any
  ) => {
    if (!parsedData || !setParsedData) return;
    const nextData = JSON.parse(JSON.stringify(parsedData));
    const targetProduct = nextData[pIdx];
    if (!targetProduct) return;

    const targetCv = targetProduct.colorVariants?.[cIdx];
    if (!targetCv) return;

    if (field === "color") {
      targetCv.color = value;
      delete targetCv.isNeedsAttention;
    } else {
      const targetSv = targetCv.subVariants?.[sIdx];
      if (!targetSv) return;

      targetSv[field] = value;
      if (field === "sku" && value && !value.includes("-COPY")) {
        delete targetSv.isNeedsAttention;
      }
    }

    setParsedData(nextData);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Stats Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/10 border p-4 rounded-xl text-xs border-border">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Total Products</span>
          <span className="text-base font-black text-foreground">{importStats?.productsCount || 0}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Variation Types</span>
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

      {/* Validation Errors & Warnings */}
      {validationErrors.length > 0 && (
        <div className="border border-border/80 rounded-xl overflow-hidden">
          <div className="bg-secondary/40 px-4 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Validation Errors & Warnings</span>
            <span className="text-[10px] text-muted-foreground">Fix errors to enable upload</span>
          </div>
          <div className="divide-y max-h-[160px] overflow-y-auto">
            {validationErrors.map((err, i) => (
              <div key={i} className="p-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
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
                    href={`${basePath}/products/${err.productId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start sm:self-center shrink-0"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-7 px-2 font-black flex items-center gap-1 text-primary border-primary/20 hover:border-primary hover:bg-primary/5"
                    >
                      <ExternalLink className="h-3 w-3" /> View Product
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Sheet Preview Grid & Duplicate Row Tool */}
      {flattenedRows.length > 0 && setParsedData && (
        <div className="border border-border rounded-xl overflow-hidden bg-background">
          <div className="bg-secondary/30 px-4 py-2.5 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">Interactive Sheet Preview & Row Duplication</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-medium">
              Click <b className="text-amber-600 dark:text-amber-400">Duplicate</b> on any row to add a new Variation or Combination. Red cells indicate fields needing attention.
            </span>
          </div>

          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-xs text-left border-collapse whitespace-nowrap">
              <thead className="bg-secondary/50 font-bold uppercase text-muted-foreground sticky top-0 z-10 border-b">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Product Title</th>
                  <th className="px-3 py-2">Variation Type</th>
                  <th className="px-3 py-2">Size / Weight</th>
                  <th className="px-3 py-2">SKU *</th>
                  <th className="px-3 py-2">Price (₹)</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2 text-right">Duplicate Row</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flattenedRows.map((row, rIdx) => {
                  const isAttention = row.isNeedsAttention;

                  return (
                    <tr
                      key={`${row.productIndex}-${row.colorIndex}-${row.subIndex}-${rIdx}`}
                      className={`hover:bg-secondary/15 transition-colors ${isAttention ? "bg-amber-500/5 dark:bg-amber-950/20" : ""}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground font-mono">{rIdx + 1}</td>

                      <td className="px-3 py-2 font-bold max-w-[180px] truncate" title={row.productTitle}>
                        {row.productTitle}
                      </td>

                      <td className="px-3 py-2">
                        <Input
                          className="h-7 text-xs w-28 font-medium"
                          value={row.color}
                          onChange={(e) =>
                            handleGridCellEdit(row.productIndex, row.colorIndex, row.subIndex, "color", e.target.value)
                          }
                        />
                      </td>

                      <td className="px-3 py-2">
                        <Input
                          className={`h-7 text-xs w-24 font-medium ${isAttention ? "border-amber-500 bg-amber-500/10 text-amber-700 font-bold" : ""}`}
                          value={row.size}
                          onChange={(e) =>
                            handleGridCellEdit(row.productIndex, row.colorIndex, row.subIndex, "size", e.target.value)
                          }
                        />
                      </td>

                      <td className="px-3 py-2">
                        <div className="space-y-0.5">
                          <Input
                            className={`h-7 text-xs font-mono font-bold w-36 ${
                              isAttention
                                ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-300 focus:ring-red-500"
                                : ""
                            }`}
                            value={row.sku}
                            onChange={(e) =>
                              handleGridCellEdit(row.productIndex, row.colorIndex, row.subIndex, "sku", e.target.value)
                            }
                          />
                          {isAttention && (
                            <span className="text-[9px] font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5">
                              <AlertCircle className="h-2.5 w-2.5" /> Needs Unique SKU
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          className="h-7 text-xs w-20"
                          value={row.b2cPrice}
                          onChange={(e) =>
                            handleGridCellEdit(
                              row.productIndex,
                              row.colorIndex,
                              row.subIndex,
                              "b2cPrice",
                              Number(e.target.value) || 0
                            )
                          }
                        />
                      </td>

                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          className="h-7 text-xs w-16"
                          value={row.stock}
                          onChange={(e) =>
                            handleGridCellEdit(
                              row.productIndex,
                              row.colorIndex,
                              row.subIndex,
                              "stock",
                              Number(e.target.value) || 0
                            )
                          }
                        />
                      </td>

                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDuplicateTarget(row);
                              setDupMode("combination");
                              setNewVarName(`Copy of ${row.color}`);
                              setNewSizeName(`${row.size} (Copy)`);
                              setNewSkuName(row.sku ? `${row.sku}-COPY` : "");
                            }}
                            className="h-7 px-2 text-[10px] font-bold text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center gap-1"
                            title="Duplicate as new Combination row (same variation type)"
                          >
                            <Plus className="h-3 w-3" /> + Combo
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDuplicateTarget(row);
                              setDupMode("variation");
                              setNewVarName(`Copy of ${row.color}`);
                              setNewSizeName(`${row.size} (Copy)`);
                              setNewSkuName(row.sku ? `${row.sku}-COPY` : "");
                            }}
                            className="h-7 px-2 text-[10px] font-bold text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer flex items-center gap-1"
                            title="Duplicate as new Variation Type (e.g. Blue)"
                          >
                            <Layers className="h-3 w-3" /> + Variation
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Row Duplication Selection Modal Dialog */}
      {duplicateTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150 relative">
            <button
              onClick={() => setDuplicateTarget(null)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
                <Copy className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-foreground">Duplicate Sheet Row</h3>
                <p className="text-xs text-muted-foreground">Product: <b className="text-foreground">{duplicateTarget.productTitle}</b></p>
              </div>
            </div>

            {/* Duplication Mode Choices */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase text-muted-foreground block">Select Duplication Mode:</label>

              <div className="grid grid-cols-1 gap-2.5">
                <label
                  onClick={() => setDupMode("combination")}
                  className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                    dupMode === "combination"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-secondary/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="dupMode"
                    checked={dupMode === "combination"}
                    onChange={() => setDupMode("combination")}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 text-primary" /> Option A: Add New Combination Row
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Copies Variation Type (<b className="text-foreground">{duplicateTarget.color}</b>) & images. Prompts for new Size & unique SKU. Highlighted in <b className="text-red-500">RED</b>.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setDupMode("variation")}
                  className={`p-3.5 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${
                    dupMode === "variation"
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-secondary/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="dupMode"
                    checked={dupMode === "variation"}
                    onChange={() => setDupMode("variation")}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" /> Option B: Add New Variation Type
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Copies Product info & prices, creates a new Variation line (e.g. Blue). Variation Name & SKUs highlighted in <b className="text-red-500">RED</b>.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Inputs based on choice */}
            <div className="space-y-3 bg-secondary/15 p-3.5 rounded-xl border border-border">
              {dupMode === "variation" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1">
                    New Variation Type Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    className="h-8 text-xs font-bold border-red-500/80 bg-red-500/5 focus:ring-red-500"
                    placeholder="e.g. Royal Blue"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1">
                    New Combination Size / Weight Label <span className="text-red-500">*</span>
                  </label>
                  <Input
                    className="h-8 text-xs font-bold border-red-500/80 bg-red-500/5 focus:ring-red-500"
                    placeholder="e.g. 1 Litre"
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  New Unique SKU <span className="text-red-500">*</span>
                </label>
                <Input
                  className="h-8 text-xs font-mono font-bold border-red-500/80 bg-red-500/5 focus:ring-red-500 text-red-600 dark:text-red-300"
                  placeholder="e.g. CWB-RED-1L"
                  value={newSkuName}
                  onChange={(e) => setNewSkuName(e.target.value)}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setDuplicateTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmDuplicate}
                className="bg-primary text-primary-foreground font-bold cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate Row & Highlight Red
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

