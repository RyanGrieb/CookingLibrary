// Global variables
const bubbles = [];
let loadedRecipesIndex = 40;
let prevScroll = window.scrollY;
let currentSearch = undefined;
let cachedRecipes = {};

function isElementInViewport(el) {
  if (el === undefined) return false;

  var rect = el.getBoundingClientRect();

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight || document.documentElement.clientHeight) /* or $(window).height() */ &&
    rect.right <=
      (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
  );
}

function urlExists(url) {
  //FIXME: Stop printing out errors please.
  var http = new XMLHttpRequest();
  http.open("HEAD", url, false);
  http.send();
  return http.status != 404;
}

function _createTag(tagContainer, input, text) {
  // Check if a tag of the same text exists, if so stop here
  const tagElements = document.querySelectorAll(".tags-input-container .tag-item span");

  for (let tagElement of tagElements) {
    if (tagElement.innerHTML === text) {
      return;
    }
  }

  const div = document.createElement("div");
  div.classList.add("tag-item");
  div.classList.add("unhighlightable");
  const span = document.createElement("span");
  span.classList.add("text");
  span.innerHTML = text;

  const closeButton = document.createElement("i");
  closeButton.classList.add("material-icons");
  closeButton.innerHTML = "close";
  closeButton.addEventListener("click", (e) => {
    removeTag(text);

    // Unselect highlighted bubble if it exists...
    for (bubble of bubbles) {
      if (bubble.name === text) {
        bubble.selected = false;
      }
    }

    //FIXME: Shouldn't have to re-create this variable
    const input = document.querySelector(".tags-input-container input");
    const searchIcon = document.querySelector(".input-status i");

    // Update search icon depending on how many tags are left
    updateSearchIcon(input, searchIcon);
  });

  div.appendChild(span);
  div.appendChild(closeButton);

  tagContainer.insertBefore(div, input);
}

function createTag(tagContainer, input, text) {
  text = text.toLowerCase().trim();

  if (text.includes(",")) {
    textElements = text.split(",");
    textElements = textElements.map((element) => {
      return element.trim();
    });

    for (i in textElements) {
      _createTag(tagContainer, input, textElements[i]);
    }

    updatePlaceholderText(input);
    return;
  }

  if (text.length < 1) return;

  _createTag(tagContainer, input, text);

  updatePlaceholderText(input);
}

function removeTag(text) {
  const tagContainer = document.querySelector(".tags-input-container");
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");

  tags = document.getElementsByClassName("tag-item");
  for (tag of tags) {
    tagName = tag.getElementsByTagName("span")[0].textContent;
    if (tagName === text) {
      tagContainer.removeChild(tag);
    }
  }

  searchIcon.classList.remove("loading");

  focusTextbox(input);
  updatePlaceholderText(input);
}

function createTagsFromUrl() {
  const tagContainer = document.querySelector(".tags-input-container");
  const input = document.querySelector(".tags-input-container input");

  const ingredients = getIngredientsFromUrl();

  for (i in ingredients) {
    createTag(tagContainer, input, ingredients[i]);
  }
}

function focusTextbox(input) {
  input.focus();
  var val = input.value; //store the value of the element
  input.value = ""; //clear the value of the element
  input.value = val; //set that value back.
}

function getIngredientsFromUrl() {
  let ingredients = window.location.href.substring(window.location.href.lastIndexOf("/") + 1);
  ingredients = decodeURIComponent(ingredients);
  ingredients = ingredients.replaceAll("fw-slash", "/");
  ingredients = ingredients.split(",");
  ingredients = ingredients.map((element) => {
    return element.trim();
  });

  return ingredients;
}

function getRecipeNameFromURL() {
  let recipeName = window.location.href.substring(window.location.href.lastIndexOf("/") + 1);
  recipeName = recipeName.replaceAll("%2C", ",");
  recipeName = recipeName.replaceAll("%20", " ");
  recipeName = recipeName.replaceAll("fw-slash", "/");

  return recipeName;
}

function cacheRecipes(key) {
  const recipeContainers = document.querySelectorAll(".all-recipes a");

  console.log("Caching: " + key);
  cachedRecipes[key] = recipeContainers;
}

