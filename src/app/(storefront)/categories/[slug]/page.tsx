import type { Metadata } from "next";
import { searchService } from "@/services/searchService";
import { categoryService } from "@/services/categoryService";
import { CategoryCatalog } from "@/components/storefront/CategoryCatalog";
import { constructMetadata, generateCategorySchema, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 86400; // 24h safety net; freshness comes from on-demand revalidation (lib/revalidate.ts)

/** Category count is small, so pre-build them all — every one is a warm-cache hit. */
export async function generateStaticParams() {
  try {
    const categories = await categoryService.getCategories();
    return categories.filter((c) => c.slug).map((c) => ({ slug: c.slug }));
  } catch (err) {
    console.error("generateStaticParams (categories) notice:", (err as any)?.message || err);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const categories = await categoryService.getCategories();
    const category = categories.find((c) => c.slug === slug);
    if (!category) {
      return constructMetadata({ title: "Category Catalog", path: `/categories/${slug}` });
    }
    return constructMetadata({
      title: `${category.name} Wholesale Products & Sourcing`,
      description: category.description || `Source factory direct wholesale items in ${category.name} at low MOQs.`,
      keywords: [category.name, `wholesale ${category.name}`, `${category.name} bulk buy`, `factory direct ${category.name}`],
      image: category.image,
      path: `/categories/${category.slug}`,
    });
  } catch (err) {
    return constructMetadata({
      title: "Category Wholesale Catalog",
      path: `/categories/${slug}`,
    });
  }
}

export default async function CategoryProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categories = await categoryService.getCategories();
  const currentCategory = categories.find((c) => c.slug === slug);

  // Fetch only products belonging to this category (or all if not found) instead of entire catalog
  const products = currentCategory
    ? (await searchService.searchProducts({ categoryId: currentCategory._id, limit: 100 })).products
    : [];

  const categoryJsonLd = currentCategory ? generateCategorySchema(currentCategory) : null;
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Categories", href: "/categories" },
    { label: currentCategory ? currentCategory.name : slug, href: `/categories/${slug}` }
  ]);
  
  return (
    <>
      {categoryJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <CategoryCatalog slug={slug} initialProducts={products} initialCategories={categories} />
    </>
  );
}
