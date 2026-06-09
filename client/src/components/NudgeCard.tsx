export interface EngineThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

interface NudgeCardProps {
  itemCount: number;
  engineThresholds: EngineThresholds | null;
  compact?: boolean;
  showTeaser?: boolean;
}

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const Hi = ({ children }: { children: React.ReactNode }) => (
  <strong className="text-amber-600 dark:text-amber-400 font-bold">{children}</strong>
);

export default function NudgeCard({
  itemCount,
  engineThresholds,
  compact = false,
  showTeaser = false,
}: NudgeCardProps) {
  if (!engineThresholds) return null;
  if (itemCount === 0 && !showTeaser) return null;

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
    if (itemCount === 0) return "locked";
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

  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  let line1: React.ReactNode;
  let line2: React.ReactNode = null;

  if (itemCount === 0) {
    line1 = <>🎁 Add {trigger} items and get <Hi>1 FREE</Hi> — automatically!</>;
  } else if (atWholesale) {
    line1 = <>🏆 You've unlocked <Hi>Our Absolute Best Rates</Hi> on everything!</>;
  } else if (atBonus) {
    const need = wholesale - itemCount;
    line1 = <>🎉 Awesome! You have <Hi>1 FREE item</Hi> + <Hi>{bonusPct}% OFF</Hi> an item.</>;
    line2 = <>Add {need} more item{need === 1 ? "" : "s"} to get <Hi>Our Absolute Best Rates</Hi>!</>;
  } else if (atFree) {
    line1 = <>🎉 Awesome! You have <Hi>1 FREE item</Hi>.</>;
    line2 = <>Add a {ord(trigger + 1)} item to get <Hi>{bonusPct}% OFF</Hi>!</>;
  } else if (itemCount === 1) {
    line1 = <>🛍️ Welcome! Add a 2nd item.</>;
    line2 = <>Add a {ord(trigger)} item to unlock <Hi>1 FREE item</Hi>!</>;
  } else {
    line1 = <>🎉 Awesome! You have {itemCount} items.</>;
    line2 = <>Add a {ord(trigger)} item to unlock <Hi>1 FREE item</Hi>!</>;
  }

  const hasAsterisk = nodes.some((p) => nodeLabel(p).includes("*"));

  const pillClasses = compact
    ? "px-2.5 py-0.5 rounded-full text-[10px] font-bold border-2 transition-all whitespace-nowrap"
    : "px-3 py-1 rounded-full text-[11px] font-bold border-2 transition-all whitespace-nowrap";
  const labelFont = compact ? "text-[11px] tracking-tight" : "text-[13px]";
  const msgFont = compact ? "text-xs" : "text-sm";
  const line2Font = compact ? "text-[13px]" : "text-[15px]";
  const pad = compact ? "p-3.5" : "p-5";
  const trackTop = compact ? "top-[10px]" : "top-[12px]";

  return (
    <div
      className={`bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40 rounded-xl ${pad} space-y-4 shadow-sm`}
      data-testid="nudge-card"
    >
      <div className="flex justify-between relative" data-testid="nudge-track">
        <div className={`absolute ${trackTop} left-0 right-0 h-1 bg-amber-100 dark:bg-amber-900/40 rounded-full z-0`}>
          <div
            className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-[width] duration-500 ease-in-out"
            style={{ width: `${fillPct}%` }}
          />
        </div>

        {nodes.map((pos) => {
          const state = nodeState(pos);
          const isMilestone = nodeLabel(pos) !== `Item ${pos}`;
          return (
            <div
              key={pos}
              className="relative z-10 flex flex-col items-center flex-1"
              data-testid={`nudge-node-${pos}`}
            >
              <div
                className={`${pillClasses} ${
                  state === "complete"
                    ? "bg-amber-500 dark:bg-amber-400 border-amber-500 dark:border-amber-400 text-white"
                    : state === "active"
                    ? "bg-white dark:bg-amber-950/40 border-orange-400 text-orange-500 nudge-active-pulse"
                    : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-300 dark:text-amber-700"
                }`}
              >
                Item {pos}
              </div>
              {isMilestone && (
                <span
                  className={`mt-1.5 ${labelFont} font-semibold text-center whitespace-nowrap leading-tight ${
                    state === "complete"
                      ? "text-amber-600 dark:text-amber-400"
                      : state === "active"
                      ? "text-slate-800 dark:text-slate-200 font-bold"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {nodeLabel(pos)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-left space-y-0.5 px-0.5" data-testid="nudge-hook">
        <p className={`${msgFont} font-bold text-amber-700 dark:text-amber-400 leading-snug`}>
          {line1}
        </p>
        {line2 && (
          <p className={`${line2Font} font-semibold text-slate-800 dark:text-slate-200 leading-snug`}>
            {line2}
          </p>
        )}
      </div>

      {hasAsterisk && (
        <p
          className="text-[12px] text-slate-600 dark:text-slate-400 text-left border-t border-dashed border-amber-200 dark:border-amber-800/40 pt-2.5 leading-tight px-0.5"
          data-testid="nudge-footnote"
        >
          *Discounts apply to the lowest-priced items in your order.
        </p>
      )}
    </div>
  );
}
