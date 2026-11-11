export interface Item {
  id: number;
  name: string;
  category: string | null;
  default_unit: string | null;
  aliases: string[];
  diet: "veg" | "egg" | "nonveg";
  jain_ok: boolean;
  staple: boolean;
}

export type Location = "fridge" | "freezer" | "shelf" | "room";

export const LOCATIONS: { id: Location; label: string }[] = [
  { id: "fridge", label: "Fridge" },
  { id: "freezer", label: "Freezer" },
  { id: "shelf", label: "Shelf" },
  { id: "room", label: "Room" },
];

export interface InventoryEntry {
  id: number;
  item: Item;
  location: Location;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  use_up: boolean;
  added_at: string;
}

export interface ShoppingEntry {
  id: number;
  item: Item;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  bought: boolean;
  added_at: string;
}

export type DietTag = "vegetarian" | "eggetarian" | "jain";

export const DIET_OPTIONS: { id: DietTag; label: string }[] = [
  { id: "vegetarian", label: "Vegetarian" },
  { id: "eggetarian", label: "Eggetarian" },
  { id: "jain", label: "Jain" },
];

export const TIME_OPTIONS: { id: string; label: string }[] = [
  { id: "10min", label: "10 min" },
  { id: "30min", label: "30 min" },
  { id: "1hour", label: "1 hour" },
  { id: "meal_prep", label: "Meal prep" },
  { id: "slow", label: "Slow / overnight" },
];

export interface RecipeIngredient {
  id: number;
  item: Item;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  is_main: boolean;
  available: boolean | null;
}

export interface Recipe {
  id: number;
  title: string;
  description: string | null;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  style: string;
  time_category: string;
  diets: string[];
  source: string;
  source_url: string | null;
  steps: string[];
  created_at: string;
  times_cooked: number;
  last_cooked: string | null;
  ingredients: RecipeIngredient[];
}

export interface Suggestion {
  recipe: Recipe;
  have: string[];
  missing: string[];
  missing_count: number;
  use_up_hits: string[];
  expiring_hits: string[];
  score: number;
}

export interface CookLog {
  id: number;
  recipe_id: number | null;
  recipe_title: string;
  cooked_at: string;
  note: string | null;
  rating: number | null;
}

export interface SpoonacularHit {
  id: number;
  title: string;
  ready_in_minutes: number | null;
  servings: number | null;
  already_imported: boolean;
}

export interface StockLine {
  id: number;
  name: string;
  location: string;
  expiry_date: string | null;
  days_left: number | null;
}

export interface Stats {
  inventory: {
    total: number;
    by_location: Record<string, number>;
    expiring_soon: StockLine[];
    expired: StockLine[];
    use_up: StockLine[];
  };
  shopping: { open: number; bought: number };
  recipes: { total: number; by_source: Record<string, number>; by_time: Record<string, number> };
  cooking: {
    total: number;
    last_30_days: number;
    average_rating: number | null;
    by_week: { week_start: string; count: number }[];
    top_recipes: { name: string; count: number }[];
    top_ingredients: { name: string; count: number }[];
  };
}
