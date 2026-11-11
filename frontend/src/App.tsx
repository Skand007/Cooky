import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Inventory } from "@/pages/Inventory";
import { ShoppingList } from "@/pages/ShoppingList";
import { Placeholder } from "@/pages/Placeholder";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/recipes" element={<Placeholder title="Recipes" />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="/stats" element={<Placeholder title="Stats" />} />
      </Route>
    </Routes>
  );
}