function restorePrevCachedRecipes(key) {
  const allRecipesContainer = document.querySelector(".all-recipes");
  let recipeContainers = cachedRecipes[key];

  if (!recipeContainers) {
    return false;
  }

  console.log("Restoring: " + key);

  for (let recipeContainer of recipeContainers) {
    allRecipesContainer.appendChild(recipeContainer);
  }

  return true;
}

function searchRecipeByName(pushState) {
  const allRecipesContainer = document.querySelector(".all-recipes");
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");

  searchIcon.innerHTML = "cached";
  searchIcon.classList.add("loading");
  input.blur();

  const new_url =
    window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1) + input.value;

  const ingredientLimit = getCookie("ingredient-limit") === "" ? -1 : getCookie("ingredient-limit");

  currentSearch = input.value;

  if (pushState) {
    history.pushState({ page: "name", data: [] }, "", new_url);
  }

  fetch("/fetchSortedRecipeIdsFromName", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.value,
      sortOrder: getCookie("sort-order"),
      sortBy: getCookie("sort-by"),
      ingredientLimit: ingredientLimit,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data["recipe_ids"].length < 1) {
        console.log("No recipes found");
        searchIcon.classList.remove("loading");
        updateSearchIcon(input, searchIcon);
      }

      if (JSON.stringify(currentSearch) !== JSON.stringify(data["name"])) {
        return;
      }

      allRecipesContainer.setAttribute(
        "unsorted-recipe-ids",
        "[" + data["unsorted_recipe_ids"] + "]"
      );

      allRecipesContainer.setAttribute("recipe-ids", "[" + data["recipe_ids"] + "]");

      console.log("Reset: 1");
      allRecipesContainer.innerHTML = "";
      loadedRecipesIndex = 40;
      loadRecipes(0, loadedRecipesIndex);
    });
}

// Returns ingredients in searchbar
function getEnteredIngredients() {
  ingredients = [];
  tags = document.getElementsByClassName("tag-item");

  if (tags.length < 1) return;

  for (tag of tags) {
    ingredients.push(tag.getElementsByTagName("span")[0].textContent);
  }

  return ingredients;
}

function searchRecipeByIngredients(pushState) {
  const ingredients = getEnteredIngredients();
  const currentSearch = getEnteredIngredients();

  cacheRecipes(JSON.stringify(getIngredientsFromUrl()));

  const allRecipesContainer = document.querySelector(".all-recipes");
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");
  searchIcon.innerHTML = "cached";
  searchIcon.classList.add("loading");
  input.blur();

  ingredient_list = ingredients.join(", ");
  html_ingredients = ingredient_list.replaceAll(",", "%2C");
  html_ingredients = html_ingredients.replaceAll(" ", "%20");
  html_ingredients = html_ingredients.replaceAll("/", "fw-slash");

  const new_url =
    window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1) + html_ingredients;

  const ingredientLimit = getCookie("ingredient-limit") === "" ? -1 : getCookie("ingredient-limit");

  if (pushState) {
    history.pushState({ page: "ingredients", data: [] }, "", new_url);
  }

  console.log("send: fetchSortedRecipeIdsFromIngredients:");

  fetch("/fetchSortedRecipeIdsFromIngredients", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ingredients: getEnteredIngredients(),
      sortOrder: getCookie("sort-order"),
      sortBy: getCookie("sort-by"),
      ingredientLimit: ingredientLimit,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data["recipe_ids"].length < 1) {
        console.log("No recipes found");
        searchIcon.classList.remove("loading");
        updateSearchIcon(input, searchIcon);
      }

      if (JSON.stringify(currentSearch) !== JSON.stringify(data["ingredients"])) {
        return;
      }

      allRecipesContainer.setAttribute(
        "unsorted-recipe-ids",
        "[" + data["unsorted_recipe_ids"] + "]"
      );
      allRecipesContainer.setAttribute("recipe-ids", "[" + data["recipe_ids"] + "]");

      console.log("Reset: 1");
      allRecipesContainer.innerHTML = "";
      loadedRecipesIndex = 40;
      loadRecipes(0, loadedRecipesIndex);
    });
}

