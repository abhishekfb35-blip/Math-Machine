import { useState, useEffect } from "react";

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

function milestoneIcon(pos: number, trigger: number, wholesale: number): string | null {
  if (pos === trigger) return "🎁";
  if (pos === trigger + 1) return "✦";
  if (pos === wholesale) return "★";
  return null;
}

function milestoneLabel(pos: number, trigger: number, bonusPct: number, wholesale: number): string {
  if (pos === trigger) return "FREE";
  if (pos === trigger + 1) return `${bonusPct}% off`;
  if (pos === wholesale) return "Wholesale";
  return "";
}

type BadgeVariant = "neutral" | "green" | "gold" | "outlined";

function badgeClasses(variant: BadgeVariant, compact: boolean): string {
  const base = `rounded-lg font-semibold whitespace-nowrap leading-tight ${compact ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2"}`;
  switch (variant) {
    case "green":
      return `${base} bg-emerald-500 text-white shadow-sm`;
    case "gold":
      return `${base} bg-amber-500 text-white shadow-sm`;
    case "neutral":
      return `${base} bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700`;
    case "outlined":
      return `${base} bg-white dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-dashed border-emerald-400 dark:border-emerald-600`;
  }
}

function pillClasses(compact: boolean): string {
  return `rounded-full font-semibold bg-amber-500 text-white whitespace-nowrap leading-tight shadow-sm ${compact ? "text-xs px-2.5 py-1.5" : "text-sm px-3 py-2"}`;
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

  const [chainVisible, setChainVisible] = useState(false);

  useEffect(() => {
    setChainVisible(false);
    const t = setTimeout(() => setChainVisible(true), 10);
    return () => clearTimeout(t);
  }, [itemCount]);

  const filledCount = Math.min(itemCount, wholesale);
  const isDealActive = itemCount >= trigger;
  const atWholesale = itemCount >= wholesale;
  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  // Countdown message
  let message: string;
  if (atWholesale) {
    message = "★ Wholesale pricing active — best value on every item!";
  } else if (atBonus) {
    const need = wholesale - itemCount;
    message = `🎁 FREE + ✦ ${bonusPct}% off unlocked! Add ${need} more item${need === 1 ? "" : "s"} → ★ Wholesale`;
  } else if (atFree) {
    message = `🎁 Cheapest item is FREE! Add 1 more → ✦ ${bonusPct}% off next item`;
  } else {
    const need = trigger - itemCount;
    message = `Add ${need} more item${need === 1 ? "" : "s"} → unlock 🎁 1 FREE item`;
  }

  // Chain element labels + variants per state
  let leftLabel: string;
  let leftVariant: BadgeVariant;
  let middlePill: string | null;
  let rightLabel: string;
  let rightVariant: BadgeVariant;

  if (atWholesale) {
    leftLabel = "★ Wholesale";
    leftVariant = "gold";
    middlePill = null;
    rightLabel = "★ Best value unlocked!";
    rightVariant = "gold";
  } else if (atBonus) {
    leftLabel = `🎁 FREE + ✦ ${bonusPct}% off`;
    leftVariant = "green";
    const need = wholesale - itemCount;
    middlePill = `Add ${need} more`;
    rightLabel = "★ Wholesale";
    rightVariant = "outlined";
  } else if (atFree) {
    leftLabel = "🎁 FREE earned!";
    leftVariant = "green";
    middlePill = "Add 1 more";
    rightLabel = `✦ ${bonusPct}% off next`;
    rightVariant = "outlined";
  } else {
    leftLabel = `🛒 ${itemCount} in cart`;
    leftVariant = "neutral";
    const need = trigger - itemCount;
    middlePill = `Add ${need} more`;
    rightLabel = "🎁 1 FREE item";
    rightVariant = "outlined";
  }

  // Animation class builders
  function fadeClasses(delay: number): { className: string; style: Record<string, string> } {
    return {
      className: `transition-all duration-[220ms] ${chainVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}`,
      style: { transitionDelay: chainVisible ? `${delay}ms` : "0ms" },
    };
  }

  function drawClasses(delay: number): { className: string; style: Record<string, string> } {
    return {
      className: `h-0.5 flex-1 min-w-[12px] bg-emerald-400/60 dark:bg-emerald-500/40 origin-left transition-all duration-[220ms] ${chainVisible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`,
      style: { transitionDelay: chainVisible ? `${delay}ms` : "0ms" },
    };
  }

  const positions = Array.from({ length: wholesale }, (_, i) => i + 1);
  const statePillBg = isDealActive ? "bg-emerald-600" : "bg-amber-500";
  const statePillText = isDealActive ? "Deal Active" : "Unlock Reward";

  return (
    <div
      className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-500 dark:border-emerald-600 shadow-sm ${compact ? "px-3 py-3 space-y-3" : "px-4 py-4 space-y-4"}`}
      data-testid="nudge-card"
    >
      {/* Row 1: State pill */}
      <span
        className={`inline-block text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${statePillBg}`}
      >
        {statePillText}
      </span>

      {/* Row 2: Dot roadmap — milestone dots larger for legibility */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {positions.map((pos) => {
            const isFilled = pos <= filledCount;
            const icon = milestoneIcon(pos, trigger, wholesale);
            const isMilestone = icon !== null;
            return (
              <div
                key={pos}
                className={[
                  "rounded-full flex items-center justify-center shrink-0 transition-colors font-bold select-none",
                  isMilestone ? "w-7 h-7 text-base" : "w-5 h-5 text-[10px]",
                  isFilled
                    ? "bg-emerald-500"
                    : isMilestone
                    ? "bg-white dark:bg-emerald-950 border-2 border-emerald-400 dark:border-emerald-600"
                    : "bg-emerald-200 dark:bg-emerald-700/40",
                ].join(" ")}
                data-testid={`nudge-dot-${pos}`}
              >
                {isMilestone && (
                  <span className={isFilled ? "text-white" : "text-emerald-500 dark:text-emerald-400"}>
                    {icon}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Milestone labels row */}
        <div className="flex items-start gap-2 mt-2">
          {positions.map((pos) => {
            const icon = milestoneIcon(pos, trigger, wholesale);
            const isMilestone = icon !== null;
            const isFilled = pos <= filledCount;
            return (
              <div
                key={pos}
                className={`${isMilestone ? "w-7" : "w-5"} shrink-0 text-center overflow-visible`}
              >
                {isMilestone && (
                  <>
                    <div
                      className={`text-[11px] font-bold leading-tight ${
                        isFilled
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-emerald-400 dark:text-emerald-600"
                      }`}
                    >
                      {milestoneLabel(pos, trigger, bonusPct, wholesale)}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 ${
                        isFilled
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-emerald-300 dark:text-emerald-600"
                      }`}
                    >
                      {pos} items
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 3: Animated chain — reveals left to right on mount & itemCount change */}
      {atWholesale ? (
        <div className="flex justify-center">
          <span
            className={`${fadeClasses(0).className} ${badgeClasses("gold", compact)}`}
            style={fadeClasses(0).style}
          >
            ★ Wholesale pricing active — best value unlocked!
          </span>
        </div>
      ) : (
        <div className="flex items-center flex-wrap gap-2">
          {/* Left: current cart state */}
          <span
            className={`${fadeClasses(0).className} ${badgeClasses(leftVariant, compact)}`}
            style={fadeClasses(0).style}
          >
            {leftLabel}
          </span>

          {/* Connector 1 — draws in */}
          <div {...drawClasses(150)} />

          {/* Middle: action pill */}
          {middlePill && (
            <span
              className={`${fadeClasses(300).className} ${pillClasses(compact)}`}
              style={fadeClasses(300).style}
            >
              {middlePill}
            </span>
          )}

          {/* Connector 2 with arrow — draws in then arrow pops */}
          <div className="flex items-center flex-1 min-w-[16px]">
            <div {...drawClasses(450)} />
            <span
              className={`ml-0.5 text-[11px] leading-none text-emerald-500 dark:text-emerald-400 transition-all duration-[180ms] ${
                chainVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
              }`}
              style={{ transitionDelay: chainVisible ? "510ms" : "0ms" }}
            >
              ▶
            </span>
          </div>

          {/* Right: upcoming reward */}
          <span
            className={`${fadeClasses(600).className} ${badgeClasses(rightVariant, compact)}`}
            style={fadeClasses(600).style}
          >
            {rightLabel}
          </span>
        </div>
      )}

      {/* Row 4: Countdown text — larger than before */}
      <p
        className={`font-semibold text-emerald-900 dark:text-emerald-100 leading-snug ${compact ? "text-sm" : "text-base"}`}
      >
        {message}
      </p>

      {/* Row 5: Admin supplementary text */}
      {supplementaryText && (
        <p
          className={`text-emerald-700 dark:text-emerald-300 leading-snug ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {supplementaryText}
        </p>
      )}
    </div>
  );
}
