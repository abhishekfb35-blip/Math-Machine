import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ZoomIn, ZoomOut } from "lucide-react";
import { getProductImageUrl } from "@/lib/imageUtils";

interface ImageItem {
  id: number | string;
  imageUrl: string;
}

interface ImageZoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ImageItem[];
  initialIndex: number;
  productName: string;
}

export default function ImageZoomDialog({
  open,
  onOpenChange,
  images,
  initialIndex,
  productName,
}: ImageZoomDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState("center center");
  const imageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedIndex(initialIndex);
      setIsZoomed(false);
    }
  }, [open, initialIndex]);

  const currentImage = images[selectedIndex] || images[0];

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setIsZoomed(false);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  const handleImageClick = useCallback(() => {
    setIsZoomed((prev) => !prev);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isZoomed || !imageContainerRef.current) return;
      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setTransformOrigin(`${x}% ${y}%`);
    },
    [isZoomed]
  );

  const handleThumbnailClick = useCallback((idx: number) => {
    setSelectedIndex(idx);
    setIsZoomed(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[95vw] md:max-w-[85vw] lg:max-w-[75vw] h-[90vh] md:h-[85vh] p-0 gap-0 overflow-hidden"
        data-testid="dialog-image-zoom"
      >
        <VisuallyHidden>
          <DialogTitle>{productName} - Image Viewer</DialogTitle>
          <DialogDescription>Click the image to zoom in, move mouse to pan</DialogDescription>
        </VisuallyHidden>

        <div className="flex flex-col md:flex-row h-full">
          <div
            ref={imageContainerRef}
            className="flex-1 relative overflow-hidden bg-white dark:bg-neutral-950 flex items-center justify-center"
            onClick={handleImageClick}
            onMouseMove={handleMouseMove}
            style={{ cursor: isZoomed ? "zoom-out" : "zoom-in" }}
            data-testid="zoom-image-container"
          >
            <img
              src={getProductImageUrl(currentImage.imageUrl, "large")}
              alt={`${productName} view ${selectedIndex + 1}`}
              className="absolute inset-0 w-full h-full object-contain transition-transform duration-200 ease-out"
              style={{
                transform: isZoomed ? "scale(2.5)" : "scale(1)",
                transformOrigin: transformOrigin,
              }}
              draggable={false}
              data-testid="img-zoomed-product"
            />

            <div className="absolute top-3 left-3 flex gap-1">
              <div className="bg-background/80 backdrop-blur-sm rounded-md p-1.5">
                {isZoomed ? (
                  <ZoomOut className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ZoomIn className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>

          {images.length > 1 && (
            <div className="md:w-28 lg:w-32 border-t md:border-t-0 md:border-l bg-background p-2 md:p-3">
              <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:overflow-x-hidden md:max-h-full pb-1 md:pb-0">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => handleThumbnailClick(idx)}
                    className={`flex-shrink-0 w-14 h-14 md:w-full md:h-auto md:aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                      idx === selectedIndex
                        ? "border-primary"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                    data-testid={`button-zoom-thumbnail-${idx}`}
                  >
                    <img
                      src={getProductImageUrl(img.imageUrl, "small")}
                      alt={`${productName} view ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
