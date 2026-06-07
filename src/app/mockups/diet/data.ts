/**
 * Daily Diet — meal slots and food catalog.
 * V1 seed list per docs/diet-feature-design-2026-05-09.md.
 * Coach can prune/extend; admin-screen editing is V1.1.
 */

export type MealSlot = {
  id: string;
  name: string;
  window: string;
  emoji: string;
  startMin: number; // 0-1439
  endMin: number;   // 0-1439, can wrap past midnight (>= 1440)
};

export type FoodItem = {
  id: string;
  name: string;
  emoji: string;
  unit: string;          // shown on the catalog button, e.g. "1 slice"
  unitDetail?: string;   // sub-label for unit, e.g. "200 ml"
};

export type FoodSection = {
  label: string;
  items: FoodItem[];
};

export type LoggedItem = {
  id: string;            // unique per logged entry
  itemId: string;        // matches FoodItem.id, or "custom" for free-form
  // For custom entries:
  customName?: string;
  customUnit?: string;
  customNotes?: string;
  count: number;
};

export type MealLog = {
  skipped: boolean;
  items: LoggedItem[];
};

export type DayLog = {
  date: string; // YYYY-MM-DD
  meals: Record<string, MealLog>;
};

export const MEAL_SLOTS: MealSlot[] = [
  { id: "midnight",     name: "Midnight Snack",        window: "10 pm – 2 am",  emoji: "🌙", startMin: 22 * 60, endMin: 26 * 60 },
  { id: "breakfast",    name: "Breakfast",             window: "6 am – 9 am",   emoji: "🌅", startMin:  6 * 60, endMin:  9 * 60 },
  { id: "mid-morning",  name: "Mid-Morning Snack",     window: "9 am – 12 pm",  emoji: "☕", startMin:  9 * 60, endMin: 12 * 60 },
  { id: "lunch",        name: "Lunch",                 window: "12 pm – 2 pm",  emoji: "🍱", startMin: 12 * 60, endMin: 14 * 60 },
  { id: "midday",       name: "Midday Snack",          window: "2 pm – 4 pm",   emoji: "🍪", startMin: 14 * 60, endMin: 16 * 60 },
  { id: "evening-tea",  name: "Evening Tea & Snacks",  window: "4 pm – 6 pm",   emoji: "🍵", startMin: 16 * 60, endMin: 18 * 60 },
  { id: "supper",       name: "Supper",                window: "6 pm – 8 pm",   emoji: "🍽️", startMin: 18 * 60, endMin: 20 * 60 },
  { id: "post-supper",  name: "Post-Supper Snack",     window: "8 pm – 10 pm",  emoji: "🌃", startMin: 20 * 60, endMin: 22 * 60 },
];