function updateSearchIcon(input, searchIcon) {
  ingredientsButton = document.querySelector("#ingredients");
  const ingredientsPage = window.location.href.includes("ingredients");
  tagAmount = document.getElementsByClassName("tag-item").length;

  if (ingredientsPage) {
    // Handle icon when we have ingredients selected
    if (input.value.length > 0) {
      // There is text present
      searchIcon.innerHTML = "add";
    } else if (tagAmount > 0) {
      // There are only tags present
      searchIcon.innerHTML = "search";
    } else {
      searchIcon.innerHTML = "0";
    }
  } else {
    // Handle icon when we have name selected
    if (input.value.length > 0) {
      searchIcon.innerHTML = "search";
    } else {
      searchIcon.innerHTML = "0";
    }
  }
}

function updatePlaceholderText(input) {
  const tags = document.getElementsByClassName("tag-item");
  const ingredientsPage = window.location.href.includes("ingredients");

  if (ingredientsPage) {
    if (input.textContent.length < 1 && tags.length < 1) {
      input.setAttribute("placeholder", "Type an ingredient here...");
    } else {
      input.removeAttribute("placeholder");
    }
  } else {
    if (input.textContent.length < 1 && tags.length < 1) {
      input.setAttribute("placeholder", "Type a recipe here...");
    } else {
      input.removeAttribute("placeholder");
    }
  }
}

function resizeLastRecipeContainers() {
  const allRecipesContainer = document.querySelector(".all-recipes");

  for (let i = allRecipesContainer.children.length - 1; i >= 0; i--) {
    allRecipesContainer.children[i].style.maxWidth = "none";
  }

  for (let i = allRecipesContainer.children.length - 1; i >= 0; i--) {
    // FIXME: Skip if this is the first row
    if (allRecipesContainer.children[i].offsetWidth != allRecipesContainer.firstChild.offsetWidth) {
      // Note, 10 accounts for our margins
      allRecipesContainer.children[i].style.maxWidth =
        allRecipesContainer.firstChild.clientWidth - 10 + "px";
    }
  }
}

function loadRecipes(start, end) {
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");
  const allRecipesContainer = document.querySelector(".all-recipes");
  const recipeIds = JSON.parse(allRecipesContainer.getAttribute("recipe-ids"));
  const toLoadIds = recipeIds.slice(start, end);
  if (toLoadIds.length < 1) return;

  let maintainOrder = false;
  // Set maintainOrder to true if we have any filters enabled
  document.querySelectorAll(".sort-options i").forEach((sortIElement) => {
    if (sortIElement.id != "no-sort") {
      maintainOrder = true;
    }
  });

  fetch("/fetchRecipeObjects", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ids: toLoadIds,
      maintainOrder: maintainOrder,
      ingredients: getEnteredIngredients(),
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      for (let recipe of data.recipes) {
        const recipeContainer = document.createElement("a");
        recipeContainer.classList.add("recipe-container");
        recipeContainer.setAttribute("id", recipe.id);

        // TODO: Get the true ingredients length, and remove recipes that violate that client-side.
        // (We can't detect subheaders server-sides)

        // Use IIFE to create new scope for recipe variable & it's listener
        ((recipe) => {
          recipeContainer.addEventListener("click", (e) => recipeContainerClick(recipe, e));

          recipeContainer.addEventListener("mouseenter", (e) =>
            recipeContainerMouseEnter(recipe, e)
          );
          recipeContainer.addEventListener("mouseleave", (e) =>
            recipeContainerMouseLeave(recipe, e)
          );
        })(recipe);

        const recipeInformation = document.createElement("div");
        recipeInformation.classList.add("information");

        const recipeUl = document.createElement("ul");
        const titleLi = document.createElement("li");
        const titleP = document.createElement("p");
        titleP.classList.add("title");
        titleP.innerHTML = recipe.name;

        const ratingCountLi = document.createElement("li");
        const ratingCountP = document.createElement("p");
        ratingCountP.classList.add("rating-count");
        ratingCountP.innerHTML =
          recipe.rating_count + (recipe.rating_count > 1 ? " Reviews" : " Review");

        const ratingLi = document.createElement("li");
        const ratingContainer = document.createElement("div");
        ratingContainer.classList.add("rating-container");
        //TODO: Handle this better?
        for (let i = 0; i < 5; i++) {
          const starI = document.createElement("i");
          starI.classList.add("material-icons");
          starI.classList.add("star");
          starI.setAttribute("value", recipe.rating_external - i);
          starI.innerHTML = "star";
          ratingContainer.appendChild(starI);
        }

        const recipeImage = document.createElement("img");
        recipeImage.classList.add("recipe-image");
        recipeImage.classList.add("no_select");

        /*if (!urlExists("/static/images/recipes/" + recipe.id + ".jpeg")) {
          recipeImage.setAttribute("src", recipe.image_url);
        } else {
          recipeImage.setAttribute("src", "/static/images/recipes/" + recipe.id + ".jpeg");
          console.log("Found local image for: " + recipe.id);
        }*/

        // Dev
        recipeImage.setAttribute("src", recipe.image_url);

        // Prod
        //recipeImage.setAttribute("src", "/static/images/recipes/" + recipe.id + ".jpeg");

        ratingLi.append(ratingContainer);
        titleLi.appendChild(titleP);
        ratingCountLi.appendChild(ratingCountP);
        recipeUl.appendChild(titleLi);
        recipeUl.appendChild(ratingCountLi);
        recipeUl.appendChild(ratingLi);
        recipeInformation.appendChild(recipeUl);
        recipeContainer.appendChild(recipeInformation);

        recipeContainer.appendChild(recipeImage);

        // Add recipe to container if it meets our ingredient limit
        const ingredientLimitValue = document
          .querySelector(".ingredients-slider-value")
          .getAttribute("value");
        const ingredientLimit = parseInt(ingredientLimitValue === "∞" ? 999 : ingredientLimitValue);
        if (recipe.ingredients.length <= ingredientLimit) {
          allRecipesContainer.appendChild(recipeContainer);
        }
      }

      const recipeContainerAmt = document.querySelector(".all-recipes").children.length;
      const lastRecipeContainer =
        document.querySelector(".all-recipes").children[parseInt(recipeContainerAmt * 0.5)];

      //if (document.documentElement.scrollHeight <= document.documentElement.clientHeight) { // OLD IF
      if (isElementInViewport(lastRecipeContainer)) {
        loadRecipes(end + 1, end + 40);
        console.log("Info: Not enough initial recipes loaded, fetching more.");
        loadedRecipesIndex += 40;
      }

      searchIcon.classList.remove("loading");
      updateSearchIcon(input, searchIcon);
    });
}

