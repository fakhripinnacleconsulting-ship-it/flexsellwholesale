// ─── Description HTML <=> Plain Text Conversion ──────────────────────────
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  let text = html;
  
  // Replace list items
  text = text.replace(/<li>/gi, "\n• ");
  text = text.replace(/<\/li>/gi, "");
  
  // Replace paragraph / block breaks
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  
  // Replace heading tags
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  
  // Strip all other HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  // Replace HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
    
  // Trim leading/trailing whitespace and normalize excessive newlines to double newlines max
  text = text.trim();
  text = text.replace(/\n{3,}/g, "\n\n");
  
  return text;
}

export function plainTextToHtml(text: string): string {
  if (!text) return "";
  
  // Split by double newlines (paragraphs)
  const paragraphs = text.split(/\n\s*\n/);
  
  const htmlParagraphs = paragraphs.map((p) => {
    const trimmed = p.trim();
    if (!trimmed) return "";
    
    // Within paragraph, convert single newlines to <br>
    const lines = trimmed.split("\n");
    const escapedLines = lines.map((line) => {
      return line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    });
    return `<p>${escapedLines.join("<br>")}</p>`;
  });
  
  return htmlParagraphs.filter(Boolean).join("");
}
