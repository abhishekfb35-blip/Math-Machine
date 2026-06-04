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

  const filledCount = Math.min(itemCount, wholesale);
  const isDealActive = itemCount >= trigger;

  let message: string;
  if (itemCount >= wholesale) {
    message = "★ Wholesale pricing active — best value on every item!";
  } else if (itemCount >= trigger + 1) {
    const need = wholesale - itemCount;
    message = `🎁 FREE + ✦ ${bonusPct}% off unlocked! Add ${need} more item${need === 1 ? "" : "s"} → ★ Wholesale`;
  } else if (itemCount >= trigger) {
    message = `🎁 Cheapest item is FREE! Add 1 more → ✦ ${bonusPct}% off next item`;
  } else {
    const need = trigger - itemCount;
    message = `Add ${need} more item${need === 1 ? "" : "s"} → unlock 🎁 1 FREE item`;
  }

  const positions = Array.from({ length: wholesale }, (_, i) => i + 1);
  const pillBg = isDealActive ? "bg-emerald-600" : "bg-amber-500";
  const pillText = isDealActive ? "Deal Active" : "Unlock Reward";

  return (
    <div
      className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-500 dark:border-emerald-600 shadow-sm ${compact ? "px-3 py-2.5 space-y-2" : "px-4 py-3.5 space-y-2.5"}`}
      data-testid="nudge-card"
    >
      <span
        className={`inline-block text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${pillBg}`}
      >
        {pillText}
      </span>

      {/* Step-dot track — one dot per item slot up to wholesaleThreshold */}
      <div>
        <div className={`flex items-center ${compact ? "gap-1" : "gap-1.5"} flex-wrap`}>
          {positions.map((pos) => {
            const isFilled = pos <= filledCount;
            const icon = milestoneIcon(pos, trigger, wholesale);
            const isMilestone = icon !== null;
            return (
              <div
                key={pos}
                className={[
                  "rounded-full flex items-center justify-center shrink-0 transition-colors font-bold select-none",
                  compact ? "w-3 h-3 text-[7px]" : "w-4 h-4 text-[9px]",
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

        {/* Milestone labels — full mode only */}
        {!compact && (
          <div className="flex items-start gap-1.5 mt-1">
            {positions.map((pos) => {
              const icon = milestoneIcon(pos, trigger, wholesale);
              const isFilled = pos <= filledCount;
              return (
                <div key={pos} className="w-4 shrink-0 text-center overflow-visible">
                  {icon && (
                    <span
                      className={`text-[7px] font-semibold leading-tight whitespace-nowrap ${
                        isFilled
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-emerald-400 dark:text-emerald-600"
                      }`}
                    >
                      {milestoneLabel(pos, trigger, bonusPct, wholesale)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dynamic countdown message — changes at every item count */}
      <p
        className={`font-semibold text-emerald-900 dark:text-emerald-100 leading-snug ${compact ? "text-xs" : "text-sm"}`}
      >
        {message}
      </p>

      {/* Admin-configured supplementary text (optional) */}
      {supplementaryText && (
        <p
          className={`text-emerald-700 dark:text-emerald-300 leading-snug ${compact ? "text-[10px]" : "text-xs"}`}
        >
          {supplementaryText}
        </p>
      )}
    </div>
  );
}
