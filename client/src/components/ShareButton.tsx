import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  className?: string;
  variant?: "icon" | "row";
}

export default function ShareButton({ url, title, text, className, variant = "icon" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleShare = async () => {
    if (canNativeShare) {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch {
      }
    }
    setOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied!", description: url });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  if (variant === "row") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={canNativeShare ? handleShare : undefined}
            className={`flex items-center gap-3 w-full px-5 py-3 text-sm font-medium transition-colors hover:bg-accent text-foreground ${className ?? ""}`}
            data-testid="button-share-site"
          >
            <Share2 className="w-4 h-4 shrink-0" />
            Share TurtleLittle
          </button>
        </PopoverTrigger>
        {!canNativeShare && (
          <PopoverContent side="right" align="start" className="w-52 p-1">
            <ShareOptions copyLink={copyLink} copied={copied} waUrl={waUrl} fbUrl={fbUrl} onClose={() => setOpen(false)} />
          </PopoverContent>
        )}
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={`h-8 w-8 text-muted-foreground hover:text-foreground ${className ?? ""}`}
          onClick={handleShare}
          aria-label="Share"
          data-testid="button-share"
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      {!canNativeShare && (
        <PopoverContent side="bottom" align="end" className="w-48 p-1">
          <ShareOptions copyLink={copyLink} copied={copied} waUrl={waUrl} fbUrl={fbUrl} onClose={() => setOpen(false)} />
        </PopoverContent>
      )}
    </Popover>
  );
}

function ShareOptions({ copyLink, copied, waUrl, fbUrl, onClose }: {
  copyLink: () => void;
  copied: boolean;
  waUrl: string;
  fbUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={() => { copyLink(); onClose(); }}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors text-left"
        data-testid="share-option-copy"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors"
        data-testid="share-option-whatsapp"
      >
        <MessageCircle className="w-4 h-4 text-green-500" />
        WhatsApp
      </a>
      <a
        href={fbUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors"
        data-testid="share-option-facebook"
      >
        <Facebook className="w-4 h-4 text-blue-600" />
        Facebook
      </a>
    </div>
  );
}
