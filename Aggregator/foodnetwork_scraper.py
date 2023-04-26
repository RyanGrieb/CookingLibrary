import urllib.request
import urllib.error
import socket
import psycopg
import time
import json

from bs4 import BeautifulSoup
from collections import namedtuple
from threading import Thread


# pip install "psycopg[binary]"
# pip install bs4

# https://www.foodnetwork.com/recipes/recipes-a-z/

class RecipeAttr:
    def __init__(self, author_names: list[str], author_urls: list[str], difficulty: str, yield_size: str, time: str, ingredients: list[str], instructions: list[str], image_url: str, rating: tuple, special_equipment: str):
        self.author_names = author_names
        self.author_urls = author_urls
        self.difficulty = difficulty
        self.time = time
        self.yield_size = yield_size
        self.ingredients = ingredients
        self.instructions = instructions
        self.image_url = image_url
        self.rating_count = rating[0]
        self.rating_external = rating[1]
        self.special_equipment = special_equipment


conn = psycopg.connect(
    "dbname=recipes user=postgres host=localhost password=postgres")


def db_reset_join_table(recipe_id: int):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM join_table WHERE recipe_id={}".format(recipe_id))
        conn.commit()
    return


def db_update_ingredient_tables(recipe_id: int, ingredients_column: list[str]):
    ingredients = ingredients_column

    # Redefine ingredients into parts.. e.g. "Black Olives" --> "Black", "Olives"
    for ingredient in ingredients:

        # Don't add subheaders in our ingredients list
        if ingredient.startswith("["):
            print("Skipping {}, is a subheader.".format(ingredient))
            continue

        for ingredient_part in ingredient.split():
            part_vals = list(
                [val for val in ingredient_part if val.isalpha() or val.isnumeric()])
            ingredient_part = ("".join(part_vals)).strip().lower()

            with conn.cursor() as cur:

                # Verify if ingredient row exists, if not create a row.
                # NOTE: Instead of id I had * for the last 2 cur.execute
                cur.execute(
                    "SELECT id FROM ingredient WHERE name = '{}'".format(ingredient_part))
                ingredient_columns = cur.fetchone()

                if ingredient_columns is None:
                    print("Missing: {}, adding to table...".format(
                        ingredient_part))
                    cur.execute(
                        "INSERT INTO ingredient (name) VALUES (%s)", (ingredient_part,))

                # Obtain ingredient_id..
                cur.execute(
                    "SELECT id FROM ingredient WHERE name = '{}'".format(ingredient_part))
                ingredient_columns = cur.fetchone()

                # Verify if recipe in join table links to ingredient, if not create a row.
                ingredient_id = int(ingredient_columns[0])

                # cur.execute(
                #    "SELECT * FROM join_table WHERE recipe_id = '{}' AND ingredient_id = '{}'".format(recipe_id, ingredient_id))
                # join_columns = cur.fetchone()

                # if join_columns is None:
                # Try adding everything into the join table, including repeated ingredients.
                # This allows us to handle multi-word ingredients better.
                # print("Adding ingredient {} to join table: {},{}".format(
                #    ingredient_part, recipe_id, ingredient_id))
                cur.execute(
                    "INSERT INTO join_table (recipe_id,ingredient_id) VALUES (%s,%s)", (recipe_id, ingredient_id))

                conn.commit()
    # return


def db_create_recipe_row(recipe_name: str, recipe_url: str):
    index = -1
    with conn.cursor() as cur:

        cur.execute(
            "SELECT id FROM recipe WHERE url = '{}'".format(recipe_url))
        recipe_columns = cur.fetchone()

        if recipe_columns is None:
            print("Adding new entry: {}".format(recipe_name))
            cur.execute("INSERT INTO recipe (name,url,website) VALUES (%s,%s,%s)",
                        (recipe_name, recipe_url, "foodnetwork"))
            conn.commit()

        cur.execute(
            "SELECT id,fully_parsed FROM recipe WHERE url = '{}'".format(recipe_url))
        recipe_columns = cur.fetchone()
        index = int(recipe_columns[0])

        scraped_page = bool(recipe_columns[1])

    return (index, scraped_page)


def db_add_recipe_attributes(recipe_id: int, recipe_attr: RecipeAttr):
    with conn.cursor() as cur:
        query = "UPDATE recipe SET authors = %s, authors_urls = %s, difficulty = %s, yield_size = %s, time = %s, ingredients = %s, directions = %s, image_url = %s, rating_count = %s, rating_external = %s, special_equipment = %s WHERE id=%s;"
        data = (recipe_attr.author_names, recipe_attr.author_urls, recipe_attr.difficulty, recipe_attr.yield_size,
                recipe_attr.time, recipe_attr.ingredients, recipe_attr.instructions, recipe_attr.image_url, recipe_attr.rating_count, recipe_attr.rating_external, recipe_attr.special_equipment, recipe_id)
        cur.execute(
            query, data)
        conn.commit()
    return


