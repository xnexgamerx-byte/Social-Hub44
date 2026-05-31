import { sql } from "drizzle-orm";
import {
  db,
  storeItemsTable,
  vipFeaturesTable,
  vipTiersTable,
  type InsertStoreItem,
  type InsertVipFeature,
  type InsertVipTier,
} from "@workspace/db";
import { logger } from "./logger";

const FEATURES: InsertVipFeature[] = [
  { key: "follow_more_users", label: "متابعة عدد أكبر من المستخدمين", icon: "person-add", sortOrder: 1, description: "تابع عدداً أكبر من المستخدمين" },
  { key: "who_viewed", label: "من شاهدني", icon: "eye", sortOrder: 2, description: "اعرف من زار ملفك الشخصي" },
  { key: "vip_card", label: "بطاقة VIP", icon: "card", sortOrder: 3, description: "بطاقة VIP مميزة بجانب اسمك" },
  { key: "exclusive_badge", label: "شارة حصرية", icon: "ribbon", sortOrder: 4, description: "شارة حصرية تظهر لمستواك" },
  { key: "exclusive_frame", label: "إطار حصري", icon: "ellipse-outline", sortOrder: 5, description: "إطار حصري حول صورتك" },
  { key: "create_room", label: "إنشاء غرفة دردشة", icon: "home", sortOrder: 6, description: "أنشئ غرف دردشة خاصة بك" },
  { key: "points_store", label: "متجر النقاط", icon: "storefront", sortOrder: 7, description: "وصول إلى متجر النقاط الحصري" },
  { key: "room_background", label: "خلفية الغرفة", icon: "image", sortOrder: 8, description: "خصص خلفية غرفتك" },
  { key: "entrance_effects", label: "مؤثرات الدخول", icon: "sparkles", sortOrder: 9, description: "مؤثرات مبهرة عند دخولك الغرف" },
  { key: "language_filter", label: "فلترة اللغات", icon: "filter", sortOrder: 10, description: "فلترة المحتوى حسب اللغة" },
  { key: "join_more_rooms", label: "الانضمام إلى عدد أكبر من الغرف", icon: "enter", sortOrder: 11, description: "انضم لعدد أكبر من الغرف" },
  { key: "follow_more_rooms", label: "متابعة عدد أكبر من الغرف", icon: "albums", sortOrder: 12, description: "تابع عدداً أكبر من الغرف" },
  { key: "special_effects", label: "مؤثرات خاصة", icon: "flash", sortOrder: 13, description: "مؤثرات بصرية خاصة" },
  { key: "profile_visitors", label: "زوار الملف", icon: "people", sortOrder: 14, description: "قائمة كاملة بزوار ملفك" },
  { key: "favorite_priority", label: "أولوية المفضلة", icon: "star", sortOrder: 15, description: "أولوية في قوائم المفضلة" },
  { key: "do_not_disturb", label: "منع الإزعاج", icon: "notifications-off", sortOrder: 16, description: "وضع منع الإزعاج" },
];

const ALL_KEYS = FEATURES.map((f) => f.key);

// VIP16 matches SUGO reference exactly.
const POINTS = [
  0, 5_000, 20_000, 50_000, 120_000, 300_000, 700_000, 1_500_000, 3_000_000,
  6_000_000, 12_000_000, 30_000_000, 80_000_000, 200_000_000, 1_000_000_000,
  8_742_264_000,
];

const VIP_COLORS = [
  "#2E7D32", "#388E3C", "#00897B", "#0277BD", "#5E35B1", "#7B1FA2",
  "#C2185B", "#D32F2F", "#E64A19", "#F57C00", "#FBC02D", "#C9972B",
  "#B8860B", "#A0522D", "#8B0000", "#B71C1C",
];

const SVIP_COLORS = [
  "#4A148C", "#6A1B9A", "#4527A0", "#283593", "#1565C0", "#00695C",
  "#2E7D32", "#9E9D24", "#EF6C00", "#D84315", "#C62828", "#AD1457",
  "#6A1B9A", "#4A148C", "#311B92", "#1A237E",
];

function featuresForLevel(level: number): string[] {
  // VIP1 = 12/16, scaling up to 16/16 at VIP16
  const count = Math.min(16, 12 + Math.floor(((level - 1) * 4) / 15));
  return ALL_KEYS.slice(0, count);
}

