export interface EngineThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

interface NudgeCardProps {
  itemCount: number;
  engineThresholds: EngineThresholds | null;
  compact?: boolean;
}

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function NudgeCard({
  itemCount,
  engineThresholds,
  compact = false,
}: NudgeCardProps) {
  if (!engineThresholds || itemCount === 0) return null;

  const {
    retailFreeItemTrigger: trigger,
    retailBonusDiscountPct: bonusPct,
    wholesaleThreshold: wholesale,
  } = engineThresholds;

  const nodes: number[] = [];
  for (let i = 1; i <= wholesale; i++) nodes.push(i);

  function nodeLabel(pos: number): string {
    if (pos === wholesale) return "Best Rates!";
    if (pos === trigger + 1) return `${bonusPct}% Off*`;
    if (pos === trigger) return "Free!*";
    return "Item";
  }

  const hasAsterisk = nodes.some((p) => nodeLabel(p).includes("*"));

  const atWholesale = itemCount >= wholesale;
  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  let line1: string;
  let line2: string | null = null;

  if (atWholesale) {
    line1 = "🏆 You've unlocked Our Absolute Best Rates on everything!";
  } else if (atBonus) {
    const need = wholesale - itemCount;
    line1 = `🎉 Awesome! You have 1 FREE item + ${bonusPct}% OFF an item.`;
    line2 = `Add ${need} more item${need === 1 ? "" : "s"} to unlock Best Rates!`;
  } else if (atFree) {
    line1 = "🎉 Awesome! You have 1 FREE item.";
    line2 = `Add a ${ord(trigger + 1)} item to get ${bonusPct}% OFF!`;
  } else if (itemCount === 1) {
    line1 = "🛍️ Welcome! Add a 2nd item.";
    line2 = `Add a ${ord(trigger)} item to unlock 1 FREE item!`;
  } else {
    line1 = `🎉 Awesome! You have ${itemCount} items.`;
    line2 = `Add a ${ord(trigger)} item to unlock 1 FREE item!`;
  }

  const nodeSize = compact ? "w-4 h-4" : "w-6 h-6";
  const numSize = compact ? "text-[8px]" : "text-[10px]";
  const labelSize = compact ? "text-[8px]" : "text-[9px]";
  const padding = compact ? "px-3 py-2" : "px-4 py-3";
  const hookSize = compact ? "text-xs" : "text-sm";

  return (
    <div
      className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-500 dark:border-emerald-600 shadow-sm ${padding} space-y-2.5`}
      data-testid="nudge-card"
    >
      <div className="flex items-start" data-testid="nudge-track">
        {nodes.map((pos, idx) => {
          const filled = pos <= itemCount;
          const isLast = idx === nodes.length - 1;
          const lineAfterFilled = pos < itemCount;
          return (
            <div key={pos} className="flex flex-col items-center flex-1 min-w-0">
              <div className="flex items-center w-full">
                <div
                  className={`${nodeSize} rounded-full shrink-0 flex items-center justify-center font-bold ${numSize} transition-colors ${
                    filled
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                  data-testid={`nudge-node-${pos}`}
                >
                  {pos}
                </div>
                {!isLast && (
                  <div
                    className={`flex-1 h-0.5 transition-colors ${
                      lineAfterFilled
                        ? "bg-emerald-500"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className={`mt-1 ${labelSize} font-medium text-center leading-tight px-0.5 ${
                  filled
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {nodeLabel(pos)}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className={`${hookSize} font-semibold text-emerald-900 dark:text-emerald-100 leading-snug`}
        data-testid="nudge-hook"
      >
        <span>{line1}</span>
        {line2 && (
          <span className="block font-normal text-emerald-700 dark:text-emerald-300 mt-0.5">
            {line2}
          </span>
        )}
      </div>

      {hasAsterisk && (
        <p
          className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight"
          data-testid="nudge-footnote"
        >
          *Discounts apply to the lowest-priced items in your order.
        </p>
      )}
    </div>
  );
}
