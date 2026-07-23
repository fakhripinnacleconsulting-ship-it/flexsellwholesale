import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function BlogsPage() {
  return (
    <div className="space-y-6 container mx-auto px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Our Blog</h1>
        <p className="text-muted-foreground mt-1">This module is currently under development.</p>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <EmptyState 
            title="Coming Soon" 
            description="The Our Blog interface is being built and will be available in the next release." 
          />
        </CardContent>
      </Card>
    </div>
  );
}
