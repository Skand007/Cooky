def milk_id(client):
    res = client.get("/api/items", params={"search": "Milk"})
    return next(item["id"] for item in res.json() if item["name"] == "Milk")


def test_anyone_can_view_the_shopping_list(client):
    res = client.get("/api/shopping-list")
    assert res.status_code == 200
    assert res.json() == []


def test_only_owner_can_add_to_shopping_list(client):
    res = client.post("/api/shopping-list", json={"item_id": milk_id(client), "quantity": 2})
    assert res.status_code == 401


def test_owner_can_add_and_mark_bought(client, owner_headers):
    created = client.post(
        "/api/shopping-list",
        json={"item_id": milk_id(client), "quantity": 2, "unit": "l"},
        headers=owner_headers,
    ).json()
    assert created["bought"] is False

    res = client.patch(
        f"/api/shopping-list/{created['id']}", json={"bought": True}, headers=owner_headers
    )
    assert res.status_code == 200
    assert res.json()["bought"] is True


def test_owner_can_add_a_shopping_item_not_in_the_catalogue(client, owner_headers):
    res = client.post(
        "/api/shopping-list",
        json={"new_item_name": "Dragonfruit", "note": "for the smoothie"},
        headers=owner_headers,
    )
    assert res.status_code == 201
    assert res.json()["item"]["name"] == "Dragonfruit"
    assert res.json()["note"] == "for the smoothie"


def test_owner_can_delete_a_shopping_entry(client, owner_headers):
    created = client.post(
        "/api/shopping-list", json={"item_id": milk_id(client)}, headers=owner_headers
    ).json()

    res = client.delete(f"/api/shopping-list/{created['id']}", headers=owner_headers)
    assert res.status_code == 204
    assert client.get("/api/shopping-list").json() == []


def test_only_owner_can_edit_or_delete_a_shopping_entry(client, owner_headers):
    created = client.post(
        "/api/shopping-list", json={"item_id": milk_id(client)}, headers=owner_headers
    ).json()

    assert client.patch(f"/api/shopping-list/{created['id']}", json={"bought": True}).status_code == 401
    assert client.delete(f"/api/shopping-list/{created['id']}").status_code == 401


def _tomato(client):
    return client.get("/api/items", params={"search": "Tomato"}).json()[0]["id"]


def test_use_up_flag_adds_to_shopping_list_once(client, owner_headers):
    entry = client.post(
        "/api/inventory", json={"item_id": _tomato(client), "location": "fridge", "quantity": 1}, headers=owner_headers
    ).json()
    client.patch(f"/api/inventory/{entry['id']}", json={"use_up": True}, headers=owner_headers)
    lines = client.get("/api/shopping-list").json()
    assert len(lines) == 1 and lines[0]["note"] == "use up"
    assert lines[0]["in_stock"] is False  # flagged use-up: still needs buying
    # un-flag and re-flag: no duplicate while the first is unbought
    client.patch(f"/api/inventory/{entry['id']}", json={"use_up": False}, headers=owner_headers)
    assert client.get("/api/shopping-list").json()[0]["in_stock"] is True
    client.patch(f"/api/inventory/{entry['id']}", json={"use_up": True}, headers=owner_headers)
    assert len(client.get("/api/shopping-list").json()) == 1


def test_shopping_list_alphabetical_and_in_stock(client, owner_headers):
    ids = {}
    for name in ("Rice", "Apple", "Tomato"):
        found = client.get("/api/items", params={"search": name}).json()
        ids[name] = next(i["id"] for i in found if i["name"] == name)
        client.post("/api/shopping-list", json={"item_id": ids[name]}, headers=owner_headers)
    client.post(
        "/api/inventory", json={"item_id": ids["Rice"], "location": "shelf", "quantity": 2}, headers=owner_headers
    )
    lines = client.get("/api/shopping-list").json()
    assert [ln["item"]["name"] for ln in lines] == ["Apple", "Rice", "Tomato"]
    assert {ln["item"]["name"]: ln["in_stock"] for ln in lines} == {"Apple": False, "Rice": True, "Tomato": False}
    assert client.get("/api/stats").json()["shopping"]["open"] == 2
