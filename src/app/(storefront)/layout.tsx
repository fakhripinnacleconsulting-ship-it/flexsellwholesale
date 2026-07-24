import { StorefrontLayout } from "@/components/layout/StorefrontLayout";

export const revalidate = 60; // Enable 60s ISR caching for fast CDN delivery

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>;
}
