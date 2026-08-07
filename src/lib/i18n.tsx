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
  sortBy: { ar: "الترتيب", en: "Sort by" },
  sortNewest: { ar: "الأحدث", en: "Newest" },
  sortNameAsc: { ar: "الاسم (أ - ي)", en: "Name (A-Z)" },
  sortNameDesc: { ar: "الاسم (ي - أ)", en: "Name (Z-A)" },
  sortPriceAsc: { ar: "السعر: الأقل أولاً", en: "Price: low to high" },
  sortPriceDesc: { ar: "السعر: الأعلى أولاً", en: "Price: high to low" },
  browseCategory: { ar: "تصفح القسم", en: "Browse category" },
  subCategories: { ar: "الأقسام الفرعية", en: "Subcategories" },
  products: { ar: "منتج", en: "products" },
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
  signIn: { ar: "تسجيل الدخول", en: "Sign in" },
  register: { ar: "إنشاء حساب", en: "Register" },
  password: { ar: "كلمة المرور", en: "Password" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  save: { ar: "حفظ", en: "Save" },
  saved: { ar: "تم الحفظ", en: "Saved" },
  editProfile: { ar: "تعديل الملف الشخصي", en: "Edit profile" },
  welcome: { ar: "أهلاً بك", en: "Welcome" },
  authHint: {
    ar: "سجّل الدخول برقم الهاتف وكلمة المرور، وعند إنشاء حساب جديد أضف اسمك الثلاثي",
    en: "Sign in with your phone number and password; add your full name when registering",
  },
  invalidPhone: { ar: "رقم هاتف غير صحيح", en: "Invalid phone number" },
  nameRequired: { ar: "الرجاء إدخال الاسم الثلاثي", en: "Full name is required" },
  passwordShort: {
    ar: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    en: "Password must be at least 6 characters",
  },
  wrongCredentials: {
    ar: "رقم الهاتف أو كلمة المرور غير صحيحة",
    en: "Incorrect phone number or password",
  },
  accountExists: { ar: "الحساب موجود مسبقاً، سجّل الدخول", en: "Account already exists, sign in" },

  // wishlist / discovery
  wishlist: { ar: "المفضلة", en: "Wishlist" },
  emptyWishlist: { ar: "لا توجد منتجات في المفضلة", en: "No products in your wishlist" },
  addedToWishlist: { ar: "أضيف إلى المفضلة", en: "Added to wishlist" },
  removedFromWishlist: { ar: "أزيل من المفضلة", en: "Removed from wishlist" },
  related: { ar: "منتجات مشابهة", en: "Related products" },
  recentlyViewed: { ar: "شوهد مؤخراً", en: "Recently viewed" },
  // reviews
  reviews: { ar: "تقييمات الزبائن", en: "Customer reviews" },
  writeReview: { ar: "اكتب تقييمك", en: "Write a review" },
  yourRating: { ar: "تقييمك", en: "Your rating" },
  yourReview: { ar: "رأيك بالمنتج", en: "Your review" },
  submitReview: { ar: "إرسال التقييم", en: "Submit review" },
  reviewPending: { ar: "شكراً! سيظهر تقييمك بعد موافقة الإدارة", en: "Thanks! Your review appears after approval" },
  noReviews: { ar: "لا توجد تقييمات بعد", en: "No reviews yet" },
  loginToReview: { ar: "سجّل الدخول لكتابة تقييم", en: "Sign in to write a review" },
  approve: { ar: "اعتماد", en: "Approve" },
  pendingReviews: { ar: "تقييمات بانتظار الاعتماد", en: "Reviews awaiting approval" },
  // stock alerts
  notifyMe: { ar: "أعلمني عند التوفر", en: "Notify me when available" },
  notifyMeDesc: { ar: "اترك رقمك وسنراسلك عند توفر المنتج", en: "Leave your number and we will contact you" },
  notifySaved: { ar: "تم تسجيل طلبك، سنعلمك عند التوفر", en: "Saved — we will notify you" },
  stockAlerts: { ar: "طلبات الإشعار بالتوفر", en: "Back-in-stock requests" },
  // tracking
  trackOrder: { ar: "تتبّع طلبك", en: "Track your order" },
  trackDesc: { ar: "أدخل رقم الطلب ورقم هاتفك لمعرفة حالة الطلب بدون تسجيل دخول", en: "Enter your order number and phone to check the status" },
  track: { ar: "تتبّع", en: "Track" },
  orderNotFound: { ar: "لم نعثر على طلب بهذه المعلومات", en: "No order found with these details" },
  // deals
  dealsPage: { ar: "العروض والتخفيضات", en: "Deals & discounts" },
  dealsDesc: { ar: "أفضل الخصومات المتاحة الآن مع كوبونات فعّالة", en: "Best current discounts and active coupons" },
  endsIn: { ar: "ينتهي خلال", en: "Ends in" },
  activeCoupons: { ar: "كوبونات فعّالة", en: "Active coupons" },
  copyCode: { ar: "نسخ الكود", en: "Copy code" },
  copied: { ar: "تم النسخ", en: "Copied" },
  noDeals: { ar: "لا توجد عروض حالياً", en: "No deals right now" },
  // sharing / payment
  share: { ar: "مشاركة", en: "Share" },
  shareCart: { ar: "مشاركة السلة عبر واتساب", en: "Share cart on WhatsApp" },
  cod: { ar: "الدفع عند الاستلام", en: "Cash on delivery" },
  shippingCalc: { ar: "احسب أجور التوصيل", en: "Estimate delivery cost" },
  chooseGovernorate: { ar: "اختر المحافظة", en: "Choose governorate" },
  freeShipping: { ar: "توصيل مجاني", en: "Free delivery" },
  // solar calculator
  solarCalc: { ar: "حاسبة الطاقة الشمسية", en: "Solar calculator" },
  solarDesc: { ar: "احسب حجم المنظومة الشمسية المناسبة لأحمالك الكهربائية", en: "Size the solar system you need for your loads" },
  deviceName: { ar: "الجهاز", en: "Device" },
  watt: { ar: "القدرة (واط)", en: "Power (W)" },
  qtyLabel: { ar: "العدد", en: "Qty" },
  hoursPerDay: { ar: "ساعات التشغيل يومياً", en: "Hours per day" },
  addDevice: { ar: "إضافة جهاز", en: "Add device" },
  dailyEnergy: { ar: "الاستهلاك اليومي", en: "Daily energy" },
  panelsNeeded: { ar: "الألواح المطلوبة", en: "Panels needed" },
  batteriesNeeded: { ar: "البطاريات المطلوبة", en: "Batteries needed" },
  inverterNeeded: { ar: "قدرة الإنفرتر المقترحة", en: "Suggested inverter size" },
  solarNote: { ar: "النتائج تقديرية لأغراض الاسترشاد، تواصل معنا لتصميم دقيق.", en: "Estimates only — contact us for an exact design." },
  calcMode: { ar: "طريقة الحساب", en: "Calculation method" },
  modeLoads: { ar: "حسب الأحمال", en: "By loads" },
  modeAmps: { ar: "أمبيرية محددة", en: "Fixed amperage" },
  ampsLabel: { ar: "الأمبيرية (A)", en: "Amperage (A)" },
  systemSettings: { ar: "إعدادات المنظومة", en: "System settings" },
  panelWatt: { ar: "واطية اللوح (W)", en: "Panel wattage (W)" },
  sunHours: { ar: "ساعات الذروة الشمسية", en: "Peak sun hours" },
  batteryAh: { ar: "سعة البطارية (Ah)", en: "Battery capacity (Ah)" },
  batteryVolt: { ar: "فولتية البطارية (V)", en: "Battery voltage (V)" },
  batteryLifepo4: {
    ar: "البطاريات المعتمدة: ليثيوم فوسفات الحديد LiFePO4 (عمق تفريغ 90%)",
    en: "Batteries: LiFePO4 lithium (90% depth of discharge)",
  },
  inverterCapacity: { ar: "قدرة الإنفرتر", en: "Inverter capacity" },
  inverterAuto: { ar: "احتساب تلقائي", en: "Auto" },
  inverterManual: { ar: "قدرة يدوية (kW)", en: "Manual size (kW)" },
  inverterOk: { ar: "الإنفرتر كافٍ للأحمال", en: "Inverter covers the load" },
  inverterLow: { ar: "الإنفرتر أصغر من الحمل المطلوب", en: "Inverter is smaller than the load" },
  peakLoad: { ar: "ذروة الحمل", en: "Peak load" },
  gridOnHours: { ar: "ساعات تشغيل الكهرباء الوطنية", en: "National grid ON hours" },
  gridOffHours: { ar: "ساعات انطفاء الكهرباء الوطنية", en: "National grid OFF hours" },
  gridNote: { ar: "بالتناوب خلال 24 ساعة", en: "Alternating within 24 hours" },
  coveredEnergy: { ar: "الحمل اليومي المطلوب تغطيته", en: "Daily load to cover" },
  resetDefaults: { ar: "إعادة الافتراضي", en: "Reset defaults" },
  suggestedSystem: { ar: "المنظومة المقترحة", en: "Suggested system" },
  suggestedDesc: { ar: "اختر المكوّنات لتظهر الكلفة الإجمالية", en: "Pick components to see the total cost" },
  panelsGroup: { ar: "الألواح", en: "Panels" },
  batteriesGroup: { ar: "البطاريات", en: "Batteries" },
  invertersGroup: { ar: "الإنفرترات", en: "Inverters" },
  qtyNeeded: { ar: "العدد المطلوب", en: "Qty needed" },
  totalCost: { ar: "الكلفة الإجمالية", en: "Total cost" },
  noSolarComponents: {
    ar: "لم تتم إضافة مكوّنات للمنظومة بعد.",
    en: "No system components have been added yet.",
  },
  packages: { ar: "عروض المنظومة", en: "System packages" },
  packageEconomy: { ar: "العرض الاقتصادي", en: "Economy package" },
  packagePro: { ar: "العرض الاحترافي", en: "Professional package" },
  packageMid: { ar: "العرض المتوسط", en: "Standard package" },
  packageEmpty: { ar: "لا توجد مكوّنات لهذا العرض", en: "No components for this package" },
  brandLabel: { ar: "البراند", en: "Brand" },
  exportQuote: { ar: "تصدير / طباعة عرض السعر PDF", en: "Export / print quote (PDF)" },
  quoteTitle: { ar: "عرض سعر منظومة طاقة شمسية", en: "Solar system quotation" },
  quoteDate: { ar: "التاريخ", en: "Date" },
  itemName: { ar: "المكوّن", en: "Item" },
  unitPriceLabel: { ar: "سعر الوحدة", en: "Unit price" },
  lineTotal: { ar: "الإجمالي", en: "Total" },

  // whatsapp / cancel / first order
  whatsappNote: {
    ar: "يرجى إدخال رقم يعمل عليه واتساب، قد نتواصل معك لتأكيد الطلب أو التبليغ عن منتج.",
    en: "Please enter a number with WhatsApp — we may contact you to confirm your order or notify you about an item.",
  },
  cancelOrder: { ar: "إلغاء الطلب", en: "Cancel order" },
  cancelOrderConfirm: { ar: "هل تريد إلغاء هذا الطلب؟", en: "Cancel this order?" },
  orderCancelled: { ar: "تم إلغاء الطلب", en: "Order cancelled" },
  cannotCancel: {
    ar: "لا يمكن الإلغاء بعد بدء التجهيز",
    en: "Cannot cancel after preparation starts",
  },
  firstOrderNote: {
    ar: "احصل على خصم 5% عند التسجيل لأول مرة، يُطبَّق تلقائياً على أول طلب فقط.",
    en: "Get 5% off when you register for the first time — applied automatically to your first order only.",
  },
  firstOrderDiscount: { ar: "خصم أول طلب (5%)", en: "First order discount (5%)" },

  // add product to an existing order
  addItemToOrder: { ar: "إضافة منتج للطلب", en: "Add product to order" },
  addItemHint: {
    ar: "يمكنك إضافة منتجات لهذا الطلب ما دام قيد المراجعة (قبل بدء التجهيز).",
    en: "You can add products while the order is still under review (before preparation).",
  },
  searchProductToAdd: { ar: "ابحث عن منتج لإضافته...", en: "Search a product to add..." },
  add: { ar: "إضافة", en: "Add" },
  itemAdded: { ar: "تمت إضافة المنتج للطلب", en: "Product added to the order" },
  cannotModify: {
    ar: "لا يمكن تعديل الطلب بعد بدء التجهيز",
    en: "Cannot modify the order after preparation starts",
  },


  // unavailable items / notifications
  unavailableItem: { ar: "غير متوفر", en: "Unavailable" },
  markUnavailable: { ar: "تعليم كغير متوفر", en: "Mark unavailable" },
  markAvailable: { ar: "إرجاع كمتوفر", en: "Mark available" },
  orderNeedsAction: {
    ar: "أحد المنتجات غير متوفر حالياً. يمكنك إكمال الطلب بدون هذا المنتج أو طلب تغييره قبل بدء التجهيز.",
    en: "One of the items is unavailable. Continue without it, or request a change before preparation starts.",
  },
  continueOrder: { ar: "إكمال الطلب", en: "Continue order" },
  changeItem: { ar: "تغيير المنتج", en: "Change item" },
  actionSaved: { ar: "تم إرسال ردك", en: "Your response was sent" },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  noNotifications: { ar: "لا توجد إشعارات", en: "No notifications" },
  markAllRead: { ar: "تعليم الكل كمقروء", en: "Mark all as read" },






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
