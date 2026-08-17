import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import WalletExpenseCategory from "@/models/WalletExpenseCategory";
import { requireWalletAdmin } from "@/lib/walletGuard";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";
import { SEED_EXPENSE_CATEGORIES } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

/**
 * Seeds the category list on first read.
 *
 * The list is data, not code — the whole point of a category field is that FlexSell can add
 * "Amazon Listing Fee" next month without a deploy. But an empty picker on day one would be
 * useless, so the constant bootstraps an empty collection and is never consulted again.
 */
async function ensureSeeded() {
  const count = await WalletExpenseCategory.estimatedDocumentCount();
  if (count > 0) return;

  await WalletExpenseCategory.insertMany(
    SEED_EXPENSE_CATEGORIES.map((c) => ({ ...c, isActive: true })),
    // Tolerates a concurrent first read seeding the same list.
    { ordered: false }
  ).catch(() => undefined);
}

/** Staff read the list to populate the expense form. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminOrManagerAuth();
    if (auth.error) return auth.error;

    await dbConnect();
    await ensureSeeded();

    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "1";
    const query = includeInactive ? {} : { isActive: true };

    const categories = await WalletExpenseCategory.find(query)
      .sort({ sortOrder: 1, label: 1 })
      .lean();

    return NextResponse.json(
      categories.map((c) => ({
        _id: String(c._id),
        key: c.key,
        label: c.label,
        colour: c.colour,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Category fetch failed:", error);
    return NextResponse.json({ message: "Failed to load expense categories" }, { status: 500 });
  }
}

/** Only an admin adds a category — a manager choosing their own labels defeats grouping. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireWalletAdmin();
    if (auth.error) return auth.error;

    const { key, label, colour, sortOrder } = await request.json();

    if (!key || !/^[a-z0-9_]+$/.test(key)) {
      return NextResponse.json(
        { message: "Key must be lowercase letters, numbers and underscores" },
        { status: 400 }
      );
    }
    if (!label || String(label).trim().length < 2) {
      return NextResponse.json({ message: "Label is required" }, { status: 400 });
    }

    await dbConnect();

    const existing = await WalletExpenseCategory.findOne({ key }).lean();
    if (existing) {
      return NextResponse.json({ message: "That category key already exists" }, { status: 409 });
    }

    const created = await WalletExpenseCategory.create({
      key,
      label: String(label).trim(),
      colour: colour || "#64748b",
      sortOrder: typeof sortOrder === "number" ? sortOrder : 500,
      isActive: true,
    });

    return NextResponse.json(
      { _id: String(created._id), key: created.key, label: created.label },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Category create failed:", error);
    return NextResponse.json({ message: "Failed to create the category" }, { status: 500 });
  }
}

/**
 * Renames or deactivates a category. The `key` is immutable.
 *
 * Renaming is safe because transactions store the key, not the label — historic rows follow
 * the new name automatically. Changing the key would orphan every row that referenced it,
 * which is why it is not offered.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireWalletAdmin();
    if (auth.error) return auth.error;

    const { key, label, colour, sortOrder, isActive } = await request.json();
    if (!key) return NextResponse.json({ message: "Category key is required" }, { status: 400 });

    await dbConnect();

    const updates: Record<string, unknown> = {};
    if (typeof label === "string" && label.trim()) updates.label = label.trim();
    if (typeof colour === "string") updates.colour = colour;
    if (typeof sortOrder === "number") updates.sortOrder = sortOrder;
    // Soft delete only. There is no DELETE handler on this route by design: removing a
    // category would break the label and the grouping on periods already shown to the
    // customer, including statements they have already downloaded.
    if (typeof isActive === "boolean") updates.isActive = isActive;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    const updated = await WalletExpenseCategory.findOneAndUpdate({ key }, { $set: updates }, { new: true });
    if (!updated) return NextResponse.json({ message: "Category not found" }, { status: 404 });

    return NextResponse.json(
      { _id: String(updated._id), key: updated.key, label: updated.label, isActive: updated.isActive },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Category update failed:", error);
    return NextResponse.json({ message: "Failed to update the category" }, { status: 500 });
  }
}
