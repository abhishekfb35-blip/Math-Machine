export interface SeoConfig {
  brandName: string;
  tagline: string;
  metaDescription: string;
  ogImageUrl: string;
  siteUrl: string;
}

export const defaultSeo: SeoConfig = {
  brandName: "TurtleLittle",
  tagline: "Personalised Luxury Towels & Blankets",
  metaDescription: "Personalised luxury embroidered towels, blankets & bathrobes. Premium quality, handcrafted with your name. Buy 2 Get 1 Free. Delivered across India.",
  ogImageUrl: "/og-image.png",
  siteUrl: "https://turtlelittle.com",
};

export interface AnnouncementConfig {
  items: { text: string }[];
}

export interface HeroConfig {
  title: string;
  titleHighlight: string;
  subtitle: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  imageUrl: string;
}

export interface HeaderConfig {
  brandName: string;
}

export interface PromiseConfig {
  label: string;
  heading: string;
  subheading: string;
  cards: { title: string; description: string }[];
}

export interface CollectionCard {
  title: string;
  description: string;
  link: string;
  imageUrl: string;
}

export interface CollectionsConfig {
  label: string;
  heading: string;
  cards: CollectionCard[];
}

export interface ProductTypeCard {
  title: string;
  description: string;
  link: string;
  imageUrl: string;
}

export interface ProductTypesConfig {
  label: string;
  heading: string;
  cards: ProductTypeCard[];
}

export interface HomepageCollectionCard {
  title: string;
  description: string;
  link: string;
  imageUrl: string;
}

export interface HomepageCollectionSection {
  id: string;
  label: string;
  heading: string;
  cards: HomepageCollectionCard[];
}

export interface HomepageCollectionsConfig {
  sections: HomepageCollectionSection[];
  deletedHistory: HomepageCollectionSection[];
}

export interface PromoConfig {
  title: string;
  description: string;
  buttonText: string;
  buttonLink: string;
}

export interface Testimonial {
  name: string;
  location: string;
  text: string;
  rating: number;
}

export interface TestimonialsConfig {
  label: string;
  heading: string;
  items: Testimonial[];
}

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsConfig {
  items: StatItem[];
}

export interface PwaInstallConfig {
  text: string;
  buttonText: string;
  customUrl: string;
}

export interface OfferTier {
  label: string;
  buyCount: number;
  freeCount: number;
  enabled: boolean;
}

export interface DeliveryTier {
  minItems: number;
  maxItems: number;
  fee: number;
}

export interface FooterConfig {
  brandName: string;
  brandStory: string;
  whatsappUrl: string;
  email: string;
  phone: string;
  address: string;
  shopLinks: { label: string; href: string }[];
}

export interface FeaturedSectionConfig {
  title: string;
  subtitle: string;
  categoryFilters: string[];
  audienceFilters: string[];
  genderFilters: string[];
  themeFilters: string[];
  styleFilters: string[];
  tagFilters: string[];
}

export interface FeaturedSectionsConfig {
  kids: FeaturedSectionConfig;
  couples: FeaturedSectionConfig;
  blankets: FeaturedSectionConfig;
  bathrobes: FeaturedSectionConfig;
}

export const defaultAnnouncement: AnnouncementConfig = {
  items: [
    { text: "Buy 2 Get 1 Free on all products" },
    { text: "Personalised embroidery on every product" },
    { text: "Premium towels, blankets & bathrobes" },
  ],
};

export const defaultHero: HeroConfig = {
  title: "Luxury Towels, Blankets & Bathrobes",
  titleHighlight: "with Your Name",
  subtitle: "Premium quality embroidered towels, blankets & bathrobes, personalised with love. The perfect gift for your little ones and loved ones.",
  primaryButtonText: "Shop Now",
  primaryButtonLink: "/shop",
  secondaryButtonText: "Couple Sets",
  secondaryButtonLink: "/collection/couples",
  imageUrl: "",
};

export const defaultHeader: HeaderConfig = {
  brandName: "TurtleLittle",
};

