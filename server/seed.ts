import { db } from "./db";
import { categories, products, siteConfig } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const IMG_BASE = "https://turtlelittle.com/pub/media/catalog/product/cache";
const CACHE_1 = "191566591ee6a44e22c4d8237e6985b6";
const CACHE_2 = "0b1107d053a289736cde32f4e715ebb1";

function imgUrl(filename: string, cache = CACHE_1): string {
  const first = filename[0].toLowerCase();
  const second = filename[1].toLowerCase();
  return `${IMG_BASE}/${cache}/${first}/${second}/${filename}`;
}

export async function seedDatabase() {
  try {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(categories);

    if (Number(count) === 0) {
      console.log("Seeding database with categories and products...");

      const insertedCategories = await db.insert(categories).values([
        { name: "Girls Towels", slug: "girls-towels", description: "Personalised luxury embroidered towels for girls featuring beloved Disney princesses, cartoon characters, and more", imageUrl: imgUrl("elsa_1.jpg"), sortOrder: 1 },
        { name: "Boys Towels", slug: "boys-towels", description: "Personalised luxury embroidered towels for boys featuring superheroes, sports themes, and popular cartoon characters", imageUrl: imgUrl("bat_1.jpg"), sortOrder: 2 },
        { name: "Couple Towels", slug: "couple-towels", description: "Personalised luxury couple towel sets with elegant embroidered designs, perfect for weddings and anniversaries", imageUrl: imgUrl("ladyhrt_set_white.jpg"), sortOrder: 3 },
        { name: "Boys Blankets", slug: "boys-blankets", description: "Personalised luxury kids AC blankets for boys featuring superhero and cartoon character embroidery", imageUrl: imgUrl("superman_c.jpg"), sortOrder: 4 },
        { name: "Girls Blankets", slug: "girls-blankets", description: "Personalised luxury kids AC blankets for girls featuring princess and fairy tale character embroidery", imageUrl: imgUrl("snowhite_bird.jpg"), sortOrder: 5 },
        { name: "Bathrobes", slug: "bathrobes", description: "Luxury personalised embroidered bathrobes in 100% high-grade cotton. Super soft, absorbent, and perfect for gifting.", imageUrl: imgUrl("nqbee_1st_pic_less_txt.jpg", CACHE_2), sortOrder: 6 },
      ]).returning();

      const catMap: Record<string, number> = {};
      for (const cat of insertedCategories) {
        catMap[cat.slug] = cat.id;
      }

      const girlsTowelsId = catMap["girls-towels"];
      const boysTowelsId = catMap["boys-towels"];
      const coupleTowelsId = catMap["couple-towels"];
      const boysBlanketId = catMap["boys-blankets"];
      const girlsBlanketId = catMap["girls-blankets"];
      const bathrobesId = catMap["bathrobes"];

      const allProducts = [
        { name: "Princess Belle of Beauty and the Beast, Personalised Embroidered Luxury Towel", slug: "princess-belle-beauty-beast-towel", price: 999, imageUrl: imgUrl("barbie_2.jpg"), categoryId: girlsTowelsId, description: "Princess Belle embroidered luxury towel with personalised name embroidery.", sortOrder: 1 },
        { name: "Princess Anna of Frozen Personalised Luxury Towel", slug: "princess-anna-frozen-towel", price: 999, imageUrl: imgUrl("ana_1.jpg"), categoryId: girlsTowelsId, description: "Princess Anna of Frozen embroidered luxury towel with personalised name embroidery.", sortOrder: 2 },
        { name: "Princess Elsa Personalised Luxury Towel", slug: "princess-elsa-towel", price: 999, imageUrl: imgUrl("elsa_1.jpg"), categoryId: girlsTowelsId, description: "Princess Elsa embroidered luxury towel with personalised name embroidery.", sortOrder: 3 },
        { name: "My Little Pony, Pinkie Pie, Personalised Luxury Towel", slug: "my-little-pony-pinkie-pie-towel", price: 999, imageUrl: imgUrl("pinkpie.jpg"), categoryId: girlsTowelsId, description: "My Little Pony Pinkie Pie embroidered luxury towel with personalised name embroidery.", sortOrder: 4 },
        { name: "Masha and the Bear, Personalised Luxury Towel", slug: "masha-and-bear-towel", price: 999, imageUrl: imgUrl("masha_1.jpg"), categoryId: girlsTowelsId, description: "Masha and the Bear embroidered luxury towel with personalised name embroidery.", sortOrder: 5 },
        { name: "My Little Pony, Rainbow Dash, Personalised Luxury Towel", slug: "my-little-pony-rainbow-dash-towel", price: 999, imageUrl: imgUrl("ponrain_copy.jpg"), categoryId: girlsTowelsId, description: "My Little Pony Rainbow Dash embroidered luxury towel with personalised name embroidery.", sortOrder: 6 },
        { name: "Princess Rapunzel Personalised Luxury Towel", slug: "princess-rapunzel-towel", price: 999, imageUrl: imgUrl("rapun_copy.jpg"), categoryId: girlsTowelsId, description: "Princess Rapunzel embroidered luxury towel with personalised name embroidery.", sortOrder: 7 },
        { name: "Hello Kitty Personalised Luxury Towel", slug: "hello-kitty-towel", price: 999, imageUrl: imgUrl("kitflr_pink_1.jpg"), categoryId: girlsTowelsId, description: "Hello Kitty embroidered luxury towel with personalised name embroidery.", sortOrder: 8 },
        { name: "TinkerBell Fairy Personalised Luxury Towel", slug: "tinkerbell-fairy-towel", price: 999, imageUrl: imgUrl("tinkerbell_white_-_copy_2.jpg"), categoryId: girlsTowelsId, description: "TinkerBell Fairy embroidered luxury towel with personalised name embroidery.", sortOrder: 9 },
        { name: "Olaf, Princess Elsa's friend from Frozen, Personalised Luxury Towel", slug: "olaf-frozen-towel", price: 999, imageUrl: imgUrl("olaf_1.jpg"), categoryId: girlsTowelsId, description: "Olaf from Frozen embroidered luxury towel with personalised name embroidery.", sortOrder: 10 },
        { name: "Peppa Fairy Personalised Luxury Towel", slug: "peppa-fairy-towel", price: 999, imageUrl: imgUrl("pepfairy.jpg"), categoryId: girlsTowelsId, description: "Peppa Fairy embroidered luxury towel with personalised name embroidery.", sortOrder: 11 },
        { name: "Dori from Finding Nemo, Personalised Luxury Towel", slug: "dori-finding-nemo-towel", price: 999, imageUrl: imgUrl("doritur_yellow.jpg"), categoryId: girlsTowelsId, description: "Dori from Finding Nemo embroidered luxury towel with personalised name embroidery.", sortOrder: 12 },
        { name: "Baby Elephant with Party Balloons, Personalised Luxury Towel", slug: "baby-elephant-balloons-towel", price: 999, imageUrl: imgUrl("elepbalun_yellow.jpg"), categoryId: girlsTowelsId, description: "Baby Elephant with Party Balloons embroidered luxury towel with personalised name embroidery.", sortOrder: 13 },
        { name: "Princess Bell from Beauty and the Beast, Personalised Luxury Towel", slug: "princess-bell-beauty-beast-towel", price: 999, imageUrl: imgUrl("snowc_pink.jpg"), categoryId: girlsTowelsId, description: "Princess Bell embroidered luxury towel with personalised name embroidery.", sortOrder: 14 },
        { name: "My Little Pony, Unicorn on Cloud, Personalised Luxury Towel", slug: "unicorn-cloud-towel", price: 999, imageUrl: imgUrl("poncloud_white_bg_copy.jpg"), categoryId: girlsTowelsId, description: "Unicorn on Cloud embroidered luxury towel with personalised name embroidery.", sortOrder: 15 },
        { name: "Barbie Princess, Personalised Embroidered Luxury Towel", slug: "barbie-princess-towel", price: 999, imageUrl: imgUrl("barbie.jpg"), categoryId: girlsTowelsId, description: "Barbie Princess embroidered luxury towel with personalised name embroidery.", sortOrder: 16 },
        { name: "Princess Moana with Pig Friend Personalised Luxury Towel", slug: "princess-moana-towel", price: 999, imageUrl: imgUrl("moanpig.jpg"), categoryId: girlsTowelsId, description: "Princess Moana embroidered luxury towel with personalised name embroidery.", sortOrder: 17 },
        { name: "Girl Minion Personalised Luxury Towel", slug: "girl-minion-towel", price: 999, imageUrl: imgUrl("mingirl.jpg"), categoryId: girlsTowelsId, description: "Girl Minion embroidered luxury towel with personalised name embroidery.", sortOrder: 18 },
        { name: "Dora the Explorer Personalised Luxury Towel", slug: "dora-explorer-towel", price: 999, imageUrl: imgUrl("dora.jpg"), categoryId: girlsTowelsId, description: "Dora the Explorer embroidered luxury towel with personalised name embroidery.", sortOrder: 19 },
        { name: "Animals Personalised Luxury Kids Towel", slug: "animals-kids-towel", price: 999, imageUrl: imgUrl("animals.jpg"), categoryId: girlsTowelsId, description: "Animals embroidered luxury towel with personalised name embroidery.", sortOrder: 20 },

        { name: "Dinosaur Personalised Luxury Towel", slug: "dinosaur-towel-tiger", price: 999, imageUrl: imgUrl("dinotig_copy.jpg"), categoryId: boysTowelsId, description: "Dinosaur embroidered luxury towel with personalised name embroidery.", sortOrder: 1 },
        { name: "Basketball Personalised Luxury Towel", slug: "basketball-towel", price: 999, imageUrl: imgUrl("basket_1.jpg"), categoryId: boysTowelsId, description: "Basketball embroidered luxury towel with personalised name embroidery.", sortOrder: 2 },
        { name: "Cricket (Bat, Ball and Wickets), Personalised Luxury Towel", slug: "cricket-bat-ball-towel", price: 999, imageUrl: imgUrl("bat_1.jpg"), categoryId: boysTowelsId, description: "Cricket embroidered luxury towel with personalised name embroidery.", sortOrder: 3 },
        { name: "Shiva on his Bike, Personalised Luxury Towel", slug: "shiva-bike-towel", price: 999, imageUrl: imgUrl("shiva_white.jpg"), categoryId: boysTowelsId, description: "Shiva on his Bike embroidered luxury towel with personalised name embroidery.", sortOrder: 4 },
        { name: "Paw Patrol Personalised Luxury Towel", slug: "paw-patrol-towel", price: 999, imageUrl: imgUrl("paw.jpg"), categoryId: boysTowelsId, description: "Paw Patrol embroidered luxury towel with personalised name embroidery.", sortOrder: 5 },
        { name: "Speedo Personalised Luxury Towel", slug: "speedo-towel", price: 999, imageUrl: imgUrl("speedo_blue.jpg"), categoryId: boysTowelsId, description: "Speedo embroidered luxury towel with personalised name embroidery.", sortOrder: 6 },
        { name: "Dinosaur Blue Personalised Luxury Towel", slug: "dinosaur-blue-towel", price: 999, imageUrl: imgUrl("dinoblue.jpg"), categoryId: boysTowelsId, description: "Dinosaur Blue embroidered luxury towel with personalised name embroidery.", sortOrder: 7 },
        { name: "Goku from Dragon Ball Personalised Luxury Towel", slug: "goku-dragon-ball-towel", price: 999, imageUrl: imgUrl("goku_2.jpg"), categoryId: boysTowelsId, description: "Goku from Dragon Ball embroidered luxury towel with personalised name embroidery.", sortOrder: 8 },
        { name: "Batman from Justice League Personalised Luxury Towel", slug: "batman-justice-league-towel", price: 999, imageUrl: imgUrl("batman_blue.jpg"), categoryId: boysTowelsId, description: "Batman embroidered luxury towel with personalised name embroidery.", sortOrder: 9 },
        { name: "Baby Shark Personalised Luxury Towel", slug: "baby-shark-towel", price: 999, imageUrl: imgUrl("sharkbb.jpg"), categoryId: boysTowelsId, description: "Baby Shark embroidered luxury towel with personalised name embroidery.", sortOrder: 10 },
        { name: "Little Singham Personalised Luxury Towel", slug: "little-singham-towel", price: 999, imageUrl: imgUrl("singham_1.jpg"), categoryId: boysTowelsId, description: "Little Singham embroidered luxury towel with personalised name embroidery.", sortOrder: 11 },
        { name: "George, Peppa's Brother, Personalised Luxury Towel", slug: "george-peppa-brother-towel", price: 999, imageUrl: imgUrl("pepboy_croc.jpg"), categoryId: boysTowelsId, description: "George from Peppa Pig embroidered luxury towel with personalised name embroidery.", sortOrder: 12 },
        { name: "Spiderman Personalised Luxury Towel", slug: "spiderman-towel", price: 999, imageUrl: imgUrl("spider_bath_hand_color_name_1_1.jpg"), categoryId: boysTowelsId, description: "Spiderman embroidered luxury towel with personalised name embroidery.", sortOrder: 13 },
        { name: "Superman Personalised Towel", slug: "superman-towel", price: 999, imageUrl: imgUrl("58superman_set_blue_2.jpg"), categoryId: boysTowelsId, description: "Superman embroidered luxury towel with personalised name embroidery.", sortOrder: 14 },
        { name: "Avengers Captain America Personalised Towel", slug: "captain-america-towel", price: 999, imageUrl: imgUrl("4capamer_1_1.jpg"), categoryId: boysTowelsId, description: "Captain America embroidered luxury towel with personalised name embroidery.", sortOrder: 15 },
        { name: "Ben10 Personalised Towel", slug: "ben10-towel", price: 999, imageUrl: imgUrl("5ben10.jpg"), categoryId: boysTowelsId, description: "Ben10 embroidered luxury towel with personalised name embroidery.", sortOrder: 16 },
        { name: "Iron Man Personalised Towel", slug: "iron-man-towel", price: 999, imageUrl: imgUrl("3iron_t_c.jpg"), categoryId: boysTowelsId, description: "Iron Man embroidered luxury towel with personalised name embroidery.", sortOrder: 17 },
        { name: "Bahubali Personalised Towel", slug: "bahubali-towel", price: 999, imageUrl: imgUrl("35bahubali.jpg"), categoryId: boysTowelsId, description: "Bahubali embroidered luxury towel with personalised name embroidery.", sortOrder: 18 },
        { name: "Cute lil Baby Car Personalised Luxury Towel", slug: "baby-car-towel", price: 999, imageUrl: imgUrl("carbb_blue.jpg"), categoryId: boysTowelsId, description: "Baby Car embroidered luxury towel with personalised name embroidery.", sortOrder: 19 },
        { name: "Hulk from Avengers Personalised Luxury Towel", slug: "hulk-avengers-towel", price: 999, imageUrl: imgUrl("hulk_c.jpg"), categoryId: boysTowelsId, description: "Hulk embroidered luxury towel with personalised name embroidery.", sortOrder: 20 },

        { name: "Floral Heart with Ladybird with Initials, Personalised Couple Set", slug: "floral-heart-ladybird-couple", price: 2499, imageUrl: imgUrl("ladyhrt_set_white.jpg"), categoryId: coupleTowelsId, description: "Floral Heart with Ladybird personalised couple towel set with elegant embroidered initials.", sortOrder: 1 },
        { name: "Floral Emblem with Name Initial Couple Set", slug: "floral-emblem-couple", price: 2499, imageUrl: imgUrl("6pink_blue_emblem_couple.jpg"), categoryId: coupleTowelsId, description: "Floral Emblem personalised couple towel set with embroidered name initials.", sortOrder: 2 },
        { name: "King and Queen Crown Couple Set", slug: "king-queen-crown-couple", price: 2499, imageUrl: imgUrl("1king_queen_crowns.jpg"), categoryId: coupleTowelsId, description: "King and Queen Crown personalised couple towel set with royal embroidered designs.", sortOrder: 3 },
        { name: "Mr & Mrs Mush and Lips Couple Set", slug: "mr-mrs-mush-lips-couple", price: 2499, imageUrl: imgUrl("2his_her_couple_towel.jpg"), categoryId: coupleTowelsId, description: "Mr & Mrs Mush and Lips personalised couple towel set with fun embroidered designs.", sortOrder: 4 },
        { name: "Golden Laurel with Name Initial Couple Set", slug: "golden-laurel-couple", price: 2499, imageUrl: imgUrl("4laurel_set_s_1.jpg"), categoryId: coupleTowelsId, description: "Golden Laurel personalised couple towel set with elegant embroidered initials.", sortOrder: 5 },
        { name: "Flowers with a Bee Couple Set", slug: "flowers-bee-couple", price: 2499, imageUrl: imgUrl("9adult_bale_pair_c.jpg"), categoryId: coupleTowelsId, description: "Flowers with a Bee personalised couple towel set with charming embroidered designs.", sortOrder: 6 },

        { name: "Superman Luxury Personalised Kids AC Blanket", slug: "superman-blanket", price: 1599, imageUrl: imgUrl("superman_c.jpg"), categoryId: boysBlanketId, description: "Superman embroidered luxury personalised kids AC blanket.", sortOrder: 1 },
        { name: "Teenage Wolverine of X-Men Luxury Personalised Kids AC Blanket", slug: "wolverine-blanket", price: 1599, imageUrl: imgUrl("wolverine_blkt.jpg"), categoryId: boysBlanketId, description: "Wolverine embroidered luxury personalised kids AC blanket.", sortOrder: 2 },
        { name: "Spiderman Luxury Personalised Kids AC Blanket", slug: "spiderman-blanket", price: 1599, imageUrl: imgUrl("spiderman_1.jpg"), categoryId: boysBlanketId, description: "Spiderman embroidered luxury personalised kids AC blanket.", sortOrder: 3 },
        { name: "Doraemon Luxury Personalised Kids AC Blanket", slug: "doraemon-blanket", price: 1599, imageUrl: imgUrl("doraemon_blue.jpg"), categoryId: boysBlanketId, description: "Doraemon embroidered luxury personalised kids AC blanket.", sortOrder: 4 },
        { name: "Mickey & Pluto Luxury Personalised Kids AC Blanket", slug: "mickey-pluto-blanket", price: 1599, imageUrl: imgUrl("mick_pluto_final_1.jpg"), categoryId: boysBlanketId, description: "Mickey & Pluto embroidered luxury personalised kids AC blanket.", sortOrder: 5 },
        { name: "Hulk from Avengers Luxury Personalised Kids AC Blanket", slug: "hulk-blanket", price: 1599, imageUrl: imgUrl("hulk_c.jpg"), categoryId: boysBlanketId, description: "Hulk embroidered luxury personalised kids AC blanket.", sortOrder: 6 },

        { name: "Snowhite with Bird Luxury Personalised Kids AC Blanket", slug: "snowhite-blanket", price: 1599, imageUrl: imgUrl("snowhite_bird.jpg"), categoryId: girlsBlanketId, description: "Snowhite with Bird embroidered luxury personalised kids AC blanket.", sortOrder: 1 },
        { name: "Princess Elsa Luxury Personalised Kids AC Blanket", slug: "elsa-blanket", price: 1599, imageUrl: imgUrl("elsa_blkt.jpg"), categoryId: girlsBlanketId, description: "Princess Elsa embroidered luxury personalised kids AC blanket.", sortOrder: 2 },
        { name: "Peppa Pig Luxury Personalised Kids AC Blanket", slug: "peppa-pig-blanket", price: 1599, imageUrl: imgUrl("pepfairy.jpg"), categoryId: girlsBlanketId, description: "Peppa Pig embroidered luxury personalised kids AC blanket.", sortOrder: 3 },
        { name: "Hello Kitty Luxury Personalised Kids AC Blanket", slug: "hello-kitty-blanket", price: 1599, imageUrl: imgUrl("kitflr_pink_1.jpg"), categoryId: girlsBlanketId, description: "Hello Kitty embroidered luxury personalised kids AC blanket.", sortOrder: 4 },
        { name: "Minnie Mouse Luxury Personalised Kids AC Blanket", slug: "minnie-mouse-blanket", price: 1599, imageUrl: imgUrl("mingirl.jpg"), categoryId: girlsBlanketId, description: "Minnie Mouse embroidered luxury personalised kids AC blanket.", sortOrder: 5 },
        { name: "Unicorn Luxury Personalised Kids AC Blanket", slug: "unicorn-blanket", price: 1599, imageUrl: imgUrl("poncloud_white_bg_copy.jpg"), categoryId: girlsBlanketId, description: "Unicorn embroidered luxury personalised kids AC blanket.", sortOrder: 6 },

        { name: "Queen Bee Personalised Bathrobe", slug: "queen-bee-bathrobe", price: 2599, imageUrl: imgUrl("nqbee_1st_pic_less_txt.jpg", CACHE_2), categoryId: bathrobesId, description: "Luxurious personalised bathrobe with intricate Queen Bee embroidery. 100% high-grade cotton, super soft and absorbent. Perfect gift for her.", sortOrder: 1 },
        { name: "Golden Laurel Initials Personalised Bathrobe", slug: "golden-laurel-bathrobe", price: 2599, imageUrl: imgUrl("nqbee_front_mannequin_1.jpg", CACHE_2), categoryId: bathrobesId, description: "Elegant personalised bathrobe with golden laurel wreath and initials embroidery. 100% high-grade cotton, super soft and absorbent.", sortOrder: 2 },
        { name: "Mr Right Mrs Always Right Couple Bathrobe Set", slug: "mr-right-mrs-always-right-bathrobe-set", price: 4759, imageUrl: imgUrl("mrmrsrightrobes.jpg", CACHE_2), categoryId: bathrobesId, description: "Personalised couple bathrobe set with Mr Right & Mrs Always Right embroidery. Set of 2 bathrobes, 100% cotton, super absorbent. Ideal anniversary or wedding gift.", sortOrder: 3 },
        { name: "Mr Right Mrs Always Right Couple Bathrobe Set (Gold)", slug: "mr-right-mrs-always-right-bathrobe-gold", price: 4759, imageUrl: imgUrl("mrr_mrsar.jpg", CACHE_2), categoryId: bathrobesId, description: "Premium personalised couple bathrobe set with elegant gold Mr Right & Mrs Always Right embroidery. Set of 2, 100% high-grade cotton.", sortOrder: 4 },
        { name: "Heart Personalised Bathrobe", slug: "heart-personalised-bathrobe", price: 2599, imageUrl: imgUrl("nqbee_1st_pic_less_txt.jpg", CACHE_2), categoryId: bathrobesId, description: "Beautiful personalised bathrobe with embroidered heart design. 100% high-grade cotton, super soft and absorbent. A thoughtful gift for loved ones.", sortOrder: 5 },
        { name: "Golden Crown Personalised Bathrobe", slug: "golden-crown-bathrobe", price: 2599, imageUrl: imgUrl("nqbee_front_mannequin_1.jpg", CACHE_2), categoryId: bathrobesId, description: "Regal personalised bathrobe with golden crown embroidery. 100% high-grade cotton, super soft and absorbent. Feel like royalty every day.", sortOrder: 6 },
      ];

      await db.insert(products).values(allProducts).onConflictDoNothing();
      console.log(`Seeded ${insertedCategories.length} categories and ${allProducts.length} products.`);
    } else {
      console.log("Database already seeded, skipping category/product seed.");
    }

    const homepageConfig = await db.select().from(siteConfig).where(eq(siteConfig.key, "homepageCollections"));
    if (homepageConfig.length === 0) {
      console.log("Seeding homepageCollections config...");
      await db.insert(siteConfig).values({
        key: "homepageCollections",
        value: JSON.stringify({"sections":[{"id":"collections","label":"Collections","heading":"Shop by Collection","cards":[{"title":"For Kids","description":"Make bath time their favourite time. Our kids' collection features Disney princesses, superheroes, unicorns and more \u2014 all embroidered with your child's name. Towels and blankets they'll never want to let go of.","link":"/shop?filter=kids","imageUrl":""},{"title":"For Adults","description":"Elevate your everyday essentials. Our adults' range features elegant monograms, laurel crests and classic initials \u2014 personalised towels and blankets that bring a touch of luxury to your home.","link":"/shop?filter=adults","imageUrl":""},{"title":"For Couples","description":"The perfect his & hers gift. Our couple towel sets come with matching embroidered designs \u2014 from King & Queen crowns to Mr. Right & Mrs. Always Right. Ideal for weddings, anniversaries and housewarmings.","link":"/shop?filter=couples","imageUrl":""}]},{"id":"productTypes","label":"Products","heading":"Shop by Product","cards":[{"title":"Towels","description":"Wrap yourself in luxury. Our 550 GSM zero-twist cotton towels are soft, absorbent and beautifully embroidered with your name or initials. Available for kids and adults in a range of fun and elegant designs.","link":"/shop","imageUrl":""},{"title":"Bathrobes","description":"Step out of the shower in style. Our plush terry cotton bathrobes are personalised with custom embroidery, making every day feel like a spa day. Perfect as a gift or a treat for yourself.","link":"/shop","imageUrl":""},{"title":"Blankets","description":"Snuggle up with a blanket made just for you. Our ultra-soft AC blankets come with beautiful embroidered names and fun designs \u2014 loved by kids and perfect for gifting on birthdays and special occasions.","link":"/shop","imageUrl":""}]}]}),
      }).onConflictDoNothing();
      console.log("Seeded homepageCollections config.");
    }

    const featuredConfig = await db.select().from(siteConfig).where(eq(siteConfig.key, "featuredSections"));
    if (featuredConfig.length === 0 || (featuredConfig[0] && !featuredConfig[0].value.includes("bathrobes"))) {
      console.log("Seeding featuredSections config...");
      const featuredValue = JSON.stringify({"kids":{"title":"Popular for Kids","subtitle":"Disney princesses, superheroes & more","link":"/shop?filter=kids"},"couples":{"title":"Couple Sets","subtitle":"Elegant matching towel sets for two","link":"/shop?filter=couples"},"blankets":{"title":"Cozy Blankets","subtitle":"Soft personalised AC blankets for kids","link":"/shop?filter=kids"},"bathrobes":{"title":"Luxury Bathrobes","subtitle":"Premium personalised cotton bathrobes","link":"/category/bathrobes"}});
      if (featuredConfig.length === 0) {
        await db.insert(siteConfig).values({ key: "featuredSections", value: featuredValue }).onConflictDoNothing();
      } else {
        await db.update(siteConfig).set({ value: featuredValue }).where(eq(siteConfig.key, "featuredSections"));
      }
      console.log("Seeded featuredSections config.");
    }

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}