export const FOOD_CATALOG: FoodSection[] = [
  {
    label: "Grains & Bread",
    items: [
      { id: "white-bread",  name: "White bread",     emoji: "🍞", unit: "1 slice" },
      { id: "brown-bread",  name: "Brown bread",     emoji: "🍞", unit: "1 slice" },
      { id: "roti",         name: "Roti / phulka",   emoji: "🫓", unit: "1 piece" },
      { id: "paratha",      name: "Paratha",         emoji: "🫓", unit: "1 piece" },
      { id: "naan",         name: "Naan",            emoji: "🫓", unit: "1 piece" },
      { id: "bhakri",       name: "Bhakri",          emoji: "🫓", unit: "1 piece" },
    ],
  },
  {
    label: "Dals & Sabzi",
    items: [
      { id: "dal",          name: "Dal / varan",     emoji: "🥣", unit: "1 waati", unitDetail: "150 g" },
      { id: "bhendi",       name: "Bhendi bhaji",    emoji: "🥬", unit: "1 waati" },
      { id: "mixed-sabzi",  name: "Mixed sabzi",     emoji: "🥗", unit: "1 waati" },
      { id: "aloo-bhaji",   name: "Aloo bhaji",      emoji: "🥔", unit: "1 waati" },
      { id: "paneer-sabzi", name: "Paneer sabzi",    emoji: "🧀", unit: "1 waati" },
      { id: "chana",        name: "Chana / chole",   emoji: "🫘", unit: "1 waati" },
    ],
  },
  {
    label: "Rice",
    items: [
      { id: "plain-rice",   name: "Plain rice",      emoji: "🍚", unit: "1 waati" },
      { id: "khichadi",     name: "Khichadi",        emoji: "🍚", unit: "1 waati" },
      { id: "pulao",        name: "Pulao / biryani", emoji: "🍛", unit: "1 plate" },
      { id: "curd-rice",    name: "Curd rice",       emoji: "🍚", unit: "1 waati" },
    ],
  },
  {
    label: "Dairy",
    items: [
      { id: "milk",         name: "Milk",                  emoji: "🥛", unit: "1 glass", unitDetail: "200 ml" },
      { id: "taak",         name: "Buttermilk / taak",    emoji: "🥛", unit: "1 glass", unitDetail: "200 ml" },
      { id: "curd",         name: "Curd / dahi",          emoji: "🍶", unit: "1 waati" },
      { id: "cheese-slice", name: "Cheese slice",         emoji: "🧀", unit: "1 piece" },
    ],
  },
  {
    label: "Fruits",
    items: [
      { id: "banana",       name: "Banana",          emoji: "🍌", unit: "1 piece" },
      { id: "apple",        name: "Apple",           emoji: "🍎", unit: "1 piece" },
      { id: "mango",        name: "Mango",           emoji: "🥭", unit: "1 piece" },
      { id: "papaya",       name: "Papaya",          emoji: "🍈", unit: "1 waati" },
      { id: "watermelon",   name: "Watermelon",      emoji: "🍉", unit: "1 waati" },
      { id: "mixed-fruit",  name: "Mixed fruit",     emoji: "🍇", unit: "1 waati" },
    ],
  },
  {
    label: "Non-Veg",
    items: [
      { id: "egg-boiled",   name: "Egg, boiled",          emoji: "🥚", unit: "1 piece" },
      { id: "egg-omelette", name: "Egg, omelette",        emoji: "🍳", unit: "1 piece" },
      { id: "egg-scrambled", name: "Egg, scrambled",      emoji: "🍳", unit: "1 waati" },
      { id: "chicken-curry", name: "Chicken curry",       emoji: "🍗", unit: "1 waati" },
      { id: "chicken-grilled", name: "Chicken grilled",   emoji: "🍗", unit: "1 piece", unitDetail: "~100 g" },
      { id: "mutton-curry", name: "Mutton curry",         emoji: "🥩", unit: "1 waati" },
      { id: "fish-curry",   name: "Fish curry",           emoji: "🐟", unit: "1 waati" },
      { id: "fish-fried",   name: "Fish grilled / fried", emoji: "🐟", unit: "1 piece" },
      { id: "prawns",       name: "Prawns",               emoji: "🦐", unit: "1 waati" },
      { id: "tandoori",     name: "Tandoori chicken",     emoji: "🍗", unit: "1 piece" },
    ],
  },
  {
    label: "Beverages",
    items: [
      { id: "water",        name: "Water",                emoji: "💧", unit: "1 glass", unitDetail: "200 ml" },
      { id: "tea",          name: "Tea / chai",           emoji: "🍵", unit: "1 cup" },
      { id: "coffee",       name: "Coffee",               emoji: "☕", unit: "1 cup" },
      { id: "juice",        name: "Juice",                emoji: "🧃", unit: "1 glass" },
      { id: "coconut-water", name: "Coconut water",       emoji: "🥥", unit: "1 glass" },
      { id: "lassi",        name: "Lassi",                emoji: "🥛", unit: "1 glass" },
      { id: "soft-drink",   name: "Soft drink / cola",    emoji: "🥤", unit: "1 glass" },
      { id: "sports-drink", name: "Sports drink",         emoji: "🍶", unit: "1 bottle", unitDetail: "1 L" },
    ],
  },
  {
    label: "Snacks",
    items: [
      { id: "poha",         name: "Poha",            emoji: "🍚", unit: "1 waati" },
      { id: "upma",         name: "Upma",            emoji: "🥣", unit: "1 waati" },
      { id: "idli",         name: "Idli",            emoji: "🍙", unit: "1 piece" },
      { id: "dosa",         name: "Dosa",            emoji: "🥞", unit: "1 piece" },
      { id: "vada",         name: "Vada",            emoji: "🍩", unit: "1 piece" },
      { id: "samosa",       name: "Samosa",          emoji: "🥟", unit: "1 piece" },
      { id: "sandwich",     name: "Sandwich",        emoji: "🥪", unit: "1 piece" },
      { id: "biscuits",     name: "Biscuits",        emoji: "🍪", unit: "1 piece" },
      { id: "maggi",        name: "Maggi / noodles", emoji: "🍜", unit: "1 waati" },
      { id: "chivda",       name: "Chivda / namkeen", emoji: "🥜", unit: "1 waati" },
    ],
  },
  {
    label: "Sweets",
    items: [
      { id: "modak",        name: "Modak",           emoji: "🍡", unit: "1 piece" },
      { id: "laddu",        name: "Laddu",           emoji: "🍡", unit: "1 piece" },
      { id: "barfi",        name: "Barfi",           emoji: "🍬", unit: "1 piece" },
      { id: "jalebi",       name: "Jalebi",          emoji: "🥨", unit: "1 piece" },
      { id: "gulab-jamun",  name: "Gulab jamun",     emoji: "🍡", unit: "1 piece" },
      { id: "kheer",        name: "Kheer",           emoji: "🥣", unit: "1 waati" },
      { id: "shrikhand",    name: "Shrikhand",       emoji: "🍶", unit: "1 waati" },
      { id: "ice-cream",    name: "Ice cream",       emoji: "🍨", unit: "1 scoop" },
      { id: "chocolate",    name: "Chocolate",       emoji: "🍫", unit: "1 piece" },
    ],
  },
];

// Lookup helper for rendering logged items.
export const FOOD_BY_ID: Record<string, FoodItem> = Object.fromEntries(
  FOOD_CATALOG.flatMap((s) => s.items).map((i) => [i.id, i])
);

