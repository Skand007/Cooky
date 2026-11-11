export interface Item {
  id: number;
  name: string;
  category: string | null;
  default_unit: string | null;
  aliases: string[];
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
