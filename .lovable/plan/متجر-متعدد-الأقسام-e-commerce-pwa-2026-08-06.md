# متجر متعدد الأقسام — E-commerce PWA

Arabic-first (RTL) storefront with English toggle, green/beige theme, bottom nav on mobile, sticky header on desktop, plus a full admin panel and Telegram order alerts.

## Design

- Primary emerald `#166534`, beige surfaces `#F7F5F0`, white base, charcoal `#1F2937` text — all as semantic tokens.
- Arabic default with `dir="rtl"`, Cairo/Tajawal typography; toggle switches language + direction and persists.
- Minimal cards, rounded corners, soft shadows, skeleton loaders, sonner toasts.

## Customer pages

1. **الرئيسية** — admin-managed hero banner slider, category bubbles, latest arrivals, discounted items with % badge, "آخر القطع" low-stock strip.
2. **الأقسام** — main category grid, accordion subcategories, tap to filter products.
3. **المنتج** — gallery, price/discount, stock badge (متوفر / آخر قطعتين / نفدت الكمية — exact qty hidden), PDF catalog button, add to cart.
4. **السلة** — thumbnails, qty +/-, delete, item detail modal; checkout: coupon field, governorate dropdown (auto shipping fee), nearest landmark, preferred delivery time, summary (subtotal + shipping − discount), submit → routes to الطلبات.
5. **الطلبات** — order list, 4-step progress bar (مراجعة ➔ تجهيز ➔ إرسال ➔ إكتمال), admin notes box, accordion item/price breakdown.
6. **الحساب** — login/register with الاسم الثلاثي + رقم الهاتف (WhatsApp-formatted); profile view with edit and logout.
7. Global search with autocomplete + category/price filters; floating WhatsApp support button; install-app banner.

## Admin panel (`/admin`)

- Dashboard: total orders, pending, revenue, out-of-stock count.
- Products CRUD: name, SKU, category/subcategory, image upload, description, price, discount price, stock qty, catalog PDF, featured toggle.
- Categories & subcategories CRUD; governorates list with per-governorate shipping fee.
- Orders: status filter, detail modal (customer, phone, landmark, items, totals), status dropdown, "تواصل عبر الواتساب" prefilled link.
- Store identity: banner image, logo, favicon upload.

## Backend

Lovable Cloud with tables: `profiles`, `user_roles`, `categories`, `products`, `governorates`, `orders`, `order_items`, `coupons`, `store_settings`, `banners`. RLS: customers read catalog and own orders; admins full access via a `has_role` security-definer function. Storage buckets for product images, catalog PDFs, and branding.

Checkout runs server-side: it recomputes prices, validates the coupon, applies the governorate fee, writes the order, then fires the Telegram message — so totals can't be tampered with client-side.

## Auth

Phone + full name only. Behind the scenes the phone is normalized to a deterministic internal identity with a stored credential, so no email or OTP is needed. Trade-off: no password recovery by email — a lost account is recovered by admin. Checkout is blocked until name and phone are present.

## Telegram

Connect the Telegram bot connector, then send the formatted new-order message (order id, customer, phone, governorate + landmark, items with qty, total) on every submitted order.

## PWA

`manifest.webmanifest` (green/beige theme, 192/512 icons), guarded service worker for offline shell caching (never registers in preview), and an "تثبيت التطبيق" install banner.

## Build order

1. Enable Cloud, schema + RLS + seed (18 Iraqi governorates, categories, sample products).
2. Design tokens, RTL shell, i18n, navigation.
3. Storefront pages → cart → checkout server function.
4. Orders tracking, account/auth.
5. Admin panel.
6. Telegram connector + PWA + polish.

## Need from you

The phone number (and full name) to seed as the admin account.
