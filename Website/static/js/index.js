// Global variables
const bubbles = [];
//let searchModified = false; // Variable that states if the input changed after we searched for something

/**
 * Rotates coordinate system for velocities
 *
 * Takes velocities and alters them as if the coordinate system they're on was rotated
 *
 * @param  Object | velocity | The velocity of an individual particle
 * @param  Float  | angle    | The angle of collision between two objects in radians
 * @return Object | The altered x and y velocities after the coordinate system has been rotated
 */

function rotate(velocity, angle) {
  const rotatedVelocities = {
    x: velocity.x * Math.cos(angle) - velocity.y * Math.sin(angle),
    y: velocity.x * Math.sin(angle) + velocity.y * Math.cos(angle),
  };

  return rotatedVelocities;
}

/**
 * Swaps out two colliding particles' x and y velocities after running through
 * an elastic collision reaction equation
 *
 * @param  Object | particle      | A particle object with x and y coordinates, plus velocity
 * @param  Object | otherParticle | A particle object with x and y coordinates, plus velocity
 * @return Null | Does not return a value
 */

function resolveCollision(particle, otherParticle) {
  const xVelocityDiff = particle.velocity.x - otherParticle.velocity.x;
  const yVelocityDiff = particle.velocity.y - otherParticle.velocity.y;

  const xDist = otherParticle.x - particle.x;
  const yDist = otherParticle.y - particle.y;

  // Prevent accidental overlap of particles
  if (xVelocityDiff * xDist + yVelocityDiff * yDist >= 0) {
    // Grab angle between the two colliding particles
    const angle = -Math.atan2(otherParticle.y - particle.y, otherParticle.x - particle.x);

    // Store mass in var for better readability in collision equation
    const m1 = particle.mass;
    const m2 = otherParticle.mass;

    // Velocity before equation
    const u1 = rotate(particle.velocity, angle);
    const u2 = rotate(otherParticle.velocity, angle);

    // Velocity after 1d collision equation
    const v1 = {
      x: (u1.x * (m1 - m2)) / (m1 + m2) + (u2.x * 2 * m2) / (m1 + m2),
      y: u1.y,
    };
    const v2 = {
      x: (u2.x * (m1 - m2)) / (m1 + m2) + (u1.x * 2 * m2) / (m1 + m2),
      y: u2.y,
    };

    // Final velocity after rotating axis back to original location
    const vFinal1 = rotate(v1, -angle);
    const vFinal2 = rotate(v2, -angle);

    // Swap particle velocities for realistic bounce effect
    particle.velocity.x = vFinal1.x;
    particle.velocity.y = vFinal1.y;

    otherParticle.velocity.x = vFinal2.x;
    otherParticle.velocity.y = vFinal2.y;
  }
}

function getRandomFloat(min, max, decimals) {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);

  return parseFloat(str);
}

function getArc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.closePath();
}

class Velocity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

class ImageBubble {
  constructor(ctx, name, x, y, sx, sy, sWidth, sHeight) {
    this.ctx = ctx;
    this.name = name;
    this.x = x;
    this.y = y;
    this.sx = sx;
    this.sy = sy;
    this.sWidth = sWidth;
    this.sHeight = sHeight;
    this.loaded = false;
    this.fading_in = true;
    this.width = 112;
    this.height = 112;
    this.opacity = 0;
    this.hovered = false;
    this.selected = false;
    this.radius = 50;
    this.mass = 1;
    // Define a random velocity
    this.velocity = new Velocity(
      0.2 * (Math.round(Math.random()) * 2 - 1),
      0.2 * (Math.round(Math.random()) * 2 - 1)
    );

    this.image = new Image();
    this.image.src = "./static/images/ingredients/" + name + ".jpg";

    this.image.onload = () => this.drawImage();
  }

  setPosition(x, y) {
    // Handle collision detection...
    for (bubble of bubbles) {
      if (bubble === this) continue;

      if (
        Math.pow(Math.abs(bubble.x - this.x), 2) + Math.pow(Math.abs(bubble.y - this.y), 2) <=
        Math.pow(bubble.radius + this.radius, 2)
      ) {
        resolveCollision(this, bubble);
      }
    }
    if (x < 0 || x + this.width > window.innerWidth) {
      this.velocity.x = -this.velocity.x;
    }
    if (y < 0 || y + this.height > window.innerHeight) {
      this.velocity.y = -this.velocity.y;
    }

    // Set position
    this.x = x;
    this.y = y;
    this.drawImage();
  }

