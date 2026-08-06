import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

const dict = {
  // nav
  home: { ar: "الرئيسية", en: "Home" },
  categories: { ar: "الأقسام", en: "Categories" },
  cart: { ar: "السلة", en: "Cart" },
  orders: { ar: "الطلبات", en: "Orders" },
  account: { ar: "الحساب", en: "Account" },
  admin: { ar: "الإدارة", en: "Admin" },
  // home
  latest: { ar: "أحدث المنتجات", en: "Latest arrivals" },
  deals: { ar: "عروض الخصومات", en: "Discount deals" },
  lastPieces: { ar: "آخر القطع", en: "Last pieces" },
  shopByCategory: { ar: "تسوق حسب القسم", en: "Shop by category" },
  featured: { ar: "منتجات مميزة", en: "Featured" },
  viewAll: { ar: "عرض الكل", en: "View all" },
  // product
  addToCart: { ar: "أضف إلى السلة", en: "Add to cart" },
  addedToCart: { ar: "أضيف إلى السلة", en: "Added to cart" },
  inStock: { ar: "متوفر", en: "In stock" },
  outOfStock: { ar: "نفدت الكمية", en: "Out of stock" },
  lastTwo: { ar: "آخر قطعتين", en: "Only 2 left" },
  downloadCatalog: { ar: "تحميل الكتالوج الفني PDF", en: "Download PDF catalog" },
  productDetails: { ar: "تفاصيل المنتج", en: "Product details" },
  code: { ar: "الرمز", en: "Code" },
  noProducts: { ar: "لا توجد منتجات", en: "No products" },
  // search
  search: { ar: "ابحث عن منتج...", en: "Search products..." },
  searchTitle: { ar: "البحث", en: "Search" },
  priceRange: { ar: "نطاق السعر", en: "Price range" },
  allCategories: { ar: "كل الأقسام", en: "All categories" },
  // cart
  emptyCart: { ar: "سلتك فارغة", en: "Your cart is empty" },
  startShopping: { ar: "ابدأ التسوق", en: "Start shopping" },
  subtotal: { ar: "المجموع الفرعي", en: "Subtotal" },
  shipping: { ar: "أجور التوصيل", en: "Shipping" },
  discount: { ar: "الخصم", en: "Discount" },
  total: { ar: "المجموع النهائي", en: "Total" },
  checkout: { ar: "إكمال الطلب", en: "Place order" },
  coupon: { ar: "كود الخصم", en: "Coupon code" },
  applyCoupon: { ar: "تطبيق", en: "Apply" },
  governorate: { ar: "المحافظة", en: "Governorate" },
  landmark: { ar: "أقرب نقطة دالة", en: "Nearest landmark" },
  deliveryTime: { ar: "ساعات التوصيل المفضلة", en: "Preferred delivery time" },
  optional: { ar: "اختياري", en: "optional" },
  orderSummary: { ar: "ملخص الطلب", en: "Order summary" },
  loginRequired: { ar: "سجّل الدخول لإكمال الطلب", en: "Sign in to place your order" },
  orderPlaced: { ar: "تم استلام طلبك بنجاح", en: "Your order was placed" },
  remove: { ar: "حذف", en: "Remove" },
  // orders
  noOrders: { ar: "لا توجد طلبات بعد", en: "No orders yet" },
  orderNo: { ar: "طلب رقم", en: "Order" },
  statusReview: { ar: "مراجعة", en: "Reviewing" },
  statusPreparing: { ar: "تجهيز", en: "Preparing" },
  statusShipped: { ar: "إرسال", en: "Shipped" },
  statusCompleted: { ar: "إكتمال", en: "Completed" },
  statusCancelled: { ar: "ملغي", en: "Cancelled" },
  adminNote: { ar: "ملاحظة الإدارة", en: "Note from the store" },
  items: { ar: "المنتجات", en: "Items" },
  // account
  fullName: { ar: "الاسم الثلاثي", en: "Full name" },
  phone: { ar: "رقم الهاتف (واتساب)", en: "Phone number (WhatsApp)" },
  signIn: { ar: "دخول / تسجيل", en: "Sign in / Register" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  save: { ar: "حفظ", en: "Save" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  editProfile: { ar: "تعديل الملف الشخصي", en: "Edit profile" },
  welcome: { ar: "أهلاً بك", en: "Welcome" },
  authHint: {
    ar: "أدخل اسمك الثلاثي ورقم هاتفك للدخول أو إنشاء حساب جديد",
    en: "Enter your full name and phone number to sign in or register",
  },
  invalidPhone: { ar: "رقم هاتف غير صحيح", en: "Invalid phone number" },
  nameRequired: { ar: "الرجاء إدخال الاسم الثلاثي", en: "Full name is required" },
  // misc
  currency: { ar: "د.ع", en: "IQD" },
  language: { ar: "English", en: "العربية" },
  install: { ar: "تثبيت التطبيق", en: "Install app" },
  installDesc: { ar: "أضف المتجر إلى شاشتك الرئيسية", en: "Add the store to your home screen" },
  later: { ar: "لاحقاً", en: "Later" },
  help: { ar: "مساعدة", en: "Help" },
  error: { ar: "حدث خطأ", en: "Something went wrong" },
} as const;

export type TKey = keyof typeof dict;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; dir: "rtl" | "ltr" };

const LanguageContext = createContext<Ctx>({
  lang: "ar",
  setLang: () => {},
  t: (k) => dict[k].ar,
  dir: "rtl",
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "ar") setLangState(stored);
  }, []);

  useEffect(() => {
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const value = useMemo<Ctx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      setLang: (l) => {
        localStorage.setItem("lang", l);
        setLangState(l);
      },
      t: (k) => dict[k][lang] ?? dict[k].ar,
    }),
    [lang],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLang = () => useContext(LanguageContext);

/** Picks the Arabic or English variant of a database record field. */
export function localized(lang: Lang, ar: string | null | undefined, en: string | null | undefined) {
  if (lang === "en") return en?.trim() ? en : (ar ?? "");
  return ar?.trim() ? ar : (en ?? "");
}
