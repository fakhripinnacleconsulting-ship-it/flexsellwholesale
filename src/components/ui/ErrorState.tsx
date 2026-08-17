import * as React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We encountered an error loading this data. Please try again.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div className={`text-center py-16 bg-destructive/5 rounded-xl border border-destructive/20 border-dashed flex flex-col items-center ${className}`}>
      <div className="bg-destructive/10 p-4 rounded-full mb-4 text-destructive">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-medium text-foreground">{title}</h3>
      <p className="text-muted-foreground mt-2 mb-6 max-w-md text-center text-sm">{description}</p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
          <RefreshCcw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
