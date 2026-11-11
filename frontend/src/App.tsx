import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Inventory } from "@/pages/Inventory";
import { ShoppingList } from "@/pages/ShoppingList";
import { Recipes } from "@/pages/Recipes";
import { RecipeDetail } from "@/pages/RecipeDetail";
import { RecipeForm } from "@/pages/RecipeForm";
import { Bot } from "@/pages/Bot";
import { Stats } from "@/pages/Stats";
import { Catalogue } from "@/pages/Catalogue";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/new" element={<RecipeForm />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/recipes/:id/edit" element={<RecipeForm />} />
        <Route path="/bot" element={<Bot />} />
        <Route path="/catalogue" element={<Catalogue />} />
        <Route path="/shopping-list" element={<ShoppingList />} />
        <Route path="/stats" element={<Stats />} />
      </Route>
    </Routes>
  );
}
