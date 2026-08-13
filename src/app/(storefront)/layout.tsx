import { StorefrontLayout } from "@/components/layout/StorefrontLayout";

// No layout-level `revalidate` on purpose.
//
// A value here silently becomes the default for all 30+ child routes, including
// per-user ones (cart, checkout, login) that should never occupy an ISR cache slot.
// Each route now declares its own caching: content routes set `revalidate = 86400`,
// user-specific routes set `dynamic = "force-dynamic"`.

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StorefrontLayout>{children}</StorefrontLayout>;
}
