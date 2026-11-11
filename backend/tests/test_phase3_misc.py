import httpx
from sqlalchemy import create_engine, text

from app.core.config import get_settings
from app.db.upgrade import ensure_item_columns
from app.services import bot, spoonacular


def test_items_patch_owner_only(client, owner_headers):
    it = client.get("/api/items", params={"search": "Tomato"}).json()[0]
    assert client.patch(f"/api/items/{it['id']}", json={"staple": True}).status_code == 401
    res = client.patch(f"/api/items/{it['id']}", json={"staple": True, "aliases": ["tamatar"]}, headers=owner_headers)
    assert res.status_code == 200 and res.json()["staple"] is True


def test_new_item_gets_guessed_diet(client, owner_headers):
    res = client.post("/api/items", json={"name": "Mutton keema"}, headers=owner_headers)
    assert res.json()["diet"] == "nonveg"


def test_alias_search_matches_scallion(client):
    names = [i["name"].lower() for i in client.get("/api/items", params={"search": "scallion"}).json()]
    assert any("spring onion" in n for n in names)


def test_stats_and_shopping_stock(client, owner_headers):
    it = client.get("/api/items", params={"search": "Tomato"}).json()[0]
    client.post("/api/shopping-list", json={"item_id": it["id"], "quantity": 1}, headers=owner_headers)
    entry = client.get("/api/shopping-list").json()[0]
    client.patch(f"/api/shopping-list/{entry['id']}", json={"bought": True}, headers=owner_headers)
    res = client.post("/api/shopping-list/stock-bought", json={"location": "fridge"}, headers=owner_headers)
    assert res.status_code == 200 and len(res.json()["moved"]) == 1
    stats = client.get("/api/stats").json()
    assert stats["inventory"]["total"] == 1


def test_ensure_item_columns_on_old_table(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path}/old.db")
    with eng.begin() as c:
        c.execute(text("CREATE TABLE items (id INTEGER PRIMARY KEY, name VARCHAR(100))"))
        c.execute(text("INSERT INTO items (name) VALUES ('Tomato')"))
    ensure_item_columns(eng)
    ensure_item_columns(eng)  # idempotent
    with eng.begin() as c:
        row = c.execute(text("SELECT diet, jain_ok, staple FROM items")).one()
    assert row[0] == "veg" and row[1] in (1, True) and row[2] in (0, False)


def test_spoonacular_needs_key_and_owner(client, owner_headers, monkeypatch):
    assert client.get("/api/spoonacular/search", params={"query": "dal"}).status_code == 401
    monkeypatch.setattr(get_settings(), "spoonacular_api_key", None)
    assert client.get("/api/spoonacular/search", params={"query": "dal"}, headers=owner_headers).status_code == 503


def test_spoonacular_search_and_import(client, owner_headers, monkeypatch):
    def fake_get(path, params):
        if path.endswith("complexSearch"):
            return {"results": [{"id": 7, "title": "Dal tadka", "readyInMinutes": 25, "servings": 4}]}
        return {
            "id": 7, "title": "Dal tadka", "readyInMinutes": 25, "servings": 4,
            "summary": "<b>Tasty</b> dal", "sourceUrl": "http://x",
            "analyzedInstructions": [{"steps": [{"step": "Boil dal."}, {"step": "Temper."}]}],
            "extendedIngredients": [
                {"nameClean": "scallions", "amount": 2, "unit": "", "original": "2 scallions"},
                {"name": "toor dal", "amount": 1, "unit": "cup", "original": "1 cup toor dal"},
            ],
        }

    monkeypatch.setattr(spoonacular, "_get", fake_get)
    res = client.get("/api/spoonacular/search", params={"query": "dal"}, headers=owner_headers).json()
    assert res[0]["already_imported"] is False
    r = client.post("/api/spoonacular/import/7", headers=owner_headers)
    assert r.status_code == 200 and r.json()["steps"] == ["Boil dal.", "Temper."]
    assert r.json()["description"] == "Tasty dal"
    again = client.post("/api/spoonacular/import/7", headers=owner_headers).json()
    assert again["id"] == r.json()["id"]
    assert len(client.get("/api/recipes").json()) == 1


def test_chat_access_and_503(client, owner_headers, monkeypatch):
    body = {"messages": [{"role": "user", "content": "what can I cook?"}]}
    assert client.post("/api/chat", json=body).status_code == 401
    monkeypatch.setattr(get_settings(), "gemini_api_key", None)
    assert client.post("/api/chat", json=body, headers=owner_headers).status_code == 503


def test_chat_reply_and_public_mode(client, owner_headers, monkeypatch):
    seen = {}

    def fake(system, messages):
        seen["system"] = system
        return "Make tomato rice."

    monkeypatch.setattr("app.api.chat.call_gemini", fake)
    it = client.get("/api/items", params={"search": "Tomato"}).json()[0]
    client.post("/api/inventory", json={"item_id": it["id"], "location": "fridge", "quantity": 3}, headers=owner_headers)
    body = {"messages": [{"role": "user", "content": "hi"}]}
    res = client.post("/api/chat", json=body, headers=owner_headers)
    assert res.json() == {"reply": "Make tomato rice."} and "omato" in seen["system"]
    bad = {"messages": [{"role": "assistant", "content": "hi"}]}
    assert client.post("/api/chat", json=bad, headers=owner_headers).status_code == 422
    monkeypatch.setattr(get_settings(), "chat_public", True)
    assert client.post("/api/chat", json=body).status_code == 200


def test_gemini_model_fallback(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "k")
    calls = []

    def fake_post(url, **kw):
        calls.append(url)
        if len(calls) == 1:
            return httpx.Response(404, request=httpx.Request("POST", url))
        return httpx.Response(
            200, json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}, request=httpx.Request("POST", url)
        )

    monkeypatch.setattr(httpx, "post", fake_post)
    assert bot.call_gemini("s", [{"role": "user", "content": "hi"}]) == "ok"
    assert len(calls) == 2
