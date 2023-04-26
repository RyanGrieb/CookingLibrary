from flask import Flask, render_template, request
#from flask_sqlalchemy import SQLAlchemy
from flask_sqlalchemy import SQLAlchemy as _BaseSQLAlchemy
import json

import os


# This Modified alchemy class fixes: psycopg2.OperationalError: SSL connection has been closed unexpectedly?
class SQLAlchemy(_BaseSQLAlchemy):
    def apply_pool_defaults(self, app, options):
        options = super().apply_pool_defaults(app, options)
        options["pool_pre_ping"] = True
        return options


db = SQLAlchemy()


class JoinTable(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    recipe_id = db.Column(db.Integer)
    ingredient_id = db.Column(db.Integer)


class Ingredient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text)


class RecipeAd():
    def __init__(self, id, name, image_name, ref_url):
        self.id = id
        self.name = name
        self.image_name = image_name
        self.ref_url = ref_url

    def as_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'image_name': self.image_name,
            'ref_url': self.ref_url
        }


class Recipe(db.Model):
    def __init__(self, id, name, url, image_url, rating_count, rating_external, instructions, ingredients, time, yield_size, website):
        self.id = id
        self.name = name
        self.url = url
        self.image_url = "" if image_url is None else image_url
        self.rating_count = rating_count
        self.rating_external = 0 if rating_external is None else int(
            rating_external)
        self.directions = instructions
        self.ingredients = ingredients
        self.time = time
        self.yield_size = yield_size
        self.website = website

    def as_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'url': self.url,
            'image_url': self.image_url,
            'rating_count': self.rating_count,
            'rating_external': 0 if self.rating_external is None else float(self.rating_external),
            'instructions': self.directions,
            'ingredients': self.ingredients,
            'time': self.time,
            'yield': self.yield_size,
            'website': self.website
        }

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text)
    url = db.Column(db.Text)
    website = db.Column(db.Text)
    authors = db.Column(db.ARRAY(db.Text))
    authors_urls = db.Column(db.ARRAY(db.Text))
    difficulty = db.Column(db.Text)
    yield_size = db.Column(db.Text)
    time = db.Column(db.ARRAY(db.Text))
    ingredients = db.Column(db.ARRAY(db.Text))
    directions = db.Column(db.ARRAY(db.Text))
    image_url = db.Column(db.Text)
    rating_count = db.Column(db.Integer)
    rating_external = db.Column(db.Float)


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:postgres@localhost:5432/recipes"
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.secret_key = "88e6ca3482b693e5fb83994ec8367021"

db.init_app(app)


@app.before_request
def make_session_permanent():
    # session.permanent = True
    return


@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate, no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/")
def index():

    name_button_class = "inactive"
    ingredients_button_class = "inactive"

    if request.cookies.get("button_value") is None or request.cookies.get("button_value") == "ingredients":
        name_button_class = "inactive"
        ingredients_button_class = "active"
    else:
        name_button_class = "active"
        ingredients_button_class = "inactive"

    # TODO: Make a cookie that stores rnd_ingredients so were not hitting the postgres server constantly.
    rnd_ingredients = []
    rnd_psql_ingredients = db.session.execute(
        "SELECT * FROM ingredient_bubble ORDER BY RANDOM() LIMIT 25")

    for ingredient in rnd_psql_ingredients:
        rnd_ingredients.append(
            (ingredient[1], ingredient[2], ingredient[3], ingredient[4], ingredient[5]))

    return render_template("index.html", ingredients=rnd_ingredients, name_class=name_button_class, ingredients_class=ingredients_button_class)


@app.route("/recipe/<recipe_name>")
def recipe_standalone(recipe_name):

    # If the name has stuff's in the name, let sql handle that w/ ''.
    recipe_name = recipe_name.replace("'", "''")

    split_name = recipe_name.rsplit("-", 1)

    if len(split_name) < 2:
        return render_template("recipe_standalone.html", recipe={})

    recipe_name = split_name[0]
    recipe_id = split_name[1]

    sql_recipe_query = db.session.execute(
        "select * from recipe where name='{}' and id={}".format(recipe_name, recipe_id))
    sql_recipe = sql_recipe_query.fetchone()

    if (sql_recipe is None):
        return render_template("recipe_standalone.html", recipe={})

    recipe = Recipe(sql_recipe[0], sql_recipe[1], sql_recipe[2], sql_recipe[12], sql_recipe[13],
                    sql_recipe[14], sql_recipe[10], sql_recipe[9], sql_recipe[8], sql_recipe[7], sql_recipe[3])

    return render_template("recipe_standalone.html", recipe_name=recipe_name, recipe=recipe.as_dict())


