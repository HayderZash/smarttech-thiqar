# Green Oasis Store

# Role & App Goal

You are an expert Full-Stack Developer and UI/UX Designer specializing in building modern E-Commerce Progressive Web Apps (PWAs). 

Build a fully functional, mobile-first, responsive E-commerce PWA for a multi-category store selling Electronics, Electrical items, Solar Power equipment, Construction materials, and general supplies. (in Arabic and English)

---

## 1. Design System & Theme

- **Color Palette:**

  - Primary: Forest/Emerald Green (e.g., `#1E5128` or `#166534`) for action buttons, highlights, and primary UI elements.

  - Secondary/Background: Soft Beige (e.g., `#F7F5F0` or `#FAF8F5`) for card backgrounds and subtle section separators.

  - Base Background: Clean White (`#FFFFFF`).

  - Text: Dark Charcoal (`#1F2937`) for high contrast readability.

- **Layout:** Minimalist, uncluttered, clean, fully RTL (Arabic Language support default).

- **Navigation Structure:**

  - **Mobile:** Fixed Bottom Navigation Bar with 5 icons: (الرئيسية | الأقسام | السلة | الطلبات | الحساب).

  - **Desktop:** Sticky Top Navigation Header with brand logo, search bar, and the same 5 links.

---

## 2. Progressive Web App (PWA) Requirements

- Configure `manifest.json` with app name, short name, green/beige theme colors, and standard icons (192x192, 512x512).

- Enable Service Worker for offline caching of static assets and basic shell UI.

- Add an "Install App / تثبيت التطبيق" prompt banner for mobile users.

---

## 3. Database & Data Architecture (Supabase / Mock Schema)

Create a clean relational schema for:

1. `Users`: ID, Full Name, WhatsApp Phone Number, Role ('customer' | 'admin'), CreatedAt.

2. `Categories`: ID, Name, Icon/Image, ParentID (nullable, for subcategories).

3. `Products`: ID, SKU/Code, Name, Description, Price, DiscountPrice, SubCategoryID, ImageUrl (or uploaded file), CatalogPdfUrl, StockQty (internal count), IsFeatured, CreatedAt.

4. `Governorates`: ID, Name (Iraqi Governorates), ShippingCost.

5. `Orders`: ID, CustomerID, CustomerName, Phone, GovernorateID, DeliveryAddress/Landmark (نقطة دالة), PreferredDeliveryTime, CouponCode, DiscountAmount, ShippingFee, TotalAmount, Status ('review', 'preparing', 'shipped', 'completed', 'cancelled'), Notes, CreatedAt.

6. `OrderItems`: ID, OrderID, ProductID, Quantity, UnitPrice.

---

## 4. User Navigation & Page Specifications

### A. Bottom/Top Navigation Tabs

1. **الرئيسية (Home):**

   - Hero Promotional Slider/Banner (Managed by Admin).

   - "أحدث المنتجات" (Latest Arrivals grid).

   - "عروض الخصومات" (Discounted Items slider with discount badge % display).

   - "آخر القطع" (Low-stock callout section to encourage quick buy).

   - Category shortcut bubbles.

2. **الأقسام (Categories):**

   - Grid view of Main Categories with images.

   - Accordion/Dropdown expansion revealing Subcategories under each main category.

   - Clicking a subcategory filters and displays the corresponding product list.

3. **السلة (Cart & Checkout Flow):**

   - Item List: Thumbnails, product names, price, quantity selector (+/-), and delete button. Clicking an item opens its detail modal.

   - **Checkout Logic:**

     - Require user authentication before proceeding (block guest checkout if profile/phone is incomplete).

     - Input field for Discount Coupon (validates code and updates total).

     - Dropdown for **المحافظة** (Iraqi Governorates) -> automatically adds the specific shipping fee set by Admin.

     - Input field for **أقرب نقطة دالة** (Nearest Landmark).

     - Optional field for **ساعات التوصيل المفضل** (Preferred delivery timing slot).

     - Order Summary (Subtotal + Shipping - Discount = Final Total).

     - "إكمال الطلب" (Submit Order) button -> creates order in database and routes user to the "الطلبات" tab.

