"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { formatPrice } from "@/lib/utils";
import { Wallet as WalletIcon, Briefcase, AlertTriangle } from "lucide-react";
import type { WalletView } from "@/types/wallet";

interface WalletBalanceCardProps {
  type: "store" | "business";
  wallet: WalletView | null;
  /** Rendered under the figures — the Add Money button, or nothing for staff views. */
  actions?: React.ReactNode;
  /** Shown above the figures. Used for the KYC banner on the Business Wallet. */
  notice?: React.ReactNode;
  /** If provided, used in low-balance warnings instead of "Your". */
  customerName?: string;
}

const COPY = {
  store: {
    title: "Store Wallet",
    blurb: "For orders and services on FlexSell",
    Icon: WalletIcon,
  },
  business: {
    title: "Business Wallet",
    blurb: "For GST, trademark, ads and other business services",
    Icon: Briefcase,
  },
} as const;

/**
 * A wallet's balance, in the minimal statement style.
 *
 * Deliberately restrained: figures in a definition list, one accent colour, no gradient.
 * A wallet is an accounting document a business owner has to trust, and the visual
 * language that sells a consumer app works against that here.
 */
export function WalletBalanceCard({ type, wallet, actions, notice, customerName }: WalletBalanceCardProps) {
  const { title, blurb, Icon } = COPY[type];

  /**
   * A missing wallet is not an error and not a zero balance — it is a wallet that has never
   * been used. Lazy creation means the document simply does not exist yet, so it reads as
   * ₹0 with the same layout rather than as an empty state that implies something is wrong.
   */
  const available = wallet?.availableBalance ?? 0;
  const held = wallet?.heldBalance ?? 0;
  const credited = wallet?.totalCredited ?? 0;
  const debited = wallet?.totalDebited ?? 0;
  const isFrozen = wallet?.status === "frozen";
  const isClosed = wallet?.status === "closed";

  return (
    <Card className="border border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
              <p className="text-[11px] text-muted-foreground">{blurb}</p>
            </div>
          </div>

          {(isFrozen || isClosed) && (
            <Badge variant="destructive" className="text-[10px] uppercase shrink-0">
              {wallet?.status}
            </Badge>
          )}
        </div>

        {/*
          A frozen or closed wallet must explain itself. Without this the customer sees a
          badge, their payments stop working, and they assume the system is broken.
        */}
        {(isFrozen || isClosed) && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-destructive">
              {isFrozen
                ? "This wallet is temporarily frozen. Your balance is safe and your statement stays available, but no money can move in or out."
                : "This wallet is closed. Your transaction history remains available."}
              {wallet?.closureReason && (
                <span className="mt-1 block font-semibold">Reason: {wallet.closureReason}</span>
              )}
            </p>
          </div>
        )}

        {notice}

        {/*
          A definition list, not divs: a screen reader then reads "Available Balance,
          fifteen thousand rupees" rather than two unrelated strings.
        */}
        <dl className="space-y-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Available Balance
            </dt>
            <dd
              className="text-3xl font-bold tracking-tight text-foreground tabular-nums"
              // Announced after a transaction changes it, rather than only animating.
              aria-live="polite"
            >
              {/* formatPrice supplies the ₹ and the lakh/crore grouping; the counter
                  parses that string and animates only the numeric part. */}
              <AnimatedCounter value={formatPrice(available)} />
            </dd>
          </div>

          {held > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold tabular-nums">{formatPrice(held)}</span> on hold for an
                order being placed
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Added
              </dt>
              <dd className="text-sm font-bold text-foreground tabular-nums">{formatPrice(credited)}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total Used
              </dt>
              <dd className="text-sm font-bold text-foreground tabular-nums">{formatPrice(debited)}</dd>
            </div>
          </div>
        </dl>

        {wallet?.isLowBalance && available > 0 && (
          <p className="mt-3 rounded-md bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
            {customerName ? `${customerName}'s` : "Your"} balance is running low.
          </p>
        )}

        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}
