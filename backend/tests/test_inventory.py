def onion_id(client):
    res = client.get("/api/items", params={"search": "Onion"})
    return next(item["id"] for item in res.json() if item["name"] == "Onion")


def test_anyone_can_view_the_inventory(client):
    res = client.get("/api/inventory")
    assert res.status_code == 200
    assert res.json() == []


def test_only_owner_can_add_to_inventory(client):
    res = client.post(
        "/api/inventory",
        json={"item_id": onion_id(client), "location": "fridge", "quantity": 3},
    )
    assert res.status_code == 401


def test_owner_can_add_an_existing_catalogue_item(client, owner_headers):
    item_id = onion_id(client)
    res = client.post(
        "/api/inventory",
        json={"item_id": item_id, "location": "fridge", "quantity": 3, "unit": "pcs"},
        headers=owner_headers,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["item"]["name"] == "Onion"
    assert body["location"] == "fridge"
    assert body["quantity"] == 3
    assert body["use_up"] is False


def test_owner_can_add_an_item_not_in_the_catalogue(client, owner_headers):
    res = client.post(
        "/api/inventory",
        json={"new_item_name": "Dragonfruit", "location": "shelf", "quantity": 1},
        headers=owner_headers,
    )
    assert res.status_code == 201
    assert res.json()["item"]["name"] == "Dragonfruit"

    # it's now in the catalogue for next time
    catalogue = client.get("/api/items", params={"search": "Dragonfruit"}).json()
    assert any(i["name"] == "Dragonfruit" for i in catalogue)


def test_rejects_an_unknown_location(client, owner_headers):
    res = client.post(
        "/api/inventory",
        json={"item_id": onion_id(client), "location": "garage", "quantity": 1},
        headers=owner_headers,
    )
    assert res.status_code == 422


def test_owner_can_toggle_use_up_and_edit_quantity(client, owner_headers):
    created = client.post(
        "/api/inventory",
        json={"item_id": onion_id(client), "location": "fridge", "quantity": 3},
        headers=owner_headers,
    ).json()

    res = client.patch(
        f"/api/inventory/{created['id']}",
        json={"use_up": True, "quantity": 1},
        headers=owner_headers,
    )
    assert res.status_code == 200
    assert res.json()["use_up"] is True
    assert res.json()["quantity"] == 1


def test_only_owner_can_edit_or_delete_an_entry(client, owner_headers):
    created = client.post(
        "/api/inventory",
        json={"item_id": onion_id(client), "location": "fridge", "quantity": 3},
        headers=owner_headers,
    ).json()

    assert client.patch(f"/api/inventory/{created['id']}", json={"quantity": 9}).status_code == 401
    assert client.delete(f"/api/inventory/{created['id']}").status_code == 401


def test_owner_can_delete_an_entry(client, owner_headers):
    created = client.post(
        "/api/inventory",
        json={"item_id": onion_id(client), "location": "fridge", "quantity": 3},
        headers=owner_headers,
    ).json()

    res = client.delete(f"/api/inventory/{created['id']}", headers=owner_headers)
    assert res.status_code == 204
    assert client.get("/api/inventory").json() == []


def test_filter_inventory_by_location(client, owner_headers):
    item_id = onion_id(client)
    client.post(
        "/api/inventory",
        json={"item_id": item_id, "location": "fridge", "quantity": 1},
        headers=owner_headers,
    )
    client.post(
        "/api/inventory",
        json={"item_id": item_id, "location": "freezer", "quantity": 2},
        headers=owner_headers,
    )

    res = client.get("/api/inventory", params={"location": "freezer"})
    body = res.json()
    assert len(body) == 1
    assert body[0]["location"] == "freezer"


def test_new_item_defaults_unit_from_the_catalogue_entry(client, owner_headers):
    item_id = onion_id(client)  # Onion's default_unit is "pcs"
    res = client.post(
        "/api/inventory",
        json={"item_id": item_id, "location": "fridge", "quantity": 2},
        headers=owner_headers,
    )
    assert res.json()["unit"] == "pcs"
