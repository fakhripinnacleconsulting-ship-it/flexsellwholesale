import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Shaped like the wallet page, not a spinner.
 *
 * The balance is what people came for, so it gets the largest block and appears in the
 * position it will actually occupy — a centred spinner tells the customer nothing and makes
 * the real content jump when it arrives.
 */
export default function WalletLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>

      <Skeleton className="h-9 w-56 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
