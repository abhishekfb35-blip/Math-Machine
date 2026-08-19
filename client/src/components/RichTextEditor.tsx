import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Smile, Palette } from "lucide-react";

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "DIV", "SPAN", "FONT"]);
const ALLOWED_STYLE_PROPERTIES = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "text-decoration"]);
const EMOJIS = ["✨", "🎁", "💚", "🌟", "😊", "🛍️", "🚚", "❤️"];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r?\n/g, "<br>");
}

function safeStyle(value: string): string {
  return value
    .split(";")
    .map((declaration) => {
      const [property, ...parts] = declaration.split(":");
      const normalizedProperty = property?.trim().toLowerCase();
      const normalizedValue = parts.join(":").trim();
      if (!normalizedProperty || !normalizedValue || !ALLOWED_STYLE_PROPERTIES.has(normalizedProperty)) return "";
      if (/url\s*\(|expression\s*\(|javascript\s*:/i.test(normalizedValue)) return "";
      return `${normalizedProperty}:${normalizedValue}`;
    })
    .filter(Boolean)
    .join(";");
}

/** Converts old plain text values to HTML and strips unsafe markup from rich values. */
export function sanitizeRichTextHtml(value: string): string {
  if (!value) return "";
  if (!/<[a-z][\s\S]*>/i.test(value)) return escapeHtml(value);

  const parser = new DOMParser();
  const document = parser.parseFromString(value, "text/html");
  const walk = (node: Node) => {
    Array.prototype.slice.call(node.childNodes).forEach((child: Node) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const element = child as HTMLElement;
      if (!ALLOWED_TAGS.has(element.tagName)) {
        element.replaceWith(document.createTextNode(element.textContent || ""));
        return;
      }
      Array.prototype.slice.call(element.attributes).forEach((attribute: Attr) => {
        const name = attribute.name.toLowerCase();
        if (name === "style") {
          const style = safeStyle(attribute.value);
          if (style) element.setAttribute("style", style);
          else element.removeAttribute("style");
        } else if (name === "color" || name === "face" || name === "size") {
          if (/[<>"'{};]/.test(attribute.value)) element.removeAttribute(name);
        } else {
          element.removeAttribute(attribute.name);
        }
      });
      walk(element);
    });
  };
  walk(document.body);
  return document.body.innerHTML;
}

function isRichValue(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  testId: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  label,
  placeholder,
  testId,
  minHeight = "84px",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    const nextHtml = isRichValue(value) ? sanitizeRichTextHtml(value) : escapeHtml(value);
    if (editorRef.current.innerHTML !== nextHtml) editorRef.current.innerHTML = nextHtml;
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    onChange(sanitizeRichTextHtml(editorRef.current.innerHTML));
  };

  const runCommand = (command: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const insertEmoji = (emoji: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, emoji);
    emitChange();
  };

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      <div className="rounded-md border border-input bg-background overflow-hidden" data-testid={`${testId}-editor`}>
        <div className="flex flex-wrap items-center gap-1 border-b border-input bg-muted/40 p-1.5">
          <button type="button" title="Bold" aria-label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("bold")} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-background" data-testid={`${testId}-bold`}>
            <Bold className="w-4 h-4" />
          </button>
          <button type="button" title="Italic" aria-label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("italic")} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-background" data-testid={`${testId}-italic`}>
            <Italic className="w-4 h-4" />
          </button>
          <button type="button" title="Underline" aria-label="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("underline")} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-background" data-testid={`${testId}-underline`}>
            <Underline className="w-4 h-4" />
          </button>
          <select aria-label="Font family" title="Font family" defaultValue="Arial" onChange={(e) => runCommand("fontName", e.target.value)} className="h-8 rounded border border-input bg-background px-1 text-xs" data-testid={`${testId}-font`}>
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Verdana">Verdana</option>
            <option value="Courier New">Courier</option>
          </select>
          <select aria-label="Font size" title="Font size" defaultValue="3" onChange={(e) => runCommand("fontSize", e.target.value)} className="h-8 rounded border border-input bg-background px-1 text-xs" data-testid={`${testId}-size`}>
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="4">Large</option>
            <option value="5">Huge</option>
          </select>
          <button type="button" title="Text color" aria-label="Text color" onMouseDown={(e) => e.preventDefault()} onClick={() => colorRef.current?.click()} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-background" data-testid={`${testId}-color-button`}>
            <Palette className="w-4 h-4" />
          </button>
          <input ref={colorRef} type="color" aria-label="Choose text color" defaultValue="#2f8f73" className="sr-only" onChange={(e) => runCommand("foreColor", e.target.value)} data-testid={`${testId}-color`} />
          <div className="relative">
            <button type="button" title="Insert emoji" aria-label="Insert emoji" onMouseDown={(e) => e.preventDefault()} onClick={() => setEmojiOpen((open) => !open)} className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-background" data-testid={`${testId}-emoji-button`}>
              <Smile className="w-4 h-4" />
            </button>
            {emojiOpen && (
              <div className="absolute left-0 top-9 z-10 flex gap-1 rounded-md border bg-background p-1.5 shadow-lg">
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" title={`Insert ${emoji}`} aria-label={`Insert ${emoji}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { insertEmoji(emoji); setEmojiOpen(false); }} className="h-8 w-8 rounded hover:bg-muted text-base">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label={label}
          aria-multiline="true"
          data-placeholder={placeholder}
          onInput={emitChange}
          className="px-3 py-2 text-sm leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
          style={{ minHeight }}
          data-testid={testId}
          suppressContentEditableWarning
        />
      </div>
      <p className="text-xs text-muted-foreground">Select text to format it. Formatting is saved with this field.</p>
    </div>
  );
}