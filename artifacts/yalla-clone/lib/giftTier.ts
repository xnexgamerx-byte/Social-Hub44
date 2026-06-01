export interface GiftTier {
  name: "normal" | "rare" | "epic" | "legendary";
  label: string;
  size: number;
  hold: number;
  particles: number;
  colors: string[];
  rings: boolean;
  spin: boolean;
  scrim: number;
  scrimColor: string;
}

/**
 * Derives the richness of a gift's full-screen effect from its coin price, so
 * pricier gifts feel like a bigger moment (more particles, glow rings, a dark
 * scrim, longer hold). Tuned for the SUGO/Yalla "gift peak" feel.
 */
export function giftTier(price: number): GiftTier {
  if (price >= 5000) {
    return {
      name: "legendary",
      label: "أسطوري",
      size: 200,
      hold: 2200,
      particles: 30,
      colors: ["#FFD54A", "#FF6B9D", "#7C5CFC", "#4FC3F7"],
      rings: true,
      spin: true,
      scrim: 0.78,
      scrimColor: "rgba(10,4,30,1)",
    };
  }
  if (price >= 1000) {
    return {
      name: "epic",
      label: "ملحمي",
      size: 168,
      hold: 1900,
      particles: 22,
      colors: ["#C77DFF", "#FF8FB1", "#9D7BFF"],
      rings: true,
      spin: false,
      scrim: 0.6,
      scrimColor: "rgba(20,8,40,1)",
    };
  }
  if (price >= 200) {
    return {
      name: "rare",
      label: "نادر",
      size: 148,
      hold: 1650,
      particles: 14,
      colors: ["#4FC3F7", "#7C5CFC"],
      rings: true,
      spin: false,
      scrim: 0.4,
      scrimColor: "rgba(12,10,30,1)",
    };
  }
  return {
    name: "normal",
    label: "",
    size: 132,
    hold: 1400,
    particles: 8,
    colors: ["#F5C242", "#FFE08A"],
    rings: false,
    spin: false,
    scrim: 0,
    scrimColor: "rgba(0,0,0,1)",
  };
}