export const defaultPromise: PromiseConfig = {
  label: "The TurtleLittle Promise",
  heading: "Crafted with Care, Personalised with Love",
  subheading: "Every product is made from premium fabrics and meticulously embroidered to create something truly special.",
  cards: [
    { title: "Premium Fabric", description: "Only the finest quality cotton and fabrics are selected for our towels and blankets, ensuring lasting softness and comfort." },
    { title: "Hand Embroidered", description: "Each design is carefully embroidered with precision and artistry. Your child's name is stitched into every piece with meticulous detail." },
    { title: "Made with Love", description: "From Disney princesses to superheroes, every design is chosen to delight. The perfect personalised gift for every occasion." },
  ],
};

export const defaultCollections: CollectionsConfig = {
  label: "Collections",
  heading: "Shop by Collection",
  cards: [
    { title: "For Kids", description: "Make bath time their favourite time. Our kids' collection features Disney princesses, superheroes, unicorns and more — all embroidered with your child's name. Towels and blankets they'll never want to let go of.", link: "/collection/kids", imageUrl: "" },
    { title: "For Adults", description: "Elevate your everyday essentials. Our adults' range features elegant monograms, laurel crests and classic initials — personalised towels and blankets that bring a touch of luxury to your home.", link: "/collection/adults", imageUrl: "" },
    { title: "For Couples", description: "The perfect his & hers gift. Our couple towel sets come with matching embroidered designs — from King & Queen crowns to Mr. Right & Mrs. Always Right. Ideal for weddings, anniversaries and housewarmings.", link: "/collection/couples", imageUrl: "" },
  ],
};

export const defaultProductTypes: ProductTypesConfig = {
  label: "Products",
  heading: "Shop by Product",
  cards: [
    { title: "Towels", description: "Wrap yourself in luxury. Our 550 GSM zero-twist cotton towels are soft, absorbent and beautifully embroidered with your name or initials. Available for kids and adults in a range of fun and elegant designs.", link: "/shop", imageUrl: "" },
    { title: "Bathrobes", description: "Step out of the shower in style. Our plush terry cotton bathrobes are personalised with custom embroidery, making every day feel like a spa day. Perfect as a gift or a treat for yourself.", link: "/shop", imageUrl: "" },
    { title: "Blankets", description: "Snuggle up with a blanket made just for you. Our ultra-soft AC blankets come with beautiful embroidered names and fun designs — loved by kids and perfect for gifting on birthdays and special occasions.", link: "/shop", imageUrl: "" },
  ],
};

export const defaultHomepageCollections: HomepageCollectionsConfig = {
  sections: [
    {
      id: "collections",
      label: "Collections",
      heading: "Shop by Collection",
      cards: [
        { title: "For Kids", description: "Make bath time their favourite time. Our kids' collection features Disney princesses, superheroes, unicorns and more — all embroidered with your child's name. Towels and blankets they'll never want to let go of.", link: "/collection/kids", imageUrl: "" },
        { title: "For Adults", description: "Elevate your everyday essentials. Our adults' range features elegant monograms, laurel crests and classic initials — personalised towels and blankets that bring a touch of luxury to your home.", link: "/collection/adults", imageUrl: "" },
        { title: "For Couples", description: "The perfect his & hers gift. Our couple towel sets come with matching embroidered designs — from King & Queen crowns to Mr. Right & Mrs. Always Right. Ideal for weddings, anniversaries and housewarmings.", link: "/collection/couples", imageUrl: "" },
      ],
    },
    {
      id: "productTypes",
      label: "Products",
      heading: "Shop by Product",
      cards: [
        { title: "Towels", description: "Wrap yourself in luxury. Our 550 GSM zero-twist cotton towels are soft, absorbent and beautifully embroidered with your name or initials. Available for kids and adults in a range of fun and elegant designs.", link: "/shop", imageUrl: "" },
        { title: "Bathrobes", description: "Step out of the shower in style. Our plush terry cotton bathrobes are personalised with custom embroidery, making every day feel like a spa day. Perfect as a gift or a treat for yourself.", link: "/shop", imageUrl: "" },
        { title: "Blankets", description: "Snuggle up with a blanket made just for you. Our ultra-soft AC blankets come with beautiful embroidered names and fun designs — loved by kids and perfect for gifting on birthdays and special occasions.", link: "/shop", imageUrl: "" },
      ],
    },
  ],
  deletedHistory: [],
};