4. **الطلبات (Order Tracking):**

   - List of user's past and active orders.

   - Visual progress bar for order status: 

     `مراجعة (Reviewing)` ➔ `تجهيز (Preparing)` ➔ `إرسال (Shipped)` ➔ `إكتمال (Completed)`.

   - Admin notes display box (e.g., "سيتم الاتصال بك خلال ساعة").

   - Accordion view to expand order items and price breakdown.

5. **الحساب (Account & Authentication):**

   - Initial View (if logged out): Simple, elegant Login/Register form asking for:

     - **الاسم الثلاثي** (Full Name)

     - **رقم الهاتف** (Phone Number - must be formatted for WhatsApp validation).

   - Profile View (if logged in): Display user details, edit profile option, and logout button.

---

## 5. Admin Panel (حساب الإدارة)

Accessible via a designated admin route `/admin` (or admin login credentials).

1. **Dashboard Overview:**

   - Quick statistics: Total Orders, Pending Orders, Total Revenue, Out-of-Stock Products.

2. **Product Management (إدارة المنتجات):**

   - CRUD interface to add/edit/delete products.

   - Fields: Name, Code/SKU, Main & Sub-category, Image (URL input or direct file upload preview), Description, Price, Discount Price, Stock Quantity (used internally to toggle "In Stock / Out of Stock" badge on frontend, exact quantity number hidden from customers), Catalog Link (PDF URL for specs), Featured toggle.

3. **Category & Shipping Management (الأقسام وأجور التوصيل):**

   - Add/edit main categories and subcategories.

   - Manage Iraqi Governorates list and set specific shipping fees per governorate (e.g., بغداد: 5000 د.ع, باقي المحافظات: 8000 د.ع).

4. **Order Management (إدارة الطلبات):**

   - Real-time order list with status filter.

   - Detailed modal showing customer name, phone, address, landmark, items ordered, and total cost breakdown.

   - Dropdown to update order status (`مراجعة`, `تجهيز`, `إرسال`, `إكتمال`).

   - "تواصل مع الزبون عبر الواتساب" (Direct WhatsApp button) that opens WhatsApp web/app pre-filled with order details.

5. **Telegram Bot Integration:**

   - On new order submission, trigger a webhook/API call to a Telegram Bot sending a formatted message:

     ```text

     📦 طلب جديد # [OrderID]

     👤 الزبون: [Customer Name]

     📞 الهاتف: [Phone Number]

     📍 المحافظة والنقطة الدالة: [Governorate] - [Landmark]

     🛒 المنتجات: [Item list with qty]

     💰 المبلغ الإجمالي مع التوصيل: [Total Amount]

     ```

6. **Store Customization (هوية المتجر):**

   - Admin UI to upload/change Home Banner Image, App Logo, and Favicon.

---

## 6. Extra Enhancements for Premium E-Commerce UX

- **Stock Alert Badges:** Display "متوفر" (In Stock) or "نفدت الكمية" (Out of Stock) automatically based on Admin stock quantity. Show "آخر قطعتين" badge when stock <= 2.

- **Product Catalog Viewer:** If a product has a PDF catalog, display a "تحميل الكتالوج الفني PDF" button on the product details view.

- **Instant Search & Filter:** Global search bar at the top with auto-complete and filters by category or price range.

- **Interactive UI Feedback:** Toast notifications (using `sonner` or `shadcn toast`) for actions like "أضيف إلى السلة", "تم تغيير حالة الطلب", etc.

- **Skeleton Loaders:** Smooth loading animations while fetching data.

- **Floating WhatsApp Help Button:** Subtle sticky help icon on customer pages to directly message support.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smarttech-thiqar.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1b47eafa-e5c6-4572-bff8-4b6abf65702e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
