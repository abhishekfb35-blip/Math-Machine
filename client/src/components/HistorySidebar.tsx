import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trash2, History, Clock } from "lucide-react";
import { useHistory, useClearHistory } from "@/hooks/use-history";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface HistorySidebarProps {
  onSelect: (expression: string) => void;
}

export function HistorySidebar({ onSelect }: HistorySidebarProps) {
  const { data: history, isLoading } = useHistory();
  const clearHistory = useClearHistory();

  return (
    <div className="flex flex-col h-full w-full max-w-sm glass rounded-3xl overflow-hidden border border-white/10">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-xl text-primary">
            <History className="w-5 h-5" />
          </div>
          <h2 className="font-semibold text-lg tracking-tight">History</h2>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={() => clearHistory.mutate()}
          disabled={!history?.length || clearHistory.isPending}
          title="Clear History"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading history...</p>
            </div>
          ) : !history || history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground">
                <Clock className="w-8 h-8 opacity-50" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">No calculations yet</p>
                <p className="text-xs text-muted-foreground max-w-[180px]">
                  Perform some math to see your history here.
                </p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="group relative"
                >
                  <button
                    onClick={() => onSelect(item.expression)}
                    className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 transition-all duration-200 group-hover:translate-x-1"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.createdAt && format(new Date(item.createdAt), "HH:mm")}
                      </span>
                    </div>
                    <div className="font-mono text-sm text-muted-foreground mb-1 truncate">
                      {item.expression} =
                    </div>
                    <div className="font-mono text-xl font-medium text-foreground tracking-tight">
                      {item.result}
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
