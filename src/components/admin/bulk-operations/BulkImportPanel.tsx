import * as React from "react";
import { Button } from "@/components/ui/Button";
import { UploadCloud, FileSpreadsheet } from "lucide-react";

interface BulkImportPanelProps {
  fileInfo: { name: string; size: number } | null;
  dragActive: boolean;
  handleDrag: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFile: () => void;
}

export function BulkImportPanel({
  fileInfo,
  dragActive,
  handleDrag,
  handleDrop,
  handleFileChange,
  clearFile,
}: BulkImportPanelProps) {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-foreground">C. Import Excel File</h3>
      <p className="text-xs text-muted-foreground">
        Upload your completed template or update sheet to process database additions/edits.
      </p>

      {!fileInfo ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
            dragActive 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50 hover:bg-secondary/10"
          }`}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <UploadCloud className="h-8 w-8" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Click to upload or drag & drop</p>
            <p className="text-xs text-muted-foreground mt-1">Excel files (.xlsx, .xls)</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-xl p-4 bg-secondary/15 flex items-center justify-between border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold truncate max-w-[250px] md:max-w-[400px]">{fileInfo.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{(fileInfo.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFile}
              className="text-xs text-destructive hover:bg-destructive/10 font-bold"
            >
              Change File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
