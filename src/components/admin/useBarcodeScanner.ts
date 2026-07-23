import * as React from "react";
import { Product, ColorVariant, SubVariant } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";

export interface ScanHistoryItem {
  timestamp: string;
  sku: string;
  productTitle: string;
  variantDetails: string;
  stock: number;
}

export function useBarcodeScanner(isOpen: boolean) {
  const { products, updateProduct } = useProductStore();
  const [scanInput, setScanInput] = React.useState("");
  const [scannedProduct, setScannedProduct] = React.useState<Product | null>(null);
  const [scannedVariant, setScannedVariant] = React.useState<ColorVariant | null>(null);
  const [scannedSubVariant, setScannedSubVariant] = React.useState<SubVariant | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [scanHistory, setScanHistory] = React.useState<ScanHistoryItem[]>([]);
  const [continuousScan, setContinuousScan] = React.useState(true);
  const [isScanning, setIsScanning] = React.useState(false);
  const [availableCameras, setAvailableCameras] = React.useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = React.useState<string>("");

  const html5QrcodeRef = React.useRef<any>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastScanRef = React.useRef<{ value: string; timestamp: number }>({ value: "", timestamp: 0 });
  const isBusyRef = React.useRef<boolean>(false);
  const continuousScanRef = React.useRef<boolean>(true);

  React.useEffect(() => {
    continuousScanRef.current = continuousScan;
  }, [continuousScan]);

  const stopCamera = React.useCallback(async () => {
    if (isBusyRef.current && !html5QrcodeRef.current) return;
    isBusyRef.current = true;
    try {
      if (html5QrcodeRef.current) {
        try {
          if (html5QrcodeRef.current.isScanning) {
            await html5QrcodeRef.current.stop();
          }
          await html5QrcodeRef.current.clear();
        } catch (err) {
          console.warn("Notice stopping camera scanner:", err);
        } finally {
          html5QrcodeRef.current = null;
        }
      }
    } finally {
      setIsScanning(false);
      isBusyRef.current = false;
    }
  }, []);

  const handleScanSearch = React.useCallback((barcodeVal: string) => {
    setErrorMsg("");
    const cleaned = barcodeVal.trim().replace(/[\r\n\t]/g, "").toUpperCase();
    if (!cleaned) return;

    // Debounce duplicate scans within 1500ms
    const now = Date.now();
    if (lastScanRef.current.value === cleaned && (now - lastScanRef.current.timestamp < 1500)) {
      return;
    }
    lastScanRef.current = { value: cleaned, timestamp: now };

    const activeProducts = products.length > 0 ? products : useProductStore.getState().products;

    let foundProduct: Product | null = null;
    let foundVariant: ColorVariant | null = null;
    let foundSubVariant: SubVariant | null = null;

    // Search 1: Exact match on SubVariant SKU or barcode
    for (const p of activeProducts) {
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

    // Search 2: Exact match on Product-level barcode, _id, or slug
    if (!foundProduct) {
      for (const p of activeProducts) {
        const matchProductBarcode = p.barcode && p.barcode.toUpperCase() === cleaned;
        const matchId = p._id.toUpperCase() === cleaned;
        const matchSlug = p.slug.toUpperCase() === cleaned;

        if (matchProductBarcode || matchId || matchSlug) {
          foundProduct = p;
          foundVariant = p.colorVariants?.[0] || null;
          foundSubVariant = p.colorVariants?.[0]?.subVariants?.[0] || null;
          break;
        }
      }
    }

    // Search 3: Normalized/Fuzzy match (ignoring non-alphanumeric separators)
    if (!foundProduct) {
      const strippedCleaned = cleaned.replace(/[^A-Z0-9]/g, "");
      if (strippedCleaned.length >= 3) {
        for (const p of activeProducts) {
          for (const cv of p.colorVariants || []) {
            const matchSub = cv.subVariants?.find(sv => {
              const strippedSku = sv.sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
              const strippedBc = sv.barcode ? sv.barcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "";
              return (strippedSku && (strippedSku === strippedCleaned || strippedCleaned.includes(strippedSku))) ||
                     (strippedBc && (strippedBc === strippedCleaned || strippedCleaned.includes(strippedBc)));
            });
            if (matchSub) {
              foundProduct = p;
              foundVariant = cv;
              foundSubVariant = matchSub;
              break;
            }
          }
          if (foundProduct) break;
        }
      }
    }

    if (foundProduct && foundVariant && foundSubVariant) {
      setScannedProduct(foundProduct);
      setScannedVariant(foundVariant);
      setScannedSubVariant(foundSubVariant);
      setScanInput(foundSubVariant.sku);
      
      const newItem: ScanHistoryItem = {
        timestamp: new Date().toLocaleTimeString(),
        sku: foundSubVariant.sku,
        productTitle: foundProduct.title,
        variantDetails: `${foundVariant.color} - ${foundSubVariant.size} / ${foundSubVariant.weight}`,
        stock: foundSubVariant.stock
      };
      setScanHistory(prev => [newItem, ...prev.slice(0, 19)]); // Keep last 20

      useToastStore.getState().addToast(`Matched product: ${foundProduct.title} (${foundVariant.color} - ${foundSubVariant.size})`, "success");
    } else {
      setScannedProduct(null);
      setScannedVariant(null);
      setScannedSubVariant(null);
      setErrorMsg(`Barcode "${barcodeVal}" not found in B2B product inventory.`);
      useToastStore.getState().addToast(`Barcode lookup failed.`, "error");
    }
  }, [products]);

  const startCamera = async (targetDeviceId?: string) => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setErrorMsg("");

    // Check 1: Ensure mediaDevices API exists (must be on localhost or HTTPS)
    if (typeof window !== "undefined" && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setErrorMsg("Camera access is blocked or unavailable on insecure origins. Please access the admin dashboard via http://localhost:3000 or HTTPS.");
      isBusyRef.current = false;
      return;
    }

    // Check 2: Pre-request permission directly within user gesture window
    let testStream: MediaStream | null = null;
    try {
      if (targetDeviceId) {
        testStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: targetDeviceId } } });
      } else {
        try {
          testStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        } catch {
          testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
    } catch (permErr: any) {
      console.warn("Direct getUserMedia permission request result:", permErr);
      const errStr = String(permErr?.message || permErr?.name || "");
      if (
        permErr?.name === "NotAllowedError" ||
        permErr?.name === "PermissionDeniedError" ||
        errStr.includes("Permission denied") ||
        errStr.includes("Permission dismissed")
      ) {
        setErrorMsg("Camera permission is blocked in browser settings. Click the Site Settings/Lock icon near the browser URL bar, set Camera to 'Allow', then click 'Live Camera Scan' again.");
        setIsScanning(false);
        isBusyRef.current = false;
        return;
      } else if (permErr?.name === "NotFoundError" || errStr.includes("Requested device not found")) {
        setErrorMsg("No camera device was detected on your computer or mobile device.");
        setIsScanning(false);
        isBusyRef.current = false;
        return;
      }
    }

    if (testStream) {
      testStream.getTracks().forEach(track => track.stop());
    }

    try {
      if (html5QrcodeRef.current) {
        try {
          if (html5QrcodeRef.current.isScanning) {
            await html5QrcodeRef.current.stop();
          }
          await html5QrcodeRef.current.clear();
        } catch (e) {
          console.warn("Cleanup prior scanner instance:", e);
        } finally {
          html5QrcodeRef.current = null;
        }
      }

      setIsScanning(true);

      // Poll until DOM element 'scanner-video-feed' is rendered
      let retries = 0;
      const waitForElement = () => {
        return new Promise<HTMLElement | null>((resolve) => {
          const check = () => {
            const el = document.getElementById("scanner-video-feed");
            if (el) resolve(el);
            else if (retries < 25) {
              retries++;
              setTimeout(check, 50);
            } else {
              resolve(null);
            }
          };
          check();
        });
      };

      const container = await waitForElement();
      if (!container) {
        setErrorMsg("Video scanner feed element not found in DOM.");
        setIsScanning(false);
        return;
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      // Retrieve device list for camera switching
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera (${d.id.slice(0, 6)})` })));
        }
      } catch (devErr) {
        console.warn("Could not enumerate camera devices:", devErr);
      }

      // Enable 1D product barcodes (Code 128, EAN, UPC, Code 39) + 2D QR codes
      const supportedFormats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ];

      const html5QrCode = new Html5Qrcode("scanner-video-feed", {
        formatsToSupport: supportedFormats,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

      const scanConfig = {
        fps: 15,
        qrbox: (width: number, height: number) => {
          const boxWidth = Math.min(width * 0.9, 340);
          const boxHeight = Math.min(height * 0.55, 180);
          return { width: boxWidth, height: boxHeight };
        },
        aspectRatio: 1.333333
      };

      const onScanSuccess = (decodedText: string) => {
        handleScanSearch(decodedText);
        if (!continuousScanRef.current) {
          stopCamera();
        }
      };

      const tryStart = async (cameraTarget: { facingMode: string } | string) => {
        const containerEl = document.getElementById("scanner-video-feed");
        if (containerEl) containerEl.innerHTML = "";

        await html5QrCode.start(cameraTarget, scanConfig, onScanSuccess, () => {});
        html5QrcodeRef.current = html5QrCode;
      };

      const activeCameraId = targetDeviceId || selectedCameraId;
      if (activeCameraId) {
        await tryStart(activeCameraId);
      } else {
        try {
          await tryStart({ facingMode: "environment" });
        } catch (backErr) {
          console.warn("Back camera unavailable, trying front camera:", backErr);
          try {
            await tryStart({ facingMode: "user" });
          } catch (frontErr) {
            console.warn("Front camera unavailable, listing cameras:", frontErr);
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await tryStart(devices[0].id);
              setSelectedCameraId(devices[0].id);
            } else {
              throw new Error("No camera devices found.");
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Camera scanner start failed:", err);
      const errStr = String(err?.message || err || "");
      if (
        errStr.includes("NotAllowedError") ||
        errStr.includes("Permission denied") ||
        errStr.includes("PermissionDeniedError")
      ) {
        setErrorMsg("Camera permission is blocked in browser settings. Please click the Lock icon next to the site URL -> Site settings -> Allow Camera.");
      } else if (errStr.includes("NotFoundError") || errStr.includes("No camera") || errStr.includes("Requested device not found")) {
        setErrorMsg("No camera device found on this system.");
      } else if (errStr.includes("NotReadableError") || errStr.includes("Could not start video source")) {
        setErrorMsg("Camera is locked by another application. Please close Zoom/Teams/Webcam apps and retry.");
      } else {
        setErrorMsg("Camera access failed. Ensure a valid camera is connected and allowed.");
      }
      setIsScanning(false);
    } finally {
      isBusyRef.current = false;
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setScanInput("");
      setScannedProduct(null);
      setScannedVariant(null);
      setScannedSubVariant(null);
      setErrorMsg("");
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, stopCamera]);

  const handleStockChange = async (amount: number) => {
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

    // Optimistic UI updates
    const previousProduct = scannedProduct;
    const previousSubVariant = scannedSubVariant;
    setScannedProduct(updatedProduct);
    setScannedSubVariant({ ...scannedSubVariant, stock: newStock });

    try {
      await updateProduct(scannedProduct._id, updatedProduct);
      useToastStore.getState().addToast(`Stock level updated to ${newStock} units.`, "success");
    } catch (err: any) {
      // Revert state on failure
      setScannedProduct(previousProduct);
      setScannedSubVariant(previousSubVariant);
      useToastStore.getState().addToast(err?.message || "Failed to update stock level in database.", "error");
    }
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

  const handleFileUploadScan = async (file: File) => {
    if (!file) return;
    setErrorMsg("");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const supportedFormats = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODABAR,
        Html5QrcodeSupportedFormats.ITF,
        Html5QrcodeSupportedFormats.DATA_MATRIX
      ];

      const tempId = "offscreen-file-scanner";
      let tempEl = document.getElementById(tempId);
      if (!tempEl) {
        tempEl = document.createElement("div");
        tempEl.id = tempId;
        tempEl.style.display = "none";
        document.body.appendChild(tempEl);
      }

      const html5QrCode = new Html5Qrcode(tempId, {
        formatsToSupport: supportedFormats,
        verbose: false
      });

      const decodedText = await html5QrCode.scanFile(file, false);
      try { html5QrCode.clear(); } catch {}
      if (decodedText) {
        handleScanSearch(decodedText);
      } else {
        setErrorMsg("No readable barcode detected in the uploaded image.");
      }
    } catch (err: any) {
      console.warn("File scan error:", err);
      setErrorMsg("Could not decode barcode from image. Ensure the image has a clear, unblurred barcode label.");
    }
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
    scanHistory,
    continuousScan,
    setContinuousScan,
    availableCameras,
    selectedCameraId,
    setSelectedCameraId,
    handleScanSearch,
    handleFileUploadScan,
    startCamera,
    stopCamera,
    handleStockChange,
    getWarehouseLocation
  };
}