def get_page_numbers(website_url: str):
    request = urllib.request.Request(url=website_url, headers={
                                     'User-Agent': 'Mozilla/5.0'})

    while True:
        try:
            with urllib.request.urlopen(request, timeout=10) as url:
                soup = BeautifulSoup(url.read().decode(),
                                     features="html.parser")
                html = soup.prettify()
                break
        except Exception as e:
            print(e)
            time.sleep(5)

    section_page_nums = soup.find("section", {"class": "o-Pagination"})
    ul_class = section_page_nums.findChild("ul")
    a_pages = ul_class.findChildren("li", recursive=False)
    a_last_page = a_pages[-2]
    return int(a_last_page.text)


def req_recipe_rating(soup: BeautifulSoup):
    html = soup.prettify()

    recipe_id = html[html.index('mdManager.addParameter("DetailID", '):html.index(
        'mdManager.addParameter("PageNumber",')]
    recipe_id = recipe_id[recipe_id.index(","):recipe_id.rindex('"')]
    recipe_id = recipe_id[recipe_id.index('"')+1:]

    api_url = "https://api.sni.foodnetwork.com/moderation-chitter-proxy/v1/ratings/brand/FOOD/type/recipe/id/{}".format(
        recipe_id)
    json_string = None

    while True:
        try:
            request = urllib.request.Request(api_url)
            with urllib.request.urlopen(request, timeout=10) as url:
                json_string = str(url.read().decode())
                break
        except Exception as e:
            print(e)
            time.sleep(5)

    json_obj = json.loads(json_string)
    if len(json_obj["ratingsSummaries"]) < 1:
        return (None, None)

    count = json_obj["ratingsSummaries"][0]["count"]
    rating = json_obj["ratingsSummaries"][0]["averageValue"]

    return (count, rating)


def scrape_recipe_page(website_url: str, recipe_id: int):

    # Reset everything in the join_table, since data might be partially constructed already.
    db_reset_join_table(recipe_id)

    # Check if row exists in database, if not abort, it should have been already.
    # Modify row to update it's columns containing author, ingredients, directions
    def initialize_soup():
        while True:
            try:
                request = urllib.request.Request(website_url)
                with urllib.request.urlopen(request, timeout=10) as url:

                    print(url.geturl())
                    print(website_url)
                    if url.geturl() != website_url:
                        print("Url redirect, checking db for duplicate.\n{}\n{}".format(
                            url.geturl(), website_url))
                     # Check if redirected url already exists in db, if so delete this current recipe_id and continue..
                        with conn.cursor() as cur:
                            cur.execute(
                                "SELECT id FROM recipe WHERE url = '{}'".format(url.geturl()))
                            recipe_columns = cur.fetchone()
                            if recipe_columns is not None:
                                print("Deleting Duplicate entry for {}".format(
                                    website_url))
                                cur.execute(
                                    "DELETE FROM recipe WHERE id={}".format(recipe_id))
                                conn.commit()
                                return (False, None)

                    print("Soup initialized.")
                    return (True, BeautifulSoup(url.read().decode(), features="html.parser"))
                    # FIXME: Include temp failure in name resolution
            except TimeoutError as e:
                print("Retry, timeout for {} {}".format(website_url, e))
                time.sleep(5)
                continue
            except urllib.error.URLError as e:

                if (e.errno == -3):
                    print("Retry, timeout for {} {}".format(website_url, e))
                    time.sleep(5)
                    continue

                print(e.errno)
                return (False, None)
            except Exception as e:
                # Any other error we just return and break the loop.
                print("Error for {}, {}".format(website_url, e))
                return (False, None)

    success, soup = initialize_soup()

    if not success:
        return

    # Run code once we know soup is initialized
    # FIXME: Account for multiple authors
    # Author
    author_urls = []
    author_names = []
    span_author = soup.find("span", {"class": "o-Attribution__a-Name"})
    if span_author != None:
        a_author = span_author.findChild("a")
        if a_author != None:
            author_urls.append("https://"+a_author.get("href")[2:])
            author_names.append(a_author.text)
        else:
            # No link to author, take text:
            author_names.append(
                span_author.text.strip().partition("of")[2].strip())

    # Difficulty
    difficulty = "N/A"
    ul_difficulty = soup.find("ul", {"class": "o-RecipeInfo__m-Level"})
    if ul_difficulty != None:
        span_difficulty = ul_difficulty.findChild(
            "span", {"class": "o-RecipeInfo__a-Description"})
        difficulty = span_difficulty.text

    # Yield
    yield_size = "N/A"
    ul_yield = soup.find("ul", {"class": "o-RecipeInfo__m-Yield"})
    if ul_yield != None:
        span_yield = ul_yield.findChild(
            "span", {"class", "o-RecipeInfo__a-Description"})
        yield_size = span_yield.text

    # Time
    recipe_times = []
    ul_time = soup.find("ul", {"class", "o-RecipeInfo__m-Time"})
    if ul_time != None:
        li_times = ul_time.findChildren("li")
        if li_times != None:
            for li_time in li_times:
                span_time_elements = li_time.findChildren("span")
                for span_time_element in span_time_elements:
                    recipe_times.append(span_time_element.text.strip())

    # Gather ingredients
    ingredients = []
    div_ingredients = soup.find("div", {"class": "o-Ingredients__m-Body"})
    if div_ingredients != None:

        ingredients_children = div_ingredients.findChildren(recursive=False)

        for ingredient_child in ingredients_children:
            if ingredient_child.name == "p":
                p_ingredient = ingredient_child
                span_ingredient = p_ingredient.findChild(
                    "span", {"class", "o-Ingredients__a-Ingredient--CheckboxLabel"})

                if "Deselect All" in span_ingredient.text:
                    continue

                ingredients.append(span_ingredient.text)
            if ingredient_child.name == "h3":
                # Ingredient sub - headline
                print("Found sub-headline {} for {}".format(
                    ingredient_child.text.strip(), recipe_id))
                ingredients.append("[{}]".format(
                    ingredient_child.text.strip()))

    # Gather instructions
    instructions = []
    div_instructions = soup.find("div", {"class": "o-Method__m-Body"})
    if div_instructions != None:
        ol_instructions = div_instructions.findChild("ol")
        li_instructions = ol_instructions.findChildren("li")
        for li_instruction in li_instructions:
            instruction = li_instruction.text.lstrip()
            instructions.append(instruction)

    # Get recipe image
    recipe_img = soup.find("img", {"class": "m-MediaBlock__a-Image a-Image"})
    image_url = None
    if recipe_img is not None and recipe_img.get("src") is not None:
        image_url = "https://"+recipe_img.get("src")[2:]

    # Get recipe rating
    rating = req_recipe_rating(soup)

    # Get recipe special equipment
    special_equipment_section = soup.find(
        "section", {"class": "o-SpecialEquipment"})
    special_equipment = None

    if special_equipment_section is not None:
        special_equipment = " ".join(special_equipment_section.text.split())
        print(special_equipment)

    recipe_data = RecipeAttr(author_names, author_urls, difficulty,
                             yield_size, recipe_times, ingredients, instructions, image_url, rating, special_equipment)

    db_add_recipe_attributes(recipe_id, recipe_data)
    db_update_ingredient_tables(recipe_id, ingredients)

    # Were done adding the recipe and all of it's attributes. Update it's parsed column to represent that.
    with conn.cursor() as cur:
        query = "UPDATE recipe SET fully_parsed = %s WHERE id=%s;"
        data = (True, recipe_id)
        cur.execute(query, data)
        conn.commit()
    print("Added recipe: {}".format(website_url))


