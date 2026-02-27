import crypto from "crypto";

const CCAVENUE_TEST_URL = "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";
const CCAVENUE_LIVE_URL = "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

export function getCCAvenueMerchantId(): string {
  return process.env.CCAVENUE_MERCHANT_ID || "";
}

export function getCCAvenueAccessCode(): string {
  return process.env.CCAVENUE_ACCESS_CODE || "";
}

function getWorkingKey(): string {
  return process.env.CCAVENUE_WORKING_KEY || "";
}

export function isCCAvenueConfigured(): boolean {
  return !!(process.env.CCAVENUE_MERCHANT_ID && process.env.CCAVENUE_ACCESS_CODE && process.env.CCAVENUE_WORKING_KEY);
}

export function getCCAvenueUrl(): string {
  const isTest = process.env.CCAVENUE_MODE !== "live";
  return isTest ? CCAVENUE_TEST_URL : CCAVENUE_LIVE_URL;
}

export function encrypt(plainText: string): string {
  const workingKey = getWorkingKey();
  const keyHash = crypto.createHash("md5").update(workingKey).digest();
  const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
  const cipher = crypto.createCipheriv("aes-128-cbc", keyHash, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return encrypted;
}

export function decrypt(encryptedText: string): string {
  const workingKey = getWorkingKey();
  const keyHash = crypto.createHash("md5").update(workingKey).digest();
  const iv = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f]);
  const decipher = crypto.createDecipheriv("aes-128-cbc", keyHash, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function parseDecryptedResponse(decrypted: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = decrypted.split("&");
  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    if (eqIndex > 0) {
      const key = decodeURIComponent(pair.substring(0, eqIndex));
      const value = decodeURIComponent(pair.substring(eqIndex + 1));
      params[key] = value;
    }
  }
  return params;
}

export interface CCAvenuOrderParams {
  orderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  redirectUrl: string;
  cancelUrl: string;
}

export function buildEncryptedRequest(params: CCAvenuOrderParams): string {
  const merchantId = getCCAvenueMerchantId();

  const data = [
    `merchant_id=${merchantId}`,
    `order_id=${params.orderId}`,
    `currency=${params.currency}`,
    `amount=${params.amount.toFixed(2)}`,
    `redirect_url=${params.redirectUrl}`,
    `cancel_url=${params.cancelUrl}`,
    `language=EN`,
    `billing_name=${params.customerName}`,
    `billing_email=${params.customerEmail}`,
    `billing_tel=${params.customerPhone}`,
    `billing_address=${params.shippingAddress}`,
    `billing_city=${params.shippingCity}`,
    `billing_state=${params.shippingState}`,
    `billing_zip=${params.shippingPincode}`,
    `billing_country=India`,
    `delivery_name=${params.customerName}`,
    `delivery_address=${params.shippingAddress}`,
    `delivery_city=${params.shippingCity}`,
    `delivery_state=${params.shippingState}`,
    `delivery_zip=${params.shippingPincode}`,
    `delivery_country=India`,
    `delivery_tel=${params.customerPhone}`,
  ].join("&");

  return encrypt(data);
}
