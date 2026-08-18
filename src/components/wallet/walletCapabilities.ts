/**
 * What a wallet surface may *draw*, for one viewer.
 *
 * The customer screen and the staff panel render the same sections in the same order — the
 * only thing that legitimately differs between them is which actions appear. Deriving that
 * set in two places is how the two screens drift apart, so it is derived once, here.
 *
 * **Capabilities decide what is drawn. They never decide what is allowed.**
 * Every action still passes `requireWalletSpendAccess` / `requireWalletAdmin` on the server
 * ([lib/walletGuard.ts](src/lib/walletGuard.ts)). Hiding a button is a courtesy to the
 * viewer, not a security boundary — a hidden button that was somehow clicked would still be
 * refused server-side.
 */

export interface WalletCapabilities {
  /** Top up by card/UPI — the customer for their own wallet, staff on a customer's behalf. */
  canAddMoneyOnline: boolean;
  /** Record money received as cash, bank transfer, UPI or cheque. Admin only. */
  canAddFundsOffline: boolean;
  /** Spend a customer's balance on a service. Admin, or a manager with the wallet grant. */
  canRecordExpense: boolean;
  /** Move Store → Business. Admin only, one direction only. */
  canTransfer: boolean;
  /** Freeze, reactivate or close. Admin only. */
  canFreeze: boolean;
  /** Reverse a ledger entry. Admin only — the only way to undo, and it is append-only. */
  canReverse: boolean;
  /** Show who recorded each entry. Staff only; customers see their own passbook without it. */
  canViewStaffNotes: boolean;
}

/**
 * A customer looking at their own wallets.
 *
 * They may add their own money and nothing else: every other action either creates money
 * that did not arrive (offline credit), spends on their behalf (expense), or is irreversible
 * (transfer, freeze). Those are staff decisions with an audit trail attached.
 */
export function customerCapabilities(options: { onlineRechargeAvailable: boolean }): WalletCapabilities {
  return {
    canAddMoneyOnline: options.onlineRechargeAvailable,
    canAddFundsOffline: false,
    canRecordExpense: false,
    canTransfer: false,
    canFreeze: false,
    canReverse: false,
    canViewStaffNotes: false,
  };
}

/**
 * Staff acting on a customer's wallets.
 *
 * The split is deliberate and mirrors `walletGuard`: a manager may **spend** a balance that
 * already exists, but only an admin may **create money** (offline credit), **move it**
 * between wallets, **return it** (reversal) or **stop it** (freeze). Those four have no
 * gateway confirming them, so they are not delegable.
 */
export function staffCapabilities(options: {
  isAdmin: boolean;
  /** True when the acting manager holds the exact wallet_store / wallet_business grant. */
  hasWalletSpendGrant: boolean;
  onlineRechargeAvailable: boolean;
}): WalletCapabilities {
  const { isAdmin, hasWalletSpendGrant, onlineRechargeAvailable } = options;

  return {
    canAddMoneyOnline: onlineRechargeAvailable,
    canAddFundsOffline: isAdmin,
    canRecordExpense: isAdmin || hasWalletSpendGrant,
    canTransfer: isAdmin,
    canFreeze: isAdmin,
    canReverse: isAdmin,
    canViewStaffNotes: true,
  };
}
