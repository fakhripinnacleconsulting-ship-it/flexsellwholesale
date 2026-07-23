import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Search } from "lucide-react";
import { Category } from "@/types";

interface ProductFiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  selectedHsn: string;
  setSelectedHsn: (val: string) => void;
  selectedStatus: string;
  setSelectedStatus: (val: string) => void;
  selectedStockStatus: string;
  setSelectedStockStatus: (val: string) => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  activeCategories: Category[];
  hsns: any[];
}

export function ProductFilters({
  searchTerm, setSearchTerm,
  selectedCategory, setSelectedCategory,
  selectedHsn, setSelectedHsn,
  selectedStatus, setSelectedStatus,
  selectedStockStatus, setSelectedStockStatus,
  sortBy, setSortBy,
  activeCategories, hsns
}: ProductFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Text Search */}
        <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by title or SKU..." 
            className="pl-9" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Category Filter */}
        <select
          className="h-10 rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary font-semibold text-foreground w-full"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {activeCategories.map(cat => (
            <option key={cat._id} value={cat._id}>{cat.name}</option>
          ))}
        </select>

        {/* HSN Filter */}
        <select
          className="h-10 rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary font-semibold text-foreground w-full"
          value={selectedHsn}
          onChange={(e) => setSelectedHsn(e.target.value)}
        >
          <option value="all">All HSN Codes</option>
          {hsns.map(h => (
            <option key={h._id} value={h.code}>HSN {h.code}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="h-10 rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary font-semibold text-foreground w-full"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>

        {/* Stock Filter */}
        <select
          className="h-10 rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary font-semibold text-foreground w-full"
          value={selectedStockStatus}
          onChange={(e) => setSelectedStockStatus(e.target.value)}
        >
          <option value="all">All Stock Status</option>
          <option value="instock">In Stock (&gt;20)</option>
          <option value="lowstock">Low Stock (1-20)</option>
          <option value="outofstock">Out of Stock</option>
        </select>

        {/* Sorter */}
        <select
          className="h-10 rounded-md border bg-background px-3 py-2 text-xs focus:ring-2 focus:ring-primary font-semibold text-foreground w-full col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="title-asc">Title: A to Z</option>
          <option value="title-desc">Title: Z to A</option>
          <option value="price-asc">Price: Low to High</option>
          <option value="price-desc">Price: High to Low</option>
          <option value="stock-asc">Stock: Low to High</option>
          <option value="stock-desc">Stock: High to Low</option>
        </select>
      </CardContent>
    </Card>
  );
}
