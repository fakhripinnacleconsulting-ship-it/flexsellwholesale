import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  try {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
        "a", "img", "span", "div", "table", "thead", "tbody", "tr", "td", "th"
      ],
      ALLOWED_ATTR: ["href", "src", "alt", "class", "target", "rel"],
      FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"]
    });
  } catch (err) {
    console.error("DOMPurify sanitize notice:", err);
    return dirty
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+="[^"]*"/gi, "")
      .replace(/on\w+='[^']*'/gi, "");
  }
}