window.addEventListener("resize", () => {
  //resizeLastRecipeContainers();
});

window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    //document.querySelector("body").style.display = "none";
    //window.location.reload();
  }
});

window.addEventListener("load", () => {
  document.querySelector("body").style.display = "block";

  // Page element variables
  const allRecipesContainer = document.querySelector(".all-recipes");
  const tagContainer = document.querySelector(".tags-input-container");
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");
  const tags = document.getElementsByClassName("tag-item");
  const ingredientsPage = window.location.href.includes("ingredients"); //FIXME: Do a better check on this.
  const scrollUpContainer = document.querySelector(".scroll-up-container");

  //FIXME: Pre-load this so we don't see a flicker..
  if (ingredientsPage) {
    createTagsFromUrl();
  } else {
    input.value = getRecipeNameFromURL();
  }

  // Initially focus on the textbox
  focusTextbox(input);
  // Update searchIcon depending on whats already in textbox
  updateSearchIcon(input, searchIcon);
  updatePlaceholderText(input);

  // If we have no scrollbar available, or we are 75% to the end of the page, call this function
  loadRecipes(0, loadedRecipesIndex);

  // Loop loadRecipes() until loadIds in loadRecipes() is < 1 or the last grid element isn't visible on screen.

  window.addEventListener("scroll", (e) => {
    const totalHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const currentScrollPosition = window.scrollY;
    const percentageScrolled = (currentScrollPosition / (totalHeight - viewportHeight)) * 100;

    // Get a recipe-container that is 75% towards the bottom
    const recipeContainerAmt = document.querySelector(".all-recipes").children.length;
    const lastRecipeContainer =
      document.querySelector(".all-recipes").children[parseInt(recipeContainerAmt * 0.5)];

    const searchContainer = document.querySelector(".search-container");

    if (isElementInViewport(lastRecipeContainer)) {
      loadRecipes(loadedRecipesIndex + 1, loadedRecipesIndex + 20);
      loadedRecipesIndex += 20;
    }

    if (currentScrollPosition >= 80) {
      if (prevScroll > window.scrollY) {
        scrollUpContainer.style.visibility = "visible";
        scrollUpContainer.style.opacity = "1";
      } else {
        scrollUpContainer.style.visibility = "hidden";
        scrollUpContainer.style.opacity = "0";
      }
    } else {
      scrollUpContainer.style.visibility = "hidden";
      scrollUpContainer.style.opacity = "0";
    }

    prevScroll = window.scrollY;
  });

  // Handle text box interactions
  input.addEventListener("input", (e) => {
    const searchIcon = document.querySelector(".input-status i");
    searchIcon.classList.remove("loading");
    
    updateSearchIcon(input, searchIcon);
  });

  input.addEventListener("keydown", (e) => {
    const ingredientsPage = window.location.href.includes("ingredients");

    if (e.key == "Enter") {
      const text = input.value;
      if (!ingredientsPage) {
        searchRecipeByName(true);
        return;
      }

      if (text == "") {
        searchRecipeByIngredients(true);
        return;
      }

      createTag(tagContainer, input, text);
      input.value = "";

      updateSearchIcon(input, searchIcon);
    }
    if (e.key == "Backspace") {
      // TODO: Make it so the user has to press backspace twice.
      console.log("Deleting last tag element");
    }
  });

  // Handle text box search,add,and load element
  searchIcon.addEventListener("click", (e) => {
    //TODO: Depending on state of <i>, do different stuff
    if (searchIcon.innerHTML === "search") {
      if (!ingredientsPage) {
        searchRecipeByName(true);
      } else {
        searchRecipeByIngredients(true);
      }
    } else if (searchIcon.innerHTML === "add") {
      createTag(tagContainer, input, input.value);
      input.value = "";
      searchIcon.innerHTML = "search";
    }

    //focusTextbox(input);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key != "Enter") {
      return;
    }

    ingredients = [];

    for (tag of tags) {
      ingredients.push(tag.getElementsByTagName("span")[0].textContent);
    }
  });

  tagContainer.addEventListener("mouseup", (e) => {
    // <input> space is limited on mobile, so we check the whole container for a mousepress.
    if (e.target === tagContainer) {
      focusTextbox(input);
    }
  });

  scrollUpContainer.addEventListener("click", () => {
    if (scrollUpContainer.style.opacity === "1") {
      document.body.scrollTop = document.documentElement.scrollTop = 0;
    }
  });

  window.addEventListener("popstate", (e) => {
    if (e.state && e.state.page === "view-recipe") {
      // Go-forward and show recipe
      showRecipe(e.state.data[0], e.state.data[1]);
      return;
    } else if (viewingRecipe) {
      const closeRecipe = document.querySelector(".close-recipe-info");

      if (getComputedStyle(closeRecipe).display === "none") {
        // Redirect back to the popstate url that we changed
        // This occurs when we refresh on a recipe page, and we want to go back to the list.
        console.log("recipe refresh back");
        window.location.replace(document.location.href);
      } else {
        console.log("hide recipe container");
        hideRecipeContainer();
      }
    }

    if (!viewingRecipe) {
      const tagContainer = document.querySelector(".tags-input-container");

      console.log("Reset: 2");

      if (ingredientsPage) {
        cacheRecipes(JSON.stringify(getEnteredIngredients()));
        allRecipesContainer.innerHTML = "";

        // Modify tags to display what is in our old url
        tagContainer.querySelectorAll(".tag-item").forEach((e) => e.remove());
        createTagsFromUrl();

        const success = restorePrevCachedRecipes(JSON.stringify(getEnteredIngredients()));
        if (!success) {
          searchRecipeByIngredients(false);
        }
      }
      if (!ingredientsPage) {
        allRecipesContainer.innerHTML = "";

        // Update searchbar to previous text
        const name = window.location.href.substring(window.location.href.lastIndexOf("/") + 1);
        input.value = name;

        searchRecipeByName(false);
      }
    }

    if (viewingRecipe) viewingRecipe = false;
  });

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === "childList") {
        if (searchIcon.innerHTML == "0") {
          searchIcon.style.cursor = "auto";
        } else {
          searchIcon.style.cursor = "pointer";
        }
      }
    });
  });

  observer.observe(searchIcon, { attributes: true, childList: true, subtree: true });

  //TODO: Remove redundant if statement also called above
  if (searchIcon.innerHTML == "0") {
    searchIcon.style.cursor = "auto";
  } else {
    searchIcon.style.cursor = "pointer";
  }
});
