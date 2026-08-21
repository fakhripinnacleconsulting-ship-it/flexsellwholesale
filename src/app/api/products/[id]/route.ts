import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import Collection from "@/models/Collection";
import Customer from "@/models/Customer";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";
import { productSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { revalidateProducts } from "@/lib/revalidate";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const product = await Product.findById(id);
    
    if (!product) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }
    
    return NextResponse.json(product);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrManagerAuth("catalog_products:update");
    if (auth.error) return auth.error;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    
    const parsedData = productSchema.partial().parse(body);
    
    // Zod `.partial()` still applies `.default()` to missing fields, which causes 
    // data erasure during partial updates (e.g., toggling isActive). 
    // We only keep fields that were actually sent in the request body.
    const updateData: any = {};
    for (const key of Object.keys(body)) {
      if (key in parsedData) {
        updateData[key] = (parsedData as any)[key];
      }
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    if (!updatedProduct) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }
    
    // The id is what purges this product's own page. Without it only the listings were
    // purged, so an edit showed up instantly on the catalogue and took up to 24 hours to
    // appear on the product's own page.
    await revalidateProducts(id);
    return NextResponse.json(updatedProduct);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminOrManagerAuth("catalog_products:delete");
    if (auth.error) return auth.error;

    await dbConnect();
    const { id } = await params;
    
    const deletedProduct = await Product.findByIdAndDelete(id);
    
    if (!deletedProduct) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }
    
    // Cleanup references in Collections and Customer wishlists asynchronously
    await Promise.all([
      Collection.updateMany({ productIds: id }, { $pull: { productIds: id } }),
      Customer.updateMany({ wishlist: id }, { $pull: { wishlist: id } }),
    ]);

    await revalidateProducts(id);
    return NextResponse.json({ message: "Product deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete product" }, { status: 500 });
  }
}