@app.route("/ingredients/<parts>")
def recipes_list_ingredients(parts):

    if parts != None:
        parts = parts.replace("fw-slash", "/")
        sortDict = {
            "by-rating": "no-sort",
            "by-review-count": "no-sort",
            "by-name": "no-sort"
        }

        if request.cookies.get("sort-by") is not None:
            sortDict[request.cookies.get(
                "sort-by")] = request.cookies.get("sort-order")

        sort_by = "by-rating"
        order_by = "sort-up"
        ingredient_limit = -1

        if request.cookies.get("ingredient-limit") is not None:
            ingredient_limit = int(request.cookies.get("ingredient-limit"))

        # Iterate dict, if a key has value not no-sort, assign key and value to our variables
        for key, value in sortDict.items():
            if value != "no-sort":
                sort_by = key
                order_by = value

        ingredient_parts = parts.split(",")
        ingredient_parts = [s.strip() for s in ingredient_parts]

        unsorted_recipe_ids = get_recipe_ids_from_ingredients(ingredient_parts)
        recipe_ids = get_sorted_recipe_ids(
            unsorted_recipe_ids, sort_by, order_by, ingredient_limit)

        print("Recipe by ingredients query done in {}ms.".format(-1))
        return render_template("recipes_list.html", unsorted_recipe_ids=unsorted_recipe_ids, recipe_ids=recipe_ids, recipe_name=parts, sort_by=sort_by, order_by=order_by, ingredient_limit=ingredient_limit)

    return render_template("recipes_list.html")


@app.route("/name/<parts>")
def recipes_list_name(parts):
    if parts != None:

        # TODO: Replace this redundant code w/ proper function
        sortDict = {
            "by-rating": "no-sort",
            "by-review-count": "no-sort",
            "by-name": "no-sort"
        }

        if request.cookies.get("sort-by") is not None:
            sortDict[request.cookies.get(
                "sort-by")] = request.cookies.get("sort-order")

        sort_by = "by-rating"
        order_by = "sort-up"
        ingredient_limit = -1

        if request.cookies.get("ingredient-limit") is not None:
            ingredient_limit = int(request.cookies.get("ingredient-limit"))

        # Iterate dict, if a key has value not no-sort, assign key and value to our variables
        for key, value in sortDict.items():
            if value != "no-sort":
                sort_by = key
                order_by = value

        unsorted_recipe_ids = get_recipe_ids_from_name(parts)

        # Sort recipe ids if needed
        recipe_ids = get_sorted_recipe_ids(
            unsorted_recipe_ids, sort_by, order_by, ingredient_limit)

        print("Recipe by name query done in {}ms.".format(-1))
        return render_template("recipes_list.html", unsorted_recipe_ids=unsorted_recipe_ids, recipe_ids=recipe_ids, recipe_name=parts, sort_by=sort_by, order_by=order_by, ingredient_limit=ingredient_limit)

    return render_template("recipes_list.html", recipe_name=parts)


@app.route("/fetchRecipeAd", methods=["POST"])
def fetch_recipe_ad_post():
    content_type = request.headers.get('Content-Type')

    if (content_type == 'application/json'):
        json_request = request.json
        sql_ad_ids = db.session.execute(
            "SELECT ad_id FROM ad_join_table where recipe_id = {}".format(json_request["id"]))

        sql_ad_id = sql_ad_ids.fetchone()

        if sql_ad_id is None:
            return "{}"

        ad_id = int(sql_ad_id[0])

        sql_ads = db.session.execute(
            "SELECT * FROM recipe_ad where id = {}".format(ad_id))

        sql_ad = sql_ads.fetchone()

        recipe_ad = RecipeAd(sql_ad[0], sql_ad[1], sql_ad[2], sql_ad[3])

        return json.dumps(recipe_ad.as_dict())

    return "{}"


# Given ingredients, we return sorted recipe ids
@app.route("/fetchSortedRecipeIdsFromName", methods=["POST"])
def get_sorted_recipe_ids_from_name():
    response = {}
    content_type = request.headers.get('Content-Type')

    if content_type == "application/json":
        json_request = request.json

        sort_by = json_request["sortBy"]
        order_by = json_request["sortOrder"]
        ingredient_limit = int(json_request["ingredientLimit"])
        name = json_request["name"]

        unsorted_recipe_ids = get_recipe_ids_from_name(name)

        # Sort recipe ids if needed
        recipe_ids = get_sorted_recipe_ids(
            unsorted_recipe_ids, sort_by, order_by, ingredient_limit)

        response["unsorted_recipe_ids"] = unsorted_recipe_ids
        response["recipe_ids"] = recipe_ids
        response["name"] = name

    return response

