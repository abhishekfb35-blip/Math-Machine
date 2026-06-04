import { useState, useEffect } from "react";

export interface EngineThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

export interface NudgeMessageTemplates {
  preTrigger?: string;
  atFree?: string;
  atBonus?: string;
  atWholesale?: string;
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
}

interface NudgeCardProps {
  itemCount: number;
  engineThresholds: EngineThresholds | null;
  supplementaryText?: string;
  compact?: boolean;
  loopEveryMs?: number;
  staggerMs?: number;
  messageTemplates?: NudgeMessageTemplates;
}

export default function NudgeCard({
  itemCount,
  engineThresholds,
  supplementaryText,
  compact = false,
  loopEveryMs = 5000,
  staggerMs = 300,
  messageTemplates,
}: NudgeCardProps) {
  const [tick, setTick] = useState(0);

  const safeLoopMs = Math.max(1000, loopEveryMs);
  const safeStaggerMs = Math.max(0, staggerMs);

  useEffect(() => {
    function replay() {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
      }
    }

    const id = setInterval(replay, safeLoopMs);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        setTick((t) => t + 1);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [itemCount, safeLoopMs]);

  if (!engineThresholds || itemCount === 0) return null;

  const {
    retailFreeItemTrigger: trigger,
    retailBonusDiscountPct: bonusPct,
    wholesaleThreshold: wholesale,
  } = engineThresholds;

  const atWholesale = itemCount >= wholesale;
  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  let message: string | null = null;
  if (atWholesale && messageTemplates?.atWholesale) {
    message = interpolate(messageTemplates.atWholesale, {
      itemCount, itemCountS: itemCount === 1 ? "" : "s", bonusPct,
    });
  } else if (atBonus && messageTemplates?.atBonus) {
    const need = wholesale - itemCount;
    message = interpolate(messageTemplates.atBonus, {
      need, needS: need === 1 ? "" : "s", bonusPct,
      itemCount, itemCountS: itemCount === 1 ? "" : "s",
    });
  } else if (atFree && messageTemplates?.atFree) {
    message = interpolate(messageTemplates.atFree, {
      bonusPct, itemCount, itemCountS: itemCount === 1 ? "" : "s",
    });
  } else if (!atWholesale && !atBonus && !atFree && messageTemplates?.preTrigger) {
    const need = trigger - itemCount;
    message = interpolate(messageTemplates.preTrigger, {
      need, needS: need === 1 ? "" : "s", bonusPct,
      itemCount, itemCountS: itemCount === 1 ? "" : "s",
    });
  }

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

  const d = (n: number) => `${100 + n * safeStaggerMs}ms`;

  return (
    <div
      className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-500 dark:border-emerald-600 shadow-sm ${compact ? "px-3 py-2.5 space-y-2" : "px-4 py-3 space-y-2.5"}`}
      data-testid="nudge-card"
    >
      {atWholesale ? (
        <div key={`chain-${itemCount}-${tick}`} className="flex justify-center">
          <span
            className={`animate-nudge-pop rounded-lg font-bold text-xs whitespace-nowrap ${pad} bg-amber-500 text-white`}
            style={{ animationDelay: d(0) }}
            data-testid="nudge-chain-wholesale"
          >
            ★ Wholesale unlocked — best value!
          </span>
        </div>
      ) : (
        <div
          key={`chain-${itemCount}-${tick}`}
          className="flex items-center flex-wrap gap-1.5"
          data-testid="nudge-chain"
        >
          <span className={leftCls} style={{ animationDelay: d(0) }} data-testid="nudge-chain-left">
            {leftLabel}
          </span>
          <span className={connectorCls} style={{ animationDelay: d(1) }} aria-hidden="true">──</span>
          <span className={pillCls} style={{ animationDelay: d(2) }} data-testid="nudge-chain-pill">
            {middlePill}
          </span>
          <span className={connectorCls} style={{ animationDelay: d(3) }} aria-hidden="true">──►</span>
          <span className={rightCls} style={{ animationDelay: d(4) }} data-testid="nudge-chain-right">
            {rightLabel}
          </span>
        </div>
      )}

      {message && (
        <p
          className="text-sm font-medium text-emerald-900 dark:text-emerald-100 leading-snug"
          data-testid="nudge-message"
        >
          {message}
        </p>
      )}

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
