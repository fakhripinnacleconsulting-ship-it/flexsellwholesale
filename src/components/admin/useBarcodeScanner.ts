import * as React from "react";
import { Product, ColorVariant, SubVariant } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";

export function useBarcodeScanner(isOpen: boolean) {
  const { products, updateProduct } = useProductStore();
  const [scanInput, setScanInput] = React.useState("");
  const [scannedProduct, setScannedProduct] = React.useState<Product | null>(null);
  const [scannedVariant, setScannedVariant] = React.useState<ColorVariant | null>(null);
  const [scannedSubVariant, setScannedSubVariant] = React.useState<SubVariant | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");

  const [isScanning, setIsScanning] = React.useState(false);
  const html5QrcodeRef = React.useRef<any>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const stopCamera = React.useCallback(async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
      } catch (err) {
        console.error("Failed to stop camera scanner:", err);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  const handleScanSearch = React.useCallback((barcodeVal: string) => {
    setErrorMsg("");
    const cleaned = barcodeVal.trim().toUpperCase();
    if (!cleaned) return;

    let foundProduct = null;
    let foundVariant = null;
    let foundSubVariant = null;

    for (const p of products) {
      for (const cv of p.colorVariants || []) {
        const matchSub = cv.subVariants?.find(sv => 
          sv.sku.toUpperCase() === cleaned || 
          (sv.barcode && sv.barcode.toUpperCase() === cleaned)
        );
        if (matchSub) {
          foundProduct = p;
          foundVariant = cv;
          foundSubVariant = matchSub;
          break;
        }
      }
      if (foundProduct) break;
    }

    if (foundProduct && foundVariant && foundSubVariant) {
      setScannedProduct(foundProduct);
      setScannedVariant(foundVariant);
      setScannedSubVariant(foundSubVariant);
      setScanInput(foundSubVariant.sku);
      useToastStore.getState().addToast(`Matched variant: ${foundProduct.title} (${foundVariant.color} - ${foundSubVariant.size} / ${foundSubVariant.weight})`, "success");
    } else {
      setScannedProduct(null);
      setScannedVariant(null);
      setScannedSubVariant(null);
      setErrorMsg(`Barcode "${barcodeVal}" not matched in active B2B variants inventory.`);
      useToastStore.getState().addToast(`Barcode lookup failed.`, "error");
    }
  }, [products]);

  const startCamera = async () => {
    setErrorMsg("");
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());
      } else {
        throw new Error("Camera API is not supported in this browser.");
      }

      setIsScanning(true);

      setTimeout(async () => {
        try {
          const { Html5Qrcode } = await import("html5-qrcode");
          
          const container = document.getElementById("scanner-video-feed");
          if (!container) {
            console.error("scanner-video-feed element not found in DOM yet");
            return;
          }

          await stopCamera();

          const scanner = new Html5Qrcode("scanner-video-feed");
          html5QrcodeRef.current = scanner;

          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const boxWidth = Math.min(width * 0.85, 280);
                const boxHeight = Math.min(height * 0.45, 110);
                return { width: boxWidth, height: boxHeight };
              },
              aspectRatio: 1.333333
            },
            (decodedText) => {
              handleScanSearch(decodedText);
              stopCamera();
            },
            (error) => {}
          );
        } catch (delayedErr) {
          console.error("Delayed camera start failed:", delayedErr);
          setErrorMsg("Failed to initialize video scanner feed.");
          setIsScanning(false);
        }
      }, 150);

    } catch (err: any) {
      console.error("Camera scanner failed to start:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Camera permission denied. Please allow camera access in browser settings.");
      } else {
        setErrorMsg("Camera access failed. Ensure a camera is connected and enabled.");
      }
      setIsScanning(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setScanInput("");
      setScannedProduct(null);
      setErrorMsg("");
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  const handleStockChange = (amount: number) => {
    if (!scannedProduct || !scannedVariant || !scannedSubVariant) return;
    const newStock = Math.max(0, scannedSubVariant.stock + amount);
    
    const updatedVariants = scannedProduct.colorVariants.map((cv: ColorVariant) => {
      if (cv.color === scannedVariant.color) {
        const updatedSubs = (cv.subVariants || []).map((sv) => 
          sv.id === scannedSubVariant.id ? { ...sv, stock: newStock } : sv
        );
        return { ...cv, subVariants: updatedSubs };
      }
      return cv;
    });

    const totalStock = updatedVariants.reduce((sum: number, cv: ColorVariant) => 
      sum + (cv.subVariants?.reduce((sSum, sv) => sSum + sv.stock, 0) || 0)
    , 0);

    const updatedProduct = {
      ...scannedProduct,
      totalStock,
      colorVariants: updatedVariants
    };

    updateProduct(scannedProduct._id, updatedProduct);
    
    setScannedProduct(updatedProduct);
    setScannedSubVariant({ ...scannedSubVariant, stock: newStock });
    useToastStore.getState().addToast(`Stock level adjusted to ${newStock} units.`, "success");
  };

  const getWarehouseLocation = (catId: string) => {
    const sections: Record<string, string> = {
      cat_kitchen_tools: "Aisle A, Rack 04 (Kitchen Goods)",
      cat_home_cleaning: "Aisle A, Rack 12 (Cleaning Supplies)",
      cat_electronics: "Aisle B, Rack 02 (Electronics)",
      cat_beauty: "Aisle C, Rack 08 (Cosmetics)",
      cat_fashion: "Aisle D, Rack 15 (Apparel)",
      cat_hardware: "Aisle E, Rack 03 (Tools & DIY)",
      cat_toys: "Aisle F, Rack 09 (Kids Section)"
    };
    return sections[catId] || "Aisle G, Rack 01 (General Cargo)";
  };

  return {
    products,
    scanInput,
    setScanInput,
    scannedProduct,
    scannedVariant,
    scannedSubVariant,
    errorMsg,
    isScanning,
    inputRef,
    handleScanSearch,
    startCamera,
    stopCamera,
    handleStockChange,
    getWarehouseLocation
  };
}
