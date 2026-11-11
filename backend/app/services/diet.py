"""Vegetarian / eggetarian / Jain logic.

Each catalogue item carries ``diet`` (veg | egg | nonveg) and ``jain_ok``.
A recipe's diets are worked out from the items it uses, so a single wrongly
flagged item shows up as a wrong recipe tag and is fixed in one place (the
catalogue), not in every recipe.

Jain rule used here: no meat, fish or eggs, and none of the root vegetables or
other foods traditionally avoided (onion, garlic, ginger, potato, carrot,
beetroot, radish, turnip, sweet potato, mushroom, honey, and close relatives).
"""

import re

DIET_TAGS = ["vegetarian", "eggetarian", "jain"]

_NONVEG = re.compile(
    r"\b(chicken|mutton|lamb|beef|pork|bacon|ham|fish|salmon|tuna|prawns?|shrimps?|crab|"
    r"meat|sausages?|turkey|duck|anchov(?:y|ies)|gelatin|lard|steak|fillets?|mince)\b",
    re.IGNORECASE,
)
_EGG = re.compile(r"\beggs?\b", re.IGNORECASE)
_NOT_JAIN = re.compile(
    r"\b(onions?|garlic|ginger|potato(?:es)?|carrots?|beetroots?|beets?|radish(?:es)?|"
    r"mushrooms?|honey|turnips?|shallots?|leeks?|yams?|scallions?|chives?)\b",
    re.IGNORECASE,
)

STAPLES = {"salt", "black pepper", "cooking oil", "water"}


def guess_diet(name: str) -> tuple[str, bool]:
    """Best-guess (diet, jain_ok) for an item name. Used for catalogue seeding and
    for items created on the fly; the owner can correct either flag afterwards."""
    if _NONVEG.search(name):
        return "nonveg", False
    if _EGG.search(name):
        return "egg", False
    return "veg", not _NOT_JAIN.search(name)


def recipe_diets(items) -> list[str]:
    """Diet tags a recipe qualifies for, given the Items it uses."""
    items = list(items)
    if any(i.diet == "nonveg" for i in items):
        return []
    has_egg = any(i.diet == "egg" for i in items)
    tags = []
    if not has_egg:
        tags.append("vegetarian")
    tags.append("eggetarian")
    if not has_egg and all(i.jain_ok for i in items):
        tags.append("jain")
    return tags
