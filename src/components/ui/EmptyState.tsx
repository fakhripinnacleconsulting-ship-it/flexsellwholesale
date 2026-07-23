import * as React from "react";
import Link from "next/link";
import { Button } from "./Button";
import { FolderSearch } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ 
  title, 
  description, 
  actionText, 
  actionHref,
  icon = <FolderSearch className="h-10 w-10 text-muted-foreground" />
}: EmptyStateProps) {
  return (
    <div className="text-center py-20 bg-secondary/20 rounded-xl border border-dashed flex flex-col items-center">
      <div className="bg-secondary p-5 rounded-full mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-medium">{title}</h3>
      <p className="text-muted-foreground mt-2 mb-6 max-w-md text-center">{description}</p>
      
      {actionText && actionHref && (
        <Link href={actionHref}>
          <Button>{actionText}</Button>
        </Link>
      )}
    </div>
  );
}