# Given ingredients, we return sorted recipe ids


@app.route("/fetchSortedRecipeIdsFromIngredients", methods=["POST"])
def get_sorted_recipe_ids_from_ingredients_post():
    response = {}
    content_type = request.headers.get('Content-Type')

    if content_type == "application/json":
        json_request = request.json

        ingredients = json_request["ingredients"]
        sort_by = json_request["sortBy"]
        order_by = json_request["sortOrder"]
        ingredient_limit = int(json_request["ingredientLimit"])

        # Get recipe ids
        unsorted_recipe_ids = get_recipe_ids_from_ingredients(
            ingredients.copy())
        # Sort recipe ids
        recipe_ids = get_sorted_recipe_ids(unsorted_recipe_ids, sort_by,
                                           order_by, ingredient_limit)

        response["unsorted_recipe_ids"] = unsorted_recipe_ids
        response["recipe_ids"] = recipe_ids
        response["ingredients"] = ingredients

    return response

# Sorts recipe ids based on provided parameters


@app.route("/sortRecipeIds", methods=["POST"])
def sort_recipes_post():
    content_type = request.headers.get('Content-Type')

    if (content_type == 'application/json'):
        json_request = request.json

        recipe_ids = get_sorted_recipe_ids(
            json_request["ids"], json_request["sortBy"], json_request["sortOrder"], json_request.get("ingredientLimit"))

        return recipe_ids

    return None


@app.route("/fetchRecipeObjects", methods=["POST"])
def fetch_recipes_post():
    content_type = request.headers.get('Content-Type')
    recipes_json = None
    if (content_type == 'application/json'):
        json_request = request.json

        recipe_ids = json_request["ids"]
        ingredients = json_request.get("ingredients")
        maintain_order = bool(json_request["maintainOrder"])

        recipes_json = get_recipe_objects(
            recipe_ids, ingredients, maintain_order)

    return recipes_json


# Creates recipe objects from recipe ids
def get_recipe_objects(recipe_ids: list[int], ingredients: list[str], maintain_order: bool):
    recipes = []
    recipe_ids_fmt = ", ".join(
        map(str, recipe_ids))

    # Maintain order of ids if we have a sortOrder parameter
    if maintain_order:
        print("Maintaining order")
        sql_recipes = db.session.execute(
            "with x (id_list) as (values (array[{}])) select r.* from recipe r, x where id = any (x.id_list) order by array_position(x.id_list, r.id)".format(recipe_ids_fmt))
    else:
        print("Doing default no-sort..")
        sql_recipes = db.session.execute(
            "SELECT * FROM recipe WHERE id in ({}) and rating_count > 0".format(recipe_ids_fmt))

    for sql_recipe in sql_recipes:
        recipes.append(
            Recipe(sql_recipe[0], sql_recipe[1], sql_recipe[2], sql_recipe[12], sql_recipe[13], sql_recipe[14], sql_recipe[10], sql_recipe[9], sql_recipe[8], sql_recipe[7], sql_recipe[3]))

    json_file = None
    # Dev-server file location
    if not os.path.isfile("./static/json/ingredient_rules.json"):
        json_file = open(
            "/var/www/website/website/static/json/ingredient_rules.json")
    else:
        json_file = open("./static/json/ingredient_rules.json")
    # Handle file location for prod server

    ingredient_rules_json = json.load(json_file)

    # FIXME: Potential performance problems here
    # Make this client-side?
    if ingredients is not None:
        for recipe in recipes[:]:
            for ingredient_line in recipe.ingredients:
                for ingredient in ingredients:
                    if ingredient in ingredient_line and ingredient_rules_json.get(ingredient) is not None:
                        forbid_same_sentence = ingredient_rules_json[ingredient]["forbid-same-sentence"]
                        if any(x in ingredient_line for x in forbid_same_sentence):
                            # print("Recipe {} violates ingredient rule for: {}, {}".format(
                            #    recipe.name, ingredient, ingredient_line))
                            # Remove recipe here
                            if recipe in recipes:
                                recipes.remove(recipe)

    json_file.close()

    recipes_dict_list = []
    for recipe in recipes:
        recipes_dict_list.append(recipe.as_dict())

    recipes_dict = {"recipes": recipes_dict_list}
    recipes_json = json.dumps(recipes_dict)

    return recipes_json


