"use client";

import React, { useEffect, useRef } from "react";
import "quill/dist/quill.snow.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const isInitiated = useRef(false);

  useEffect(() => {
    if (isInitiated.current) return;
    
    let quillInstance: any = null;

    async function initQuill() {
      if (typeof window === "undefined" || !containerRef.current) return;
      
      // Prevent duplicate initialization if container already has Quill classes
      if (containerRef.current.classList.contains("ql-container")) return;

      const Quill = (await import("quill")).default;
      
      // Double check in case of concurrent async execution
      if (!containerRef.current || containerRef.current.classList.contains("ql-container")) return;

      // Initialize Quill instance
      quillInstance = new Quill(containerRef.current, {
        theme: "snow",
        placeholder: placeholder || "Write product description here...",
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            ["link", "clean"],
          ],
        },
      });

      quillRef.current = quillInstance;
      isInitiated.current = true;

      // Set initial value
      if (value) {
        quillInstance.root.innerHTML = value;
      }

      // Listen to text changes
      quillInstance.on("text-change", () => {
        if (!quillInstance) return;
        const html = quillInstance.root.innerHTML;
        // Avoid empty paragraph tag saving
        const cleanHtml = html === "<p><br></p>" ? "" : html;
        onChange(cleanHtml);
      });
    }

    initQuill();

    return () => {
      // Cleanup DOM and reset state to allow clean re-initialization
      if (containerRef.current) {
        const toolbar = containerRef.current.previousElementSibling;
        if (toolbar && toolbar.classList.contains("ql-toolbar")) {
          toolbar.remove();
        }
        containerRef.current.innerHTML = "";
        containerRef.current.className = "";
      }
      isInitiated.current = false;
    };
  }, []);

  // Update value from parent prop if it changes externally
  useEffect(() => {
    if (quillRef.current && isInitiated.current) {
      const currentHTML = quillRef.current.root.innerHTML;
      const normalizedProp = value || "";
      const normalizedCurrent = currentHTML === "<p><br></p>" ? "" : currentHTML;
      
      if (normalizedProp !== normalizedCurrent) {
        const range = quillRef.current.getSelection();
        quillRef.current.root.innerHTML = normalizedProp;
        if (range) {
          quillRef.current.setSelection(range);
        }
      }
    }
  }, [value]);

  return (
    <div className="w-full border border-input rounded-md overflow-hidden bg-background text-foreground ql-editor-wrapper">
      <div ref={containerRef} className="min-h-[220px] text-sm" />
    </div>
  );
}
