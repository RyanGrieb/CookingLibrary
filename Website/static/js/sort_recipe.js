function isTouchDevice() {
  return "ontouchstart" in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function resetOtherIcons(sortIElement) {
  document.querySelectorAll(".sort-options i").forEach((otherSortIElement) => {
    if (otherSortIElement !== sortIElement) {
      otherSortIElement.innerHTML = "height";
      otherSortIElement.id = "no-sort";
    }
  });
}

function sortRecipes(options) {
  const allRecipesContainer = document.querySelector(".all-recipes");

  fetch("/sortRecipeIds", {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  })
    .then((response) => response.json())
    .then((data) => {
      //Reload all recipes now that we regenerated a sorted list of recipe ids
      allRecipesContainer.setAttribute("recipe-ids", "[" + data + "]");
      allRecipesContainer.innerHTML = "";
      loadedRecipesIndex = 40;
      loadRecipes(0, loadedRecipesIndex);
    });
}

function updateIngredientLimit() {
  cachedRecipes = {}; // Reset cached recipes since we updated our filter

  const ingredientsSliderText = document.querySelector(".ingredients-slider-value");
  const allRecipesContainer = document.querySelector(".all-recipes");

  const ingredientLimit =
    ingredientsSliderText.getAttribute("value") === "∞"
      ? -1
      : parseInt(ingredientsSliderText.getAttribute("value"));

  document.cookie = "ingredient-limit=" + ingredientLimit + "; expires=max-age; path=/";
  console.log("ingredient-limit=" + ingredientLimit + "; expires=max-age; path=/");

  sortRecipes({
    ids: JSON.parse(allRecipesContainer.getAttribute("unsorted-recipe-ids")),
    sortOrder: getCookie("sort-order"),
    sortBy: getCookie("sort-by"),
    ingredientLimit: ingredientLimit,
  });
}

window.addEventListener("load", () => {
  const sortIcon = document.querySelector(".sort-icon");
  const sortView = document.querySelector(".sort-view");
  const sortContainer = document.querySelector(".sort-container");
  const closeSortContainer = document.querySelector(".close-sort-container");
  const allRecipesContainer = document.querySelector(".all-recipes");
  const ingredientsSlider = document.querySelector(".ingredients-slider");
  const ingredientsSliderText = document.querySelector(".ingredients-slider-value");

  const cachedSortIcon = document.querySelector("." + sortBy + " i");

  // Cache our default sort values into cookies
  if (getCookie("sort-order") === "") {
    document.cookie = "sort-order=sort-up; expires=max-age; path=/";
  }

  if (getCookie("sort-by") === "") {
    document.cookie = "sort-by=by-rating; expires=max-age; path=/";
  }

  if (cachedSortIcon != undefined) {
    switch (orderBy) {
      case "sort-up":
        cachedSortIcon.style.transform = "scale(1.5)";
        cachedSortIcon.innerHTML = "straight";
        cachedSortIcon.id = "sort-up";
        break;
      case "sort-down":
        cachedSortIcon.style.transform = "rotate(180deg) scale(1.5)";
        cachedSortIcon.innerHTML = "straight";
        cachedSortIcon.id = "sort-down";
        break;
      case "no-sort":
        cachedSortIcon.style.transform = "scale(1.5)";
        cachedSortIcon.innerHTML = "height";
        cachedSortIcon.id = "no-sort";
    }
  }

  if (ingredientLimit == -1) {
    ingredientLimit = "∞";
    ingredientsSlider.value = 51;
  } else {
    ingredientsSlider.value = ingredientLimit;
  }

  ingredientsSliderText.innerHTML = "#️⃣  Number of Ingredients: " + ingredientLimit;
  ingredientsSliderText.setAttribute("value", ingredientLimit);

  sortIcon.addEventListener("click", (e) => {
    console.log("Open sort window");

    if (sortView.style.display == "flex") {
      //sortView.style.display = "none";
      sortView.classList.add("hide");
      //sortView.style.visibility = "hidden"
      document.body.style.overflow = "visible";
      return;
    }

    //sortView.style.display = "flex";
    sortView.classList.remove("hide");
    // sortView.style.visibility = "visible"

    if (window.innerWidth <= 700) {
      document.body.style.overflow = "hidden";
    }
  });

  closeSortContainer.addEventListener("click", (e) => {
    //sortView.style.display = "none";
    sortView.classList.add("hide");
    //sortView.style.visibility = "hidden"
    document.body.style.overflow = "visible";
  });

  ingredientsSlider.oninput = () => {
    let value = ingredientsSlider.value;
    if (ingredientsSlider.value > 50) {
      value = "∞";
    }
    ingredientsSliderText.setAttribute("value", value);
    ingredientsSliderText.innerHTML = "#️⃣  Number of Ingredients: " + value;
  };

  if (isTouchDevice()) {
    ingredientsSlider.addEventListener("touchend", updateIngredientLimit);
  } else {
    ingredientsSlider.addEventListener("click", updateIngredientLimit);
  }

  document.querySelectorAll(".sort-options i").forEach((sortIElement) => {
    sortIElement.addEventListener("click", (e) => {
      cachedRecipes = {}; // Reset cached recipes since we updated our filter

      // Change <i> icon depending on the current icon
      //sortIElement.innerHTML = "straight";

      styleDict = {
        "no-sort": () => {
          sortIElement.innerHTML = "straight";
          sortIElement.id = "sort-up";
          resetOtherIcons(sortIElement);
        },
        "sort-up": () => {
          sortIElement.style.transform = "rotate(180deg) scale(1.5)";
          sortIElement.innerHTML = "straight";
          sortIElement.id = "sort-down";
          resetOtherIcons(sortIElement);
        },
        "sort-down": () => {
          sortIElement.style.transform = "scale(1.5)";
          sortIElement.innerHTML = "height";
          sortIElement.id = "no-sort";
        },
      };

      styleDict[sortIElement.id]();

      console.log("Sort Order: " + sortIElement.id);
      console.log("Sort By: " + sortIElement.parentElement.className);

      document.cookie =
        "sort-by=" + sortIElement.parentElement.className + "; expires=max-age; path=/";
      document.cookie = "sort-order=" + sortIElement.id + "; expires=max-age; path=/";

      // POST to get sorted list of recipe IDs, replace old ids in allRecipesContainer
      const ingredientLimit =
        ingredientsSliderText.getAttribute("value") === "∞"
          ? -1
          : parseInt(ingredientsSliderText.getAttribute("value"));

      sortRecipes({
        ids: JSON.parse(allRecipesContainer.getAttribute("unsorted-recipe-ids")),
        sortOrder: sortIElement.id,
        sortBy: sortIElement.parentElement.className,
        ingredientLimit: ingredientLimit,
      });
    });
  });
});