def get_sorted_recipe_ids(recipe_ids, sort_by, order_by, ingredient_limit):

    if sort_by is None or order_by is None or len(recipe_ids) < 1 or sort_by == "" or order_by == "":
        return recipe_ids

    print("Sorting recipes by: {}".format(sort_by))

    # TODO: Handle # of ingredients. We would SELECT id,ingredients in our sort_by_dict thing.
    # Or SELECT id depending if the filter is active by the user.

    recipe_ids_fmt = None

    sql_query = ""
    if (len(recipe_ids) > 0):
        recipe_ids_fmt = ", ".join(
            map(str, recipe_ids))

    recipe_ids = []

    # TODO: Merge the ingredient limit w/ the existing queries above. This can be faster that way.
    if ingredient_limit > 0:
        sql_recipes = db.session.execute(
            "SELECT id FROM recipe WHERE id in ({}) and cardinality(ingredients) <= {}".format(recipe_ids_fmt, ingredient_limit))

        for sql_recipe in sql_recipes:
            recipe_ids.append(sql_recipe[0])

        if (len(recipe_ids) < 1):
            return recipe_ids

        # Update the recipe_ids_fmt w/ recipes that fit our ingredient limit
        recipe_ids_fmt = ", ".join(map(str, recipe_ids))
        recipe_ids = []

    sort_by_dict = {
        "by-rating": "WITH cte AS (SELECT id, (CASE WHEN rating_count > 0 THEN rating_external + log(rating_count) ELSE NULL END) as score FROM recipe WHERE id in ({})) SELECT id, score FROM cte WHERE score IS NOT NULL ORDER BY score".format(recipe_ids_fmt),
        "by-review-count": "SELECT id FROM recipe WHERE id in ({}) and rating_count > 0 order by rating_count".format(recipe_ids_fmt),
        "by-name": "SELECT id FROM recipe WHERE id in ({}) and rating_count > 0 order by name".format(recipe_ids_fmt)
    }

    sql_query = sort_by_dict[sort_by]

    if order_by == "sort-up":
        sql_query += " desc"

    sql_recipes = db.session.execute(sql_query)

    for sql_recipe in sql_recipes:
        recipe_ids.append(sql_recipe[0])

    return recipe_ids


# Returns an unsorted list of recipe ids associated with a provided name
def get_recipe_ids_from_name(name):
    # Get unsorted recipe ids
    name_keywords = name.replace(" ", "%")
    name_keywords = "%" + name_keywords + "%"

    sql_recipes = db.session.execute(
        "SELECT id FROM recipe where name ILIKE '{}'".format(name_keywords))

    unsorted_recipe_ids = []
    for sql_recipe in sql_recipes:
        unsorted_recipe_ids.append(sql_recipe[0])
    return unsorted_recipe_ids

# Returns an unsorted list of recipe ids associated with ingredients


