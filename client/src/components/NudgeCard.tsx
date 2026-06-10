import { ShoppingCart } from "lucide-react";

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
    if (itemCount === 0) return pos === 1 ? "active" : "locked";
    if (pos <= itemCount) return "complete";
    if (pos === itemCount + 1 && !atWholesale) return "active";
    return "locked";
  }

  function nodeLabel(pos: number): string {
    if (pos === wholesale) return "Bulk Rates!";
    if (pos === trigger + 1) return `${bonusPct}% Off*`;
    if (pos === trigger) return "Free*";
    return `Item ${pos}`;
  }

  function rewardIcon(pos: number): string | null {
    if (pos === wholesale) return "🏆";
    if (pos === trigger + 1) return null;
    if (pos === trigger) return "🎁";
    return null;
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

  const cartIconSize = compact ? "w-8 h-8" : "w-10 h-10";
  const numFont      = compact ? "text-[10px]" : "text-[12px]";
  const labelFont    = compact ? "text-[11px] tracking-tight" : "text-[13px]";
  const msgFont      = compact ? "text-xs" : "text-sm";
  const line2Font    = compact ? "text-[13px]" : "text-[15px]";
  const pad          = compact ? "p-3.5" : "p-5";
  const trackTop     = compact ? "top-[16px]" : "top-[20px]";

  return (
    <div
      className={`bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40 rounded-xl ${pad} space-y-4 shadow-sm`}
      data-testid="nudge-card"
    >
      <div className="flex justify-between relative" data-testid="nudge-track">
        {/* Progress track */}
        <div className={`absolute ${trackTop} left-0 right-0 h-1 bg-amber-200 dark:bg-amber-800/50 rounded-full z-0`}>
          <div
            className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-[width] duration-500 ease-in-out"
            style={{ width: `${fillPct}%` }}
          />
        </div>

        {nodes.map((pos) => {
          const state = nodeState(pos);
          const isMilestone = nodeLabel(pos) !== `Item ${pos}`;
          const icon = rewardIcon(pos);
          const label = pos === wholesale ? "5+" : String(pos);

          const isComplete = state === "complete";
          const isWholesale = pos === wholesale;

          const iconColor = isWholesale
            ? "text-rose-500 dark:text-rose-400"
            : isComplete
            ? "text-amber-500 dark:text-amber-400"
            : "text-orange-400 dark:text-orange-400";

          const numColor = isWholesale
            ? "text-rose-600 dark:text-rose-400 font-black"
            : isComplete
            ? "text-amber-600 dark:text-amber-400 font-black"
            : "text-orange-500 dark:text-orange-400 font-black";

          return (
            <div
              key={pos}
              className="relative z-10 flex flex-col items-center flex-1"
              data-testid={`nudge-node-${pos}`}
            >
              {/* Cart icon with bubble badge */}
              <div className={`relative ${cartIconSize} flex items-center justify-center`}>
                <ShoppingCart
                  className={`w-full h-full ${iconColor} ${state === "active" ? "nudge-active-pulse" : ""}`}
                  strokeWidth={1.5}
                />
                <span
                  className={`absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center ${numFont} font-black text-white leading-none pointer-events-none ${
                    isWholesale
                      ? "bg-rose-500"
                      : isComplete
                      ? "bg-amber-500"
                      : "bg-orange-500"
                  }`}
                >
                  {label}
                </span>
              </div>

              {/* Milestone label below */}
              {isMilestone && (
                <span
                  className={`mt-1 ${labelFont} font-bold text-center whitespace-nowrap leading-tight flex items-center gap-0.5 ${
                    isComplete
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-orange-500 dark:text-orange-400"
                  }`}
                >
                  {icon && !isComplete && (
                    <span className={isWholesale ? "text-[1.1em]" : ""}>{icon}</span>
                  )}
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
