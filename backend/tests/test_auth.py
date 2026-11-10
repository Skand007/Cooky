def test_owner_can_log_in_with_bootstrap_credentials(client):
    res = client.post("/api/auth/login", json={"username": "skand", "password": "test-password"})
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_wrong_password_is_rejected(client):
    res = client.post("/api/auth/login", json={"username": "skand", "password": "nope"})
    assert res.status_code == 401


def test_unknown_username_is_rejected(client):
    res = client.post("/api/auth/login", json={"username": "someone-else", "password": "x"})
    assert res.status_code == 401


def test_me_requires_a_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_returns_owner_with_a_valid_token(client):
    login = client.post("/api/auth/login", json={"username": "skand", "password": "test-password"})
    token = login.json()["access_token"]

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json() == {"username": "skand", "is_owner": True}


def test_me_rejects_a_garbage_token(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"})
    assert res.status_code == 401
