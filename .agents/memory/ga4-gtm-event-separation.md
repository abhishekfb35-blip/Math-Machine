---
name: GA4 and GTM event separation
description: Why direct GA4 events and Google Ads events routed through GTM must not share a trigger name.
---

Use a dedicated custom event name for Google Ads conversions routed through GTM; keep GA4's standard ecommerce event names only for direct GA4 calls.

**Why:** Direct `gtag` commands are pushed into the same data layer processed by GTM. If an Ads custom-event trigger uses the same name as a direct GA4 event, one business action can match the Ads trigger twice.

**How to apply:** For any event sent both directly to GA4 and separately to GTM, give the GTM-only event a destination-specific name and test the number of events that match the actual GTM trigger condition.