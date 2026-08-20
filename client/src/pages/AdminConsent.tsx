import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, LogIn, Save, Loader2, ChevronLeft, ChevronRight, Users, Heart, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomerConsent } from "@shared/types";
import RichTextEditor from "@/components/RichTextEditor";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SignupPopupConfig {
  enabled: boolean;
  /** Seconds from session start before auto-showing. Default 15. */
  delaySeconds: number;
  /** Seconds after first cart add before auto-showing. Default 2. */
  cartAddDelaySeconds: number;
  /**
   * Seconds after dismissal before the popup re-shows automatically.
   * 0 = disabled (popup stays gone for the session after one dismissal).
   */
  reshowIntervalSeconds: number;
  /** Heading shown on the nudge card. */
  incentiveText: string;
  /** Subtitle line shown below the heading on the nudge card. */
  subtitleText: string;
  /** Subtitle line shown below the heading on the phone form. */
  phoneSubtitleText: string;
  /** Whether a phone number must be provided before account creation. */
  phoneRequired: boolean;
  /** Consent statement / T&C shown below incentive. */
  consentText: string;
  /** Label shown before the reader reaches the bottom. */
  consentScrollPrompt: string;
  /** Label shown after the reader reaches the bottom. */
  consentAgreementLabel: string;
}

const DEFAULT_SIGNUP_POPUP: SignupPopupConfig = {
  enabled: false,
  delaySeconds: 15,
  cartAddDelaySeconds: 2,
  reshowIntervalSeconds: 0,
  incentiveText: "",
  subtitleText: "Save your wishlist, track orders, and check out faster.",
  phoneSubtitleText: "Add your phone number to complete sign-up.",
  phoneRequired: true,
  consentText: "",
  consentScrollPrompt: "Scroll to the bottom to enable agreement.",
  consentAgreementLabel: "I agree to the consent text above.",
};

interface WishlistPromptConfig {
  enabled: boolean;
  delaySeconds: number;
  sessionDelaySeconds: number;
  headline: string;
  bodyText: string;
  ctaText: string;
}

const DEFAULT_WISHLIST_PROMPT: WishlistPromptConfig = {
  enabled: true,
  delaySeconds: 5,
  sessionDelaySeconds: 20,
  headline: "Don't lose your picks!",
  bodyText: "Create a free account to save your wishlist and pick up right where you left off.",
  ctaText: "Save my wishlist",
};

