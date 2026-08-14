"use client";
import { formatTimeIST } from "@/lib/datetime";

import * as React from "react";
import { Product, ColorVariant, SubVariant } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { resolveBarcode, BarcodeResolutionResult } from "@/services/barcodeResolver";
import { initUSBScannerListener } from "@/lib/usbScannerListener";

export interface ScanHistoryItem {
  timestamp: string;
  sku: string;
  productTitle: string;
  variantDetails: string;
  stock: number;
}

export function useBarcodeScanner(
  isOpen: boolean,
  initialCustomerType: "B2C" | "B2B" | "Dropshipping" = "B2C",
  onSelectVariant?: (resolved: any) => void
) {
  const { products, updateProduct } = useProductStore();
  const [scanInput, setScanInput] = React.useState("");
  const [scannedProduct, setScannedProduct] = React.useState<Product | null>(null);
  const [scannedVariant, setScannedVariant] = React.useState<ColorVariant | null>(null);
  const [scannedSubVariant, setScannedSubVariant] = React.useState<SubVariant | null>(null);
  const [lastResolution, setLastResolution] = React.useState<BarcodeResolutionResult | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [scanHistory, setScanHistory] = React.useState<ScanHistoryItem[]>([]);
  const [continuousScan, setContinuousScan] = React.useState(true);
  const [isScanning, setIsScanning] = React.useState(false);

  // Camera Dual-Mode State ("rear" | "front")
  const [cameraMode, setCameraMode] = React.useState<"rear" | "front">("rear");
  const [availableCameras, setAvailableCameras] = React.useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = React.useState<string>("");

  const html5QrcodeRef = React.useRef<any>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastScanRef = React.useRef<{ value: string; timestamp: number }>({ value: "", timestamp: 0 });
  const isBusyRef = React.useRef<boolean>(false);
  const continuousScanRef = React.useRef<boolean>(true);
  const onSelectVariantRef = React.useRef(onSelectVariant);

  React.useEffect(() => {
    onSelectVariantRef.current = onSelectVariant;
  }, [onSelectVariant]);

  // Sync continuousScan ref
  React.useEffect(() => {
    continuousScanRef.current = continuousScan;
  }, [continuousScan]);

  // Load saved camera mode preference
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPref = localStorage.getItem("flexsell-camera-preference") as "rear" | "front" | null;
      if (savedPref === "rear" || savedPref === "front") {
        setCameraMode(savedPref);
      }
    }
  }, []);

  // Web Audio synthetic scan beep tone
  const playScanBeep = React.useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio autoplay restrictions ignored silently
    }
  }, []);

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

  const handleScanSearch = React.useCallback((barcodeVal: string): BarcodeResolutionResult | null => {
    setErrorMsg("");
    const cleaned = barcodeVal.trim().replace(/[\r\n\t]/g, "").toUpperCase();
    if (!cleaned) return null;

    // Debounce rapid duplicate scans within 1200ms
    const now = Date.now();
    if (lastScanRef.current.value === cleaned && (now - lastScanRef.current.timestamp < 1200)) {
      return lastResolution;
    }
    lastScanRef.current = { value: cleaned, timestamp: now };

    const activeProducts = products.length > 0 ? products : useProductStore.getState().products;
    const res = resolveBarcode(cleaned, activeProducts, initialCustomerType);

    setLastResolution(res);

    if (res.success && res.product && res.colorVariant && res.subVariant) {
      playScanBeep();
      setScannedProduct(res.product);
      setScannedVariant(res.colorVariant);
      setScannedSubVariant(res.subVariant);
      setScanInput(res.subVariant.sku);

      const newItem: ScanHistoryItem = {
        timestamp: formatTimeIST(new Date()),
        sku: res.subVariant.sku,
        productTitle: res.product.title,
        variantDetails: `${res.colorVariant.color} - ${res.subVariant.size || "Std"} / ${res.subVariant.weight || "250g"}`,
        stock: res.subVariant.stock
      };
      setScanHistory(prev => [newItem, ...prev.slice(0, 19)]);
      useToastStore.getState().addToast(`Matched SKU: ${res.subVariant.sku} (${res.product.title})`, "success");

      if (onSelectVariantRef.current) {
        onSelectVariantRef.current(res);
      }

      return res;
    } else {
      setScannedProduct(null);
      setScannedVariant(null);
      setScannedSubVariant(null);
      setErrorMsg(res.error || `Barcode "${barcodeVal}" not found.`);
      useToastStore.getState().addToast(`Barcode resolution failed for "${barcodeVal}".`, "error");
      return null;
    }
  }, [products, initialCustomerType, playScanBeep, lastResolution]);

  const startCamera = async (targetMode: "rear" | "front" = cameraMode, targetDeviceId?: string) => {
    if (isBusyRef.current) return;
    isBusyRef.current = true;
    setErrorMsg("");

    if (typeof window !== "undefined" && (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)) {
      setErrorMsg("Camera access requires localhost or HTTPS context.");
      isBusyRef.current = false;
      return;
    }

    // Attempt direct permission request
    const facingConstraint = targetMode === "rear" ? "environment" : "user";
    let testStream: MediaStream | null = null;
    try {
      if (targetDeviceId) {
        testStream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: targetDeviceId } } });
      } else {
        try {
          testStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingConstraint } });
        } catch {
          testStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
    } catch (permErr: any) {
      const errStr = String(permErr?.message || permErr?.name || "");
      if (permErr?.name === "NotAllowedError" || errStr.includes("Permission denied")) {
        setErrorMsg("Camera permission is blocked in browser settings. Please allow camera access in URL site settings.");
        setIsScanning(false);
        isBusyRef.current = false;
        return;
      } else if (permErr?.name === "NotFoundError" || errStr.includes("Requested device not found")) {
        setErrorMsg("No camera device was detected on your system.");
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

      // Wait for DOM container
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
        setErrorMsg("Video feed element not rendered.");
        setIsScanning(false);
        return;
      }

      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");

      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera (${d.id.slice(0, 6)})` })));
        }
      } catch (devErr) {
        console.warn("Could not enumerate camera devices:", devErr);
      }

      const supportedFormats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.QR_CODE,
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

      const activeDeviceId = targetDeviceId || selectedCameraId;
      if (activeDeviceId) {
        await tryStart(activeDeviceId);
      } else {
        try {
          await tryStart({ facingMode: facingConstraint });
        } catch (modeErr) {
          console.warn(`Camera target facingMode ${facingConstraint} failed, trying fallback:`, modeErr);
          const fallbackConstraint = facingConstraint === "environment" ? "user" : "environment";
          try {
            await tryStart({ facingMode: fallbackConstraint });
          } catch (fbErr) {
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await tryStart(devices[0].id);
              setSelectedCameraId(devices[0].id);
            } else {
              throw fbErr;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Camera scanner start failed:", err);
      const errStr = String(err?.message || err || "");
      if (errStr.includes("NotAllowedError") || errStr.includes("Permission denied")) {
        setErrorMsg("Camera permission is blocked in browser settings.");
      } else if (errStr.includes("NotFoundError") || errStr.includes("No camera")) {
        setErrorMsg("No camera device found on this system.");
      } else if (errStr.includes("NotReadableError")) {
        setErrorMsg("Camera is locked by another application (Zoom, Teams, Webcam).");
      } else {
        setErrorMsg("Camera access failed. Check device connections.");
      }
      setIsScanning(false);
    } finally {
      isBusyRef.current = false;
    }
  };

  // Switch camera mode (Rear vs Front) with live restart
  const toggleCameraMode = async (mode: "rear" | "front") => {
    setCameraMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("flexsell-camera-preference", mode);
    }
    if (isScanning) {
      await stopCamera();
      await startCamera(mode);
    }
  };

  // Attach USB Scanner Listener when modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    const cleanupUSB = initUSBScannerListener({
      onScan: (scannedText) => {
        handleScanSearch(scannedText);
      }
    });
    return () => {
      cleanupUSB();
    };
  }, [isOpen, handleScanSearch]);

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

  const handleStockChange = async (amount: number, actionType: "add" | "sub" | "set") => {
    if (!scannedProduct || !scannedVariant || !scannedSubVariant) return;

    let newStock = scannedSubVariant.stock;
    if (actionType === "add") {
      newStock = scannedSubVariant.stock + amount;
    } else if (actionType === "sub") {
      newStock = Math.max(0, scannedSubVariant.stock - amount);
    } else if (actionType === "set") {
      newStock = Math.max(0, amount);
    }

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

    const previousProduct = scannedProduct;
    const previousSubVariant = scannedSubVariant;
    setScannedProduct(updatedProduct);
    setScannedSubVariant({ ...scannedSubVariant, stock: newStock });

    try {
      await updateProduct(scannedProduct._id, updatedProduct);
      useToastStore.getState().addToast(`Stock for ${scannedSubVariant.sku} updated to ${newStock} units.`, "success");
    } catch (err: any) {
      setScannedProduct(previousProduct);
      setScannedSubVariant(previousSubVariant);
      useToastStore.getState().addToast(err?.message || "Failed to update stock in database.", "error");
    }
  };

  const handleFileUploadScan = async (file: File) => {
    if (!file) return;
    setErrorMsg("");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const supportedFormats = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.QR_CODE
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
        setErrorMsg("No readable barcode detected in image.");
      }
    } catch (err: any) {
      console.warn("File scan error:", err);
      setErrorMsg("Could not decode barcode label image.");
    }
  };

  return {
    products,
    scanInput,
    setScanInput,
    scannedProduct,
    scannedVariant,
    scannedSubVariant,
    lastResolution,
    errorMsg,
    isScanning,
    inputRef,
    scanHistory,
    continuousScan,
    setContinuousScan,
    cameraMode,
    toggleCameraMode,
    availableCameras,
    selectedCameraId,
    setSelectedCameraId,
    handleScanSearch,
    handleFileUploadScan,
    startCamera,
    stopCamera,
    handleStockChange
  };
}
