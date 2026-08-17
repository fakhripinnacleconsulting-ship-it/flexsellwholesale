import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatFullIST } from "@/lib/datetime";
import { formatPrice } from "@/lib/utils";
import type { WalletTransactionView } from "@/types/wallet";

const pdfFormatPrice = (amount: number) => `Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function downloadStatementPdf(
  transactions: WalletTransactionView[],
  customerName: string,
  walletLabel: string,
  dateRangeLabel: string
) {
  const doc = new jsPDF();
  
  let startY = 22;

  // Add Logo
  try {
    const response = await fetch("/Flexsell%20Logo.png");
    const blob = await response.blob();
    const base64data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    doc.addImage(base64data, "PNG", 14, 14, 38, 12);
    startY = 36;
  } catch (e) {
    console.error("Failed to load logo for PDF", e);
  }
  
  // Header
  doc.setFontSize(18);
  doc.text("Wallet Statement", 14, startY);
  
  doc.setFontSize(11);
  doc.text(`Customer: ${customerName}`, 14, startY + 8);
  doc.text(`Wallet: ${walletLabel}`, 14, startY + 14);
  doc.text(`Period: ${dateRangeLabel}`, 14, startY + 20);
  

  
  // Table
  const tableColumn = ["Date", "Particulars", "Category", "Credit", "Debit", "Balance"];
  const tableRows: string[][] = [];

  transactions.forEach((tx) => {
    const isCredit = tx.direction === "credit";
    const amountStr = pdfFormatPrice(tx.amount);
    
    // Clean particulars string by replacing \n with a space
    const particularsStr = `${tx.transactionName}${tx.description ? ` - ${tx.description}` : ""}`;
    
    tableRows.push([
      formatFullIST(tx.createdAt),
      particularsStr,
      tx.categoryLabel || "-",
      isCredit ? amountStr : "-",
      !isCredit ? amountStr : "-",
      pdfFormatPrice(tx.balanceAfter)
    ]);
  });

  autoTable(doc, {
    startY: startY + 28,
    head: [tableColumn],
    body: tableRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
  });

  doc.save(`Wallet_Statement_${customerName.replace(/\s+/g, "_")}.pdf`);
}
