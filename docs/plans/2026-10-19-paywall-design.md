# Paywall modal (web only) — design

## Goal

One-time "Semester Pro" pitch modal on the web app. Shown once per browser/device, never again. No payment integration, nothing gated. CTA closes the modal.

## Pricing

- Monthly: €9.99/month
- Yearly: €90/year (≈ 25 % saved, highlighted card)

## Approach

A: one boolean in the existing persisted settings store + one modal component mounted on the dashboard. Deferred: dedicated paywall store, /pro route.

## Pieces

- `src/components/paywall/PaywallModal.tsx` — only file. Uses the existing `ui/` modal primitive and theme CSS variables.
- Trigger: dashboard mounts → 1.2 s delay → if `!seen && hydrated`, render. Primary CTA "Continue" marks seen + closes; "Continue free" secondary; backdrop/Escape behave identically. After that the modal never renders again on this device.
- i18n: all copy through the existing i18n mechanism (DE + EN).
- Mobile app: untouched.

## Error handling

None required — pure UI; persistence is the existing zustand persist path.

## Verification

`pnpm lint` + `pnpm build`; visual pass light + dark on the dev server.