export const defaultPromo: PromoConfig = {
  title: "Buy 2 Get 1 Free",
  description: "Mix and match across all products. Add 3 or more items to your cart and the cheapest ones are free!",
  buttonText: "Start Shopping",
  buttonLink: "/shop",
};

export const defaultTestimonials: TestimonialsConfig = {
  label: "What Our Customers Say",
  heading: "Loved by Parents & Couples",
  items: [
    { name: "Priya M.", location: "Mumbai", text: "The embroidery quality is stunning! My daughter loves her personalised Elsa towel. Perfect birthday gift.", rating: 5 },
    { name: "Rahul K.", location: "Delhi", text: "Ordered the couple towel set for our anniversary. The quality is premium and the embroidery is beautiful.", rating: 5 },
    { name: "Ananya S.", location: "Bangalore", text: "Buy 2 Get 1 Free is such a great deal. Got blankets for all three kids. Super soft fabric!", rating: 5 },
    { name: "Neha G.", location: "Pune", text: "Fast delivery and amazing packaging. The personalised touch makes it so special. Will order again!", rating: 5 },
  ],
};

export const defaultStats: StatsConfig = {
  items: [
    { value: "58+", label: "Products" },
    { value: "5", label: "Collections" },
    { value: "All India", label: "Free Delivery" },
  ],
};

export const defaultPwaInstall: PwaInstallConfig = {
  text: "Add to your home screen for the best experience",
  buttonText: "Get the App",
  customUrl: "",
};

export const defaultOfferTiers: OfferTier[] = [
  { label: "Buy 2 Get 1 Free", buyCount: 2, freeCount: 1, enabled: true },
  { label: "Buy 3 Get 2 Free", buyCount: 3, freeCount: 2, enabled: true },
];

export const defaultDeliveryTiers: DeliveryTier[] = [
  { minItems: 3, maxItems: 5, fee: 300 },
  { minItems: 6, maxItems: 10, fee: 500 },
  { minItems: 11, maxItems: 15, fee: 700 },
];

export const defaultFooter: FooterConfig = {
  brandName: "TurtleLittle",
  brandStory: "Premium personalised towels and blankets, embroidered with love. Each product is crafted with the finest fabrics and meticulous attention to detail, making every piece a thoughtful gift.",
  whatsappUrl: "https://wa.me/919990079722",
  email: "hello@turtlelittle.com",
  phone: "+91 99900 79722",
  address: "New Delhi, India",
  shopLinks: [
    { label: "Towels", href: "/shop#towels" },
    { label: "Bathrobes", href: "/shop#bathrobes" },
    { label: "Blankets", href: "/shop#blankets" },
    { label: "All Products", href: "/shop" },
    { label: "My Cart", href: "/cart" },
  ],
};

export interface PageSection {
  heading: string;
  body: string;
}

export interface AboutPageConfig {
  title: string;
  intro: string;
  sections: PageSection[];
  valueCards: { title: string; description: string }[];
  contactWhatsapp: string;
  contactEmail: string;
  contactLocation: string;
}

export interface TermsPageConfig {
  title: string;
  lastUpdated: string;
  sections: PageSection[];
}

export interface PrivacyPageConfig {
  title: string;
  lastUpdated: string;
  sections: PageSection[];
}

export interface RefundPageConfig {
  title: string;
  lastUpdated: string;
  sections: PageSection[];
}

export interface ShippingPageConfig {
  title: string;
  lastUpdated: string;
  sections: PageSection[];
}

