import * as React from "react";
import { notFound } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { pagesContent } from "@/config/pagesContent";

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  await dbConnect();
  const cmsPoliciesDoc = await CmsContent.findOne({ key: "policies" });
  const cmsPolicies = cmsPoliciesDoc?.value;

  const policyData = cmsPolicies?.[slug] || pagesContent.policies[slug as keyof typeof pagesContent.policies];

  if (!policyData) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{policyData.title}</h1>
        <p className="text-muted-foreground mt-2 text-sm font-medium">Last updated: {policyData.lastUpdated}</p>
      </div>
      <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
        {policyData.sections.map((section: any, idx: number) => (
          <div key={idx} className="space-y-2">
            <h2 className="text-xl font-bold mt-6">{section.heading}</h2>
            <p className="text-muted-foreground leading-relaxed text-sm md:text-base">{section.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
