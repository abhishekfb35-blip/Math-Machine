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

export interface FooterConfig {
  brandName: string;
  brandStory: string;
  whatsappUrl: string;
  email: string;
  phone: string;
  address: string;
  shopLinks: { label: string; href: string }[];
}

export interface FeaturedSectionsConfig {
  kids: { title: string; subtitle: string; link: string };
  couples: { title: string; subtitle: string; link: string };
  blankets: { title: string; subtitle: string; link: string };
  bathrobes: { title: string; subtitle: string; link: string };
}

export const defaultAnnouncement: AnnouncementConfig = {
  items: [
    { text: "Buy 2 Get 1 Free on all products" },
    { text: "Free shipping across India" },
    { text: "Personalised embroidery on every product" },
  ],
};

export const defaultHero: HeroConfig = {
  title: "Luxury Towels & Blankets",
  titleHighlight: "with Your Name",
  subtitle: "Premium quality embroidered products, personalised with love. The perfect gift for your little ones and loved ones.",
  primaryButtonText: "Shop Now",
  primaryButtonLink: "/shop",
  secondaryButtonText: "Couple Sets",
  secondaryButtonLink: "/shop?filter=couples",
  imageUrl: "",
};

export const defaultHeader: HeaderConfig = {
  brandName: "Turtle Little",
};

export const defaultPromise: PromiseConfig = {
  label: "The Turtle Little Promise",
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
    { title: "For Kids", description: "Make bath time their favourite time. Our kids' collection features Disney princesses, superheroes, unicorns and more — all embroidered with your child's name. Towels and blankets they'll never want to let go of.", link: "/shop?filter=kids", imageUrl: "" },
    { title: "For Adults", description: "Elevate your everyday essentials. Our adults' range features elegant monograms, laurel crests and classic initials — personalised towels and blankets that bring a touch of luxury to your home.", link: "/shop?filter=adults", imageUrl: "" },
    { title: "For Couples", description: "The perfect his & hers gift. Our couple towel sets come with matching embroidered designs — from King & Queen crowns to Mr. Right & Mrs. Always Right. Ideal for weddings, anniversaries and housewarmings.", link: "/shop?filter=couples", imageUrl: "" },
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
        { title: "For Kids", description: "Make bath time their favourite time. Our kids' collection features Disney princesses, superheroes, unicorns and more — all embroidered with your child's name. Towels and blankets they'll never want to let go of.", link: "/shop?filter=kids", imageUrl: "" },
        { title: "For Adults", description: "Elevate your everyday essentials. Our adults' range features elegant monograms, laurel crests and classic initials — personalised towels and blankets that bring a touch of luxury to your home.", link: "/shop?filter=adults", imageUrl: "" },
        { title: "For Couples", description: "The perfect his & hers gift. Our couple towel sets come with matching embroidered designs — from King & Queen crowns to Mr. Right & Mrs. Always Right. Ideal for weddings, anniversaries and housewarmings.", link: "/shop?filter=couples", imageUrl: "" },
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

export const defaultFooter: FooterConfig = {
  brandName: "Turtle Little",
  brandStory: "Premium personalised towels and blankets, embroidered with love. Each product is crafted with the finest fabrics and meticulous attention to detail, making every piece a thoughtful gift.",
  whatsappUrl: "https://wa.me/919990079722",
  email: "hello@turtlelittle.com",
  phone: "+91 99900 79722",
  address: "New Delhi, India",
  shopLinks: [
    { label: "Kids Collection", href: "/shop?filter=kids" },
    { label: "Couple Sets", href: "/shop?filter=couples" },
    { label: "All Products", href: "/shop" },
    { label: "My Cart", href: "/cart" },
  ],
};

export const defaultFeaturedSections: FeaturedSectionsConfig = {
  kids: { title: "Popular for Kids", subtitle: "Disney princesses, superheroes & more", link: "/shop?filter=kids" },
  couples: { title: "Couple Sets", subtitle: "Elegant matching towel sets for two", link: "/shop?filter=couples" },
  blankets: { title: "Cozy Blankets", subtitle: "Soft personalised AC blankets for kids", link: "/shop?filter=kids" },
  bathrobes: { title: "Luxury Bathrobes", subtitle: "Premium personalised cotton bathrobes", link: "/category/bathrobes" },
};
