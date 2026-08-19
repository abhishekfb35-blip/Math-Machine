import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Smile, Palette } from "lucide-react";

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "BR", "P", "DIV", "SPAN", "FONT"]);
const ALLOWED_STYLE_PROPERTIES = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "text-decoration"]);
const EMOJIS = ["✨", "🎁", "💚", "🌟", "😊", "🛍️", "🚚", "❤️"];
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 72;
/** Marks spans that temporarily highlight the text the font-size control will change. */
const SIZE_MARKER_ATTR = "data-size-marker";
const SIZE_MARKER_HIGHLIGHT = "rgba(47, 143, 115, 0.28)";

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
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizeChangedRef = useRef(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [fontSize, setFontSize] = useState("16");
  const [sizeHint, setSizeHint] = useState<string | null>(null);

  useEffect(() => () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;
    const nextHtml = isRichValue(value) ? sanitizeRichTextHtml(value) : escapeHtml(value);
    // A temporary marker keeps the chosen range visible while the size input
    // has focus. Ignore a parent update when its sanitized value already
    // matches the editor, otherwise React would remove that marker mid-edit.
    if (sanitizeRichTextHtml(editorRef.current.innerHTML) !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
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
    if (!range.collapsed && editorRef.current.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const showSizeHint = (message: string) => {
    setSizeHint(message);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setSizeHint(null), 3000);
  };

  const getSizeMarker = () =>
    editorRef.current?.querySelector<HTMLElement>(`[${SIZE_MARKER_ATTR}]`) ?? null;

  const clearSizeMarker = () => {
    const marker = getSizeMarker();
    if (!marker) return;
    marker.removeAttribute(SIZE_MARKER_ATTR);
    marker.style.removeProperty("background-color");
  };

  /**
   * Wrap the saved range once, before focus moves to the number input. The
   * wrapper is both the persistent highlight and the exact element that later
   * receives font-size, so applying a size never depends on restoring browser
   * selection state or document.execCommand.
   */
  const markSavedSelection = (): HTMLElement | null => {
    const editor = editorRef.current;
    const savedRange = selectionRef.current;
    if (!editor || !savedRange || savedRange.collapsed ||
      !editor.contains(savedRange.startContainer) || !editor.contains(savedRange.endContainer)) {
      return null;
    }

    clearSizeMarker();
    const range = savedRange.cloneRange();
    const marker = document.createElement("span");
    marker.setAttribute(SIZE_MARKER_ATTR, "true");
    marker.style.backgroundColor = SIZE_MARKER_HIGHLIGHT;

    try {
      const contents = range.extractContents();
      if (!contents.hasChildNodes()) return null;
      marker.appendChild(contents);
      range.insertNode(marker);

      const markerRange = document.createRange();
      markerRange.selectNodeContents(marker);
      selectionRef.current = markerRange.cloneRange();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(markerRange);
      return marker;
    } catch {
      return null;
    }
  };

  const prepareFontSizeTarget = () => {
    rememberSelection();
    return getSizeMarker() ?? markSavedSelection();
  };

  const applyFontSize = (rawSize = fontSize, showInvalidHint = true) => {
    if (!/^\d+$/.test(rawSize)) {
      if (showInvalidHint) showSizeHint(`Enter a whole number from ${MIN_FONT_SIZE} to ${MAX_FONT_SIZE}px.`);
      return false;
    }
    const size = Number(rawSize);
    if (!Number.isInteger(size) || size < MIN_FONT_SIZE || size > MAX_FONT_SIZE) {
      if (showInvalidHint) showSizeHint(`Font size must be between ${MIN_FONT_SIZE} and ${MAX_FONT_SIZE}px.`);
      return false;
    }

    const marker = getSizeMarker() ?? prepareFontSizeTarget();
    if (!marker) {
      showSizeHint("Select text in the editor before changing its font size.");
      return false;
    }

    marker.style.fontSize = `${size}px`;
    marker.style.backgroundColor = SIZE_MARKER_HIGHLIGHT;
    emitChange();
    setSizeHint(null);
    return true;
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
          <div className="flex items-center gap-1">
            <label htmlFor={`${testId}-size`} className="sr-only">Font size in pixels</label>
            <input
              id={`${testId}-size`}
              type="number"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              inputMode="numeric"
              value={fontSize}
              onPointerDown={prepareFontSizeTarget}
              onFocus={prepareFontSizeTarget}
              onChange={(e) => {
                const nextSize = e.target.value;
                sizeChangedRef.current = true;
                setFontSize(nextSize);
                // Number input spinners and valid typed values take effect
                // immediately, without a second click that would lose context.
                applyFontSize(nextSize, false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyFontSize();
                } else if (e.key === "Escape") {
                  clearSizeMarker();
                  setSizeHint(null);
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => {
                if (sizeChangedRef.current) applyFontSize();
                sizeChangedRef.current = false;
                clearSizeMarker();
              }}
              aria-label="Font size in pixels"
              aria-describedby={sizeHint ? `${testId}-size-hint` : undefined}
              title={`Font size in pixels (${MIN_FONT_SIZE}-${MAX_FONT_SIZE})`}
              className="h-8 w-16 rounded border border-input bg-background px-1 text-xs"
              data-testid={`${testId}-size`}
            />
            <span className="text-xs text-muted-foreground" aria-hidden="true">px</span>
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
          onMouseUp={rememberSelection}
          onKeyUp={rememberSelection}
          onSelect={rememberSelection}
          className="px-3 py-2 text-sm leading-relaxed outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
          style={{ minHeight }}
          data-testid={testId}
          suppressContentEditableWarning
        />
      </div>
      <p className="text-xs text-muted-foreground">Select text to format it. Font size applies as you type and accepts whole pixels from {MIN_FONT_SIZE}–{MAX_FONT_SIZE}px.</p>
      {sizeHint && (
        <p id={`${testId}-size-hint`} role="status" className="text-xs text-muted-foreground">
          {sizeHint}
        </p>
      )}
    </div>
  );
}