export const defaultAboutPage: AboutPageConfig = {
  title: "About TurtleLittle",
  intro: "TurtleLittle was born from a simple idea: that everyday essentials like towels, blankets, and bathrobes can be something truly special when made personal. We believe in the magic of seeing your own name beautifully embroidered on a premium product — it transforms something ordinary into a cherished keepsake.",
  sections: [
    { heading: "What We Do", body: "We specialise in personalised, embroidered luxury towels, blankets, and bathrobes for kids, adults, and couples. Every product is crafted using premium fabrics — our towels are made from 550 GSM zero-twist cotton that's incredibly soft and absorbent. Each item is embroidered with care, featuring your chosen name, initials, or design." },
    { heading: "Our Collections", body: "From Disney princesses and superheroes for kids to elegant monograms for adults and matching \"King & Queen\" sets for couples — we have something for everyone. Our products make perfect gifts for birthdays, baby showers, weddings, anniversaries, housewarmings, and every celebration in between." },
    { heading: "Our Promise", body: "At TurtleLittle, we're committed to delivering products that exceed your expectations. Every towel, blanket, and bathrobe is made to be soft, durable, and beautifully personalised. If you're ever not satisfied with the quality of your product, we'll make it right — that's our promise to you." },
  ],
  valueCards: [
    { title: "Handcrafted Quality", description: "Every piece is individually embroidered with precision and care, ensuring a premium finish." },
    { title: "Made with Love", description: "We put our heart into every product, because we know it's going to be loved by someone special." },
    { title: "Premium Fabrics", description: "550 GSM zero-twist cotton towels and ultra-soft blankets — only the best materials make it into our products." },
    { title: "All-India Delivery", description: "We deliver across India so you can send a personalised gift to anyone, anywhere." },
  ],
  contactWhatsapp: "+91 99900 79722",
  contactEmail: "hello@turtlelittle.com",
  contactLocation: "New Delhi, India",
};

export const defaultTermsPage: TermsPageConfig = {
  title: "Terms & Conditions",
  lastUpdated: "February 2026",
  sections: [
    { heading: "1. Introduction", body: "Welcome to TurtleLittle (\"we,\" \"our,\" or \"us\"). These Terms & Conditions govern your use of our website turtlelittle.com and the purchase of our products. By accessing our website or placing an order, you agree to be bound by these terms. Please read them carefully before using our services." },
    { heading: "2. Products & Personalisation", body: "TurtleLittle offers personalised embroidered towels, blankets, and bathrobes. All personalisation details (names, initials, designs) provided by the customer must be accurate. We are not responsible for errors in personalisation caused by incorrect information provided by the customer. Due to the personalised nature of our products, please double-check all details before confirming your order." },
    { heading: "3. Pricing & Payment", body: "All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to change prices at any time without prior notice. Payment must be completed at the time of placing an order through our accepted payment methods. We use secure, industry-standard payment processing to protect your financial information." },
    { heading: "4. Orders & Confirmation", body: "Once you place an order, you will receive an order confirmation. This confirmation does not guarantee acceptance of your order. We reserve the right to cancel or refuse any order for reasons including product availability, pricing errors, or suspected fraudulent activity. In such cases, you will be notified and any payment made will be refunded." },
    { heading: "5. Shipping & Delivery", body: "We aim to dispatch all orders within 3-5 business days after order confirmation. Delivery timelines depend on your location and the shipping partner. Please refer to our Shipping Policy for detailed information on delivery timelines and charges." },
    { heading: "6. Returns & Refunds", body: "Due to the personalised nature of our products, returns and exchanges are accepted only in cases of manufacturing defects or incorrect items delivered. Please refer to our Refund & Cancellation Policy for complete details on the return process and eligibility." },
    { heading: "7. Intellectual Property", body: "All content on turtlelittle.com, including text, images, logos, designs, and graphics, is the property of TurtleLittle and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use any content from our website without our prior written permission." },
    { heading: "8. Limitation of Liability", body: "TurtleLittle shall not be liable for any indirect, incidental, or consequential damages arising from the use of our website or products. Our total liability shall not exceed the amount paid by you for the specific product in question." },
    { heading: "9. Governing Law", body: "These terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the courts in New Delhi, India." },
    { heading: "10. Contact Us", body: "If you have any questions about these Terms & Conditions, please reach out to us at hello@turtlelittle.com or call us at +91 99900 79722." },
  ],
};

