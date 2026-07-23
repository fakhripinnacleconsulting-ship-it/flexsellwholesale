"use client";

import React, { useState, useEffect, useRef } from "react";
import { Customer } from "@/types";
import { customerService } from "@/services/customerService";

interface CustomerSearchPickerProps {
  onSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
  placeholder?: string;
  error?: string;
}

export default function CustomerSearchPicker({
  onSelect,
  selectedCustomer,
  placeholder = "Search customer by name, email, company or ID...",
  error,
}: CustomerSearchPickerProps) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Sync display search text with selected customer
  useEffect(() => {
    if (selectedCustomer) {
      setSearch(
        selectedCustomer.company
          ? `${selectedCustomer.name} (${selectedCustomer.company})`
          : selectedCustomer.name
      );
    } else {
      setSearch("");
    }
  }, [selectedCustomer]);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term back to match selected customer
        if (selectedCustomer) {
          setSearch(
            selectedCustomer.company
              ? `${selectedCustomer.name} (${selectedCustomer.company})`
              : selectedCustomer.name
          );
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedCustomer]);

  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await customerService.getCustomers({ search: query, limit: 10 });
      if (res && Array.isArray(res)) {
        setCustomers(res);
      } else if (res && Array.isArray(res.customers)) {
        setCustomers(res.customers);
      } else {
        setCustomers([]);
      }
    } catch (err) {
      console.error("Failed to query customers:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!val.trim()) {
      setCustomers([]);
      onSelect(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      searchCustomers(val);
    }, 400);
  };

  const handleSelectCustomer = (customer: Customer) => {
    onSelect(customer);
    setSearch(
      customer.company
        ? `${customer.name} (${customer.company})`
        : customer.name
    );
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full px-4 py-2 text-sm bg-white dark:bg-zinc-900 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all ${
            error
              ? "border-red-500 focus:ring-red-500"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        />
        {loading && (
          <div className="absolute right-3 top-2.5 flex items-center justify-center">
            <svg
              className="animate-spin h-5 w-5 text-emerald-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        )}
        {selectedCustomer && !loading && (
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setSearch("");
              setCustomers([]);
            }}
            className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && (customers.length > 0 || (search.trim() && !loading)) && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {customers.length > 0 ? (
            customers.map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => handleSelectCustomer(c)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex flex-col border-b border-zinc-100 dark:border-zinc-800/80 last:border-b-0 transition-colors"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {c.name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap gap-x-2">
                  {c.company && <span>🏢 {c.company}</span>}
                  {c.email && <span>✉️ {c.email}</span>}
                  {c.phone && <span>📞 {c.phone}</span>}
                  {c.gstin && <span className="text-emerald-600 dark:text-emerald-400 font-mono">GST: {c.gstin}</span>}
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400 text-center">
              No matching customers found
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
