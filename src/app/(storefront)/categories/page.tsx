import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { categoryService } from "@/services/categoryService";
import { productService } from "@/services/productService";

export const revalidate = 3600;

export default async function CategoriesPage() {
  const categories = await categoryService.getCategories();
  const products = await productService.getProducts();

  // Filter categories to only those containing at least 1 product
  const activeCategories = categories.filter(category => {
    return products.some(product => product.categoryId === category._id);
  });

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-12 text-foreground w-full">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">All Categories</h1>
        <p className="text-muted-foreground mt-2">Browse wholesale catalog lines direct from verified factories.</p>
      </div>

      {activeCategories.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-secondary/15">
          <p className="text-sm text-muted-foreground">No categories containing products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {activeCategories.map((category) => (
            <Link key={category._id} href={`/categories/${category.slug}`}>
              <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer text-center overflow-hidden h-full flex flex-col group bg-card border-border">
                <div className="aspect-square relative bg-secondary overflow-hidden">
                  <Image
                    src={category.image || `https://placehold.co/400x400/10b981/ffffff?text=${encodeURIComponent(category.name)}`}
                    alt={category.name}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-3 mt-auto bg-card border-t border-border">
                  <p className="text-sm font-bold text-foreground line-clamp-2">{category.name}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
