import { MapPin, Phone, Mail, Clock, Navigation } from "lucide-react";
import type { LocationSectionData } from "@/components/admin/cms/types";

interface LocationSectionProps {
  data?: LocationSectionData | null;
  /** Fallbacks from businessSettings so the section is useful before anyone edits it. */
  fallback?: {
    address?: string;
    phone?: string;
    email?: string;
    timings?: string;
  };
}

/**
 * Store location block, rendered just above the footer.
 *
 * The map embed renders straight away rather than behind a click-to-load facade. It is
 * a server component — no state, no handlers — so it ships no client JavaScript of its
 * own, and the iframe is lazily loaded so the Maps payload is only fetched once the
 * visitor scrolls down to it.
 */
export function LocationSection({ data, fallback }: LocationSectionProps) {
  if (data?.isActive === false) return null;

  const heading = data?.heading || "Visit Our Warehouse";
  const subheading =
    data?.subheading || "Come see the stock in person, or get in touch before you travel.";
  const address = data?.address || fallback?.address || "";
  const phone = data?.phone || fallback?.phone || "";
  const email = data?.email || fallback?.email || "";
  const timings = data?.timings || fallback?.timings || "";
  const mapEmbedUrl = data?.mapEmbedUrl || "";
  const directionsUrl =
    data?.directionsUrl ||
    (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");

  // Nothing worth rendering an empty band for.
  if (!address && !phone && !email && !mapEmbedUrl) return null;

  return (
    <section
      className="mx-auto max-w-8xl px-4 md:px-6 w-full py-2 sm:py-4"
      aria-labelledby="location-section-heading"
    >
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Details */}
          <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center">
            <h2
              id="location-section-heading"
              className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground"
            >
              {heading}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{subheading}</p>

            <dl className="mt-6 space-y-4">
              {address && (
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 shrink-0">
                    <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="sr-only">Address</span>
                  </dt>
                  <dd className="text-sm text-foreground/90 leading-relaxed">{address}</dd>
                </div>
              )}

              {phone && (
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 shrink-0">
                    <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="sr-only">Phone</span>
                  </dt>
                  <dd className="text-sm">
                    <a
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="text-foreground/90 hover:text-primary transition-colors"
                    >
                      {phone}
                    </a>
                  </dd>
                </div>
              )}

              {email && (
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 shrink-0">
                    <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="sr-only">Email</span>
                  </dt>
                  <dd className="text-sm">
                    <a
                      href={`mailto:${email}`}
                      className="text-foreground/90 hover:text-primary transition-colors break-all"
                    >
                      {email}
                    </a>
                  </dd>
                </div>
              )}

              {timings && (
                <div className="flex items-start gap-3">
                  <dt className="mt-0.5 shrink-0">
                    <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="sr-only">Opening hours</span>
                  </dt>
                  <dd className="text-sm text-foreground/90">{timings}</dd>
                </div>
              )}
            </dl>

            {directionsUrl && (
              <div className="mt-7">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  Get Directions
                </a>
              </div>
            )}
          </div>

          {/*
            Map renders directly, with no click-to-load step.

            `loading="lazy"` is what keeps this affordable: the section sits at the bottom
            of the homepage, so the browser defers the (roughly 1 MB) Google Maps payload
            until the visitor scrolls near it rather than fetching it during initial load.
          */}
          <div className="relative min-h-[260px] sm:min-h-[320px] lg:min-h-full bg-secondary">
            {mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                title={`Map showing the location of ${heading}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full border-0"
                allowFullScreen
              />
            ) : (
              // No embed URL configured — fall back to the address rather than a blank panel.
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                {data?.staticMapImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.staticMapImageUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,var(--color-primary,theme(colors.emerald.500))_0%,transparent_60%)] opacity-10"
                  />
                )}

                <MapPin className="h-8 w-8 text-primary relative" aria-hidden="true" />

                {address && (
                  <p className="relative text-sm font-semibold text-foreground max-w-xs">{address}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
