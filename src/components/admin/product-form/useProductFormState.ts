import * as React from "react";
import { Product, Category, ColorVariant, APlusBlock } from "@/types";
import { useRouter } from "next/navigation";
import { useProductStore } from "@/stores/productStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useHsnStore } from "@/stores/hsnStore";
import { useToastStore } from "@/stores/toastStore";
import { parseWeightToGrams, parseDimensionsToCm } from "@/lib/priceTierHelper";

export interface ProductFormContextProps {
  productId?: string;
  existingProduct: Product | null;
  categories: Category[];
  hsns: any[];
  title: string;
  setTitle: (t: string) => void;
  description: string;
  setDescription: (d: string) => void;
  categoryId: string;
  setCategoryId: (c: string) => void;
  tagsText: string;
  setTagsText: (t: string) => void;
  cardTagsText: string;
  setCardTagsText: (t: string) => void;
  hsnCode: string;
  setHsnCode: (c: string) => void;
  priceIncludesGst: boolean;
  setPriceIncludesGst: (b: boolean) => void;
  packagingCharge: number;
  setPackagingCharge: (p: number) => void;
  packagingChargeType: "per_unit" | "per_order";
  setPackagingChargeType: (t: "per_unit" | "per_order") => void;
  defaultPriceTier: "B2C" | "B2B" | "Dropshipping";
  setDefaultPriceTier: (t: "B2C" | "B2B" | "Dropshipping") => void;
  seoTitle: string;
  setSeoTitle: (t: string) => void;
  seoDescription: string;
  setSeoDescription: (d: string) => void;
  seoKeywords: string;
  setSeoKeywords: (k: string) => void;
  fieldVisibility: {
    showDescription: boolean;
    showSizes: boolean;
    showWeights: boolean;
    showDimensions: boolean;
    showImages: boolean;
  };
  setFieldVisibility: React.Dispatch<React.SetStateAction<{
    showDescription: boolean;
    showSizes: boolean;
    showWeights: boolean;
    showDimensions: boolean;
    showImages: boolean;
  }>>;
  variantsList: ColorVariant[];
  setVariantsList: React.Dispatch<React.SetStateAction<ColorVariant[]>>;
  variantSizes: Record<number, string>;
  setVariantSizes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  variantWeights: Record<number, string>;
  setVariantWeights: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  newImageUrl: Record<number, string>;
  setNewImageUrl: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  editorMode: "edit" | "preview";
  setEditorMode: (m: "edit" | "preview") => void;
  aPlusBlocks: APlusBlock[];
  setAPlusBlocks: React.Dispatch<React.SetStateAction<APlusBlock[]>>;
  isSaving: boolean;

  // Product-level Barcode
  barcode: string;
  setBarcode: (b: string) => void;
  barcodeSource: "auto" | "manual" | "image";
  setBarcodeSource: (s: "auto" | "manual" | "image") => void;
  barcodeImage: string | null;
  setBarcodeImage: (img: string | null) => void;
  handleProductBarcodeImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;

