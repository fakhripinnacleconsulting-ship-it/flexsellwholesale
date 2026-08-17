"use client";

import * as React from "react";
import { formatPrice } from "@/lib/utils";
import { formatFullIST } from "@/lib/datetime";
import { WALLET_TERMS_TEXT } from "@/lib/walletConstants";
import type { WalletTransactionView } from "@/types/wallet";

interface WalletReceiptDocumentProps {
  transaction: WalletTransactionView;
  customerName: string;
  customerEmail?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerGstin?: string;
}

/**
 * A printable receipt for one wallet transaction.
 *
 * A **receipt**, deliberately not a tax invoice. A recharge moves money into a prepaid
 * balance and is generally not a supply; a service expense usually is, and needs a GST
 * invoice with GSTIN, SAC and a tax breakup that this document does not attempt. The
 * category-to-document mapping is a question for the accountant, so until it is answered
 * this prints the honest thing rather than something that looks like a tax document.
 *
 * Order payments carry a link to the order's own invoice instead of issuing a second
 * document — two invoices for one supply is a real accounting problem.
 */
export function WalletReceiptDocument({
  transaction,
  customerName,
  customerEmail,
  sellerName = "FlexSell Wholesale",
  sellerAddress,
  sellerGstin,
}: WalletReceiptDocumentProps) {
  const isCredit = transaction.direction === "credit";
  const walletLabel = transaction.walletType === "business" ? "Business Wallet" : "Store Wallet";

  const rows: Array<[string, string | undefined]> = [
    ["Receipt Number", transaction.receiptNumber],
    ["Transaction ID", transaction._id],
    ["Date & Time", formatFullIST(transaction.createdAt)],
    ["Wallet", walletLabel],
    ["Type", isCredit ? "Credit" : "Debit"],
    ["Particulars", transaction.transactionName],
    ["Category", transaction.categoryLabel],
    ["Description", transaction.description],
    ["Reference", transaction.referenceId],
    ["Order", transaction.orderId],
    // Named on the customer's own copy, not only internally. With no approval step before a
    // staff spend, this is part of what makes the record answerable.
    ["Recorded By", transaction.actedByRole === "Customer" ? undefined : transaction.actedBy],
    ["Status", transaction.status === "success" ? "Completed" : transaction.status],
  ];

  return (
    <div
      className="mx-auto max-w-[210mm] bg-white p-10 text-[#0f172a] print:p-0"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      <div className="flex items-start justify-between border-b-2 border-[#10b981] pb-4">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Flexsell%20Logo.png" alt="Flexsell" className="h-12 w-auto object-contain print-logo" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{sellerName}</h1>
            {sellerAddress && <p className="mt-1 max-w-xs text-[11px] text-[#475569]">{sellerAddress}</p>}
            {sellerGstin && <p className="text-[11px] text-[#475569]">GSTIN: {sellerGstin}</p>}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#10b981]">
            Wallet Transaction Receipt
          </h2>
          <p className="mt-1 font-mono text-xs">{transaction.receiptNumber}</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Issued To</p>
        <p className="mt-0.5 text-sm font-bold">{customerName}</p>
        {customerEmail && <p className="text-[11px] text-[#475569]">{customerEmail}</p>}
      </div>

      <div className="mt-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
          {isCredit ? "Amount Added" : "Amount Debited"}
        </p>
        <p className="mt-1 text-3xl font-bold" style={{ color: isCredit ? "#10b981" : "#0f172a" }}>
          {/* U+2212 minus, not a hyphen — a hyphen reads as a dash in print. */}
          {isCredit ? "+" : "−"}
          {formatPrice(transaction.amount)}
        </p>
      </div>

      <table className="mt-6 w-full border-collapse text-[11px]">
        <tbody>
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <tr key={label} className="border-b border-[#e2e8f0]">
                <th scope="row" className="w-2/5 py-2 text-left font-semibold text-[#64748b]">
                  {label}
                </th>
                <td className="py-2 font-medium">{value}</td>
              </tr>
            ))}
          <tr className="border-b-2 border-[#0f172a]">
            <th scope="row" className="py-2.5 text-left text-xs font-bold">
              Balance After This Transaction
            </th>
            <td className="py-2.5 text-xs font-bold">{formatPrice(transaction.balanceAfter)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-8 border-t border-[#e2e8f0] pt-4 text-[9px] leading-relaxed text-[#64748b]">
        <p className="font-semibold">{WALLET_TERMS_TEXT}</p>
        <p className="mt-2">
          This is a computer-generated receipt for a wallet transaction and does not require a
          signature. It is not a tax invoice.
          {transaction.orderId
            ? " The tax invoice for this purchase is issued with the order."
            : ""}
        </p>
        <p className="mt-1">Generated on {formatFullIST(new Date())}.</p>
      </div>
    </div>
  );
}
