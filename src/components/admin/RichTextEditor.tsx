"use client";

import React, { useEffect, useRef, useState } from "react";
import "quill/dist/quill.snow.css";
import { Code, Eye, Edit3, Image as ImageIcon, Video, Sparkles, Check, Copy } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/stores/toastStore";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = "240px",
  readOnly = false
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const isInitiated = useRef(false);
  const { addToast } = useToastStore();

  const [mode, setMode] = useState<"visual" | "html" | "preview">("visual");
  const [htmlValue, setHtmlValue] = useState(value || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHtmlValue(value || "");
  }, [value]);

  useEffect(() => {
    if (isInitiated.current || mode !== "visual") return;

    let quillInstance: any = null;

    async function initQuill() {
      if (typeof window === "undefined" || !containerRef.current) return;
      if (containerRef.current.classList.contains("ql-container")) return;

      const Quill = (await import("quill")).default;

      if (!containerRef.current || containerRef.current.classList.contains("ql-container")) return;

      quillInstance = new Quill(containerRef.current, {
        theme: "snow",
        readOnly: readOnly,
        placeholder: placeholder || "Write rich description, technical specs, or product details here...",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, 4, 5, 6, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ script: "sub" }, { script: "super" }],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ indent: "-1" }, { indent: "+1" }],
            ["blockquote", "code-block"],
            ["link", "image", "video"],
            ["clean"],
          ],
        },
      });

      quillRef.current = quillInstance;
      isInitiated.current = true;

      // Custom Image Upload Handler (Cloud CDN URL insertion instead of heavy Base64 strings)
      const toolbar = quillInstance.getModule("toolbar");
      toolbar.addHandler("image", () => {
        const input = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("accept", "image/png, image/jpeg, image/jpg, image/webp, image/gif");
        input.click();

        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;

          if (file.size > 2 * 1024 * 1024) {
            addToast("Image size exceeds 2MB limit. Please upload a smaller image.", "error");
            return;
          }

          try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await apiClient.post<{url: string}>("/upload", formData);
            const range = quillInstance.getSelection(true);
            quillInstance.insertEmbed(range.index, "image", res.url);
            quillInstance.setSelection(range.index + 1);
          } catch (err: any) {
            console.error("Failed to upload editor image", err);
            // Fallback to FileReader if service fails
            const reader = new FileReader();
            reader.onload = (e) => {
              const url = e.target?.result as string;
              if (url) {
                const range = quillInstance.getSelection(true);
                quillInstance.insertEmbed(range.index, "image", url);
                quillInstance.setSelection(range.index + 1);
              }
            };
            reader.readAsDataURL(file);
          }
        };
      });

      // Custom Video Embed Handler
      toolbar.addHandler("video", () => {
        const url = prompt("Enter Video Embed URL (YouTube, Vimeo, or direct MP4 link):");
        if (url && url.trim()) {
          let embedUrl = url.trim();
          if (embedUrl.includes("youtube.com/watch?v=")) {
            embedUrl = embedUrl.replace("watch?v=", "embed/");
          } else if (embedUrl.includes("youtu.be/")) {
            embedUrl = embedUrl.replace("youtu.be/", "www.youtube.com/embed/");
          }
          const range = quillInstance.getSelection(true);
          quillInstance.insertEmbed(range.index, "video", embedUrl);
          quillInstance.setSelection(range.index + 1);
        }
      });

      // Set initial content
      if (value) {
        quillInstance.root.innerHTML = value;
      }

      // Sync changes back to parent
      quillInstance.on("text-change", () => {
        if (!quillInstance) return;
        const html = quillInstance.root.innerHTML;
        const cleanHtml = html === "<p><br></p>" ? "" : html;
        setHtmlValue(cleanHtml);
        onChange(cleanHtml);
      });
    }

    initQuill();

    return () => {
      if (containerRef.current) {
        const toolbarEl = containerRef.current.previousElementSibling;
        if (toolbarEl && toolbarEl.classList.contains("ql-toolbar")) {
          toolbarEl.remove();
        }
        containerRef.current.innerHTML = "";
        containerRef.current.className = "";
      }
      isInitiated.current = false;
    };
  }, [mode, readOnly]);

  // Handle external updates to `value`
  useEffect(() => {
    if (quillRef.current && isInitiated.current && mode === "visual") {
      const currentHTML = quillRef.current.root.innerHTML;
      const normalizedProp = value || "";
      const normalizedCurrent = currentHTML === "<p><br></p>" ? "" : currentHTML;

      if (normalizedProp !== normalizedCurrent) {
        const range = quillRef.current.getSelection();
        quillRef.current.root.innerHTML = normalizedProp;
        if (range) {
          try {
            quillRef.current.setSelection(range);
          } catch { }
        }
      }
    }
  }, [value, mode]);

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setHtmlValue(newVal);
    onChange(newVal);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(htmlValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full border border-input rounded-xl overflow-hidden bg-background text-foreground shadow-sm flex flex-col">
      {/* Top Header Mode Selector Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/40 border-b border-border text-xs">
        <div className="flex items-center gap-1">
          <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider px-1">
            Enterprise Editor
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "visual"
                ? "bg-background text-primary shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Visual Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("html")}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "html"
                ? "bg-background text-primary shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>Edit HTML</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              mode === "preview"
                ? "bg-background text-primary shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body */}
      {mode === "visual" && (
        <div className="relative w-full ql-editor-wrapper">
          <div ref={containerRef} style={{ minHeight }} className="text-sm p-3" />
        </div>
      )}

      {mode === "html" && (
        <div className="p-3 space-y-2 bg-slate-950 text-slate-100 font-mono text-xs">
          <div className="flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800 pb-1.5">
            <span>Direct HTML Code Source</span>
            <button
              type="button"
              onClick={handleCopyHtml}
              className="flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
            >
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied HTML!" : "Copy HTML"}</span>
            </button>
          </div>
          <textarea
            value={htmlValue}
            onChange={handleHtmlChange}
            placeholder="<div>Write custom HTML or embed codes...</div>"
            rows={10}
            className="w-full bg-transparent text-slate-100 outline-none border-none resize-y font-mono leading-relaxed focus:ring-0"
            style={{ minHeight }}
          />
        </div>
      )}

      {mode === "preview" && (
        <div
          className="p-5 bg-card text-foreground prose dark:prose-invert max-w-none min-h-[240px] overflow-y-auto"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(htmlValue) || "<p class='text-muted-foreground italic'>Content preview is empty.</p>",
          }}
        />
      )}
    </div>
  );
}