  // Handlers
  addVariant: () => void;
  removeVariant: (index: number) => void;
  generateSubVariants: (idx: number, sizesStr: string, weightsStr: string) => void;
  updateSubVariantField: (colorIdx: number, subId: string, field: string, value: any) => void;
  removeSubVariant: (colorIdx: number, subId: string) => void;
  updateVariantField: (index: number, field: keyof ColorVariant, value: any) => void;
  autoGenerateSEO: () => void;
  handleSave: (e: React.FormEvent) => void;
  handleVariantImageUpload: (e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) => Promise<void>;
  handleSubVariantBarcodeImageUpload: (e: React.ChangeEvent<HTMLInputElement>, colorIdx: number, subId: string) => Promise<void>;
  handleAddImageUrl: (variantIndex: number) => Promise<void>;
  addAPlusBlock: () => void;
  moveAPlusBlock: (index: number, direction: "up" | "down") => void;
  removeAPlusBlock: (id: string) => void;
  handleBlockImageUpload: (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => Promise<void>;
}

export function useProductFormState(
  productId?: string,
  initialProducts: Product[] = [],
  initialCategories: Category[] = []
): ProductFormContextProps {
  const router = useRouter();
  const { products, initializeProducts, addProduct, updateProduct } = useProductStore();
  const { categories, initializeCategories } = useCategoryStore();
  const { hsns, initializeHsns } = useHsnStore();
  const { addToast } = useToastStore();

  React.useEffect(() => {
    initializeProducts(initialProducts);
    initializeCategories(initialCategories, true);
    initializeHsns();
  }, [initialProducts, initialCategories, initializeProducts, initializeCategories, initializeHsns]);

  const activeProducts = products.length > 0 ? products : initialProducts;
  const activeCategories = categories.length > 0 ? categories : initialCategories;

  const existingProduct = React.useMemo(() => {
    if (!productId) return null;
    return activeProducts.find(p => p._id === productId) || null;
  }, [productId, activeProducts]);

  // States
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [tagsText, setTagsText] = React.useState("");
  const [cardTagsText, setCardTagsText] = React.useState("");
  const [hsnCode, setHsnCode] = React.useState("3924");
  const [priceIncludesGst, setPriceIncludesGst] = React.useState(true);
  const [packagingCharge, setPackagingCharge] = React.useState<number>(0);
  const [packagingChargeType, setPackagingChargeType] = React.useState<"per_unit" | "per_order">("per_unit");
  const [defaultPriceTier, setDefaultPriceTier] = React.useState<"B2C" | "B2B" | "Dropshipping">("B2C");
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");
  const [seoKeywords, setSeoKeywords] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Auto select default category if categoryId is empty for a new product
  React.useEffect(() => {
    if (!categoryId && activeCategories.length > 0 && !existingProduct) {
      setCategoryId(activeCategories[0]._id);
    }
  }, [activeCategories, categoryId, existingProduct]);

  // Product-level Barcode States
  const [barcode, setBarcode] = React.useState("");
  const [barcodeSource, setBarcodeSource] = React.useState<"auto" | "manual" | "image">("auto");
  const [barcodeImage, setBarcodeImage] = React.useState<string | null>(null);

  const [fieldVisibility, setFieldVisibility] = React.useState({
    showDescription: true,
    showSizes: true,
    showWeights: true,
    showDimensions: true,
    showImages: true,
  });

  const [variantsList, setVariantsList] = React.useState<ColorVariant[]>([]);

  const [variantSizes, setVariantSizes] = React.useState<Record<number, string>>({});
  const [variantWeights, setVariantWeights] = React.useState<Record<number, string>>({});
  const [newImageUrl, setNewImageUrl] = React.useState<Record<number, string>>({});
  const [editorMode, setEditorMode] = React.useState<"edit" | "preview">("edit");
  const [aPlusBlocks, setAPlusBlocks] = React.useState<APlusBlock[]>([]);

  // Load existing details
  React.useEffect(() => {
    if (existingProduct) {
      setTitle(existingProduct.title);
      setDescription(existingProduct.description);
      setCategoryId(existingProduct.categoryId);
      setTagsText(existingProduct.tags.join(", "));
      setCardTagsText(existingProduct.cardTags?.join(", ") || "");
      setAPlusBlocks(existingProduct.aPlusContent || []);
      setHsnCode(existingProduct.hsnCode || "3924");
      setPriceIncludesGst(existingProduct.priceIncludesGst ?? true);
      setPackagingCharge(existingProduct.packagingCharge ?? 0);
      setPackagingChargeType(existingProduct.packagingChargeType || "per_unit");
      setDefaultPriceTier(existingProduct.defaultPriceTier || "B2C");
      setSeoTitle(existingProduct.seoTitle || "");
      setSeoDescription(existingProduct.seoDescription || "");
      setSeoKeywords(existingProduct.seoKeywords || "");

      setBarcode(existingProduct.barcode || "");
      setBarcodeSource(existingProduct.barcodeSource || (existingProduct.barcodeImage ? "image" : existingProduct.barcode ? "manual" : "auto"));
      setBarcodeImage(existingProduct.barcodeImage || null);

      setFieldVisibility(existingProduct.fieldVisibility || {
        showDescription: true,
        showSizes: true,
        showWeights: true,
        showDimensions: true,
        showImages: true,
      });

      if (existingProduct.colorVariants && existingProduct.colorVariants.length > 0) {
        const normalizedVariants = existingProduct.colorVariants.map(v => {
          const parsedDim = parseDimensionsToCm(v.dimensions);
          const lengthCm = (v.lengthCm !== undefined && v.lengthCm !== null && v.lengthCm > 0) ? v.lengthCm : parsedDim.lengthCm;
          const breadthCm = (v.breadthCm !== undefined && v.breadthCm !== null && v.breadthCm > 0) ? v.breadthCm : parsedDim.breadthCm;
          const heightCm = (v.heightCm !== undefined && v.heightCm !== null && v.heightCm > 0) ? v.heightCm : parsedDim.heightCm;
          return {
            ...v,
            lengthCm,
            breadthCm,
            heightCm,
            packagingCharge: v.packagingCharge ?? 0,
            packagingChargeType: v.packagingChargeType || "per_unit",
            dimensions: v.dimensions || `${lengthCm}x${breadthCm}x${heightCm} cm`,
            subVariants: (v.subVariants || []).map(sv => ({
              ...sv,
              packagingCharge: sv.packagingCharge ?? 0,
              packagingChargeType: sv.packagingChargeType || "per_unit",
              weightGrams: (sv.weightGrams !== undefined && sv.weightGrams !== null && sv.weightGrams > 0)
                ? sv.weightGrams
                : parseWeightToGrams(sv.weight || "250g")
            })),
            images: (v.images || []).map((img, imgIdx) => {
              if (typeof img === "string") {
                return {
                  url: img,
                  alt: `${existingProduct.title} - ${v.color} - Image ${imgIdx + 1}`
                };
              }
              return {
                url: img.url || "",
                alt: img.alt || `${existingProduct.title} - ${v.color} - Image ${imgIdx + 1}`
              };
            }).filter(img => Boolean(img.url && img.url.trim()))
          };
        });
        setVariantsList(normalizedVariants);

        const initialSizes: Record<number, string> = {};
        const initialWeights: Record<number, string> = {};

        normalizedVariants.forEach((v, idx) => {
          const uniqueSizes = Array.from(new Set((v.subVariants || []).map(sv => sv.size))).filter(Boolean);
          const uniqueWeights = Array.from(new Set((v.subVariants || []).map(sv => sv.weight))).filter(Boolean);
          initialSizes[idx] = uniqueSizes.join(", ");
          initialWeights[idx] = uniqueWeights.join(", ");
        });

        setVariantSizes(initialSizes);
        setVariantWeights(initialWeights);
      }
    } else {
      if (activeCategories.length > 0) {
        setCategoryId(activeCategories[0]._id);
      }
    }
  }, [existingProduct, activeCategories]);

  // Handlers
  const addVariant = () => {
    setVariantsList(prev => [
      ...prev,
      {
        color: `New Color ${prev.length + 1}`,
        dimensions: "15x12x8 cm",
        lengthCm: 15,
        breadthCm: 12,
        heightCm: 8,
        images: [],
        subVariants: [{
          id: `sv-${Date.now()}`,
          size: "Standard",
          weight: "250g",
          weightGrams: 250,
          mrp: 0,
          b2cPrice: 0,
          b2bPrice: 0,
          dropshippingPrice: 0,
          b2bMoq: null,
          discount: 0,
          stock: 50,
          sku: ""
        }]
      }
    ]);
  };

  const removeVariant = (index: number) => {
    if (variantsList.length === 0) return;
    setVariantsList(prev => prev.filter((_, i) => i !== index));

    const shiftKeys = (prev: Record<number, any>) => {
      const copy = { ...prev };
      delete copy[index];
      const newMap: Record<number, any> = {};
      Object.keys(copy).forEach(kStr => {
        const k = parseInt(kStr, 10);
        if (k > index) {
          newMap[k - 1] = copy[k];
        } else {
          newMap[k] = copy[k];
        }
      });
      return newMap;
    };

    setVariantSizes(prev => shiftKeys(prev));
    setVariantWeights(prev => shiftKeys(prev));
    setNewImageUrl(prev => shiftKeys(prev));
  };

  const generateSubVariants = (idx: number, sizesStr: string, weightsStr: string) => {
    const sizes = sizesStr.split(",").map(s => s.trim()).filter(Boolean);
    const weights = weightsStr.split(",").map(w => w.trim()).filter(Boolean);
    if (sizes.length === 0) sizes.push("Standard");
    if (weights.length === 0) weights.push("250g");

    setVariantsList(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newSubVariants: any[] = [];
      let counter = 1;
      sizes.forEach(size => {
        weights.forEach(weight => {
          const existing = item.subVariants.find(sv => sv.size === size && sv.weight === weight);
          const parsedGrams = parseWeightToGrams(weight);
          if (existing) {
            newSubVariants.push({
              ...existing,
              weightGrams: (existing.weightGrams !== undefined && existing.weightGrams !== null && existing.weightGrams > 0)
                ? existing.weightGrams
                : parsedGrams
            });
          } else {
            newSubVariants.push({
              id: `sv-${Date.now()}-${counter}`,
              size,
              weight,
              weightGrams: parsedGrams,
              mrp: item.subVariants[0]?.mrp || 0,
              b2cPrice: item.subVariants[0]?.b2cPrice || 0,
              b2bPrice: item.subVariants[0]?.b2bPrice || 0,
              dropshippingPrice: item.subVariants[0]?.dropshippingPrice || 0,
              b2bMoq: item.subVariants[0]?.b2bMoq || null,
              discount: item.subVariants[0]?.discount || 0,
              stock: 50,
              sku: `${item.subVariants[0]?.sku || 'SKU'}-${counter}`
            });
          }
          counter++;
        });
      });
      return { ...item, subVariants: newSubVariants };
    }));
  };

  const updateSubVariantField = (colorIdx: number, subId: string, field: string, value: any) => {
    setVariantsList(prev => prev.map((item, idx) => {
      if (idx !== colorIdx) return item;
      const newSubs = item.subVariants.map(sv => {
        if (sv.id !== subId) return sv;
        const updated = { ...sv, [field]: value };

        // Dynamic price discount recalculation
        const priceField = defaultPriceTier === "B2B" ? "b2bPrice" : defaultPriceTier === "Dropshipping" ? "dropshippingPrice" : "b2cPrice";
        const p = ["b2cPrice", "b2bPrice", "dropshippingPrice"].includes(field) ? Number(value) : (sv as any)[priceField];
        const m = field === "mrp" ? Number(value) : sv.mrp;
        updated.discount = m > 0 ? Math.round(((m - p) / m) * 100) : 0;

        return updated;
      });
      return { ...item, subVariants: newSubs };
    }));
  };

  const removeSubVariant = (colorIdx: number, subId: string) => {
    setVariantsList(prev => prev.map((item, idx) => {
      if (idx !== colorIdx) return item;
      return {
        ...item,
        subVariants: item.subVariants.filter(sv => sv.id !== subId)
      };
    }));
  };

  const updateVariantField = (index: number, field: keyof ColorVariant, value: any) => {
    setVariantsList(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "lengthCm" || field === "breadthCm" || field === "heightCm") {
        const l = updated.lengthCm;
        const b = updated.breadthCm;
        const h = updated.heightCm;
        if (l && b && h && Number(l) > 0 && Number(b) > 0 && Number(h) > 0) {
          updated.dimensions = `${l}x${b}x${h} cm`;
        } else if (!updated.dimensions || updated.dimensions.includes("cm")) {
          updated.dimensions = "";
        }
      }
      return updated;
    }));
  };

  const validateImageAspectRatio = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        // Flexible aspect ratio check: warn instead of hard fail
        if (Math.abs(ratio - 1) <= 0.2) {
          resolve(true);
        } else {
          resolve(true); // Allow non-square image but show hint if needed
        }
      };
      img.onerror = () => {
        resolve(true);
      };
      img.src = src;
    });
  };

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const rawImages = variantsList[variantIndex].images || [];
    const currentImages = rawImages.filter((img: any) =>
      typeof img === "string" ? img.trim() !== "" : Boolean(img && img.url && img.url.trim() !== "")
    );

    if (currentImages.length >= 9) {
      addToast("You can only add a maximum of 9 images per color variant.", "error");
      e.target.value = "";
      return;
    }

    addToast("Uploading variant image...", "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload image");
      }

      const { url } = await res.json();

      const newImgIndex = currentImages.length + 1;
      const colorName = variantsList[variantIndex].color || "Variant";
      const defaultAlt = `${title || "Product"} - ${colorName} - Image ${newImgIndex}`;

      const updatedImages = [...currentImages, { url, alt: defaultAlt }];
      updateVariantField(variantIndex, "images", updatedImages);
      addToast("Variant image uploaded and added to preview successfully.", "success");
    } catch (err: unknown) {
      console.error(err);
      addToast(err instanceof Error ? (err as any).message : "Failed to upload variant image.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleAddImageUrl = async (variantIndex: number) => {
    const url = newImageUrl[variantIndex]?.trim();
    if (!url) {
      addToast("Please enter a valid image URL.", "error");
      return;
    }

    const rawImages = variantsList[variantIndex].images || [];
    const currentImages = rawImages.filter((img: any) =>
      typeof img === "string" ? img.trim() !== "" : Boolean(img && img.url && img.url.trim() !== "")
    );

    if (currentImages.length >= 9) {
      addToast("You can only add a maximum of 9 images per color variant.", "error");
      return;
    }

    const newImgIndex = currentImages.length + 1;
    const colorName = variantsList[variantIndex].color || "Variant";
    const defaultAlt = `${title || "Product"} - ${colorName} - Image ${newImgIndex}`;

    const updatedImages = [...currentImages, { url, alt: defaultAlt }];
    updateVariantField(variantIndex, "images", updatedImages);
    setNewImageUrl(prev => ({ ...prev, [variantIndex]: "" }));
    addToast("Image URL added to preview successfully.", "success");
  };

  const addAPlusBlock = () => {
    if (aPlusBlocks.length >= 7) {
      addToast("You can only add a maximum of 7 A+ content blocks.", "error");
      return;
    }
    const newBlock: APlusBlock = {
      id: `ap_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type: "image",
      content: "970x600",
      imageUrl: "",
      alt: ""
    };
    setAPlusBlocks([...aPlusBlocks, newBlock]);
  };

  const moveAPlusBlock = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === aPlusBlocks.length - 1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...aPlusBlocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setAPlusBlocks(updated);
  };

  const removeAPlusBlock = (id: string) => {
    setAPlusBlocks(aPlusBlocks.filter(b => b.id !== id));
  };

  const handleBlockImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, blockId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addToast("Uploading banner image to Vercel Blob...", "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload to Vercel Blob");
      }

      const { url } = await res.json();

      setAPlusBlocks(prev => prev.map((b, idx) =>
        b.id === blockId ? {
          ...b,
          imageUrl: url,
          type: "image",
          alt: b.alt || `${title || "Product"} A+ Banner ${idx + 1}`
        } : b
      ));
      addToast("Banner image uploaded successfully.", "success");
    } catch (err: unknown) {
      console.error(err);
      addToast(err instanceof Error ? (err as any).message : "Failed to upload image to Vercel Blob.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSubVariantBarcodeImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    colorIdx: number,
    subId: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please select a valid image file (JPEG, PNG, WebP, SVG) for the variant barcode.", "error");
      e.target.value = "";
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload barcode image");
      }

      const { url } = await res.json();

      setVariantsList(prev => prev.map((item, idx) => {
        if (idx !== colorIdx) return item;
        const updatedSubVariants = item.subVariants.map(sv => {
          if (sv.id !== subId) return sv;
          return {
            ...sv,
            barcodeImage: url,
            barcodeSource: "image" as const,
          };
        });
        return { ...item, subVariants: updatedSubVariants };
      }));

      addToast("Custom variant barcode image uploaded successfully!", "success");
    } catch (err: unknown) {
      console.error(err);
      addToast(err instanceof Error ? err.message : "Failed to upload barcode image.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleProductBarcodeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please select a valid image file (JPEG, PNG, WebP, SVG) for the barcode.", "error");
      e.target.value = "";
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload product barcode image");
      }

      const { url } = await res.json();
      setBarcodeImage(url);
      setBarcodeSource("image");
      addToast("Product barcode image uploaded and validated successfully!", "success");
    } catch (err: unknown) {
      console.error(err);
      addToast(err instanceof Error ? err.message : "Failed to upload barcode image.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const autoGenerateSEO = () => {
    if (!title) {
      addToast("Please enter a product title first.", "warning");
      return;
    }
    const selectedCat = activeCategories.find(c => c._id === categoryId);
    const catName = selectedCat ? selectedCat.name : "Wholesale Supply";
    setSeoTitle(`${title} | Buy Bulk Online at Wholesale Price`);
    setSeoDescription(`Purchase ${title} in bulk direct from manufacturers.   B2B cargo supply. Department: ${catName}. GST claimable tax invoice supplied.`);
    setSeoKeywords(`${title.toLowerCase()}, wholesale ${title.toLowerCase()}, B2B bulk buy, ${catName.toLowerCase()} supply`);
    addToast("SEO metadata tags successfully auto-generated!", "success");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title) {
      addToast("Product Title is required.", "error");
      return;
    }

    if (!variantsList || variantsList.length === 0) {
      addToast("At least one color variant is required to save the product.", "error");
      return;
    }

    const hasEmptySubVariants = variantsList.some(v => !v.subVariants || v.subVariants.length === 0);
    if (hasEmptySubVariants) {
      addToast("Each color variant must have at least one sub-variant combination.", "error");
      return;
    }

    const matchedHsn = hsns.find(h => h.code === hsnCode);
    const gstRateVal = matchedHsn ? matchedHsn.gstRate : 18;

    const finalVariants = variantsList.map((item) => {
      const validImages = (item.images || []).filter((img: any) => {
        const url = typeof img === "string" ? img : img?.url;
        return url && url.trim() !== "";
      });
      const parsedLength = (item.lengthCm !== null && item.lengthCm !== undefined && !isNaN(Number(item.lengthCm)) && Number(item.lengthCm) >= 0) ? Math.max(0, Number(item.lengthCm)) : null;
      const parsedBreadth = (item.breadthCm !== null && item.breadthCm !== undefined && !isNaN(Number(item.breadthCm)) && Number(item.breadthCm) >= 0) ? Math.max(0, Number(item.breadthCm)) : null;
      const parsedHeight = (item.heightCm !== null && item.heightCm !== undefined && !isNaN(Number(item.heightCm)) && Number(item.heightCm) >= 0) ? Math.max(0, Number(item.heightCm)) : null;

      return {
        ...item,
        lengthCm: parsedLength,
        breadthCm: parsedBreadth,
        heightCm: parsedHeight,
        packagingCharge: Math.max(0, Number(item.packagingCharge) || 0),
        packagingChargeType: item.packagingChargeType || "per_unit",
        images: validImages,
        subVariants: (item.subVariants || []).map((sv: any) => {
          const parsedMoq = (sv.b2bMoq !== null && sv.b2bMoq !== undefined && !isNaN(Number(sv.b2bMoq)) && Number(sv.b2bMoq) > 0)
            ? Math.max(1, Math.floor(Number(sv.b2bMoq)))
            : null;
          const parsedWeightGrams = (sv.weightGrams !== null && sv.weightGrams !== undefined && !isNaN(Number(sv.weightGrams)) && Number(sv.weightGrams) >= 0)
            ? Math.max(0, Number(sv.weightGrams))
            : null;

          return {
            ...sv,
            mrp: Math.max(0, Number(sv.mrp) || 0),
            b2cPrice: Math.max(0, Number(sv.b2cPrice) || 0),
            b2bPrice: Math.max(0, Number(sv.b2bPrice) || 0),
            dropshippingPrice: Math.max(0, Number(sv.dropshippingPrice) || 0),
            b2bMoq: parsedMoq,
            discount: Math.max(0, Number(sv.discount) || 0),
            stock: Math.max(0, Math.floor(Number(sv.stock) || 0)),
            weightGrams: parsedWeightGrams,
            packagingCharge: Math.max(0, Number(sv.packagingCharge) || 0),
            packagingChargeType: sv.packagingChargeType || "per_unit",
            barcode: sv.barcode || null,
            barcodeSource: sv.barcodeSource || (sv.barcodeImage ? "image" : sv.barcode ? "manual" : "auto"),
            barcodeImage: sv.barcodeImage || null,
          };
        })
      };
    });

    // Validate image is provided for every variant color
    const missingImages = finalVariants.some(v => !v.images || v.images.length === 0);
    if (missingImages) {
      addToast("At least one image is mandatory for each variant color. Please upload or add an image URL.", "error");
      return;
    }

    // Validate weight is not empty for any variant
    const missingWeight = finalVariants.some(v => v.subVariants.some((sv: any) => !sv.weight || sv.weight.trim() === ""));
    if (missingWeight) {
      addToast("Each variant combination must have a weight specified.", "error");
      return;
    }

    const invalidSku = finalVariants.some(v => v.subVariants.some((sv: any) => !sv.sku));
    if (invalidSku) {
      addToast("Each variant combination must have a unique SKU code.", "error");
      return;
    }

    const totalStock = finalVariants.reduce((sum, v) => sum + v.subVariants.filter((sv: any) => sv.isActive !== false).reduce((s: number, sv: any) => s + sv.stock, 0), 0);
    const tags = tagsText.split(",").map(t => t.trim()).filter(Boolean);
    const cardTags = cardTagsText.split(",").map(t => t.trim()).filter(Boolean);

    const productData: Omit<Product, "_id" | "createdAt"> = {
      title,
      slug: existingProduct ? existingProduct.slug : title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4),
      description,
      categoryId,
      rating: existingProduct ? existingProduct.rating : 0,
      reviewCount: existingProduct ? existingProduct.reviewCount : 0,
      tags,
      cardTags,
      isActive: existingProduct ? existingProduct.isActive : true,
      totalStock,
      colorVariants: finalVariants,
      aPlusContent: aPlusBlocks.filter(b => b.imageUrl && b.imageUrl.trim() !== ""),
      hsnCode,
      gstRate: gstRateVal,
      priceIncludesGst,
      packagingCharge: Math.max(0, Number(packagingCharge) || 0),
      packagingChargeType: packagingChargeType || "per_unit",
      defaultPriceTier,
      seoTitle,
      seoDescription,
      seoKeywords,
      fieldVisibility,
      barcode,
      barcodeSource,
      barcodeImage,
    };

    setIsSaving(true);
    try {
      if (existingProduct) {
        await updateProduct(existingProduct._id, productData);
        addToast("Product details updated successfully.", "success");
      } else {
        await addProduct(productData);
        addToast("New product published successfully.", "success");
      }
      router.push("/admin/products");
    } catch (err: any) {
      addToast(err?.message || "Failed to save product details.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    productId,
    existingProduct,
    categories: activeCategories,
    hsns,
    title,
    setTitle,
    description,
    setDescription,
    categoryId,
    setCategoryId,
    tagsText,
    setTagsText,
    cardTagsText,
    setCardTagsText,
    hsnCode,
    setHsnCode,
    priceIncludesGst,
    setPriceIncludesGst,
    packagingCharge,
    setPackagingCharge,
    packagingChargeType,
    setPackagingChargeType,
    defaultPriceTier,
    setDefaultPriceTier,
    seoTitle,
    setSeoTitle,
    seoDescription,
    setSeoDescription,
    seoKeywords,
    setSeoKeywords,
    fieldVisibility,
    setFieldVisibility,
    variantsList,
    setVariantsList,
    variantSizes,
    setVariantSizes,
    variantWeights,
    setVariantWeights,
    newImageUrl,
    setNewImageUrl,
    editorMode,
    setEditorMode,
    aPlusBlocks,
    setAPlusBlocks,
    isSaving,

    addVariant,
    removeVariant,
    generateSubVariants,
    updateSubVariantField,
    removeSubVariant,
    updateVariantField,
    autoGenerateSEO,
    handleSave,
    handleVariantImageUpload,
    handleSubVariantBarcodeImageUpload,
    handleProductBarcodeImageUpload,
    handleAddImageUrl,
    addAPlusBlock,
    moveAPlusBlock,
    removeAPlusBlock,
    handleBlockImageUpload,

    barcode,
    setBarcode,
    barcodeSource,
    setBarcodeSource,
    barcodeImage,
    setBarcodeImage
  };
}
