import { useCallback, useEffect, useRef } from "react";
import { sanitizeRichTextHtml } from "@/components/RichTextEditor";

interface ConsentScrollGateProps {
  consentText: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onReadToBottomChange: (readToBottom: boolean) => void;
  testIdPrefix: string;
}

export function ConsentScrollGate({
  consentText,
  checked,
  onCheckedChange,
  onReadToBottomChange,
  testIdPrefix,
}: ConsentScrollGateProps) {
  const scrollRegionRef = useRef<HTMLDivElement>(null);

  const updateReadState = useCallback(() => {
    const region = scrollRegionRef.current;
    if (!region) return;
    const readToBottom = region.scrollTop + region.clientHeight >= region.scrollHeight - 1;
    onReadToBottomChange(readToBottom);
  }, [onReadToBottomChange]);

  useEffect(() => {
    updateReadState();
  }, [consentText, updateReadState]);

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-consent-gate`}>
      <div
        ref={scrollRegionRef}
        onScroll={updateReadState}
        tabIndex={0}
        role="region"
        aria-label="Consent text"
        className="h-28 overflow-y-auto rounded-md border border-input bg-muted/20 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
        data-testid={`${testIdPrefix}-consent-text`}
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(consentText) }}
      />
      <label className={`flex items-start gap-2 ${checked ? "cursor-pointer" : ""}`} data-testid={`${testIdPrefix}-consent-label`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!readToBottom}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-50"
          data-testid={`${testIdPrefix}-consent-checkbox`}
        />
        <span className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {readToBottom ? "I agree to the consent text above." : "Scroll to the bottom to enable agreement."}
        </span>
      </label>
    </div>
  );
}