import { storage } from "../storage";
import { notificationService } from "../providers/notification";

function jobLog(message: string) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${time} [abandoned-cart] ${message}`);
}

async function isEnabled(): Promise<boolean> {
  try {
    const record = await storage.getSiteConfig("abandoned_cart_emails_enabled");
    if (!record) return true;
    return record.value === "true" || record.value === "1";
  } catch {
    return true;
  }
}

async function getRecoveryCode(): Promise<string | undefined> {
  try {
    const record = await storage.getSiteConfig("abandoned_cart_recovery_code");
    return record?.value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function runAbandonedCartJob() {
  try {
    if (!(await isEnabled())) {
      return;
    }

    const recoveryCode = await getRecoveryCode();
    const abandonedCarts = await storage.getAbandonedCarts();

    if (abandonedCarts.length === 0) return;

    jobLog(`Found ${abandonedCarts.length} abandoned cart(s) to process`);

    for (const cart of abandonedCarts) {
      try {
        const cartItems = await storage.getCartItems(cart.cartId);
        if (cartItems.length === 0) continue;

        const itemDetails = await Promise.all(
          cartItems.map(async ci => {
            const product = await storage.getProductById(ci.productId);
            let effectivePrice = product?.price ?? 0;
            if (product && ci.selectedSize) {
              try {
                const variantOptions = await storage.getProductVariantOptions(ci.productId);
                const sizeConfig = variantOptions.sizes.find(s => s.name === ci.selectedSize);
                if (sizeConfig && sizeConfig.priceAdd > 0) {
                  effectivePrice = product.price + sizeConfig.priceAdd;
                }
              } catch {}
            }
            return {
              productName: product?.name ?? "Unknown Product",
              personalizationName: ci.personalizationName ?? null,
              quantity: ci.quantity,
              price: effectivePrice,
            };
          })
        );

        const firstName = (cart.customerName || cart.customerEmail.split("@")[0] || "").split(" ")[0] || "";
        const cartUrl = "https://turtlelittle.com/cart";

        const result = await notificationService.sendAbandonedCart(
          cart.customerEmail,
          firstName,
          itemDetails,
          cartUrl,
          recoveryCode,
        );

        if (result.success) {
          await storage.markCartAbandonedEmailSent(cart.cartId);
          jobLog(`Sent email to ${cart.customerEmail} for cart ${cart.cartId}`);
        } else {
          console.error(`[abandoned-cart] Email delivery failed for cart ${cart.cartId}: ${result.error}`);
        }
      } catch (err: any) {
        console.error(`[abandoned-cart] Failed for cart ${cart.cartId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[abandoned-cart] Scheduler error:", err.message);
  }
}

export function startAbandonedCartScheduler() {
  const INTERVAL_MS = 30 * 60 * 1000;
  setInterval(runAbandonedCartJob, INTERVAL_MS);
  jobLog("Scheduler started — checks every 30 minutes");
}
