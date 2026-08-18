import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import WalletExpenseCategory from "@/models/WalletExpenseCategory";
import { requireWalletSpendAccess } from "@/lib/walletGuard";
import { rateLimit } from "@/lib/rateLimit";
import { parseAmountToPaise, toRupees, formatPaise } from "@/lib/money";
import {
  writeLedgerEntry,
  isDuplicateKeyError,
  findExistingByIdempotencyKey,
  InsufficientBalanceError,
  WalletNotActiveError,
} from "@/lib/walletLedger";
import { runInTransaction } from "@/lib/transactionHelper";
import { WALLET_TYPES, BUSINESS_WALLET_TIERS } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

/**
 * Records an expense staff have incurred on a customer's behalf.
 *
 * There is **no spend cap and no customer approval** — both were declined in favour of
 * staff being able to act without waiting on anyone. Nothing here will stop a wrong or
 * dishonest spend; every control below exists so that one cannot happen *quietly*:
 *
 *  - the acting person's name is written into the entry and shown to the customer
 *  - a bill is mandatory for managers, so an invented expense has nothing behind it
 *  - the customer is notified, and their noticing is the fastest detection there is
 *  - the whole thing is idempotent, so the honest failure mode (a double-click) cannot
 *    quietly double a debit that can then only be undone by an admin reversal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, walletType, expenseCategory, transactionName, description, referenceId, proofUrl, clientRequestId } =
      body;

    if (!WALLET_TYPES.includes(walletType)) {
      return NextResponse.json({ message: "Unknown wallet type" }, { status: 400 });
    }

    // The permission is chosen from the wallet being written, never from anything else in
    // the body — otherwise a wallet_business holder could reach a Store Wallet by changing
    // one field.
    const auth = await requireWalletSpendAccess(walletType);
    if (auth.error) return auth.error;
    const { payload, actor } = auth;

    // Every wallet write is rate limited per actor. Only recharge/initiate had one, so the
    // rest were bounded by nothing but how fast a script could post.
    try {
      await rateLimit(payload.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ message: "Customer is required" }, { status: 400 });
    }
    if (!clientRequestId || typeof clientRequestId !== "string") {
      return NextResponse.json({ message: "Missing request id" }, { status: 400 });
    }
    if (!transactionName || String(transactionName).trim().length < 2) {
      return NextResponse.json({ message: "Describe what this expense was for" }, { status: 400 });
    }
    if (!expenseCategory || typeof expenseCategory !== "string") {
      return NextResponse.json({ message: "Choose an expense category" }, { status: 400 });
    }

    /**
     * A bill is mandatory for managers, optional for admins.
     *
     * Not an arbitrary split: with caps and approvals gone, the bill is the only artefact
     * that distinguishes a real expense from an invented one, and a manager is the role
     * spending money that is neither theirs nor their company's.
     */
    if (actor.role === "Manager" && !proofUrl) {
      return NextResponse.json(
        { message: "Attach the bill or invoice for this expense" },
        { status: 400 }
      );
    }

    let amountPaise: number;
    try {
      amountPaise = parseAmountToPaise(body.amount, { label: "Expense amount" });
    } catch (err) {
      return NextResponse.json({ message: (err as Error).message }, { status: 400 });
    }

    await dbConnect();

    const [customer, category] = await Promise.all([
      Customer.findById(userId).select("name email role customerTypes upgradeStatus").lean() as Promise<
        | { name?: string; email?: string; role?: string; customerTypes?: string[]; upgradeStatus?: string }
        | null
      >,
      WalletExpenseCategory.findOne({ key: expenseCategory }).select("label isActive").lean() as Promise<
        { label?: string; isActive?: boolean } | null
      >,
    ]);

    if (!customer) return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    if (customer.role === "admin") {
      return NextResponse.json({ message: "Staff accounts do not hold wallets" }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ message: "Unknown expense category" }, { status: 400 });
    }
    // A deactivated category may still appear on historic rows, but must not accept new
    // spend — otherwise deactivating one would achieve nothing.
    if (category.isActive === false) {
      return NextResponse.json({ message: "That expense category is no longer available" }, { status: 400 });
    }

    if (walletType === "business") {
      const eligible = (customer.customerTypes || []).some((t) =>
        (BUSINESS_WALLET_TIERS as readonly string[]).includes(t)
      );
      if (!eligible) {
        return NextResponse.json(
          { message: "This customer is not eligible for a Business Wallet" },
          { status: 400 }
        );
      }

      /**
       * KYC gates spending, not funding. The customer was warned when they added money
       * that services cannot begin until it is approved; this is where that promise is
       * actually kept.
       */
      if (customer.upgradeStatus !== "approved") {
        return NextResponse.json(
          {
            message:
              "This customer's KYC is not approved yet. Services cannot be charged to the Business Wallet until it is.",
            code: "KYC_NOT_APPROVED",
          },
          { status: 409 }
        );
      }
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    try {
      const { transaction, wallet } = await runInTransaction((session) =>
        writeLedgerEntry({
          userId,
          walletType,
          type: "DEBIT",
          source: "expense",
          amountPaise,
          transactionName: String(transactionName).trim(),
          expenseCategory,
          actor,
          description: description ? String(description).trim() : undefined,
          referenceId: referenceId ? String(referenceId).trim() : undefined,
          proofUrl: proofUrl || undefined,
          clientRequestId,
          metadata: { recordedByIp: ip, recordedAt: new Date() },
          session,
        })
      );

      // After the commit, never inside it. A failed send must not roll back a debit that
      // has already happened, and these are the customer's only live view of the spend.
      void notifyCustomer({
        userId,
        email: customer.email,
        name: customer.name,
        amountPaise,
        walletType,
        categoryLabel: category.label || expenseCategory,
        actorName: actor.name,
      });

      void emailExpense({
        customerEmail: customer.email,
        customerName: customer.name || "Valued Customer",
        customerId: userId,
        amountPaise,
        walletType,
        categoryLabel: category.label || expenseCategory,
        description: String(transactionName).trim(),
        actorName: actor.name,
        actorRole: actor.role,
        balanceAfterPaise: wallet.availableBalance,
        receiptNumber: transaction.receiptNumber,
        hasBill: Boolean(proofUrl),
      });

      return NextResponse.json(
        {
          message: "Expense recorded",
          transactionId: String(transaction._id),
          receiptNumber: transaction.receiptNumber,
          balance: toRupees(wallet.availableBalance),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (err) {
      /**
       * The same clientRequestId arriving twice means the form was resubmitted, not that a
       * second expense happened. Returning the original entry with 200 is deliberate: from
       * the person's point of view the work *did* succeed, and an error here would invite
       * them to try again — which is exactly how the duplicate would eventually get in.
       */
      if (isDuplicateKeyError(err)) {
        const existing = (await findExistingByIdempotencyKey({ clientRequestId })) as
          | { _id?: unknown; receiptNumber?: string }
          | null;
        return NextResponse.json(
          {
            message: "Expense already recorded",
            transactionId: existing?._id ? String(existing._id) : undefined,
            receiptNumber: existing?.receiptNumber,
            duplicate: true,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      if (err instanceof InsufficientBalanceError || err instanceof WalletNotActiveError) {
        return NextResponse.json({ message: err.message }, { status: err.status });
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("[Wallet] Expense failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to record the expense" },
      { status: 500 }
    );
  }
}

/**
 * Emails the expense to the customer and to the business owner.
 *
 * Both, always. The customer's copy is the fraud control — with no approval step, noticing
 * a wrong charge is their only recourse. The admin's copy is the owner's live view of staff
 * spending, which no single customer's wallet can provide.
 *
 * Failures are logged and swallowed: the debit is already committed, and an email outage
 * must not turn a successful expense into a 500 that invites the operator to retry it.
 */
async function emailExpense(params: {
  customerEmail?: string;
  customerName: string;
  customerId: string;
  amountPaise: number;
  walletType: string;
  categoryLabel: string;
  description: string;
  actorName: string;
  actorRole: string;
  balanceAfterPaise: number;
  receiptNumber: string;
  hasBill: boolean;
}) {
  const walletLabel = params.walletType === "business" ? "Business Wallet" : "Store Wallet";

  try {
    const { emailService } = await import("@/lib/emailService");
    const { formatFullIST } = await import("@/lib/datetime");

    const tasks: Array<Promise<unknown>> = [];

    if (params.customerEmail) {
      tasks.push(
        emailService.sendWalletExpenseEmail({
          to: params.customerEmail,
          customerName: params.customerName,
          amount: toRupees(params.amountPaise),
          walletLabel,
          category: params.categoryLabel,
          description: params.description,
          spentBy: params.actorName,
          balanceAfter: toRupees(params.balanceAfterPaise),
          receiptNumber: params.receiptNumber,
          occurredAt: formatFullIST(new Date()),
        })
      );
    }

    tasks.push(
      emailService.sendAdminWalletExpenseAlert({
        customerName: params.customerName,
        customerId: params.customerId,
        amount: toRupees(params.amountPaise),
        walletLabel,
        category: params.categoryLabel,
        description: params.description,
        spentBy: params.actorName,
        spentByRole: params.actorRole,
        balanceAfter: toRupees(params.balanceAfterPaise),
        receiptNumber: params.receiptNumber,
        hasBill: params.hasBill,
      })
    );

    // allSettled, not all: the customer's copy must still go out if the admin's fails.
    await Promise.allSettled(tasks);
  } catch (err) {
    console.error("[Wallet] Failed to email expense notifications:", err);
  }
}

async function notifyCustomer(params: {
  userId: string;
  email?: string;
  name?: string;
  amountPaise: number;
  walletType: string;
  categoryLabel: string;
  actorName: string;
}) {
  try {
    const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
    const walletLabel = params.walletType === "business" ? "Business Wallet" : "Store Wallet";

    dispatchEventServer({
      eventType: "WALLET_DEBITED",
      category: "payments",
      actor: { id: "SYSTEM", name: "FlexSell Wholesale", role: "system" },
      recipient: {
        customerId: params.userId,
        email: params.email || "",
        name: params.name || "Valued Customer",
        role: "both",
      },
      entity: { type: "wallet", id: params.userId },
      data: {
        amount: toRupees(params.amountPaise),
        walletType: params.walletType,
        category: params.categoryLabel,
        // The acting person is named to the customer. With no approval step, this message
        // is their only real-time view of who is spending their money.
        message: `${formatPaise(params.amountPaise)} was spent from your ${walletLabel} on ${params.categoryLabel} by ${params.actorName}.`,
      },
    });
  } catch (err) {
    console.error("[Wallet] Failed to notify customer of expense:", err);
  }
}
