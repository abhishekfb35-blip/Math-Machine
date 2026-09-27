import {
  defaultAboutPage,
  defaultPrivacyPage,
  defaultRefundPage,
  defaultShippingPage,
  defaultTermsPage,
  normalizeAboutPage,
  normalizePolicyPage,
  type AboutPageConfig,
  type TermsPageConfig,
} from "../client/src/lib/siteConfigDefaults";
import { publicInfoMetadata, type PublicInfoPath } from "@shared/discoverability";
import type { IStorage } from "./storage";

type PolicyPath = Exclude<PublicInfoPath, "about" | "contact">;

export type PublicInfoContent =
  | { kind: "about"; config: AboutPageConfig }
  | { kind: "policy"; path: PolicyPath; config: TermsPageConfig }
  | { kind: "contact" };

export interface LoadedPublicInfoPage {
  path: PublicInfoPath;
  content: PublicInfoContent;
  siteConfig: Record<string, unknown>;
}

const policyDefaults: Record<PolicyPath, TermsPageConfig> = {
  terms: defaultTermsPage,
  privacy: defaultPrivacyPage,
  "refund-policy": defaultRefundPage,
  shipping: defaultShippingPage,
};

const policyKeys: Record<PolicyPath, string> = {
  terms: "page-terms",
  privacy: "page-privacy",
  "refund-policy": "page-refund",
  shipping: "page-shipping",
};

export async function loadPublicInfoPage(
  pathname: string,
  storage: IStorage,
): Promise<LoadedPublicInfoPage | null> {
  const slug = pathname.replace(/^\/|\/$/g, "");
  if (!Object.prototype.hasOwnProperty.call(publicInfoMetadata, slug)) return null;
  const path = slug as PublicInfoPath;

  // This is the same aggregate shape returned by /api/site-config, which the
  // interactive page, header and footer all consume after the snapshot handoff.
  const [configs, contents] = await Promise.all([
    storage.getAllSiteConfigs(),
    storage.getAllSiteContents(),
  ]);
  const siteConfig: Record<string, unknown> = {};
  for (const row of [...configs, ...contents]) {
    try {
      siteConfig[row.key] = JSON.parse(row.value);
    } catch {
      siteConfig[row.key] = row.value;
    }
  }

  if (path === "contact") return { path, content: { kind: "contact" }, siteConfig };

  if (path === "about") {
    const key = "page-about";
    const config = normalizeAboutPage(siteConfig[key]);
    siteConfig[key] = config;
    return { path, content: { kind: "about", config }, siteConfig };
  }

  const key = policyKeys[path];
  const config = normalizePolicyPage(siteConfig[key], policyDefaults[path]);
  siteConfig[key] = config;
  return { path, content: { kind: "policy", path, config }, siteConfig };
}