interface ConsentsResponse {
  consents: CustomerConsent[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, testId }: { value: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        value ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
      }`}
      data-testid={testId}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminConsent() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [signupPopup, setSignupPopup] = useState<SignupPopupConfig>(DEFAULT_SIGNUP_POPUP);
  const [wishlistPrompt, setWishlistPrompt] = useState<WishlistPromptConfig>(DEFAULT_WISHLIST_PROMPT);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: signupConfigData, isLoading: signupConfigLoading } = useQuery<{ key: string; value: SignupPopupConfig }>({
    queryKey: ["/api/site-config", "signup-popup"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/signup-popup");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: wishlistConfigData, isLoading: wishlistConfigLoading } = useQuery<{ key: string; value: WishlistPromptConfig }>({
    queryKey: ["/api/site-config", "wishlist-signup-prompt"],
    queryFn: async () => {
      const res = await fetch("/api/site-config/wishlist-signup-prompt");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: consentsData, isLoading: consentsLoading } = useQuery<ConsentsResponse>({
    queryKey: ["/api/admin/consents", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/consents?page=${page}&limit=20`);
      return res.json();
    },
  });

  // ── Seed state from API ──────────────────────────────────────────────────────

  useEffect(() => {
    if (signupConfigData?.value) {
      // Destructure only known fields — drops any stale keys (e.g. old nudge-card fields).
      const { enabled, delaySeconds, cartAddDelaySeconds, reshowIntervalSeconds, incentiveText, subtitleText, phoneSubtitleText, phoneRequired, consentText, consentScrollPrompt, consentAgreementLabel } = signupConfigData.value;
      setSignupPopup({ ...DEFAULT_SIGNUP_POPUP, enabled, delaySeconds, cartAddDelaySeconds, reshowIntervalSeconds, incentiveText, subtitleText: subtitleText ?? DEFAULT_SIGNUP_POPUP.subtitleText, phoneSubtitleText: phoneSubtitleText ?? DEFAULT_SIGNUP_POPUP.phoneSubtitleText, phoneRequired: phoneRequired !== false, consentText, consentScrollPrompt: consentScrollPrompt ?? DEFAULT_SIGNUP_POPUP.consentScrollPrompt, consentAgreementLabel: consentAgreementLabel ?? DEFAULT_SIGNUP_POPUP.consentAgreementLabel });
    }
  }, [signupConfigData]);

  useEffect(() => {
    if (wishlistConfigData?.value) {
      setWishlistPrompt({ ...DEFAULT_WISHLIST_PROMPT, ...wishlistConfigData.value });
    }
  }, [wishlistConfigData]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const saveSignupMutation = useMutation({
    mutationFn: async (data: SignupPopupConfig) => {
      await apiRequest("POST", "/api/site-config/signup-popup", { value: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", "signup-popup"] });
      toast({ title: "Signup popup settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  const saveWishlistMutation = useMutation({
    mutationFn: async (data: WishlistPromptConfig) => {
      await apiRequest("POST", "/api/site-config/wishlist-signup-prompt", { value: data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/site-config", "wishlist-signup-prompt"] });
      toast({ title: "Wishlist prompt settings saved" });
    },
    onError: () => {
      toast({ title: "Failed to save", variant: "destructive" });
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24" data-testid="page-admin-consent">
      <Link href="/admin">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-dashboard">
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30">
          <Gift className="w-5 h-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-consent-title">Consent & Offers</h1>
          <p className="text-sm text-muted-foreground">Manage popup settings and view signups</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Signup Popup ─────────────────────────────────────────────────────── */}
        <Card className="p-5 space-y-5" data-testid="card-signup-popup">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Signup Popup
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Controls Google One Tap sign-in for unauthenticated visitors. Fires automatically after a delay
              and again a few seconds after the first cart add. Dismissing One Tap enables a hard gate on subsequent
              cart adds until the user signs in or registers.
            </p>
          </div>

          {signupConfigLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Enabled */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-32 shrink-0">Enabled</label>
                <Toggle
                  value={signupPopup.enabled}
                  onChange={v => setSignupPopup(s => ({ ...s, enabled: v }))}
                  testId="toggle-signup-popup-enabled"
                />
                <span className="text-sm text-muted-foreground">
                  {signupPopup.enabled ? "Popup is active" : "Popup is disabled"}
                </span>
              </div>

              {/* Timing */}
              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="text-sm font-medium block mb-1">Session delay (seconds)</label>
                  <Input
                    type="number"
                    min={0}
                    value={signupPopup.delaySeconds}
                    onChange={e => setSignupPopup(s => ({ ...s, delaySeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-28"
                    data-testid="input-signup-delay"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Seconds from session start</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Cart-add delay (seconds)</label>
                  <Input
                    type="number"
                    min={0}
                    value={signupPopup.cartAddDelaySeconds}
                    onChange={e => setSignupPopup(s => ({ ...s, cartAddDelaySeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-28"
                    data-testid="input-signup-cart-delay"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Seconds after first item added</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Re-show interval (seconds)</label>
                  <Input
                    type="number"
                    min={0}
                    value={signupPopup.reshowIntervalSeconds}
                    onChange={e => setSignupPopup(s => ({ ...s, reshowIntervalSeconds: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-28"
                    data-testid="input-signup-reshow-interval"
                  />
                  <p className="text-xs text-muted-foreground mt-1">0 = don't re-show after dismiss</p>
                </div>
              </div>

              <Separator />

              {/* Nudge card copy */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nudge card copy</p>
              <div>
                <RichTextEditor
                  value={signupPopup.subtitleText}
                  onChange={value => setSignupPopup(s => ({ ...s, subtitleText: value }))}
                  label="Subtitle text"
                  placeholder="e.g. Save your wishlist, track orders, and check out faster."
                  testId="input-signup-subtitle"
                  minHeight="60px"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown below the heading on the sign-in nudge card.</p>
              </div>

              <Separator />

              {/* Phone form copy (shown to new users after Google credential) */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone form (new users only)</p>
              <div>
                <RichTextEditor
                  value={signupPopup.phoneSubtitleText}
                  onChange={value => setSignupPopup(s => ({ ...s, phoneSubtitleText: value }))}
                  label="Subtitle text"
                  placeholder="e.g. Add your phone number to complete sign-up."
                  testId="input-signup-phone-subtitle"
                  minHeight="60px"
                />
                <p className="text-xs text-muted-foreground mt-1">Shown below the heading on the phone collection form.</p>
              </div>
              <div>
                <RichTextEditor
                  value={signupPopup.incentiveText}
                  onChange={value => setSignupPopup(s => ({ ...s, incentiveText: value }))}
                  label="Incentive text"
                  placeholder="Shown below the phone field — e.g. a reward or benefit for signing up"
                  testId="input-signup-incentive"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer rounded-md border border-input px-3 py-3">
                <input
                  type="checkbox"
                  checked={signupPopup.phoneRequired}
                  onChange={e => setSignupPopup(s => ({ ...s, phoneRequired: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))] shrink-0"
                  data-testid="checkbox-signup-phone-required"
                />
                <span>
                  <span className="text-sm font-medium block">Make phone number mandatory</span>
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    Require new Google sign-ups to provide a phone number before creating their account.
                  </span>
                </span>
              </label>
              <div>
                <RichTextEditor
                  value={signupPopup.consentText}
                  onChange={value => setSignupPopup(s => ({ ...s, consentText: value }))}
                  label="Consent statement"
                  placeholder="Legal / T&C wording shown with a checkbox — e.g. I agree to receive…"
                  testId="input-signup-consent-text"
                  minHeight="80px"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  No default. Leave empty to skip the consent checkbox (the form submits without it).
                </p>
              </div>

              <Button
                onClick={() => saveSignupMutation.mutate(signupPopup)}
                disabled={saveSignupMutation.isPending}
                data-testid="button-save-signup-popup"
              >
                {saveSignupMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Signup Popup
              </Button>
            </div>
          )}
        </Card>

        <Separator />

        {/* ── Wishlist Sign-up Prompt ──────────────────────────────────────────── */}
        <Card className="p-5 space-y-4" data-testid="card-wishlist-prompt">
          <h2 className="font-semibold flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" /> Wishlist Sign-up Prompt
          </h2>
          <p className="text-xs text-muted-foreground -mt-2">
            A bottom-sheet nudge shown to guest users after they add their first wishlist item, encouraging them to create an account.
          </p>

          {wishlistConfigLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-20 shrink-0">Enabled</label>
                <Toggle
                  value={wishlistPrompt.enabled}
                  onChange={v => setWishlistPrompt(s => ({ ...s, enabled: v }))}
                  testId="toggle-wishlist-prompt-enabled"
                />
                <span className="text-sm text-muted-foreground">
                  {wishlistPrompt.enabled ? "Prompt is active" : "Prompt is hidden"}
                </span>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Delay after first add (seconds)</label>
                <Input
                  type="number"
                  min={0}
                  value={wishlistPrompt.delaySeconds}
                  onChange={e => setWishlistPrompt(s => ({ ...s, delaySeconds: parseInt(e.target.value) || 0 }))}
                  className="w-32"
                  data-testid="input-wishlist-prompt-delay"
                />
                <p className="text-xs text-muted-foreground mt-1">How long to wait before showing the prompt after an item is added</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Delay on page revisit (seconds)</label>
                <Input
                  type="number"
                  min={0}
                  value={wishlistPrompt.sessionDelaySeconds}
                  onChange={e => setWishlistPrompt(s => ({ ...s, sessionDelaySeconds: parseInt(e.target.value) || 0 }))}
                  className="w-32"
                  data-testid="input-wishlist-prompt-session-delay"
                />
                <p className="text-xs text-muted-foreground mt-1">How long to wait before showing the prompt when a returning visitor already has wishlist items</p>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Headline</label>
                <Input
                  value={wishlistPrompt.headline}
                  onChange={e => setWishlistPrompt(s => ({ ...s, headline: e.target.value }))}
                  placeholder="e.g. Don't lose your picks!"
                  data-testid="input-wishlist-prompt-headline"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Body text</label>
                <textarea
                  value={wishlistPrompt.bodyText}
                  onChange={e => setWishlistPrompt(s => ({ ...s, bodyText: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-y"
                  placeholder="Describe why they should sign up..."
                  data-testid="input-wishlist-prompt-body"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Button label</label>
                <Input
                  value={wishlistPrompt.ctaText}
                  onChange={e => setWishlistPrompt(s => ({ ...s, ctaText: e.target.value }))}
                  placeholder="e.g. Save my wishlist"
                  data-testid="input-wishlist-prompt-cta"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => saveWishlistMutation.mutate(wishlistPrompt)}
                  disabled={saveWishlistMutation.isPending}
                  data-testid="button-save-wishlist-prompt"
                >
                  {saveWishlistMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Wishlist Prompt
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("wishlist:force-preview"))}
                  data-testid="button-preview-wishlist-prompt"
                >
                  Preview Popup
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Separator />

        {/* ── Signups table ────────────────────────────────────────────────────── */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" /> Signups
              {consentsData && (
                <Badge variant="secondary" className="ml-1" data-testid="badge-total-signups">
                  {consentsData.total}
                </Badge>
              )}
            </h2>
          </div>

          {consentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !consentsData?.consents?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No signups yet</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full text-sm" data-testid="table-consents">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Email</th>
                      <th className="pb-2 font-medium">Phone</th>
                      <th className="pb-2 font-medium">Discount Code</th>
                      <th className="pb-2 font-medium">Used</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consentsData.consents.map((c) => (
                      <tr key={c.id} className="border-b last:border-0" data-testid={`row-consent-${c.id}`}>
                        <td className="py-2 pr-3 whitespace-nowrap">{c.firstName} {c.lastName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{c.email}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{c.discountCode || "—"}</td>
                        <td className="py-2 pr-3">
                          {c.discountCode ? (
                            <Badge variant={c.discountUsed ? "default" : "secondary"} className="text-xs">
                              {c.discountUsed ? "Yes" : "No"}
                            </Badge>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground whitespace-nowrap">
                          {c.consentedAt
                            ? new Date(c.consentedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {consentsData.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">
                    Page {consentsData.page} of {consentsData.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= consentsData.totalPages}
                      onClick={() => setPage(p => p + 1)}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