function buildTiers(): InsertVipTier[] {
  const tiers: InsertVipTier[] = [];
  for (let level = 1; level <= 16; level++) {
    tiers.push({
      level,
      type: "vip",
      pointsRequired: POINTS[level - 1],
      color: VIP_COLORS[level - 1],
      features: featuresForLevel(level),
      active: true,
    });
    tiers.push({
      level,
      type: "svip",
      pointsRequired: POINTS[level - 1] * 3,
      color: SVIP_COLORS[level - 1],
      features: featuresForLevel(Math.min(16, level + 2)),
      active: true,
    });
  }
  return tiers;
}

function buildStoreItems(): InsertStoreItem[] {
  const frames = [
    { name: "حلقة النار", color: "#FF5722", icon: "flame", price: 4500, vip: 5 },
    { name: "تنين الجليد", color: "#29B6F6", icon: "snow", price: 4500, vip: 7 },
    { name: "نظارة المستقبل", color: "#FFA726", icon: "glasses", price: 1800, vip: 5 },
    { name: "إكليل الزهور", color: "#EC407A", icon: "flower", price: 4500, vip: 5 },
    { name: "هالة ذهبية", color: "#FFD700", icon: "sunny", price: 6000, vip: 8 },
    { name: "تاج ملكي", color: "#AB47BC", icon: "diamond", price: 9000, vip: 10 },
  ];
  const entrances = [
    { name: "دخولية الفهد", color: "#FF7043", icon: "rocket", price: 3200, vip: 4 },
    { name: "دخولية النجوم", color: "#7E57C2", icon: "star", price: 5000, vip: 6 },
    { name: "دخولية الطائرة", color: "#42A5F5", icon: "airplane", price: 7500, vip: 9 },
    { name: "دخولية القلوب", color: "#EC407A", icon: "heart", price: 2800, vip: 3 },
  ];
  const backgrounds = [
    { name: "خلفية المجرة", color: "#5C6BC0", icon: "planet", price: 4000, vip: 5 },
    { name: "خلفية الشاطئ", color: "#26A69A", icon: "water", price: 3500, vip: 4 },
    { name: "خلفية الليل", color: "#3949AB", icon: "moon", price: 4200, vip: 6 },
  ];
  const symbols = [
    { name: "رمز التاج", color: "#FFCA28", icon: "ribbon", price: 1200, vip: 2 },
    { name: "رمز الورد", color: "#EF5350", icon: "rose", price: 900, vip: 1 },
    { name: "رمز الماس", color: "#26C6DA", icon: "diamond", price: 1500, vip: 3 },
  ];
  const recovery = [
    { name: "بطاقة استرجاع 7 أيام", color: "#66BB6A", icon: "refresh", price: 2000, vip: 0 },
    { name: "بطاقة استرجاع 30 يوم", color: "#43A047", icon: "refresh-circle", price: 6000, vip: 0 },
  ];

  const items: InsertStoreItem[] = [];
  let order = 0;
  const push = (
    arr: { name: string; color: string; icon: string; price: number; vip: number }[],
    category: string,
    durationDays: number,
  ) => {
    for (const it of arr) {
      items.push({
        name: it.name,
        category,
        section: it.vip >= 8 ? "svip" : "vip",
        imageUrl: "",
        color: it.color,
        icon: it.icon,
        price: it.price,
        currency: "V",
        vipRequired: it.vip,
        durationDays,
        active: true,
        sortOrder: order++,
      });
    }
  };

  push(frames, "إطارات", 3);
  push(entrances, "الدخوليات", 3);
  push(backgrounds, "الخلفيات", 7);
  push(symbols, "رمز", 7);
  push(recovery, "بطاقة الإسترجاع", 7);
  return items;
}

export async function seedIfEmpty(): Promise<void> {
  try {
    const [{ count: featureCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vipFeaturesTable);

    if (featureCount === 0) {
      await db.insert(vipFeaturesTable).values(FEATURES);
      logger.info({ n: FEATURES.length }, "Seeded VIP features");
    }

    const [{ count: tierCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vipTiersTable);

    if (tierCount === 0) {
      const tiers = buildTiers();
      await db.insert(vipTiersTable).values(tiers);
      logger.info({ n: tiers.length }, "Seeded VIP tiers");
    }

    const [{ count: itemCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(storeItemsTable);

    if (itemCount === 0) {
      const items = buildStoreItems();
      await db.insert(storeItemsTable).values(items);
      logger.info({ n: items.length }, "Seeded store items");
    }
  } catch (err) {
    logger.error({ err }, "Seeding failed");
  }
}
