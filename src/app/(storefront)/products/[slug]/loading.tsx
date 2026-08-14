import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Instant feedback while a product page streams in.
 *
 * Without a loading boundary on this segment, Next falls back to the nearest one — which
 * is the app-root skeleton, a product *grid*. Clicking a card therefore either showed a
 * grid-shaped placeholder or simply left the previous page on screen with nothing
 * happening, which is what made navigation feel slow even when the payload was quick.
 *
 * The shape below mirrors the real product page (gallery left, buy panel right) so the
 * swap to real content is not a visible jump.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 w-full py-6 md:py-8">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-56 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Gallery */}
        <div className="space-y-3">
          <Skeleton className="w-full aspect-square rounded-2xl" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-16 rounded-lg shrink-0" />
            ))}
          </div>
        </div>

        {/* Title, price, variants, buy panel */}
        <div className="space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />

          <div className="space-y-2 pt-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>

          <div className="space-y-2 pt-3">
            <Skeleton className="h-4 w-24" />
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-lg" />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Skeleton className="h-11 w-28 rounded-xl" />
            <Skeleton className="h-11 flex-1 rounded-xl" />
          </div>

          <div className="space-y-2 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
