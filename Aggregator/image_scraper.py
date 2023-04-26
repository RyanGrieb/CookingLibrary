import psycopg
import os
import requests
import time

conn = psycopg.connect(
    "dbname=recipes user=postgres host=localhost password=postgres")

# Set the proxy URL
proxy_url = 'http://41.65.55.2:1976'
proxies = {'http': proxy_url}


def scrape_foodnetwork_images(target_img_dir: str):
    session = requests.Session()
    with conn.cursor() as cur:
        cur.execute("select id,image_url from recipe")
        sql_recipes = cur.fetchall()
        for sql_recipe in sql_recipes:

            id = sql_recipe[0]
            image_url = sql_recipe[1]

            if image_url is None:
                continue

            if not os.path.exists("{}/{}.jpeg".format(target_img_dir, id)):
                # print(sql_recipe[0])
                while True:
                    try:
                        #session.proxies = proxies
                        #response = session.get(image_url, proxies=proxies)
                        response = session.get(image_url)

                        with open("{}/{}.jpeg".format(target_img_dir, id), 'wb') as f:
                            f.write(response.content)
                            print("Downloading image. {} : {}".format(
                                id, image_url))
                            break

                    except Exception as e:
                        print("{}: {}".format(id, e))
                        time.sleep(5)
            else:
                print("exists")


def main():
    scrape_foodnetwork_images("./images")
    # scrape_foodnetwork_images("/var/www/website/website/static/images/recipes")


if __name__ == "__main__":
    main()
