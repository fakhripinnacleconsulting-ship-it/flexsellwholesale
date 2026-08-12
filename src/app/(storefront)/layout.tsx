import { StorefrontLayout } from "@/components/layout/StorefrontLayout";

export const revalidate = 3600; // Enable 60s ISR caching for fast CDN delivery

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>;
}
