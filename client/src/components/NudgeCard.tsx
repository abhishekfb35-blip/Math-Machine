export interface EngineThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

interface NudgeCardProps {
  itemCount: number;
  engineThresholds: EngineThresholds | null;
  supplementaryText?: string;
  compact?: boolean;
}

export default function NudgeCard({
  itemCount,
  engineThresholds,
  supplementaryText,
  compact = false,
}: NudgeCardProps) {
  if (!engineThresholds || itemCount === 0) return null;

  const {
    retailFreeItemTrigger: trigger,
    retailBonusDiscountPct: bonusPct,
    wholesaleThreshold: wholesale,
  } = engineThresholds;

  const atWholesale = itemCount >= wholesale;
  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  // Short guiding message below the chain
  let message: string;
  if (atWholesale) {
    message = "★ Wholesale pricing active — best value on every item!";
  } else if (atBonus) {
    const need = wholesale - itemCount;
    message = `🎁 FREE + ✦ ${bonusPct}% off unlocked! Add ${need} more item${need === 1 ? "" : "s"} → ★ Wholesale`;
  } else if (atFree) {
    message = `🎁 Cheapest item is FREE! Add 1 more → ✦ ${bonusPct}% off`;
  } else {
    const need = trigger - itemCount;
    message = `Add ${need} more item${need === 1 ? "" : "s"} → unlock 🎁 1 FREE item`;
  }

  // Chain labels per state
  let leftLabel: string;
  let leftActive: boolean;
  let middlePill: string;
  let rightLabel: string;

  if (atBonus) {
    leftLabel = `🎁 FREE + ✦ ${bonusPct}% off`;
    leftActive = true;
    const need = wholesale - itemCount;
    middlePill = `Add ${need} more`;
    rightLabel = "★ Wholesale";
  } else if (atFree) {
    leftLabel = "🎁 FREE earned!";
    leftActive = true;
    middlePill = "Add 1 more";
    rightLabel = `✦ ${bonusPct}% off next`;
  } else {
    const need = trigger - itemCount;
    leftLabel = `🛒 ${itemCount} item${itemCount === 1 ? "" : "s"}`;
    leftActive = false;
    middlePill = `Add ${need} more`;
    rightLabel = "🎁 1 FREE item";
  }

  const pad = compact ? "px-2.5 py-1" : "px-3 py-1.5";

  const leftCls = [
    "animate-nudge-pop rounded-lg font-bold text-xs whitespace-nowrap",
    pad,
    leftActive
      ? "bg-emerald-500 text-white"
      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  ].join(" ");

  const pillCls = [
    "animate-nudge-pop rounded-full font-bold text-xs whitespace-nowrap",
    pad,
    "bg-amber-400 dark:bg-amber-500 text-white",
  ].join(" ");

  const rightCls = [
    "animate-nudge-pop rounded-lg font-bold text-xs whitespace-nowrap",
    pad,
    "border border-dashed border-emerald-400 dark:border-emerald-600",
    "text-emerald-700 dark:text-emerald-300 bg-white/70 dark:bg-transparent",
  ].join(" ");

  const connectorCls = "animate-nudge-pop text-slate-400 dark:text-slate-600 text-xs select-none font-mono";

  return (
    <div
      className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-500 dark:border-emerald-600 shadow-sm ${compact ? "px-3 py-2.5 space-y-2" : "px-4 py-3 space-y-2.5"}`}
      data-testid="nudge-card"
    >
      {atWholesale ? (
        /* Wholesale: single centred badge, no chain */
        <div
          key={`chain-${itemCount}`}
          className="flex justify-center"
        >
          <span
            className={`animate-nudge-pop rounded-lg font-bold text-xs whitespace-nowrap ${pad} bg-amber-500 text-white`}
            style={{ animationDelay: "0.1s" }}
            data-testid="nudge-chain-wholesale"
          >
            ★ Wholesale unlocked — best value!
          </span>
        </div>
      ) : (
        /* Pre-trigger / free / bonus: left ── pill ──► right */
        <div
          key={`chain-${itemCount}`}
          className="flex items-center flex-wrap gap-1.5"
          data-testid="nudge-chain"
        >
          <span
            className={leftCls}
            style={{ animationDelay: "0.1s" }}
            data-testid="nudge-chain-left"
          >
            {leftLabel}
          </span>

          <span
            className={connectorCls}
            style={{ animationDelay: "0.4s" }}
            aria-hidden="true"
          >
            ──
          </span>

          <span
            className={pillCls}
            style={{ animationDelay: "0.7s" }}
            data-testid="nudge-chain-pill"
          >
            {middlePill}
          </span>

          <span
            className={connectorCls}
            style={{ animationDelay: "1.0s" }}
            aria-hidden="true"
          >
            ──►
          </span>

          <span
            className={rightCls}
            style={{ animationDelay: "1.3s" }}
            data-testid="nudge-chain-right"
          >
            {rightLabel}
          </span>
        </div>
      )}

      {/* Guiding text — one short sentence */}
      <p
        className="text-sm font-medium text-emerald-900 dark:text-emerald-100 leading-snug"
        data-testid="nudge-message"
      >
        {message}
      </p>

      {/* Optional admin note */}
      {supplementaryText && (
        <p
          className="text-xs text-emerald-700 dark:text-emerald-300 leading-snug"
          data-testid="nudge-supplementary"
        >
          {supplementaryText}
        </p>
      )}
    </div>
  );
}
