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

  const atWholesale = itemCount >= wholesale;

  const fillPct =
    wholesale <= 1
      ? 100
      : Math.min(100, Math.max(0, ((Math.min(itemCount, wholesale) - 1) / (wholesale - 1)) * 100));

  function nodeState(pos: number): "complete" | "active" | "locked" {
    if (pos <= itemCount) return "complete";
    if (pos === itemCount + 1 && !atWholesale) return "active";
    return "locked";
  }

  function nodeLabel(pos: number): string {
    if (pos === wholesale) return "Best Rates!";
    if (pos === trigger + 1) return `${bonusPct}% Off*`;
    if (pos === trigger) return "Free*";
    return `Item ${pos}`;
  }

  function circleContent(pos: number, state: "complete" | "active" | "locked"): string {
    if (state === "complete") return "✓";
    if (pos === wholesale) return "★";
    return String(pos);
  }

  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  let line1: string;
  let line2: string | null = null;

  if (atWholesale) {
    line1 = "🏆 You've unlocked Our Absolute Best Rates on everything!";
  } else if (atBonus) {
    const need = wholesale - itemCount;
    line1 = `🎉 Awesome! You have 1 FREE item + ${bonusPct}% OFF an item.`;
    line2 = `Add ${need} more item${need === 1 ? "" : "s"} to get Our Absolute Best Rates!`;
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

  const hasAsterisk = nodes.some((p) => nodeLabel(p).includes("*"));

  const circleSize = compact ? "w-5 h-5" : "w-7 h-7";
  const circleFont = compact ? "text-[9px]" : "text-[11px]";
  const labelFont = compact ? "text-[11px] tracking-tight" : "text-[15px]";
  const msgFont = compact ? "text-xs" : "text-sm";
  const pad = compact ? "p-3.5" : "p-5";
  const trackTop = compact ? "top-[10px]" : "top-[14px]";

  return (
    <div
      className={`bg-white dark:bg-card border border-border rounded-xl ${pad} space-y-4 shadow-sm`}
      data-testid="nudge-card"
    >
      <div className="flex justify-between relative" data-testid="nudge-track">
        <div className={`absolute ${trackTop} left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 rounded-full z-0`}>
          <div
            className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-[width] duration-500 ease-in-out"
            style={{ width: `${fillPct}%` }}
          />
        </div>

        {nodes.map((pos) => {
          const state = nodeState(pos);
          return (
            <div
              key={pos}
              className="relative z-10 flex flex-col items-center flex-1"
              data-testid={`nudge-node-${pos}`}
            >
              <div
                className={`${circleSize} rounded-full flex items-center justify-center font-bold ${circleFont} border-2 transition-all ${
                  state === "complete"
                    ? "bg-emerald-600 dark:bg-emerald-500 border-emerald-600 dark:border-emerald-500 text-white"
                    : state === "active"
                    ? "bg-white dark:bg-card border-orange-400 text-orange-400 nudge-active-pulse"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600"
                }`}
              >
                {circleContent(pos, state)}
              </div>
              <span
                className={`mt-1.5 ${labelFont} font-semibold text-center whitespace-nowrap leading-tight ${
                  state === "complete"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : state === "active"
                    ? "text-slate-800 dark:text-slate-200 font-bold"
                    : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {nodeLabel(pos)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-left space-y-0.5 px-0.5" data-testid="nudge-hook">
        <p className={`${msgFont} font-semibold text-emerald-700 dark:text-emerald-400 leading-snug`}>
          {line1}
        </p>
        {line2 && (
          <p className={`${msgFont} text-slate-700 dark:text-slate-300 leading-snug`}>
            {line2}
          </p>
        )}
      </div>

      {hasAsterisk && (
        <p
          className="text-[10px] text-slate-400 dark:text-slate-500 text-left border-t border-dashed border-slate-200 dark:border-slate-700 pt-2.5 leading-tight px-0.5"
          data-testid="nudge-footnote"
        >
          *Discounts apply to the lowest-priced items in your order.
        </p>
      )}
    </div>
  );
}
