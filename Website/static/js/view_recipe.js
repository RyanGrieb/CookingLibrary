let recipesJson = undefined;
//const fac = new FastAverageColor();

const rulesJson = {
  rice: {
    "forbid-same-sentence": ["vinegar", "wine"],
  },
  chicken: {
    "forbid-same-sentence": ["broth"],
  },
  salt: {
    "forbid-same-sentence": ["pork", "ham", "unsalted", "saltine"],
  },
  avocado: {
    "forbid-same-sentence": ["salsa"],
  },
  garlic: {
    "forbid-same-sentence": ["chili sauce"],
  },
  butter: {
    "forbid-same-sentence": ["peanut", "buttermilk", "buttercream", "butterflied"],
  },
  pepper: {
    "forbid-same-sentence": ["red peppers"],
  },
};

function storeRecipes(jsonData) {
  recipesJson = JSON.parse(jsonData);
}

function recipeContainerMouseEnter(recipe, e) {
  e.currentTarget.setAttribute("hovered", "true");

  const currentTargetElement = e.currentTarget;

  let timeout_id = setTimeout(() => {
    // Compare e.currentTarget and ?? here
    if (currentTargetElement.getAttribute("hovered") === "true") {
      console.log("Hovered: " + recipe.name);
      currentTargetElement.classList.add("expanded");

      //currentTargetElement.querySelector("ul").innerHTML = ""
    }
  }, 2000);
  e.currentTarget.setAttribute("timeout", timeout_id);
}

function recipeContainerMouseLeave(recipe, e) {
  e.currentTarget.classList.remove("expanded");
  e.currentTarget.setAttribute("hovered", "false");

  if (e.currentTarget.hasAttribute("timeout")) {
    clearTimeout(parseInt(e.currentTarget.getAttribute("timeout")));
    e.currentTarget.removeAttribute("timeout");
  }
}

function loadRecipeAd(recipeId) {
  fetch("/fetchRecipeAd", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: recipeId,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      const sponsorBanner = document.querySelector(".sponsor-banner");
      const sponsorContainer = document.querySelector(".sponsor-container");
      const productImage = document.querySelector(".sponsor-banner .product-logo");

      if (data["ref_url"] == undefined) {
        /*sponsorBanner.href = "https://amzn.to/3vvkhTg";
        productImage.src = "/static/images/ads/amazon_fresh.jpg";
        sponsorContainer.querySelector("h3").innerHTML = "Try Amazon Fresh:";
        sponsorContainer.querySelector(".amazon-logo").src = "";*/

        //const adsense = document.querySelector("#google_esf");
        //sponsorBanner.append(adsense);
        sponsorContainer.style.display = "block";
        return;
      }

      console.log("Loading sponsor...");

      sponsorContainer.querySelector("h3").innerHTML = "Required Tool:";
      sponsorContainer.querySelector(".amazon-logo").src =
        "https://in-sync-child.com/wp-content/uploads/2020/08/buy-on-amazon-button.png";

      sponsorBanner.href = data["ref_url"];
      productImage.src = "/static/images/ads/" + data["image_name"] + ".png";
      sponsorContainer.style.display = "block";
    });
}

