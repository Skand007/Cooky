def test_catalogue_is_seeded_on_startup(client):
    res = client.get("/api/items")
    assert res.status_code == 200
    names = [item["name"] for item in res.json()]
    assert "Onion" in names
    assert "Paneer" in names


def test_search_matches_an_alias_not_just_the_name(client):
    res = client.get("/api/items", params={"search": "scallion"})
    assert res.status_code == 200
    names = [item["name"] for item in res.json()]
    assert "Spring onion" in names


def test_search_is_case_insensitive_and_partial(client):
    res = client.get("/api/items", params={"search": "pan"})
    names = [item["name"] for item in res.json()]
    assert "Paneer" in names


def test_anyone_can_browse_the_catalogue_without_logging_in(client):
    res = client.get("/api/items")
    assert res.status_code == 200


def test_only_owner_can_add_a_catalogue_item(client):
    res = client.post("/api/items", json={"name": "Dragonfruit"})
    assert res.status_code == 401


def test_owner_can_add_a_new_catalogue_item(client, owner_headers):
    res = client.post(
        "/api/items",
        json={"name": "Dragonfruit", "category": "Produce", "aliases": ["pitaya"]},
        headers=owner_headers,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Dragonfruit"
    assert body["aliases"] == ["pitaya"]


def test_adding_a_duplicate_item_name_is_rejected(client, owner_headers):
    client.post("/api/items", json={"name": "Dragonfruit"}, headers=owner_headers)
    res = client.post("/api/items", json={"name": "dragonfruit"}, headers=owner_headers)
    assert res.status_code == 409