def scrape_recipe_list_page(website_url: str):
    # print("Scraping: {}".format(website_url))
    html_file = open("./debug.html", "w+")

    request = urllib.request.Request(website_url)
    while True:
        with urllib.request.urlopen(request, timeout=10) as url:
            soup = BeautifulSoup(url.read().decode(), features="html.parser")
            html = soup.prettify()
            html_file.write(html)
            html_file.close()
            break

    div_recipes_parent = soup.find(
        "div", {"class": "l-Columns l-Columns--2up"})

    # Should be two <ul> recipes columns...
    ul_recipes_columns = div_recipes_parent.findChildren("ul", recursive=False)
    for ul_column in ul_recipes_columns:
        # FIXME: Cast ul_column to something instead of it being the "Anything" type. I want intellisense for ul_column and below
        li_recipes = ul_column.findChildren("li", recursive=False)
        for li_recipe in li_recipes:
            a_recipe = li_recipe.findChild("a", recursive=False)
            recipe_name = a_recipe.text
            recipe_url = "https://"+a_recipe.get("href")[2:]

            recipe_id, scraped_page = db_create_recipe_row(
                recipe_name, recipe_url)
            if not scraped_page:
                scrape_recipe_page(recipe_url, recipe_id)
            else:
                print("Skipping: {}".format(recipe_url))


def scape_foodnetwork():
    # Generate all possible prefixes: 123,a-z,xyz
    prefixes = []
    #prefixes.append("123")
    #prefixes.extend(list(map(chr, range(97, 123))))
    prefixes.append("w")
    prefixes.append("xyz")
    
    for prefix in prefixes:
        website_url = "https://www.foodnetwork.com/recipes/recipes-a-z/{}".format(
            prefix)
        total_pages = get_page_numbers(website_url)

        for page in range(1, total_pages+1):
            website_url = "https://www.foodnetwork.com/recipes/recipes-a-z/{}/p/{}".format(
                prefix, page)
            scrape_recipe_list_page(website_url)


def main():
    scape_foodnetwork()


if __name__ == "__main__":
    main()
