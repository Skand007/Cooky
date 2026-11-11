from app.services.diet import guess_diet, recipe_diets


class FakeItem:
    def __init__(self, diet, jain_ok):
        self.diet = diet
        self.jain_ok = jain_ok


def test_guess_diet():
    assert guess_diet("Chicken breast")[0] == "nonveg"
    assert guess_diet("Eggs")[0] == "egg"
    assert guess_diet("Eggplant")[0] == "veg"
    assert guess_diet("Onion")[1] is False
    assert guess_diet("Spinach") == ("veg", True)


def test_recipe_diets():
    assert recipe_diets([FakeItem("veg", True)]) == ["vegetarian", "eggetarian", "jain"]
    assert recipe_diets([FakeItem("veg", False)]) == ["vegetarian", "eggetarian"]
    assert recipe_diets([FakeItem("egg", False)]) == ["eggetarian"]
    assert recipe_diets([FakeItem("nonveg", False)]) == []
