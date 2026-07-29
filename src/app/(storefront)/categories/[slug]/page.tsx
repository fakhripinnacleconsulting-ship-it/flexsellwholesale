import type { Metadata } from "next";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { CategoryCatalog } from "@/components/storefront/CategoryCatalog";
import { constructMetadata, generateCategorySchema, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 60;

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
  const [products, categories] = await Promise.all([
    productService.getProducts(),
    categoryService.getCategories()
  ]);

  const currentCategory = categories.find((c) => c.slug === slug);
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