export const CUSTOM_UNIT_OPTIONS = [
  "piece",
  "waati",
  "glass",
  "bottle",
  "plate",
  "spoon",
  "other",
] as const;

// ─── Storage ───────────────────────────────────────────────────────

export const todayKey = () => new Date().toISOString().slice(0, 10);

export const dietStorageKey = (dateKey: string) =>
  `kfandra:mockup:diet-day-${dateKey}-v1`;

export function loadDay(dateKey: string): DayLog {
  if (typeof window === "undefined") return blankDay(dateKey);
  try {
    const raw = window.localStorage.getItem(dietStorageKey(dateKey));
    if (!raw) return blankDay(dateKey);
    return JSON.parse(raw) as DayLog;
  } catch {
    return blankDay(dateKey);
  }
}

export function saveDay(day: DayLog) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(dietStorageKey(day.date), JSON.stringify(day));
}

export function blankDay(dateKey: string): DayLog {
  const meals: Record<string, MealLog> = {};
  for (const slot of MEAL_SLOTS) {
    meals[slot.id] = { skipped: false, items: [] };
  }
  return { date: dateKey, meals };
}

// ─── Helpers ───────────────────────────────────────────────────────

export function describeLogged(item: LoggedItem): { name: string; unit: string } {
  if (item.itemId === "custom") {
    return {
      name: item.customName ?? "Custom item",
      unit: item.customUnit ? `1 ${item.customUnit}` : "1 unit",
    };
  }
  const food = FOOD_BY_ID[item.itemId];
  return {
    name: food?.name ?? item.itemId,
    unit: food?.unit ?? "1 unit",
  };
}

export function compactSummary(meal: MealLog | undefined, max = 3): string {
  if (!meal) return "";
  if (meal.skipped) return "Skipped";
  if (meal.items.length === 0) return "";
  const parts = meal.items.slice(0, max).map((it) => {
    const { name } = describeLogged(it);
    return `${name} × ${it.count}`;
  });
  if (meal.items.length > max) parts.push(`+${meal.items.length - max} more`);
  return parts.join(", ");
}

export function totalUnits(meal: MealLog | undefined): number {
  if (!meal || meal.skipped) return 0;
  return meal.items.reduce((sum, it) => sum + it.count, 0);
}

export function currentMealId(now: Date = new Date()): string | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const slot of MEAL_SLOTS) {
    // Handle wrap (midnight slot 22:00–02:00 next day).
    if (slot.endMin > 24 * 60) {
      if (minutes >= slot.startMin || minutes < slot.endMin - 24 * 60) {
        return slot.id;
      }
    } else if (minutes >= slot.startMin && minutes < slot.endMin) {
      return slot.id;
    }
  }
  return null;
}

export function getMeal(day: DayLog, mealId: string): MealLog {
  return day.meals[mealId] ?? { skipped: false, items: [] };
}

export function setMeal(day: DayLog, mealId: string, meal: MealLog): DayLog {
  return { ...day, meals: { ...day.meals, [mealId]: meal } };
}

export function addCatalogTap(day: DayLog, mealId: string, foodId: string): DayLog {
  const meal = getMeal(day, mealId);
  const existing = meal.items.find((it) => it.itemId === foodId);
  let items: LoggedItem[];
  if (existing) {
    items = meal.items.map((it) =>
      it.itemId === foodId ? { ...it, count: it.count + 1 } : it
    );
  } else {
    items = [
      ...meal.items,
      {
        id: `${foodId}-${Date.now()}`,
        itemId: foodId,
        count: 1,
      },
    ];
  }
  return setMeal(day, mealId, { skipped: false, items });
}

export function adjustLogged(
  day: DayLog,
  mealId: string,
  loggedId: string,
  delta: number
): DayLog {
  const meal = getMeal(day, mealId);
  const items = meal.items
    .map((it) => (it.id === loggedId ? { ...it, count: it.count + delta } : it))
    .filter((it) => it.count > 0);
  return setMeal(day, mealId, { ...meal, items });
}

export function removeLogged(day: DayLog, mealId: string, loggedId: string): DayLog {
  const meal = getMeal(day, mealId);
  return setMeal(day, mealId, {
    ...meal,
    items: meal.items.filter((it) => it.id !== loggedId),
  });
}

export function addCustom(
  day: DayLog,
  mealId: string,
  custom: { name: string; quantity: number; unit: string; notes?: string }
): DayLog {
  const meal = getMeal(day, mealId);
  const items: LoggedItem[] = [
    ...meal.items,
    {
      id: `custom-${Date.now()}`,
      itemId: "custom",
      customName: custom.name,
      customUnit: custom.unit,
      customNotes: custom.notes,
      count: custom.quantity,
    },
  ];
  return setMeal(day, mealId, { skipped: false, items });
}

export function setSkipped(day: DayLog, mealId: string, skipped: boolean): DayLog {
  const meal = getMeal(day, mealId);
  return setMeal(day, mealId, { ...meal, skipped, items: skipped ? [] : meal.items });
}

export function getMealSlot(mealId: string): MealSlot | undefined {
  return MEAL_SLOTS.find((s) => s.id === mealId);
}