function showRecipe(recipe, rulesJson) {
  viewingRecipe = true;

  document.title = recipe.name + " | Cooking Library";

  const listContainer = document.querySelector(".list-container");
  const recipeInfoContainer = document.querySelector(".recipe-info-container");
  const recipeContainers = document.getElementsByClassName("recipe-container");
  const recipeName = document.querySelector(".recipe-name");
  const recipeImage = document.querySelector(".recipe-info-container .recipe-sidebar img");
  const recipeInstructions = document.querySelector(".recipe-details .recipe-instructions ol");
  const recipeIngredients = document.querySelector(".recipe-details .recipe-ingredients ul");
  const recipeTimePortion = document.querySelector(".recipe-time-portion");
  const recipeServing = document.querySelector(".recipe-serving p");
  const parentWebsite = document.querySelector(".parent-website");
  const parentWebsiteLink = document.querySelector(".parent-website-link");

  // Hide Back to List button if this is a standalone recipe page
  if (typeof getEnteredIngredients !== "function") {
    document.querySelector(".close-recipe-info").style.display = "none";
  }

  // Reveal the recipe page
  recipeInfoContainer.style.display = "flex";
  recipeInfoContainer.setAttribute("id", recipe.id);
  document.body.style.overflow = "hidden";

  recipeName.innerHTML = recipe.name;

  // Prod
  //recipeImage.setAttribute("src", "/static/images/recipes/" + recipe.id + ".jpeg");

  // Dev
  recipeImage.setAttribute("src", recipe.image_url);

  for (instruction of recipe.instructions) {
    li_instruction = document.createElement("li");
    li_instruction.textContent = instruction;
    recipeInstructions.appendChild(li_instruction);
  }

  //FIXME: We need to put everything else in here since now we start showing stuff too early.
  for (ingredient of recipe.ingredients) {
    li_ingredient = document.createElement("li");

    (async () => {
      if (ingredient.charAt(0) == "[" /*&& ingredient.at(-1) == "]"*/) {
        ingredient = ingredient.slice(1, -1);
        li_ingredient.classList.add("sub-header");
      } else if (typeof getEnteredIngredients === "function") {
        enteredIngredients = getEnteredIngredients();

        if (enteredIngredients != undefined) {
          for (enteredIngredient of enteredIngredients) {
            if (ingredient.toLowerCase().includes(enteredIngredient)) {
              let skip = false;

              // Check if the line doesn't violate our ingredient_rules.json
              if (rulesJson[enteredIngredient] != undefined) {
                //console.log("Found rules for: " + enteredIngredient + " on line: " + ingredient);

                rulesJson[enteredIngredient.toLowerCase()]["forbid-same-sentence"].forEach(
                  (badWord) => {
                    //console.log(badWord);

                    if (ingredient.toLowerCase().includes(badWord)) {
                      //console.log("Found bad word " + badWord);
                      skip = true;
                    }
                  }
                );
              }

              if (skip) continue;
              li_ingredient.classList.add("has-ingredient");
            }
          }
        }
      }
      //end-broken
    })().catch(console.error);

    li_ingredient.textContent = ingredient;
    recipeIngredients.appendChild(li_ingredient);
  }

  currentTimeP = undefined;
  for (timeElement of recipe.time) {
    if (timeElement.toLowerCase().includes("prep")) {
      timeElement = "⏲️ " + timeElement;
    }
    if (timeElement.toLowerCase().includes("cook")) {
      timeElement = "🍳 " + timeElement;
    }
    if (timeElement.toLowerCase().includes("total")) {
      timeElement = "💯 " + timeElement;
    }

    if (timeElement.toLowerCase().includes("inactive")) {
      timeElement = "🛌 " + timeElement;
    } else if (timeElement.toLowerCase().includes("active")) {
      timeElement = "✅ " + timeElement;
    }

    if (timeElement.includes(":")) {
      timeP = document.createElement("p");
      recipeTimePortion.appendChild(timeP);
      currentTimeP = timeP;
      currentTimeP.innerHTML = timeElement;
      continue;
    }
    currentTimeP.innerHTML += " " + timeElement;
  }

  recipeServing.innerHTML = "🍽️ " + recipe.yield;

  parentWebsite.src = "/static/images/websites/foodnetwork.png";
  parentWebsiteLink.href = recipe.url;

  //loadRecipeAd(recipe.id);

  /*var image = new Image();
  image.setAttribute("crossorigin", "anonymous");

  //TODO: Catch if image is 404.
  image.src = "/static/images/recipes/" + 1 + ".jpeg";

  fac
    .getColorAsync(image)
    .then((color) => {
      console.log(color);
      //document.querySelector(".recipe-info-container").style.backgroundColor = color.rgb;
    })
    .catch((e) => {
      console.log(e);
    });*/

  recipeInfoContainer.scrollTo(0, 0);
}

function recipeContainerClick(recipe, e) {
  if (e.currentTarget == undefined || e.currentTarget.id != recipe.id) return;
  // DEBUG: e.currentTarget.classList.add("hide");

  showRecipe(recipe, rulesJson);

  const recipeUrl =
    document.location.origin +
    "/recipe/" +
    document.querySelector(".recipe-name").innerHTML +
    "-" +
    recipe.id;

  console.log("View recipe push state?");
  history.pushState(
    { page: "view-recipe", data: [recipe, rulesJson], prevUrl: recipeUrl },
    "",
    recipeUrl
  );
}

function hideRecipeContainer() {
  document.title = "Cooking Library";

  const listContainer = document.querySelector(".list-container");
  const recipeInfoContainer = document.querySelector(".recipe-info-container");
  const recipeInstructions = document.querySelector(".recipe-details .recipe-instructions ol");
  const recipeIngredients = document.querySelector(".recipe-details .recipe-ingredients ul");
  const recipeTimePortion = document.querySelector(".recipe-time-portion");
  const sponsorContainer = document.querySelector(".sponsor-container");
  const parentWebsite = document.querySelector(".parent-website");

  listContainer.style.display = "block";
  recipeInfoContainer.style.display = "none";
  recipeInfoContainer.setAttribute("id", "");
  document.body.style.overflow = "auto";

  recipeInstructions.innerHTML = "";
  recipeIngredients.innerHTML = "";
  recipeTimePortion.innerHTML = "";
  //parentWebsite.src = "";

  sponsorContainer.style.display = "none";
}

window.addEventListener("load", () => {
  const closeRecipe = document.querySelector(".close-recipe-info");
  const copyLink = document.querySelector(".recipe-footer .copy-link");
  const printRecipe = document.querySelector(".recipe-footer .print-recipe");
  const recipeInfoContainer = document.querySelector(".recipe-info-container");

  closeRecipe.addEventListener("click", (e) => {
    history.back();
    hideRecipeContainer();
  });

  copyLink.addEventListener("click", () => {
    const copyLinkA = copyLink.querySelector("a");
    let url =
      document.location.origin +
      "/recipe/" +
      document.querySelector(".recipe-name").innerHTML +
      "-" +
      recipeInfoContainer.id;

    url = encodeURI(url);

    navigator.clipboard.writeText(url);
    console.log("Copied: " + url);
    copyLinkA.innerHTML = "Link Copied!";

    setTimeout(() => {
      copyLinkA.innerHTML = "Copy Link";
    }, 2500);
  });

  printRecipe.addEventListener("click", () => {
    print();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && recipeInfoContainer.style.display === "flex") {
      hideRecipeContainer();
      history.back();
    }
  });

  window.addEventListener("popstate", (e) => {
    if (
      e.state &&
      e.state.page &&
      e.state.page === "ingredients" &&
      getComputedStyle(closeRecipe).display === "none"
    ) {
      // Redirect back to the popstate url that we changed
      // This occurs when we refresh on a recipe page, and we want to go back to the list.
      window.location.replace(document.location.href);
    }
  });
});
