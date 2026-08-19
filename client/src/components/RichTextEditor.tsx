import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Smile, Palette } from "lucide-react";

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "DIV", "SPAN", "FONT"]);
const ALLOWED_STYLE_PROPERTIES = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "text-decoration"]);
const EMOJIS = ["✨", "🎁", "💚", "🌟", "😊", "🛍️", "🚚", "❤️"];
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;

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
      if (normalizedProperty === "font-size" && !/^(?:[8-9]|[1-6][0-9]|7[0-2])px$/i.test(normalizedValue)) return "";
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
  const selectionRef = useRef<Range | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fontSize, setFontSize] = useState("16");

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

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) return;
    const range = selection.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selectionRef.current || !editorRef.current) return;
    editorRef.current.focus();
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };

  const applyFontSize = () => {
    if (!/^\d+$/.test(fontSize)) return;
    const size = Number(fontSize);
    if (!Number.isInteger(size) || size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) return;

    restoreSelection();
    // execCommand creates a wrapper around the selected text. Convert that
    // wrapper to an exact pixel style instead of relying on browser presets.
    document.execCommand("fontSize", false, "7");
    editorRef.current?.querySelectorAll('font[size="7"]').forEach((font) => {
      font.removeAttribute("size");
      font.setAttribute("style", `font-size:${size}px`);
    });
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
          <div className="flex items-center gap-1" onMouseDown={rememberSelection}>
            <label htmlFor={`${testId}-size`} className="sr-only">Font size in pixels</label>
            <input
              id={`${testId}-size`}
              type="number"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              inputMode="numeric"
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyFontSize(); } }}
              aria-label="Font size in pixels"
              title={`Font size in pixels (${MIN_FONT_SIZE}-${MAX_FONT_SIZE})`}
              className="h-8 w-16 rounded border border-input bg-background px-1 text-xs"
              data-testid={`${testId}-size`}
            />
            <button
              type="button"
              onClick={applyFontSize}
              className="h-8 rounded border border-input px-1.5 text-xs hover:bg-background"
              aria-label="Apply font size"
              title="Apply font size"
              data-testid={`${testId}-apply-size`}
            >
              px
            </button>
          </div>
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
      <p className="text-xs text-muted-foreground">Select text to format it. Font size accepts whole pixels from {MIN_FONT_SIZE}–{MAX_FONT_SIZE}px.</p>
    </div>
  );
}