export const defaultPrivacyPage: PrivacyPageConfig = {
  title: "Privacy Policy",
  lastUpdated: "February 2026",
  sections: [
    { heading: "1. Introduction", body: "TurtleLittle (\"we,\" \"our,\" or \"us\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your personal information when you visit turtlelittle.com or purchase our products." },
    { heading: "2. Information We Collect", body: "We collect the following types of information:\n• Personal Information: Name, email address, phone number, shipping address, and billing address when you place an order.\n• Personalisation Details: Names and initials you provide for embroidery on our products.\n• Payment Information: Payment details are processed securely through our payment gateway partners and are not stored on our servers.\n• Usage Data: Browser type, pages visited, time spent on pages, and other analytics data to improve our website experience.\n• Cookies: We use cookies to maintain your cart, remember preferences, and improve your browsing experience." },
    { heading: "3. How We Use Your Information", body: "• To process and fulfill your orders, including personalisation and delivery.\n• To communicate with you about your orders, including shipping updates via WhatsApp or phone.\n• To improve our website, products, and customer service.\n• To send promotional communications (only with your consent, and you can opt out at any time).\n• To prevent fraud and ensure the security of transactions." },
    { heading: "4. Information Sharing", body: "We do not sell, trade, or rent your personal information to third parties. We may share your information only with:\n• Shipping Partners: To deliver your orders.\n• Payment Processors: To process your payments securely.\n• Legal Requirements: When required by law or to protect our rights." },
    { heading: "5. Cookies", body: "Our website uses cookies to enhance your experience. Cookies help us remember your cart items and preferences. You can manage or disable cookies through your browser settings, though some features of the website may not function properly without them." },
    { heading: "6. Data Security", body: "We implement industry-standard security measures to protect your personal information, including SSL encryption for all data transmission. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security." },
    { heading: "7. Data Retention", body: "We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, including order fulfillment, customer support, and legal obligations. You may request deletion of your data by contacting us." },
    { heading: "8. Your Rights", body: "You have the right to:\n• Access the personal information we hold about you.\n• Request correction of inaccurate information.\n• Request deletion of your personal data.\n• Opt out of promotional communications at any time." },
    { heading: "9. Changes to This Policy", body: "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated date. We encourage you to review this policy periodically." },
    { heading: "10. Contact Us", body: "For any privacy-related questions or requests, please contact us at hello@turtlelittle.com or call us at +91 99900 79722." },
  ],
};

export const defaultRefundPage: RefundPageConfig = {
  title: "Refund & Cancellation Policy",
  lastUpdated: "February 2026",
  sections: [
    { heading: "1. Personalised Products", body: "Since all TurtleLittle products are personalised with custom embroidery (names, initials, or specific designs), they are made-to-order and cannot be resold. Therefore, we do not accept returns or exchanges for change of mind, incorrect personalisation details provided by the customer, or size/colour preferences after the order has been placed." },
    { heading: "2. Eligible Returns", body: "We accept returns and provide replacements or refunds only in the following cases:\n• Manufacturing Defects: If the product has a defect in the fabric, stitching, or embroidery quality.\n• Wrong Item: If you receive a product different from what you ordered.\n• Damaged in Transit: If the product arrives damaged due to shipping." },
    { heading: "3. How to Request a Return", body: "To initiate a return, please follow these steps:\n1. Contact us within 48 hours of receiving your order via WhatsApp at +91 99900 79722 or email at hello@turtlelittle.com.\n2. Share clear photographs of the product showing the defect or issue.\n3. Include your order number and a brief description of the problem.\n4. Our team will review your request and respond within 24-48 hours." },
    { heading: "4. Refund Process", body: "Once your return request is approved, we will offer you the choice of a replacement product or a full refund. Refunds will be processed to the original payment method within 7-10 business days. For Cash on Delivery (COD) orders, refunds will be processed via bank transfer — we will collect your bank details securely." },
    { heading: "5. Order Cancellation", body: "You may cancel your order within 2 hours of placing it by contacting us via WhatsApp or email. After this window, your order may already be in production and cannot be cancelled. For cancelled orders where payment was already made, a full refund will be processed within 7-10 business days." },
    { heading: "6. Non-Returnable Items", body: "The following are not eligible for returns:\n• Products that have been used, washed, or altered after delivery.\n• Products returned without prior approval from our team.\n• Products where the issue is due to incorrect personalisation details provided by the customer." },
    { heading: "7. Contact Us", body: "For any questions about returns, refunds, or cancellations, please reach out to us at hello@turtlelittle.com or WhatsApp us at +91 99900 79722." },
  ],
};

