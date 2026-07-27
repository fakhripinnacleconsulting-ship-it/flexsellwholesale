"use client";

import React, { useState } from "react";
import { Building, Copy, Check, Shield } from "lucide-react";
import { DropshippingBankDetails, DropshippingGSTDetails, DropshippingCMSData } from "@/lib/seedDropshippingCMS";
import { useToastStore } from "@/stores/toastStore";

interface DropshippingBankAndGSTProps {
  data?: DropshippingCMSData;
  bank?: DropshippingBankDetails;
  gst?: DropshippingGSTDetails;
}

export function DropshippingBankAndGST(props: DropshippingBankAndGSTProps) {
  const { addToast } = useToastStore();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const bank = props.data?.bankDetails || props.bank || {
    accountName: "CONTINENTAL MERCANTILE ECOMMERCE GROUP",
    bankName: "AXIS BANK",
    accountNumber: "924020023471011",
    ifscCode: "UTIB0003463",
    branch: "PEERGATE BRANCH, BHOPAL",
    accountType: "Current Account",
  };

  const gst = props.data?.gstDetails || props.gst || {
    companyName: "CONTINENTAL MERCANTILE ECOMMERCE GROUP",
    gstNo: "23ABBPQ0103G1ZG",
    contactName: "FlexSell Support",
  };

  const handleCopy = (text: string, label: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    addToast(`${label} copied to clipboard!`, "success");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <section className="py-16 md:py-20 bg-slate-50 dark:bg-slate-900/60 px-4 sm:px-6 lg:px-8 border-b border-border/40">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Official Payment & GST Verification Details
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
            Verify official company bank credentials for membership subscription transfers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company & GST Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Entity & GST Verification
                  </h3>
                  <span className="text-xs text-slate-500">Registered Business</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                    Company Legal Name
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {gst.companyName}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                    GSTIN Identification
                  </span>
                  <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {gst.gstNo}
                    </span>
                    <button
                      onClick={() => handleCopy(gst.gstNo, "GSTIN", "gstin")}
                      className="text-slate-400 hover:text-emerald-500 p-1 transition-colors"
                      title="Copy GSTIN"
                    >
                      {copiedKey === "gstin" ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AXIS Bank Account Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {bank.bankName} Account Details
                  </h3>
                  <span className="text-xs text-slate-500">{bank.accountType}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase block">Account Number</span>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{bank.accountNumber}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(bank.accountNumber, "Account Number", "acc")}
                    className="text-slate-400 hover:text-emerald-500 p-1"
                  >
                    {copiedKey === "acc" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase block">IFSC Code</span>
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{bank.ifscCode}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(bank.ifscCode, "IFSC Code", "ifsc")}
                    className="text-slate-400 hover:text-emerald-500 p-1"
                  >
                    {copiedKey === "ifsc" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="text-xs text-slate-500 pt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Branch:</span> {bank.branch}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
