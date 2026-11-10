import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Login } from "@/pages/Login";
import { Placeholder } from "@/pages/Placeholder";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/inventory" element={<Placeholder title="Inventory" />} />
        <Route path="/recipes" element={<Placeholder title="Recipes" />} />
        <Route path="/shopping-list" element={<Placeholder title="Shopping list" />} />
        <Route path="/stats" element={<Placeholder title="Stats" />} />
      </Route>
    </Routes>
  );
}
