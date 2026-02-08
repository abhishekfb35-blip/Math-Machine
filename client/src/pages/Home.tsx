import { useState, useEffect } from "react";
import { Calculator } from "@/components/Calculator";
import { HistorySidebar } from "@/components/HistorySidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { History as HistoryIcon, Calculator as CalculatorIcon, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function Home() {
  const [currentExpression, setCurrentExpression] = useState("");
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
      setIsInstalled(true);
    }
  };

  const handleHistorySelect = (expression: string) => {
    setCurrentExpression(expression);
    setMobileHistoryOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 lg:p-8 gap-8 max-w-7xl mx-auto">
      
      {/* Install App Button */}
      <AnimatePresence>
        {installPrompt && !isInstalled && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-4 z-50"
          >
            <Button
              onClick={handleInstall}
              variant="default"
              className="gap-2 rounded-full shadow-lg shadow-primary/30"
              data-testid="button-install-app"
            >
              <Download className="w-4 h-4" />
              Install App
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile History Toggle */}
      <div className="lg:hidden absolute top-4 right-4 z-50">
        <Sheet open={mobileHistoryOpen} onOpenChange={setMobileHistoryOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full h-12 w-12 bg-background/50 backdrop-blur-md border-white/10 hover:bg-white/10">
              <HistoryIcon className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 border-l border-white/10 bg-background/95 backdrop-blur-xl w-full sm:max-w-md">
            <HistorySidebar onSelect={handleHistorySelect} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col items-center gap-8 w-full max-w-sm lg:max-w-none lg:w-auto"
      >
        <div className="text-center space-y-2 lg:hidden">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/20 text-primary mb-4">
            <CalculatorIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
            Calculator
          </h1>
          <p className="text-muted-foreground text-sm">
            Advanced mathematics made beautiful
          </p>
        </div>

        <Calculator 
          initialExpression={currentExpression}
          onExpressionChange={setCurrentExpression}
        />
      </motion.div>

      {/* Desktop History Sidebar */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="hidden lg:flex flex-col h-[680px] w-96 shrink-0 gap-6"
      >
        <div className="flex items-center gap-4 px-2">
          <div className="p-2 bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-lg shadow-primary/20 text-white">
            <CalculatorIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Calculator</h1>
            <p className="text-sm text-muted-foreground">Beautifully precise.</p>
          </div>
        </div>
        
        <HistorySidebar onSelect={handleHistorySelect} />
      </motion.div>
    </div>
  );
}
