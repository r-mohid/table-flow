document.addEventListener("DOMContentLoaded", async () => {
  let stockLevels = {};
  let menuItems = {};
  const ingredients = [];

  const container = document.getElementById("ingredientsContainer");
  const addIngredientBtn = document.getElementById("addIngredientBtn");
  const stockList = document.getElementById("stockList");
  const nameInput = document.getElementById("ingredientName");
  const errorText = document.getElementById("ingredientError");

  async function loadInitialData() {
    try {
      const [ingredientsRes, menuItemsRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/menu-items"),
      ]);
      const ingredientsData = await ingredientsRes.json();
      const menuItemsData = await menuItemsRes.json();
      Object.keys(stockLevels).forEach((key) => delete stockLevels[key]);
      ingredients.length = 0;
      Object.keys(menuItems).forEach((key) => delete menuItems[key]);
      if (
        ingredientsData.ingredients &&
        Array.isArray(ingredientsData.ingredients)
      ) {
        ingredientsData.ingredients.forEach((i) => {
          stockLevels[i.name.toLowerCase()] = i.quantity;
          ingredients.push(i.name.charAt(0).toUpperCase() + i.name.slice(1));
        });
      } else {
        console.error("Ingredients format unexpected:", ingredientsData);
      }
      if (menuItemsData.menuItems && Array.isArray(menuItemsData.menuItems)) {
        menuItemsData.menuItems.forEach((m) => {
          menuItems[m.name] = {
            description: m.description,
            price: m.price,
            ingredients: m.ingredients,
          };
        });
      } else {
        console.error("Menu Items format unexpected:", menuItemsData);
      }
      renderStockList();
      renderMenuDropdown();
    } catch (err) {
      console.error("Failed to load initial data:", err);
    }
  }

  await loadInitialData();
  function renderStockList() {
    stockList.innerHTML = "";
    Object.entries(stockLevels).forEach(([ingredient, qty]) => {
      const row = document.createElement("div");
      row.classList.add("row", "align-items-center", "mb-3");
      row.innerHTML = `
        <div class="col-4 text-capitalize">${ingredient}</div>
        <div class="col-2 text-center">
          <button class="btn btn-light btn-sm increase-btn" data-ingredient="${ingredient}">↑</button>
        </div>
        <div class="col-2 text-center">
          <span id="${ingredient}Qty">${qty}</span>
        </div>
        <div class="col-2 text-center">
          <button class="btn btn-light btn-sm decrease-btn" data-ingredient="${ingredient}">↓</button>
        </div>
        <div class="col-2 text-end">
          <button class="btn btn-sm btn-danger delete-ingredient-btn" data-ingredient="${ingredient}">🗑️</button>
        </div>
      `;
      stockList.appendChild(row);
    });
  }

  function renderMenuDropdown() {
    const menuSelect = document.getElementById("menuItemSelect");
    menuSelect.innerHTML = `<option selected disabled>Choose an item...</option>`;

    Object.keys(menuItems).forEach((itemName) => {
      const option = document.createElement("option");
      option.value = itemName;
      option.textContent = itemName;
      menuSelect.appendChild(option);
    });
  }

  nameInput.addEventListener("input", () => {
    const name = nameInput.value.trim().toLowerCase();
    if (stockLevels[name] !== undefined) {
      nameInput.classList.add("is-invalid");
      errorText.classList.remove("d-none");
    } else {
      nameInput.classList.remove("is-invalid");
      errorText.classList.add("d-none");
    }
  });

  stockList.addEventListener("click", async function (e) {
    const btn = e.target;
    const ingredient = btn.dataset.ingredient;
    if (!ingredient) return;
    if (btn.classList.contains("increase-btn")) {
      stockLevels[ingredient]++;
    } else if (btn.classList.contains("decrease-btn")) {
      stockLevels[ingredient] = Math.max(0, stockLevels[ingredient] - 1);
    } else if (btn.classList.contains("delete-ingredient-btn")) {
      const confirmed = confirm(`Delete ingredient "${ingredient}"?`);
      if (!confirmed) return;
      try {
        const res = await fetch("/api/ingredients", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: ingredient }),
        });
        const data = await res.json();
        if (data.success) {
          delete stockLevels[ingredient];
          renderStockList();
        } else {
          alert("Failed to delete ingredient.");
        }
      } catch (err) {
        console.error("Delete failed", err);
        alert("Error deleting ingredient.");
      }
      return;
    }
    try {
      await fetch("/api/ingredients/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ingredient,
          quantity: stockLevels[ingredient],
        }),
      });
      document.getElementById(`${ingredient}Qty`).textContent =
        stockLevels[ingredient];
    } catch (err) {
      console.error("Failed to update stock", err);
    }
  });

  addIngredientBtn.addEventListener("click", () => {
    const selectedIngredients = Array.from(
      container.querySelectorAll('select[name="ingredient"]')
    ).map((s) => s.value);
    const availableIngredients = ingredients.filter(
      (i) => !selectedIngredients.includes(i.toLowerCase())
    );
    if (availableIngredients.length === 0) {
      alert("All ingredients have been added.");
      return;
    }
    const row = document.createElement("div");
    row.classList.add("row", "align-items-center", "mb-2");
    row.innerHTML = `
      <div class="col-6">
        <select class="form-select" name="ingredient">
          <option disabled selected>Select ingredient</option>
          ${availableIngredients
            .map((i) => `<option value="${i.toLowerCase()}">${i}</option>`)
            .join("")}
        </select>
      </div>
      <div class="col-4">
        <input type="number" name="quantity" class="form-control" min="0" placeholder="Qty">
      </div>
      <div class="col-2 text-end">
        <button type="button" class="btn btn-sm btn-danger remove-ingredient">×</button>
      </div>
    `;
    container.appendChild(row);

    row.querySelector(".remove-ingredient").addEventListener("click", () => {
      row.remove();
    });
  });

  document
    .getElementById("newIngredientForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const name = nameInput.value.trim().toLowerCase();
      const qty = parseInt(document.getElementById("initialQty").value);
      if (!name || isNaN(qty)) return;
      try {
        const res = await fetch("/api/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, quantity: qty }),
        });
        const data = await res.json();
        if (data.success) {
          stockLevels[name] = qty;
          ingredients.push(name.charAt(0).toUpperCase() + name.slice(1));
          renderStockList();
          const modal = bootstrap.Modal.getInstance(
            document.getElementById("createIngredientModal")
          );
          modal.hide();
          this.reset();
        } else {
          alert("Failed to add ingredient.");
        }
      } catch (err) {
        console.error("Error adding ingredient", err);
      }
    });

  document
    .getElementById("newMenuItemForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();
      const name = document.getElementById("menuItemName").value.trim();
      const description = document
        .getElementById("menuItemDescription")
        .value.trim();
      const price = parseFloat(document.getElementById("menuItemPrice").value);
      const ingredientsList = [];
      container.querySelectorAll(".row").forEach((row) => {
        const ingredient = row.querySelector("select").value;
        const quantity = parseFloat(row.querySelector("input").value);
        if (ingredient && !isNaN(quantity)) {
          ingredientsList.push({ ingredient, quantity });
        }
      });
      if (!name || isNaN(price)) return;
      try {
        const res = await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            price,
            ingredients: ingredientsList,
          }),
        });
        const data = await res.json();
        if (data.success) {
          menuItems[name] = {
            description,
            price,
            ingredients: ingredientsList,
          };
          renderMenuDropdown();
          container.innerHTML = "";
          this.reset();
          const modal = bootstrap.Modal.getInstance(
            document.getElementById("createMenuItemModal")
          );
          modal.hide();
        } else {
          alert("Failed to create menu item.");
        }
      } catch (err) {
        console.error("Error creating menu item", err);
      }
    });

  document
    .getElementById("menuItemSelect")
    .addEventListener("change", function () {
      const selected = this.value;
      const selectedItem = menuItems[selected];
      const ingredientList = document.getElementById("ingredientList");
      if (!selectedItem) return;
      ingredientList.innerHTML = "";
      selectedItem.ingredients.forEach(({ ingredient, quantity }) => {
        const row = document.createElement("div");
        row.classList.add("row", "align-items-center", "mb-3");
        row.innerHTML = `
        <div class="col-4">${
          ingredient.charAt(0).toUpperCase() + ingredient.slice(1)
        }</div>
        <div class="col-8">
          <input 
            type="number" 
            class="form-control ingredient-input" 
            data-ingredient="${ingredient}" 
            min="0" 
            value="${quantity}" 
          />
        </div>
      `;
        ingredientList.appendChild(row);
      });
    });

  document
    .getElementById("saveChangesBtn")
    .addEventListener("click", async function () {
      const selectedMenuItem = document.getElementById("menuItemSelect").value;
      if (!selectedMenuItem || !menuItems[selectedMenuItem]) {
        alert("Please select a menu item first.");
        return;
      }
      const updatedIngredients = [];
      document
        .querySelectorAll("#ingredientList .ingredient-input")
        .forEach((input) => {
          const ingredientName = input.dataset.ingredient;
          const quantity = parseFloat(input.value);
          if (ingredientName && !isNaN(quantity)) {
            updatedIngredients.push({ ingredient: ingredientName, quantity });
          }
        });
      document
        .querySelectorAll("#ingredientList .new-ingredient-select")
        .forEach((select) => {
          const ingredient = select.value;
          const quantityInput = select
            .closest(".row")
            .querySelector(".new-ingredient-qty");
          const quantity = parseFloat(quantityInput.value);
          if (ingredient && !isNaN(quantity)) {
            updatedIngredients.push({ ingredient, quantity });
          }
        });
      try {
        const response = await fetch(
          `/api/menu-items/${encodeURIComponent(selectedMenuItem)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ingredients: updatedIngredients,
            }),
          }
        );
        const data = await response.json();
        if (data.success) {
          alert("✅ Menu item updated successfully!");
          menuItems[selectedMenuItem].ingredients = updatedIngredients;
        } else {
          alert("Failed to update menu item.");
        }
      } catch (err) {
        console.error("Failed to update:", err);
        alert("Something went wrong updating the menu item.");
      }
    });

  document
    .getElementById("editAddIngredientBtn")
    .addEventListener("click", () => {
      const menuName = document.getElementById("menuItemSelect").value;
      if (!menuName || !menuItems[menuName]) return;
      const selectedIngredients = menuItems[menuName].ingredients.map(
        (i) => i.ingredient
      );
      const availableIngredients = ingredients.filter(
        (i) => !selectedIngredients.includes(i.toLowerCase())
      );
      if (availableIngredients.length === 0) {
        alert("All ingredients already included in this menu item.");
        return;
      }
      const row = document.createElement("div");
      row.classList.add("row", "align-items-center", "mb-3");
      row.innerHTML = `
      <div class="col-4">
        <select class="form-select new-ingredient-select">
          <option disabled selected>Select ingredient</option>
          ${availableIngredients
            .map((i) => `<option value="${i.toLowerCase()}">${i}</option>`)
            .join("")}
        </select>
      </div>
      <div class="col-6">
        <input type="number" class="form-control new-ingredient-qty" placeholder="Qty" min="0" />
      </div>
      <div class="col-2">
        <button type="button" class="btn btn-sm btn-danger remove-ingredient">×</button>
      </div>
    `;
      const ingredientList = document.getElementById("ingredientList");
      ingredientList.appendChild(row);
      const select = row.querySelector(".new-ingredient-select");
      const input = row.querySelector(".new-ingredient-qty");
      function updateIngredient() {
        const ingredient = select.value;
        const quantity = parseFloat(input.value);
        if (!ingredient || isNaN(quantity)) return;
        const existing = menuItems[menuName].ingredients.find(
          (i) => i.ingredient === ingredient
        );
        if (existing) {
          existing.quantity = quantity;
        } else {
          menuItems[menuName].ingredients.push({ ingredient, quantity });
        }
      }
      select.addEventListener("change", updateIngredient);
      input.addEventListener("input", updateIngredient);
      row.querySelector(".remove-ingredient").addEventListener("click", () => {
        row.remove();
      });
    });
});
