import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeRichTextHtml } from "@/components/RichTextEditor";

interface ConsentScrollGateProps {
  consentText: string;
  scrollPrompt: string;
  agreementLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onReadToBottomChange: (readToBottom: boolean) => void;
  testIdPrefix: string;
}

export function ConsentScrollGate({
  consentText,
  scrollPrompt,
  agreementLabel,
  checked,
  onCheckedChange,
  onReadToBottomChange,
  testIdPrefix,
}: ConsentScrollGateProps) {
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const hasReachedBottomRef = useRef(false);
  const [readToBottom, setReadToBottom] = useState(false);

  const updateReadState = useCallback(() => {
    const region = scrollRegionRef.current;
    if (!region || hasReachedBottomRef.current) return;
    const remainingScroll = region.scrollHeight - region.clientHeight - region.scrollTop;
    if (remainingScroll <= 2) {
      hasReachedBottomRef.current = true;
      setReadToBottom(true);
      onReadToBottomChange(true);
    }
  }, [onReadToBottomChange]);

  useEffect(() => {
    hasReachedBottomRef.current = false;
    setReadToBottom(false);
    onReadToBottomChange(false);
    onCheckedChange(false);

    const animationFrame = requestAnimationFrame(() => {
      requestAnimationFrame(updateReadState);
    });
    const resizeObserver = new ResizeObserver(updateReadState);
    if (scrollRegionRef.current) resizeObserver.observe(scrollRegionRef.current);
    if (contentRef.current) resizeObserver.observe(contentRef.current);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [consentText, onCheckedChange, onReadToBottomChange, updateReadState]);

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-consent-gate`}>
      <div
        ref={scrollRegionRef}
        onScroll={updateReadState}
        onTouchEnd={updateReadState}
        onPointerUp={updateReadState}
        tabIndex={0}
        role="region"
        aria-label="Consent text"
        className="h-28 overflow-y-auto rounded-md border border-input bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
        data-testid={`${testIdPrefix}-consent-text`}
      >
        <div
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(consentText) }}
        />
      </div>
      <label className={`flex items-start gap-2 ${readToBottom ? "cursor-pointer" : ""}`} data-testid={`${testIdPrefix}-consent-label`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!readToBottom}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={`${testIdPrefix}-consent-checkbox`}
        />
        <span className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {readToBottom ? agreementLabel : scrollPrompt}
        </span>
      </label>
    </div>
  );
}