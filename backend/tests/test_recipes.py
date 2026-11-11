from datetime import date, timedelta


def item_id(client, name):
    found = client.get("/api/items", params={"search": name}).json()
    exact = [i for i in found if i["name"].lower() == name.lower()]
    return (exact or found)[0]["id"]


def make_recipe(client, headers, title="Tomato rice", names=("Tomato", "Rice"), **extra):
    body = {
        "title": title,
        "steps": ["Cook it."],
        "ingredients": [{"item_id": item_id(client, n), "quantity": 1, "unit": "kg"} for n in names],
        **extra,
    }
    res = client.post("/api/recipes", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def stock(client, headers, name, **extra):
    body = {"item_id": item_id(client, name), "location": "shelf", "quantity": 2, "unit": "kg", **extra}
    res = client.post("/api/inventory", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_owner_only_writes(client, owner_headers):
    body = {"title": "x", "ingredients": []}
    assert client.post("/api/recipes", json=body).status_code == 401
    r = make_recipe(client, owner_headers)
    assert client.put(f"/api/recipes/{r['id']}", json=body).status_code == 401
    assert client.delete(f"/api/recipes/{r['id']}").status_code == 401
    assert client.get("/api/recipes").status_code == 200  # public read


def test_create_get_update_delete(client, owner_headers):
    r = make_recipe(client, owner_headers, total_minutes=None, prep_minutes=5, cook_minutes=10)
    assert r["total_minutes"] == 15 and "vegetarian" in r["diets"]
    got = client.get(f"/api/recipes/{r['id']}").json()
    assert len(got["ingredients"]) == 2
    upd = client.put(
        f"/api/recipes/{r['id']}",
        json={"title": "Renamed", "ingredients": [{"new_item_name": "Dragon fruit"}]},
        headers=owner_headers,
    )
    assert upd.json()["title"] == "Renamed" and len(upd.json()["ingredients"]) == 1
    assert client.delete(f"/api/recipes/{r['id']}", headers=owner_headers).status_code == 204
    assert client.get(f"/api/recipes/{r['id']}").status_code == 404


def test_nonveg_recipe_has_no_diet_tags(client, owner_headers):
    r = client.post(
        "/api/recipes",
        json={"title": "Chicken curry", "ingredients": [{"new_item_name": "Chicken breast"}]},
        headers=owner_headers,
    ).json()
    assert r["diets"] == []
    assert client.get("/api/recipes", params={"diet": "vegetarian"}).json() == []


def test_bad_filters(client):
    assert client.get("/api/recipes/suggest", params={"diet": "keto"}).status_code == 422
    assert client.get("/api/recipes/suggest", params={"time": "forever"}).status_code == 422


def test_suggest_missing_counts_and_staples(client, owner_headers):
    make_recipe(client, owner_headers, "Tomato rice", ("Tomato", "Rice", "Salt"))
    out = client.get("/api/recipes/suggest").json()
    assert out[0]["missing_count"] == 2  # salt is a staple and assumed
    stock(client, owner_headers, "Tomato")
    stock(client, owner_headers, "Rice")
    out = client.get("/api/recipes/suggest", params={"max_missing": 0}).json()
    assert len(out) == 1 and out[0]["missing"] == []


def test_expired_stock_does_not_count(client, owner_headers):
    make_recipe(client, owner_headers, "Tomato soup", ("Tomato",))
    stock(client, owner_headers, "Tomato", expiry_date=str(date.today() - timedelta(days=1)))
    out = client.get("/api/recipes/suggest", params={"max_missing": 0}).json()
    assert out == []


def test_use_up_filter(client, owner_headers):
    make_recipe(client, owner_headers, "Tomato soup", ("Tomato",))
    make_recipe(client, owner_headers, "Plain rice", ("Rice",))
    e = stock(client, owner_headers, "Tomato")
    client.patch(f"/api/inventory/{e['id']}", json={"use_up": True}, headers=owner_headers)
    out = client.get("/api/recipes/suggest", params={"use_up": True}).json()
    assert [s["recipe"]["title"] for s in out] == ["Tomato soup"]


def test_time_filter(client, owner_headers):
    make_recipe(client, owner_headers, "Quick", ("Tomato",), prep_minutes=3, cook_minutes=5)
    make_recipe(client, owner_headers, "Long", ("Rice",), prep_minutes=30, cook_minutes=60)
    quick = client.get("/api/recipes", params={"time": "10min"}).json()
    assert [r["title"] for r in quick] == ["Quick"]


def test_cooked_logs_and_deducts(client, owner_headers):
    r = make_recipe(client, owner_headers, "Tomato soup", ("Tomato",))
    e = stock(client, owner_headers, "Tomato")
    res = client.post(f"/api/recipes/{r['id']}/cooked", json={"rating": 5, "deduct": True}, headers=owner_headers)
    assert res.status_code == 201
    assert client.post(f"/api/recipes/{r['id']}/cooked", json={}).status_code == 401
    assert client.get(f"/api/recipes/{r['id']}").json()["times_cooked"] == 1
    hist = client.get("/api/history").json()
    assert hist[0]["recipe_title"] == "Tomato soup"
    inv = client.get("/api/inventory").json()
    left = [x for x in inv if x["id"] == e["id"]]
    assert not left or left[0]["quantity"] < 2
    # deleting the recipe keeps the history row
    client.delete(f"/api/recipes/{r['id']}", headers=owner_headers)
    assert client.get("/api/history").json()[0]["recipe_title"] == "Tomato soup"
    assert client.delete(f"/api/history/{hist[0]['id']}", headers=owner_headers).status_code == 204


def test_add_missing_to_shopping(client, owner_headers):
    r = make_recipe(client, owner_headers, "Tomato rice", ("Tomato", "Rice"))
    stock(client, owner_headers, "Tomato")
    res = client.post(f"/api/recipes/{r['id']}/shopping", headers=owner_headers).json()
    assert len(res["added"]) == 1
    again = client.post(f"/api/recipes/{r['id']}/shopping", headers=owner_headers).json()
    assert again["added"] == [] and len(again["already_listed"]) == 1
