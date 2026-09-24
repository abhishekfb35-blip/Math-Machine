import { useEffect, useState } from "react";
import { Gift, Minus, Plus, ShoppingCart } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import "./_group.css";

type ProductColor = {
  name: string;
  swatchUrl: string;
};

type ProductSize = {
  name: string;
  description: string;
  priceAdd: number;
  mrpAdd: number;
  isDefault?: boolean;
  colors: ProductColor[];
};

const product = {
  id: "esiva1z402rn07qp7i5a8k54",
  name: "Little Unicorn Pony Personalised Kids Bath Towel",
  imageUrl: "/__mockup/images/quick-add/product.jpg",
  price: 999,
  mrp: 1299,
};

const sizes: ProductSize[] = [
  {
    name: "120*60 cm, Kids Size",
    description: "0 to 15 yrs or up to 5 ft 2 in of height",
    priceAdd: 0,
    mrpAdd: 0,
    isDefault: true,
    colors: [
      { name: "Turquoise Blue", swatchUrl: "/__mockup/images/quick-add/turquoise-blue.jpg" },
      { name: "Baby Pink", swatchUrl: "/__mockup/images/quick-add/baby-pink.jpg" },
      { name: "Lemon Yellow", swatchUrl: "/__mockup/images/quick-add/lemon-yellow.jpg" },
      { name: "Purple", swatchUrl: "/__mockup/images/quick-add/purple.jpg" },
      { name: "Deep Red", swatchUrl: "/__mockup/images/quick-add/deep-red.jpg" },
      { name: "Gray", swatchUrl: "/__mockup/images/quick-add/gray.jpg" },
    ],
  },
  {
    name: "150*75 cm",
    description: "Adult Bath Towel (King Size)",
    priceAdd: 300,
    mrpAdd: 0,
    colors: [
      { name: "Turquoise Blue", swatchUrl: "/__mockup/images/quick-add/turquoise-blue.jpg" },
      { name: "Baby Pink", swatchUrl: "/__mockup/images/quick-add/baby-pink.jpg" },
      { name: "Lemon Yellow", swatchUrl: "/__mockup/images/quick-add/lemon-yellow.jpg" },
      { name: "Purple", swatchUrl: "/__mockup/images/quick-add/purple.jpg" },
      { name: "Deep Red", swatchUrl: "/__mockup/images/quick-add/deep-red.jpg" },
      { name: "Gray", swatchUrl: "/__mockup/images/quick-add/gray.jpg" },
    ],
  },
];

const nameMin = 3;
const nameMax = 11;

function nameCharHint(value: string) {
  const left = nameMax - value.length;
  if (value.length === 0) return { text: `${nameMin} to ${nameMax} characters`, className: "text-muted-foreground" };
  if (value.length < nameMin) return { text: `Minimum ${nameMin} characters · ${left} characters left`, className: "text-amber-500" };
  return { text: `${left} character${left !== 1 ? "s" : ""} left`, className: "text-muted-foreground" };
}

function EmbroideryNeedleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-amber-600 dark:text-amber-300"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      data-testid="icon-quickadd-needle"
    >
      <path d="m5 15 10-10" />
      <path d="m13.5 3.5 3 3" />
      <path d="M5 15c-1.7.1-3.2.8-3.7 2.1-.4 1.1.3 2 1.5 1.8 1.3-.2 2.3-1.7 3-2.8 1.2-1.8 2.4-1.7 3.5-.7 1.1 1 2.1 1.1 3.2.5" />
    </svg>
  );
}

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function Current() {
  const [open, setOpen] = useState(true);
  const [personalizationName, setPersonalizationName] = useState("");
  const [showNameConfirm, setShowNameConfirm] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedSizeName, setSelectedSizeName] = useState<string | null>(null);
  const [sizeColorMap, setSizeColorMap] = useState<Record<string, string>>({});
  const [cartItemCount, setCartItemCount] = useState(0);
  const [addedMessage, setAddedMessage] = useState("");

  const selectedSizeObj = sizes.find((size) => size.name === selectedSizeName);
  const colorsForSelectedSize = selectedSizeObj?.colors ?? [];
  const effectivePrice = product.price + (selectedSizeObj?.priceAdd ?? 0);
  const effectiveMrp = product.mrp + (selectedSizeObj?.mrpAdd ?? 0);
  const variantSelectionIncomplete = !selectedSizeName || !sizeColorMap[selectedSizeName];
  const nameInvalid = personalizationName.trim().length > 0 && personalizationName.trim().length < nameMin;

  useEffect(() => {
    if (!selectedSizeName) {
      const defaultSize = sizes.find((size) => size.isDefault) ?? sizes[0];
      if (defaultSize) {
        setSelectedSizeName(defaultSize.name);
        setSizeColorMap((previous) => ({ ...previous, [defaultSize.name]: defaultSize.colors[0]?.name ?? "" }));
      }
    }
  }, [selectedSizeName]);

  useEffect(() => {
    if (!open) {
      setPersonalizationName("");
      setQuantity(1);
      setSelectedSizeName(null);
      setSizeColorMap({});
    }
  }, [open]);

  const addToCart = () => {
    setCartItemCount((count) => count + quantity);
    setAddedMessage(`${product.name} has been added to your cart.`);
    setShowNameConfirm(false);
    setOpen(false);
  };

  const submit = () => {
    if (nameInvalid || variantSelectionIncomplete) return;
    if (!personalizationName.trim()) {
      setShowNameConfirm(true);
      return;
    }
    addToCart();
  };

  return (
    <div className="quick-add-prototype min-h-screen bg-background text-foreground">
      {!open && (
        <div className="fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-background px-4 py-3 shadow-sm">
          <p className="text-sm font-medium" role="status">{addedMessage || "Add an item to your cart"}</p>
          <Button size="sm" onClick={() => setOpen(true)}>Open Quick Add</Button>
        </div>
      )}
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setAddedMessage("");
        }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl max-h-[90svh] flex flex-col md:left-0 md:right-0 md:mx-auto md:w-[min(92vw,34rem)] md:border-x"
          data-testid="quickadd-sheet-content"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader>
            <SheetTitle className="text-left">Add to Cart</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto flex-1 space-y-4 pt-4 md:min-h-0">
            <div
              className="space-y-4"
              data-testid="quickadd-form-layout"
            >
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      data-testid="img-quickadd-product"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm leading-tight line-clamp-2" data-testid="text-quickadd-name">
                      {product.name}
                    </h3>
                    <p className="text-lg font-bold text-primary mt-1" data-testid="text-quickadd-price">
                      {formatPrice(effectivePrice)}
                      {effectiveMrp > effectivePrice && (
                        <span className="text-sm font-normal text-muted-foreground line-through ml-2" data-testid="text-quickadd-mrp">
                          {formatPrice(effectiveMrp)}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {cartItemCount > 0 ? (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 dark:bg-primary/10 rounded-md px-3 py-2">
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>🎉 You have {cartItemCount} item{cartItemCount === 1 ? "" : "s"} — add 2 items to unlock rewards!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 dark:bg-primary/10 rounded-md px-3 py-2" data-testid="nudge-card">
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>🎁 Add 3 items and get 1 FREE — automatically!</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5" data-testid="section-quickadd-sizes">
                  <Label className="text-sm font-medium">Size</Label>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => {
                      const isSelected = selectedSizeName === size.name;
                      return (
                        <button
                          key={size.name}
                          onClick={() => {
                            setSelectedSizeName(size.name);
                            if (!sizeColorMap[size.name] && size.colors[0]) {
                              setSizeColorMap((previous) => ({ ...previous, [size.name]: size.colors[0].name }));
                            }
                          }}
                          className={`flex items-center px-3 py-1 text-xs rounded border transition-all ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : sizeColorMap[size.name]
                              ? "border-primary/50 hover:border-primary"
                              : "border-border hover:border-primary"
                          }`}
                          data-testid={`button-quickadd-size-${size.name}`}
                        >
                          <span>{size.name}</span>
                          {size.priceAdd > 0 && (
                            <span className="ml-1 text-[10px] opacity-70">+{formatPrice(size.priceAdd)}</span>
                          )}
                          {sizeColorMap[size.name] && (() => {
                            const picked = size.colors.find((color) => color.name === sizeColorMap[size.name]);
                            return picked ? <img src={picked.swatchUrl} alt={picked.name} className="w-5 h-5 rounded-full object-cover ring-2 ring-white ml-1.5 shrink-0" /> : null;
                          })()}
                        </button>
                      );
                    })}
                  </div>
                  {selectedSizeObj?.description && (
                    <p className="text-muted-foreground" style={{ fontSize: "12px" }}>{selectedSizeObj.description}</p>
                  )}
                </div>

                {colorsForSelectedSize.length > 0 && (
                  <div className="space-y-1.5" data-testid="section-quickadd-colors">
                    <Label className="text-sm font-medium">Colour</Label>
                    <div className="flex flex-wrap gap-2">
                      {colorsForSelectedSize.map((color) => {
                        const isSelected = sizeColorMap[selectedSizeName ?? ""] === color.name;
                        return (
                          <button
                            key={color.name}
                            onClick={() => setSizeColorMap((previous) => ({ ...previous, [selectedSizeName ?? ""]: color.name }))}
                            className={`flex items-center gap-1.5 p-1 text-xs rounded border transition-all ${
                              isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary"
                            }`}
                            data-testid={`button-quickadd-color-${color.name}`}
                            title={color.name}
                          >
                            <img src={color.swatchUrl} alt={color.name} className="w-12 h-12 rounded object-cover" />
                            <span className="pr-1">{color.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div
                  className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-800/50 dark:bg-amber-950/20"
                  data-testid="section-quickadd-personalization"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold leading-5">Make it personal</p>
                    <p className="text-xs text-muted-foreground">Your name will be embroidered on this item.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="qa-personalization" className="text-sm font-semibold">Personalise with a Name</Label>
                    <div className="relative">
                      <EmbroideryNeedleIcon />
                      <Input
                        id="qa-personalization"
                        placeholder="Enter name to embroider"
                        value={personalizationName}
                        onChange={(event) => setPersonalizationName(event.target.value)}
                        maxLength={nameMax}
                        className="h-[52px] border-amber-300 bg-white pl-10 text-base shadow-sm placeholder:text-muted-foreground/80 focus-visible:border-amber-500 focus-visible:ring-amber-500/30 dark:border-amber-800/60 dark:bg-background"
                        data-testid="input-quickadd-name"
                      />
                    </div>
                    {(() => { const hint = nameCharHint(personalizationName); return <p className={`text-xs ${hint.className}`}>{hint.text}</p>; })()}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm font-medium">Quantity</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      data-testid="button-quickadd-decrease"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="text-base font-semibold w-8 text-center" data-testid="text-quickadd-qty">{quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => setQuantity(quantity + 1)}
                      data-testid="button-quickadd-increase"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-3 pb-1">
            <Button
              className="w-full"
              size="lg"
              onClick={submit}
              disabled={variantSelectionIncomplete || nameInvalid}
              data-testid="button-quickadd-submit"
            >
              {variantSelectionIncomplete ? (
                `Select ${!selectedSizeName ? "Size" : "Colour"} to Continue`
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart - {formatPrice(effectivePrice * quantity)}
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showNameConfirm} onOpenChange={setShowNameConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No name added</AlertDialogTitle>
            <AlertDialogDescription>
              This product can be personalised with an embroidered name. Are you sure you want to add it to your cart without a name?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-name-confirm-cancel">Add a name</AlertDialogCancel>
            <AlertDialogAction data-testid="button-name-confirm-proceed" onClick={addToCart}>
              Proceed without name
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}