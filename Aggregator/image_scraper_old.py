import psycopg
import os
import urllib.request
import urllib.error
import time

conn = psycopg.connect(
    "dbname=recipes user=postgres host=localhost password=postgres")

# Set the proxy URL
proxy_url = 'http://groups-BUYPROXIES94952:apify_proxy_oaykSdafVsAwNN2tBPZHuR41HSG24N08SUBz@proxy.apify.com:8000'

# Create a proxy handler
proxy_handler = urllib.request.ProxyHandler({'http': proxy_url})


def scrape_foodnetwork_images(target_img_dir: str):
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
                        opener = urllib.request.build_opener(proxy_handler)
                        urllib.request.install_opener(opener)

                        request = urllib.request.Request(image_url)

                        # Add a header to the Request
                        request.add_header(
                            'User-Agent', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:70.0) Gecko/20100101 Firefox/70.0')

                        # Use the opener to fetch the URL
                        response = opener.open(request)
                        print(response.info())
                        with open("{}/{}.jpeg".format(target_img_dir, id), 'wb') as f:
                            f.write(response.read())
                            print("Downloading image. {} : {}".format(
                                id, image_url))
                            break
                    except urllib.error.HTTPError as e:
                        print("HTTP Error: {} {}".format(e.code, e.reason))
                        print(e.headers)
                        time.sleep(5)
                    except Exception as e:

                        print("{}: {}".format(id, e))
                        time.sleep(5)
            else:
                print("exists")


def main():
    # scrape_foodnetwork_images("./images")
    scrape_foodnetwork_images("/var/www/website/website/static/images/recipes")


if __name__ == "__main__":
    main()
