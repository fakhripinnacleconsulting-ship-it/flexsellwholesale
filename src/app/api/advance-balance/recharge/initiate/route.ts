import { NextResponse, NextRequest } from "next/server";
import Razorpay from "razorpay";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import AdvanceBalanceTransaction from "@/models/AdvanceBalanceTransaction";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";
import { parseAmountToPaise } from "@/lib/money";
import { createPendingRecharge } from "@/lib/advanceBalanceRecharge";
import { resolveActor } from "@/lib/orderHistory";
import {
  MIN_RECHARGE_PAISE,
  MAX_RECHARGE_PAISE,
  ADVANCE_BALANCE_TERMS_VERSION,
  BUSINESS_ADVANCE_BALANCE_TIERS,
  ADVANCE_BALANCE_TYPES,
} from "@/lib/advanceBalanceConstants";
import {
  getAdvanceBalanceTopUpAvailability,
  RECHARGE_UNAVAILABLE_MESSAGE,
  RECHARGE_UNAVAILABLE_STAFF_MESSAGE,
} from "@/lib/commerceSettings";
import type { AdvanceBalanceActor } from "@/types/advanceBalance";

export const dynamic = "force-dynamic";

/**
 * Starts a Advance Balance recharge.
 *
 * Mints the Razorpay order from a **server-side** amount and records the intent as a
 * pending transaction, so settlement credits what we intended rather than what the browser
 * claims. No balance moves here — that happens only when Razorpay confirms the money.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    const isAdmin = payload.role === "admin";

    /**
     * Customers top up their own Advance Balance; **admins** may take an online payment on a
     * customer's behalf — a counter or telephone sale, where the admin opens the checkout and
     * the customer pays on it.
     *
     * Managers are excluded. They may spend a balance but not put money into one, matching
     * the offline-credit rule: anything that increases a balance stays with admin.
     */
    if (payload.role !== "customer" && !isAdmin) {
      return NextResponse.json(
        { message: "Only the account holder or an admin can start an Advance Balance top-up" },
        { status: 403 }
      );
    }

    /**
     * The admin switch is enforced **here**, not only in the UI.
     *
     * Hiding the button is presentation; refusing the route is the control. This is also why
     * the check sits before the amount is parsed — a disabled feature should not report a
     * validation error about a payment it was never going to accept.
     */
    const availability = await getAdvanceBalanceTopUpAvailability();
    if (!availability.available) {
      return NextResponse.json(
        {
          message: isAdmin
            ? RECHARGE_UNAVAILABLE_STAFF_MESSAGE[availability.reason]
            : RECHARGE_UNAVAILABLE_MESSAGE[availability.reason],
          code: "RECHARGE_UNAVAILABLE",
          reason: availability.reason,
        },
        { status: 409 }
      );
    }

    // This endpoint mints Razorpay orders, so it is cheap to abuse and worth limiting.
    await rateLimit(payload.userId, "general");

    const body = await request.json();
    const walletType = body.walletType;

    /**
     * Whose Advance Balance is being topped up.
     *
     * A customer may only ever top up their own, so the body's `userId` is ignored for them
     * entirely rather than compared — there is nothing a customer could legitimately put
     * there, and accepting it would create a value to distrust.
     */
    const targetUserId = isAdmin && body.userId ? String(body.userId) : payload.userId;

    if (isAdmin && !body.userId) {
      return NextResponse.json(
        { message: "Choose which customer's Advance Balance to top up" },
        { status: 400 }
      );
    }

    if (!ADVANCE_BALANCE_TYPES.includes(walletType)) {
      return NextResponse.json({ message: "Unknown Advance Balance type" }, { status: 400 });
    }

    /**
     * The acknowledgement is validated here, not only in the browser.
     *
     * A checkbox enforced client-side proves nothing in a dispute, and this is the record
     * that carries both the non-refundable disclosure and the authorisation for FlexSell to
     * spend the balance on the customer's behalf.
     */
    if (body.termsAccepted !== true) {
      return NextResponse.json(
        { message: "Please accept the Advance Balance terms before adding money" },
        { status: 400 }
      );
    }

    let amountPaise: number;
    try {
      amountPaise = parseAmountToPaise(body.amount, {
        min: MIN_RECHARGE_PAISE,
        max: MAX_RECHARGE_PAISE,
        label: "Recharge amount",
      });
    } catch (err) {
      return NextResponse.json({ message: (err as Error).message }, { status: 400 });
    }

    await dbConnect();

    const customer = await Customer.findById(targetUserId)
      .select("name email role customerTypes upgradeStatus kycDocuments")
      .lean() as
      | {
          name?: string;
          role?: string;
          customerTypes?: string[];
          upgradeStatus?: string;
          kycDocuments?: Record<string, string | undefined>;
        }
      | null;

    if (!customer) {
      return NextResponse.json({ message: "Account not found" }, { status: 404 });
    }

    // Admins are Customer documents with role "admin"; they are staff, not Advance Balance holders.
    if (customer.role === "admin") {
      return NextResponse.json({ message: "Staff accounts do not hold wallets" }, { status: 403 });
    }

    const kycApproved = customer.upgradeStatus === "approved";

    if (walletType === "business") {
      const eligible = (customer.customerTypes || []).some((t) =>
        (BUSINESS_ADVANCE_BALANCE_TIERS as readonly string[]).includes(t)
      );
      if (!eligible) {
        return NextResponse.json(
          { message: "The Business Advance Balance is available to B2B and Dropshipping accounts" },
          { status: 403 }
        );
      }

      /**
       * KYC is not required to add money, but it is required to spend it — so a customer
       * funding an unapproved account is putting money somewhere it cannot yet be used.
       * They must acknowledge that specific fact, not merely the general terms. This is the
       * only guard against the one way a customer can lose money through inaction.
       */
      if (!kycApproved && body.kycWarningAccepted !== true) {
        return NextResponse.json(
          {
            message:
              "Your KYC is pending. Services cannot begin until it is approved — please acknowledge this before adding funds.",
            code: "KYC_ACKNOWLEDGEMENT_REQUIRED",
          },
          { status: 400 }
        );
      }
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      console.error("[advanceBalance] Razorpay keys are missing from environment variables.");
      return NextResponse.json({ message: "Payment gateway configuration error" }, { status: 500 });
    }

    /**
     * Attribution.
     *
     * An admin-initiated top-up is recorded as an **Admin** action, not the customer's: the
     * customer did not accept the terms themselves — the admin did so on their behalf while
     * the customer paid. The passbook must show who actually started it, and `initiatedByStaff`
     * marks the acknowledgement as second-hand rather than a self-service acceptance.
     */
    const actor = isAdmin
      ? (resolveActor(payload) as AdvanceBalanceActor)
      : (resolveActor(payload, customer.name) as AdvanceBalanceActor);

    const pending = await createPendingRecharge({
      userId: targetUserId,
      walletType,
      amountPaise,
      actor,
      termsVersion: ADVANCE_BALANCE_TERMS_VERSION,
      kycPending: !kycApproved,
      initiatedByStaff: isAdmin,
    });

    let rzpOrder;
    try {
      const razorpay = new Razorpay({ key_id, key_secret });
      rzpOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: String(pending._id),
        /**
         * The old keys are written alongside the new ones for now.
         *
         * These notes come back on the webhook, so a deploy that only wrote the new key
         * would strand any payment whose webhook was handled by a still-running old
         * instance. Writing both makes the rename safe in either direction; the legacy pair
         * can be dropped once no old instance is serving traffic.
         */
        notes: {
          flexsellAdvanceBalanceTxnId: String(pending._id),
          flexsellAdvanceBalanceType: walletType,
          flexsellWalletTxnId: String(pending._id),
          flexsellWalletType: walletType,
        },
      });
    } catch (err) {
      // Razorpay refused. Fail the pending row rather than leaving it to the sweeper —
      // there is no payment to reconcile, and a stuck "pending" the customer can see is
      // more alarming than an honest failure.
      await AdvanceBalanceTransaction.updateOne(
        { _id: pending._id },
        { $set: { status: "failed", "metadata.failureReason": "razorpay_order_creation_failed" } }
      );
      console.error("[advanceBalance] Razorpay order creation failed:", err);
      return NextResponse.json({ message: "Could not start the payment. Please try again." }, { status: 502 });
    }

    // Binds the Razorpay handle to this intent. The webhook looks the pending row up by
    // this value, so without it a captured payment could never be matched to a wallet.
    await AdvanceBalanceTransaction.updateOne(
      { _id: pending._id },
      { $set: { "metadata.razorpayOrderId": rzpOrder.id } }
    );

    return NextResponse.json(
      {
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        walletTransactionId: String(pending._id),
        keyId: key_id,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[advanceBalance] Recharge initiate failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to start the Advance Balance top-up" },
      { status: 500 }
    );
  }
}