export const defaultShippingPage: ShippingPageConfig = {
  title: "Shipping Policy",
  lastUpdated: "February 2026",
  sections: [
    { heading: "1. Processing Time", body: "Since all TurtleLittle products are personalised with custom embroidery, each item is made-to-order. Orders typically take 3-5 business days to process and prepare for dispatch. During festive seasons or high-demand periods, processing may take slightly longer." },
    { heading: "2. Delivery Timeline", body: "After dispatch, estimated delivery times are:\n• Metro Cities (Delhi, Mumbai, Bangalore, Chennai, Kolkata, Hyderabad): 2-4 business days\n• Other Cities & Towns: 4-7 business days\n• Remote Areas: 7-10 business days\n\nPlease note that delivery timelines are estimates and may vary based on the shipping partner and your location. You will receive a shipping confirmation with tracking details once your order is dispatched." },
    { heading: "3. Shipping Charges", body: "We offer free shipping across India on all orders. No minimum order value is required. We want the joy of receiving a personalised TurtleLittle product to begin the moment you place your order." },
    { heading: "4. Shipping Partners", body: "We work with reputable logistics partners to ensure safe and timely delivery of your orders. All products are carefully packaged to protect the embroidery and fabric during transit." },
    { heading: "5. Order Tracking", body: "Once your order is dispatched, you will receive a tracking number via WhatsApp or email. You can use this to track the real-time status of your delivery. If you haven't received tracking details within 5 business days of placing your order, please contact us." },
    { heading: "6. Delivery Issues", body: "If your order has not arrived within the estimated delivery timeline, or if you receive a damaged package, please contact us immediately via WhatsApp at +91 99900 79722 or email at hello@turtlelittle.com. We will work with the shipping partner to resolve the issue as quickly as possible." },
    { heading: "7. Incorrect Address", body: "Please ensure that the shipping address provided at checkout is accurate and complete. TurtleLittle is not responsible for delays or non-delivery caused by incorrect or incomplete addresses. If you need to change your shipping address after placing an order, contact us within 2 hours of placing the order." },
    { heading: "8. Contact Us", body: "For any shipping-related queries, please reach out to us at hello@turtlelittle.com or WhatsApp us at +91 99900 79722." },
  ],
};

export interface ShopSection {
  label: string;
  tag?: string;           // legacy — kept for reading old saved data
  tags?: string[];        // replaces tag; used for product tag filtering + section key
  categories?: string[];  // category slug filter
  maxShown: number;
  enabled: boolean;
  audience?: string[];
  genders?: string[];
  themes?: string[];
  styles?: string[];
}

export const defaultShopSections: ShopSection[] = [
  { label: "Kids Towels",      tags: ["kids towels"],      maxShown: 8, enabled: true, audience: ["kids"] },
  { label: "Adult Towels",     tags: ["adult towels"],     maxShown: 8, enabled: true, audience: ["adults"] },
  { label: "Couple Towels",    tags: ["couple towels"],    maxShown: 8, enabled: true, audience: ["adults"] },
  { label: "Kids Blankets",    tags: ["kids blankets"],    maxShown: 8, enabled: true, audience: ["kids"] },
  { label: "Kids Bathrobes",   tags: ["kids bathrobes"],   maxShown: 8, enabled: true, audience: ["kids"] },
  { label: "Adult Bathrobes",  tags: ["adult bathrobes"],  maxShown: 8, enabled: true, audience: ["adults"] },
  { label: "Couple Bathrobes", tags: ["couple bathrobes"], maxShown: 8, enabled: true, audience: ["adults"] },
];

const EMPTY_SECTION_FILTERS = {
  categoryFilters: [],
  audienceFilters: [],
  genderFilters: [],
  themeFilters: [],
  styleFilters: [],
  tagFilters: [],
};

export const defaultFeaturedSections: FeaturedSectionsConfig = {
  kids:      { title: "Popular for Kids Towels",           subtitle: "Disney princesses, superheroes & more",   ...EMPTY_SECTION_FILTERS },
  couples:   { title: "Couple Sets",                       subtitle: "Elegant matching towel sets for two",       ...EMPTY_SECTION_FILTERS },
  blankets:  { title: "Cozy Blankets",                     subtitle: "Soft personalised AC blankets for kids",    ...EMPTY_SECTION_FILTERS },
  bathrobes: { title: "Luxury Bathrobes",                  subtitle: "Premium personalised cotton bathrobes",     ...EMPTY_SECTION_FILTERS },
};