def get_recipe_ids_from_ingredients(ingredient_parts: list[str]):
    multi_word_ingredients = []
    # Separate single-word & multi-word ingredients. They behave differently.
    for ingredient in list(ingredient_parts):
        if " " in ingredient:
            multi_word_ingredients.append(ingredient)
            ingredient_parts.remove(ingredient)

    single_word_ingredients = ingredient_parts

    # Split the words based on whitespace. Then flatten the array into one.
    multi_word_ingredients = [i.split() for i in multi_word_ingredients]

    # Get a list of all single-word ingredients
    query = db.session.query(Ingredient).filter(
        Ingredient.name.in_(single_word_ingredients))
    ingredient_results = query.all()

    singe_word_ingredient_ids = []
    for ingredient_result in ingredient_results:
        singe_word_ingredient_ids.append(ingredient_result.id)

    # !!! Modified code, does it break anything?
    if len(single_word_ingredients) != len(singe_word_ingredient_ids):
        print("A single-word ingredient wasn't found. Canceling single word query.. {}, {}".format(len(single_word_ingredients),
                                                                                                   len(singe_word_ingredient_ids)))
        singe_word_ingredient_ids = []

    single_ingredient_ids_fmt = ", ".join(
        map(str, singe_word_ingredient_ids))
    print("Searching for recipes using single word ingredients: {}".format(
        singe_word_ingredient_ids))

    jt_recipe_ids_single_word = None
    # List of all recipe ids that use ALL inputted single word ingredients.
    single_word_recipe_ids = []

    if len(singe_word_ingredient_ids) > 0:

        jt_recipe_ids_single_word = db.session.execute(
            "SELECT DISTINCT recipe_id FROM join_table WHERE ingredient_id IN ({}) GROUP BY recipe_id HAVING COUNT(DISTINCT ingredient_id) = {}".format(single_ingredient_ids_fmt, len(singe_word_ingredient_ids)))

        for jt_recipe_id in jt_recipe_ids_single_word:
            single_word_recipe_ids.append(jt_recipe_id[0])

    # Parse join table to find multi_word ingredients in the CORRECT ORDER
    # List of all recipe ids that use ALL inputted single word ingredients
    multi_word_recipe_ids = []
    whole_multi_word_index = 0
    for ingredient_parts in multi_word_ingredients:
        # List of recipe ids that use CURRENT multi-word ingredients. ([['green', 'beans'],['black','olives']] would use ['green','beans'])
        current_multi_word_recipe_ids = []

        # Get a list of all multi-word ingredients ids
        query = db.session.query(Ingredient).filter(
            Ingredient.name.in_(ingredient_parts))

        ingredient_results = query.all()

        # FIXME: There are better ways to do this, but I don't know how to maintain order of inputted values in PSQL.
        multi_word_ingredient_ids = []
        for ingredient_part in ingredient_parts:
            ingredient_results = db.session.execute(
                "select id from ingredient where name='{}'".format(ingredient_part))
            for ingredient_result in ingredient_results:
                multi_word_ingredient_ids.append(ingredient_result[0])

        # If we can't find the id for one of the ingredient words, skip this current multi-word ingredient.
        if len(multi_word_ingredient_ids) != len(ingredient_parts):
            continue

        multi_ingredient_ids_fmt = ", ".join(
            map(str, multi_word_ingredient_ids))
        # Now that we have the multi ingredient id parts. We want to find recipes where that use both
        jt_rows_from_multi_word_ingredients = db.session.execute(
            "SELECT * FROM join_table WHERE recipe_id in (SELECT DISTINCT recipe_id FROM join_table WHERE ingredient_id IN ({}) GROUP BY recipe_id HAVING COUNT(DISTINCT ingredient_id) = {} ORDER BY recipe_id)".format(multi_ingredient_ids_fmt, len(multi_word_ingredient_ids)))

        current_ing_index = 0
        for jt_row in jt_rows_from_multi_word_ingredients:
            # if jt_row[1] == 34:
            # print(jt_row)
            current_ingredient_id = multi_word_ingredient_ids[current_ing_index]
            if jt_row[1] == current_ingredient_id:
                # if jt_row[1] == 34:
                #    print(jt_row)
                if current_ing_index >= len(multi_word_ingredient_ids) - 1:
                    # We found a recipe that uses the proper order e.g. ("Green Beans"), add it..
                    # print("Found recipe that uses word pair {}: {}".format(
                    #    ingredient_parts, jt_row[1]))
                    current_multi_word_recipe_ids.append(jt_row[0])
                    current_ing_index = 0
                else:
                    current_ing_index += 1
            else:
                current_ing_index = 0

        # print(current_multi_word_recipe_ids)
        # If a recipe from previous words isn't in this current word. Remove it.
        for multi_word_recipe_id in list(multi_word_recipe_ids):
            if multi_word_recipe_id not in current_multi_word_recipe_ids:
                multi_word_recipe_ids.remove(multi_word_recipe_id)

        # Now add all recipes found in the first word, then we just chip away ids further out.
        if whole_multi_word_index < 1:
            multi_word_recipe_ids.extend(current_multi_word_recipe_ids)

        whole_multi_word_index += 1

    recipe_ids = []
    # We now have two lists single_word_recipe_ids, and multi_word_recipe_ids
    # We only want ids that are in BOTH lists. (Only when both are populated)
    if len(single_word_recipe_ids) > 0 and len(multi_word_recipe_ids) > 0:
        recipe_ids = list(set(single_word_recipe_ids)
                          & set(multi_word_recipe_ids))
        print("Both populated")
    elif len(single_word_recipe_ids) < 1 and len(single_word_ingredients) < 1:
        print("Only multi-populated")
        recipe_ids = multi_word_recipe_ids
    elif len(multi_word_recipe_ids) < 1 and len(multi_word_ingredients) < 1:
        print("Only single populated...")
        recipe_ids = single_word_recipe_ids

    return recipe_ids


if __name__ == "__main__":
    app.run(debug=True)
    # serve(app, host="0.0.0.0", port=5000, url_scheme="https")
