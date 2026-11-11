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