  drawImage() {
    this.ctx.save();

    this.ctx.beginPath();
    this.ctx.arc(112 / 2 + this.x, 112 / 2 + this.y, this.radius, 0, 2 * Math.PI);
    this.ctx.clip();

    // Handle mouse hovering animation
    if (this.hovered && this.radius < 55) {
      this.radius += 1;
    } else if (!this.hovered && this.radius > 50) {
      this.radius -= 1;
    }

    // Handle mouse click animation
    if (this.opacity < 0.5 && this.fading_in) {
      this.opacity += 0.005;
    }

    if (this.opacity >= 0.5 && this.fading_in) {
      this.fading_in = false;
      this.opacity = 0.5;
    }

    if (this.opacity < 0.5 && !this.selected && !this.fading_in) {
      this.opacity = 0.5;
    }

    if (this.selected && this.opacity < 1) {
      this.opacity += 0.03;
    } else if (!this.selected && this.opacity > 0.5) {
      this.opacity -= 0.03;
    }

    this.ctx.globalAlpha = this.opacity;

    this.ctx.drawImage(
      this.image,
      this.sx,
      this.sy,
      this.sWidth,
      this.sHeight,
      this.x,
      this.y,
      112,
      112
    );

    this.ctx.restore();

    this.loaded = true;
  }
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
    for (let bubble of bubbles) {
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

function focusTextbox(input) {
  input.focus();
  var val = input.value; //store the value of the element
  input.value = ""; //clear the value of the element
  input.value = val; //set that value back.
}

function searchRecipeByName() {
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");

  searchIcon.innerHTML = "cached";
  searchIcon.classList.add("loading");

  let recipeName = input.value;
  recipeName = recipeName.replaceAll("/", "fw-slash");

  const new_html =
    window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1) +
    "name/" +
    recipeName;

  window.location.href = new_html;
}

function searchRecipeByIngredients() {
  ingredients = [];
  tags = document.getElementsByClassName("tag-item");

  if (tags.length < 1) return;

  console.log("Searching for the following ingredients: [ADD_LATER]");

  const searchIcon = document.querySelector(".input-status i");

  searchIcon.innerHTML = "cached";
  searchIcon.classList.add("loading");

  for (tag of tags) {
    ingredients.push(tag.getElementsByTagName("span")[0].textContent);
  }

  ingredient_list = ingredients.join(", ");
  html_ingredients = ingredient_list.replace(",", "%2C");
  html_ingredients = html_ingredients.replace(" ", "%20");
  html_ingredients = html_ingredients.replace("/", "fw-slash");

  const new_html =
    window.location.href.substring(0, window.location.href.lastIndexOf("/") + 1) +
    "ingredients/" +
    html_ingredients;
  window.location.href = new_html;
}

function updateSearchIcon(input, searchIcon) {
  ingredientsButton = document.querySelector("#ingredients");
  nameButton = document.querySelector("#name");
  tagAmount = document.getElementsByClassName("tag-item").length;

  console.log("Updating search icon: " + nameButton.classList.contains("inactive"));
  if (nameButton.classList.contains("inactive")) {
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

  if (document.querySelector("#name").classList.contains("inactive")) {
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

function setSearchByIngredients() {
  const tagContainer = document.querySelector(".tags-input-container");
  const input = document.querySelector(".tags-input-container input");
  const button = document.querySelector("#ingredients");

  //Add back all saved tags into the text box
  saved_tags = [];

  // Re-select ingredients bubbles and add back saved tags
  for (let bubble of bubbles) {
    if (saved_bubbles.includes(bubble.name)) {
      bubble.selected = true;
    }
  }

  for (let tag of saved_bubbles) {
    createTag(tagContainer, input, tag);
  }

  saved_bubbles = [];
  document.cookie = "button_value=ingredients; expires=max-age";
}

window.addEventListener("pageshow", (e) => {
  if (e.persisted) {
    //document.querySelector("body").style.display = "none";
    //window.location.reload();
  }
});

function updateSearchButtons(clickedButton) {
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");

  document.querySelectorAll("button[type=button]").forEach((button) => {
    if (button.classList.contains("active")) {
      button.classList.remove("active");
      button.classList.add("inactive");
    }
  });

  if (clickedButton.classList.contains("inactive")) {
    clickedButton.classList.remove("inactive");
    clickedButton.classList.add("active");
  }

  document.getElementById("button_value").value = clickedButton.id;

  updateSearchIcon(input, searchIcon);
  //focusTextbox(input); ?? Maybe only enable this on desktop.
  updatePlaceholderText(input);
}

window.addEventListener("load", () => {
  document.querySelector("body").style.display = "block";
  //Interactive element variables
  saved_tags = []; // List of saved tags that we typed in, allows us to hide tags when "By Name" is selected
  saved_bubbles = [];

  // Page element variables
  const tagContainer = document.querySelector(".tags-input-container");
  const input = document.querySelector(".tags-input-container input");
  const searchIcon = document.querySelector(".input-status i");
  const tags = document.getElementsByClassName("tag-item");

  // Initially focus on the textbox
  focusTextbox(input);

  // Update searchIcon depending on whats already in textbox
  updateSearchIcon(input, searchIcon);

  updatePlaceholderText(input);

  //Handle "By Name", "By Ingredient" button interactions...
  document.querySelector("#name").addEventListener("click", (e) => {
    button = e.target;

    //Remove all existing tags from text box, save tags into array saved_tags
    for (tag of tags) {
      saved_tags.push(tag.getElementsByTagName("span")[0].textContent);
    }

    while (tagContainer.children.length > 2) {
      tagContainer.removeChild(tags[0]);
    }

    // Save clicked ingredient bubbles
    saved_bubbles = saved_tags;

    for (bubble of bubbles) {
      if (saved_tags.includes(bubble.name)) {
        console.log("Removing: " + bubble.name);
        bubble.selected = false;
      }
    }

    document.cookie = "button_value=name; expires=max-age";
  });

  document.querySelector("#ingredients").addEventListener("click", (event) => {
    setSearchByIngredients();
  });

  document.addEventListener("click", (event) => {
    if (event.target.type != "button") return;

    updateSearchButtons(event.target);
  });

  // Handle text box interactions
  input.addEventListener("input", (e) => {
    const searchIcon = document.querySelector(".input-status i");
    searchIcon.classList.remove("loading");
    
    updateSearchIcon(input, searchIcon);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key == "Enter") {
      const text = input.value;
      if (document.querySelector(".ingredients").classList.contains("inactive")) {
        searchRecipeByName();
        return;
      }

      if (text == "") {
        searchRecipeByIngredients();
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
    console.log("Icon clicked");

    //TODO: Depending on state of <i>, do different stuff
    if (searchIcon.innerHTML === "search") {
      if (document.querySelector(".ingredients").classList.contains("inactive")) {
        searchRecipeByName();
      } else {
        searchRecipeByIngredients();
      }
    } else if (searchIcon.innerHTML === "add") {
      createTag(tagContainer, input, input.value);

      ingredients = [];

      // Highlight bubbles if needed
      // FIXME: This code appears again, make this a function.
      for (let tag of tags) {
        ingredients.push(tag.getElementsByTagName("span")[0].textContent);
      }

      for (let bubble of bubbles) {
        if (bubble.selected && !ingredients.includes(bubble.name)) {
          console.log("Removing: " + bubble.name);
          bubble.selected = false;
        }

        if (!bubble.selected && ingredients.includes(bubble.name)) {
          bubble.selected = true;
        }
      }

      input.value = "";
      updateSearchIcon(input, searchIcon);
      //searchIcon.innerHTML = "search";
    }

    focusTextbox(input);
  });

  // Handle canvas elements
  this.canvas = document.getElementById("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  window.addEventListener("resize", function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // TODO: Clear rect & re-add images?
    // Only do that when resize has stopped after 0.5s or whatever
  });

  var ctx = canvas.getContext("2d");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const numBubbles = Math.min(canvas.width * canvas.height * (1 / 22500), rnd_ingredients.length);
  for (let i = 0; i < numBubbles; i++) {
    let ingredient = rnd_ingredients[i];
    bubbles.push(
      new ImageBubble(
        ctx,
        ingredient[0],
        getRandomFloat(0, window.innerWidth - 112, 1),
        getRandomFloat(0, window.innerHeight - 112, 1),
        ingredient[1], //cx
        ingredient[2], //cy
        ingredient[3], //cWidth
        ingredient[4] //cHeight
      )
    );
  }

  debug = false;
  if (debug) {
    bubbles.push(
      new ImageBubble(
        ctx,
        "jelly",
        getRandomFloat(0, window.innerWidth - 112, 1),
        getRandomFloat(0, window.innerHeight - 112, 1),
        110, //cx
        85, //cy
        1000, //cWidth
        1000 //cHeight
      )
    );
  }

  let lastTimeUpdate = 0;
  let fps = 0;
  let countedFrames = 0;

  function moveBubbles() {
    //Define fps & move offset
    if (Date.now() - lastTimeUpdate >= 1000) {
      fps = Math.min(countedFrames, 60);
      lastTimeUpdate = Date.now();
      countedFrames = 0;
    }

    moveOffset = Math.max(fps / 60, 0.85);

    // Move bubbles around
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (bubble of bubbles) {
      if (!bubble.loaded) continue;

      bubble.setPosition(
        bubble.x + bubble.velocity.x * moveOffset,
        bubble.y + bubble.velocity.y * moveOffset
      );
    }

    // Update mouse & hover method
    check_hovered();

    // Update frames are re-request frames
    countedFrames++;

    requestAnimationFrame(moveBubbles);
  }

  x = 0;
  y = 0;
  in_dom = false;
  in_bubble = false;

  moveBubbles();

  input.addEventListener("keydown", (e) => {
    if (e.key != "Enter") {
      return;
    }

    ingredients = [];

    for (tag of tags) {
      ingredients.push(tag.getElementsByTagName("span")[0].textContent);
    }

    for (let bubble of bubbles) {
      if (bubble.selected && !ingredients.includes(bubble.name)) {
        console.log("Removing: " + bubble.name);
        bubble.selected = false;
      }

      if (!bubble.selected && ingredients.includes(bubble.name)) {
        bubble.selected = true;
      }
    }
  });

  document.addEventListener("mousemove", (e) => {
    in_dom = false;
    //TODO: Improve this code.
    // Stop bubble interaction on searchbar.

    // The two buttons below search bar
    if (e.target.id == "name" || e.target.id == "ingredients") {
      in_dom = true;
    }

    // The search bar elements
    if (
      e.target.type == "text" ||
      (e.target.classList !== undefined &&
        (e.target.classList.contains("tag-item") ||
          e.target.classList.contains("tags-input-container") ||
          e.target.classList.contains("text") ||
          e.target.classList.contains("material-icons")))
    ) {
      in_dom = true;
    }

    var rect = canvas.getBoundingClientRect();
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;

    //document.body.style.setProperty("--x", x + "px");
    //document.body.style.setProperty("--x", y + "px");
  });

  document.addEventListener("mouseup", (e) => {
    for (let bubble of bubbles) {
      if (bubble.hovered) {
        bubble.selected = !bubble.selected;

        if (bubble.selected) {
          // Switch back to search by ingredients if we click on a bubble
          if (document.querySelector("#ingredients").classList.contains("inactive")) {
            setSearchByIngredients();
            updateSearchButtons(document.querySelector("#ingredients"));
          }

          createTag(tagContainer, input, bubble.name);
          //focusTextbox(input);
        } else {
          removeTag(bubble.name);
        }
      } else {
        console.log("Not hovered");
      }
    }

    if (!(e.target && e.target.classList && e.target.classList.contains("material-icons")))
      // Prevents unclickable icon on mobile
      updateSearchIcon(input, searchIcon);
  });

  function check_hovered() {
    in_bubble = false;

    for (bubble of bubbles) {
      //bubble.getArc();
      bubble.hovered = false;
      ctx.save();
      getArc(ctx, 112 / 2 + bubble.x, 112 / 2 + bubble.y, 50);
      if (ctx.isPointInPath(x, y) && !in_dom) {
        bubble.hovered = true;
        in_bubble = true;
        document.body.style.cursor = "pointer";
      }
      ctx.restore();
    }

    if (!in_bubble) {
      document.body.style.cursor = "auto";
    }
  }

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

