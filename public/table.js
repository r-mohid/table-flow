let reservationToDelete = null;
let noteElemToUpdate = null;
let menuItemsData = [];
let selectedTableId = null;
const takeOrderModalInstance = M.Modal.init(
  document.getElementById("takeOrderModal")
);

document.addEventListener("DOMContentLoaded", function () {
  const partyDetails = document.querySelector(".party-details");
  const noPartiesMsg = document.getElementById("no-parties-message");
  const reservationForm = document
    .getElementById("reservationModal")
    .querySelector("form");
  const reservationNotesElem = document.getElementById("reservation-notes");
  const scanMsg = document.getElementById("scan-success-msg");
  const tables = document.querySelectorAll(".grid-item");
  let selectedTableItem = null;
  const tableActionModalInstance = M.Modal.init(
    document.getElementById("tableActionModal")
  );
  const createTableModal = document.getElementById("createTableModal");
  const openReservationBtn = document.getElementById("openReservation");
  const cancelDeleteBtn = document.getElementById("cancelDelete");
  const confirmDeleteBtn = document.getElementById("confirmDelete");
  const reservationInstance = M.Modal.init(
    document.getElementById("reservationModal")
  );

  const deleteModalInstance = M.Modal.init(
    document.getElementById("deleteReservationModal")
  );
  M.Modal.init(document.querySelectorAll(".modal"));
  M.FormSelect.init(document.querySelectorAll("select"));
  const createTableModalInstance = M.Modal.init(createTableModal);
  const qrReader = new Html5Qrcode("qr-reader");

  function renderReservation(reservation) {
    const { _id, name, partySize, notes } = reservation;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
    <button
      class="waiting-party modal-trigger"
      data-target="deleteReservationModal"
      type="button"
      data-id="${_id}"
      data-partysize="${partySize}"
      data-notes="${notes}"
    >
      <div class="time-bar"></div>
      <div class="party-content">
        <div class="left-info d-flex align-items-center">
          <p class="waiting-name" style="margin: 0 10px 0 0;">${name}</p>
          <i class="fa-solid fa-note-sticky" style="color: #bebebe; font-size: 20px; margin-right: 15px;"></i>
        </div>
        <div class="right-info d-flex align-items-center">
          <i class="fa-solid fa-people-group" style="color: #bebebe; margin-right: 5px;"></i>
          <p style="margin: 0; color: #bebebe; font-weight: 500;">${partySize}</p>
        </div>
      </div>
      ${
        notes
          ? `<div class="bottom-bar"><small class="reservation-note" style="margin-left: 10px; display: none;">${notes}</small></div>`
          : ""
      }
    </button>
  `;
    const button = wrapper.firstElementChild;
    M.Modal.init(button);
    button.addEventListener("click", () => {
      reservationToDelete = button;
      noteElemToUpdate = button.querySelector(".reservation-note");

      reservationNotesElem.textContent = noteElemToUpdate
        ? `Note: ${noteElemToUpdate.textContent}`
        : "Note: No notes provided.";

      scanMsg.style.display = "none";
      document.getElementById("qr-reader").style.display = "block";
      qrReader.start(
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          qrbox: 200,
        },
        onScanSuccess
      );
    });
    partyDetails.appendChild(button);
  }

  async function onScanSuccess(decodedText) {
    const scannedText = decodedText.trim().toLowerCase();
    const matchingTableInner = document.getElementById(scannedText);
    if (!matchingTableInner) {
      console.warn("No table found with id:", scannedText);
      return;
    }
    const matchingGridItem = matchingTableInner.closest(".grid-item");
    const statusElement = matchingTableInner.querySelector(".status");
    const maxOccupants = parseInt(matchingGridItem.getAttribute("data-max"));
    const partySize = parseInt(
      reservationToDelete.getAttribute("data-partysize")
    );
    if (partySize > maxOccupants) {
      alert(
        `This table has a maximum of ${maxOccupants} occupants. Reservation has ${partySize}.`
      );
      return;
    }
    if (matchingGridItem && reservationToDelete) {
      // Update table UI
      matchingGridItem.classList.add("red-glow");
      if (statusElement) {
        statusElement.textContent = "Occupied";
      }
      const usersElem = matchingTableInner.querySelector("#users");
      const commentsElem = matchingTableInner.querySelector("#comments");
      const notes = reservationToDelete.getAttribute("data-notes");
      if (usersElem) usersElem.textContent = partySize;
      if (commentsElem) commentsElem.textContent = notes || "0";
      matchingGridItem.style.cursor = "pointer";
      matchingGridItem.addEventListener("click", () => {
        selectedTableItem = matchingGridItem;
        const currentWarning =
          selectedTableItem.getAttribute("data-warning") || "";
        document.getElementById("warningText").value = currentWarning;
        M.updateTextFields();
        tableActionModalInstance.open();
      });
      const reservationId = reservationToDelete.getAttribute("data-id");
      try {
        const response = await fetch(`/api/reservations/${reservationId}`, {
          method: "DELETE",
        });
        await fetch(`/api/tables/${scannedText}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "occupied",
            users: partySize,
            notes: notes || "",
          }),
        });
        const data = await response.json();
        if (data.success) {
          reservationToDelete.remove();
          reservationToDelete = null;
          updateReservationMessage();
          const openDeleteModal = M.Modal.getInstance(deleteModalInstance);
          if (openDeleteModal) openDeleteModal.close();
        } else {
          alert("Failed to delete reservation.");
        }
      } catch (err) {
        console.error("Error deleting reservation:", err);
        alert("Error deleting reservation.");
      }
      qrReader.stop().then(() => {
        document.getElementById("qr-reader").style.display = "none";
        scanMsg.style.display = "block";
        const openModalElem = document.querySelector(".modal.open");
        if (openModalElem) {
          const openInstance = M.Modal.getInstance(openModalElem);
          if (openInstance) openInstance.close();
        }
      });
      updateReservationMessage();
    } else {
      console.warn("Either no matching table or no reservation to delete.");
    }
  }

  function updateReservationMessage() {
    const hasReservations =
      partyDetails.querySelectorAll(".waiting-party").length > 0;
    noPartiesMsg.style.display = hasReservations ? "none" : "block";
  }

  openReservationBtn.addEventListener("click", () =>
    reservationInstance.open()
  );

  cancelDeleteBtn.addEventListener("click", () => {
    scanMsg.style.display = "none";
    qrReader.stop();
  });

  confirmDeleteBtn.addEventListener("click", async () => {
    if (reservationToDelete) {
      const reservationId = reservationToDelete.getAttribute("data-id");

      try {
        const response = await fetch(`/api/reservations/${reservationId}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (data.success) {
          reservationToDelete.remove();
          reservationToDelete = null;
          noteElemToUpdate = null;
          updateReservationMessage();
        } else {
          alert("Failed to delete reservation.");
        }
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Error deleting reservation.");
      }
    }
  });

  function updateReservationCount(reservations) {
    let totalPeople = 0;
    reservations.forEach((res) => {
      totalPeople += parseInt(res.partySize) || 0;
    });

    const reservationCountElem = document.getElementById("reservationCount");
    if (reservationCountElem) {
      reservationCountElem.innerHTML = `<i class="fa-solid fa-user"></i> ${totalPeople}`;
    }
  }

  if (window.__INITIAL_RESERVATIONS__) {
    window.__INITIAL_RESERVATIONS__.forEach(renderReservation);
    updateReservationMessage();
    updateReservationCount(window.__INITIAL_RESERVATIONS__);
  }

  async function loadFloors() {
    const floorContainer = document.getElementById("floor-btns-container");
    const tableFloorSelect = document.getElementById("tableFloorSelect");
    floorContainer.innerHTML = "";
    tableFloorSelect.innerHTML =
      '<option value="" disabled selected>Choose floor</option>';
    try {
      const res = await fetch("/api/floors");
      const data = await res.json();
      const floors = data.floors || [];
      floors.forEach((floor, index) => {
        const newButton = document.createElement("button");
        newButton.className =
          "btn btn-outline d-flex align-items-center justify-content-center floor-btn";
        if (index === 0) newButton.classList.add("btn-outline-pill-active");
        newButton.dataset.floor = floor;
        newButton.innerHTML = `<a>${
          floor.charAt(0).toUpperCase() + floor.slice(1)
        } Floor</a>`;
        newButton.addEventListener("click", () => {
          filterTablesByFloor(floor);
          document
            .querySelectorAll(".floor-btn")
            .forEach((b) => b.classList.remove("btn-outline-pill-active"));
          newButton.classList.add("btn-outline-pill-active");
          updateFloorName(floor);
        });
        floorContainer.appendChild(newButton);
        const option = document.createElement("option");
        option.value = floor;
        option.textContent =
          floor.charAt(0).toUpperCase() + floor.slice(1) + " Floor";
        tableFloorSelect.appendChild(option);
      });
      const defaultFloor = floors[0];
      if (defaultFloor) {
        filterTablesByFloor(defaultFloor);
        updateFloorName(defaultFloor);
      }
      M.FormSelect.init(tableFloorSelect);
    } catch (err) {
      console.error("Failed to load floors:", err);
    }
  }

  document.getElementById("clearTableBtn").addEventListener("click", () => {
    if (selectedTableItem) {
      selectedTableItem.classList.remove("red-glow");
      const inner = selectedTableItem.querySelector(".status");
      const users = selectedTableItem.querySelector("#users");
      const comments = selectedTableItem.querySelector("#comments");
      if (inner) inner.textContent = "Unoccupied";
      if (users) users.textContent = "0";
      if (comments) comments.textContent = "0";
      selectedTableItem.setAttribute("data-warning", "");
    }
  });

  function renderNewOrderItem() {
    const container = document.getElementById("orderItemsContainer");
    const row = document.createElement("div");
    row.classList.add("row", "align-items-center", "mb-2");
    row.innerHTML = `
    <div class="col-5">
      <select class="browser-default order-item-select">
        <option disabled selected>Select item</option>
        ${menuItemsData
          .map((item) => `<option value="${item.name}">${item.name}</option>`)
          .join("")}
      </select>
    </div>
    <div class="col-5">
      <input type="text" placeholder="Add note (optional)" class="order-note-input form-control">
    </div>
    <div class="col-2">
      <button type="button" class="btn btn-sm red remove-order-item-btn">×</button>
    </div>
  `;
    container.appendChild(row);
    row
      .querySelector(".remove-order-item-btn")
      .addEventListener("click", () => {
        row.remove();
      });
  }

  document.getElementById("takeOrderBtn").addEventListener("click", () => {
    if (selectedTableItem) {
      selectedTableId = selectedTableItem.querySelector("div").id;
      fetch("/api/menu-items")
        .then((res) => res.json())
        .then((data) => {
          menuItemsData = data.menuItems;
          renderNewOrderItem();
          takeOrderModalInstance.open();
        })
        .catch((err) => console.error("Error loading menu items:", err));
    }
  });

  document
    .getElementById("addOrderItemBtn")
    .addEventListener("click", renderNewOrderItem);
  document
    .getElementById("submitOrderBtn")
    .addEventListener("click", async () => {
      const orderRows = document.querySelectorAll("#orderItemsContainer .row");
      const orders = [];
      orderRows.forEach((row) => {
        const itemName = row.querySelector(".order-item-select").value;
        const note = row.querySelector(".order-note-input").value;
        if (itemName) {
          orders.push({
            name: itemName,
            note,
          });
        }
      });
      if (orders.length === 0) {
        alert("Please select at least one item.");
        return;
      }
      try {
        const ingredientsRes = await fetch("/api/ingredients");
        const ingredientsData = await ingredientsRes.json();
        const currentIngredients = {};
        ingredientsData.ingredients.forEach((ing) => {
          currentIngredients[ing.name] = ing.quantity;
        });
        const menuItemsRes = await fetch("/api/menu-items");
        const menuItemsData = await menuItemsRes.json();
        const ingredientUsage = {};
        orders.forEach((order) => {
          const item = menuItemsData.menuItems.find(
            (m) => m.name === order.name
          );
          if (item) {
            item.ingredients.forEach((ingredient) => {
              if (!ingredientUsage[ingredient.ingredient]) {
                ingredientUsage[ingredient.ingredient] = 0;
              }
              ingredientUsage[ingredient.ingredient] += ingredient.quantity;
            });
          }
        });

        const insufficientIngredients = [];
        for (const [ingredientName, qtyUsed] of Object.entries(
          ingredientUsage
        )) {
          if ((currentIngredients[ingredientName] || 0) - qtyUsed < 0) {
            insufficientIngredients.push(ingredientName);
          }
        }

        if (insufficientIngredients.length > 0) {
          alert(`Not enough stock for: ${insufficientIngredients.join(", ")}`);
          return;
        }
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tableId: selectedTableId,
            orders,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert("Order placed successfully!");
          document.getElementById("orderItemsContainer").innerHTML = "";
          takeOrderModalInstance.close();
        } else {
          alert("Failed to place order.");
        }
      } catch (err) {
        console.error("Submit order error:", err);
        alert("Error submitting order.");
      }
    });

  document.getElementById("saveWarningBtn").addEventListener("click", () => {
    if (selectedTableItem) {
      const warning = document.getElementById("warningText").value.trim();
      selectedTableItem.setAttribute("data-warning", warning);
      const warningIcon = selectedTableItem.querySelector(
        ".fa-triangle-exclamation"
      );
      const commentElem = selectedTableItem.querySelector("#comments");
      if (warningIcon) {
        warningIcon.title = warning || "";
      }
      if (commentElem) {
        commentElem.textContent = warning || "0";
      }
      tableActionModalInstance.close();
    }
  });

  document
    .getElementById("openCreateTable")
    .addEventListener("click", async () => {
      await loadFloors();
      createTableModalInstance.open();
    });
  let tableCounter = document.querySelectorAll(".grid-item").length;
  document
    .getElementById("createTableBtn")
    .addEventListener("click", async () => {
      const floor = document.getElementById("tableFloorSelect").value;
      const maxOccupants = parseInt(
        document.getElementById("maxOccupantsInput").value
      );
      if (!floor || isNaN(maxOccupants)) {
        alert("Please select a floor and enter a valid number.");
        return;
      }
      const currentTableCount = document.querySelectorAll(".grid-item").length;
      const nextTableNumber = currentTableCount + 1;
      tableCounter += 1;
      const tableId = `table-${tableCounter}`;
      try {
        const response = await fetch("/api/tables", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            floor,
            maxOccupants,
            tableId,
          }),
        });
        const data = await response.json();
        if (data.success) {
          const newTableHTML = `
        <div class="grid-item" data-floor="${floor}" data-max="${maxOccupants}">
          <div id="${tableId}">
            <div class="d-flex justify-content-between align-items-center">
              <p class="table-number" style="margin: 0;">${nextTableNumber}</p>
              <p class="status" style="margin: 0;">Unoccupied</p>
            </div>
            <div class="symbols d-flex align-items-center mt-2" style="color: #BDBDBD;">
              <i class="fa-solid fa-triangle-exclamation me-2"></i>
              <a id="comments" style="margin-right: 10px;">0</a>
              <i class="fa-solid fa-users me-1"></i>
              <a id="users">0</a>
            </div>
          </div>
        </div>
      `;
          document
            .querySelector(".grid-container")
            .insertAdjacentHTML("beforeend", newTableHTML);
          const activeFloor = document.querySelector(
            ".floor-btn.btn-outline-pill-active"
          )?.dataset.floor;
          if (activeFloor) {
            filterTablesByFloor(activeFloor);
          }
          document.getElementById("tableFloorSelect").selectedIndex = 0;
          document.getElementById("maxOccupantsInput").value = "";
          M.updateTextFields();
          M.FormSelect.init(document.querySelectorAll("select"));
        } else {
          alert("Failed to create table.");
        }
      } catch (err) {
        console.error("Error creating table:", err);
        alert("Error creating table. Please try again.");
      }
    });

  document.getElementById("clearTableBtn").addEventListener("click", () => {
    if (selectedTableItem) {
      selectedTableItem.classList.remove("red-glow");
      const status = selectedTableItem.querySelector(".status");
      const users = selectedTableItem.querySelector("#users");
      const comments = selectedTableItem.querySelector("#comments");
      const warningIcon = selectedTableItem.querySelector(
        ".fa-triangle-exclamation"
      );
      if (status) status.textContent = "Unoccupied";
      if (users) users.textContent = "0";
      if (comments) comments.textContent = "0";
      if (warningIcon) {
        warningIcon.style.color = "#BDBDBD";
        warningIcon.title = "";
      }
      selectedTableItem.setAttribute("data-warning", "");
      selectedTableItem.style.cursor = "default";
      const clone = selectedTableItem.cloneNode(true);
      selectedTableItem.replaceWith(clone);
      selectedTableItem = null;
      tableActionModalInstance.close();
    }
  });

  function updateFloorName(floor) {
    const floorNameElem = document.getElementById("currentFloorName");
    if (floorNameElem) {
      floorNameElem.textContent =
        floor.charAt(0).toUpperCase() + floor.slice(1) + " Floor";
    }
  }

  document.querySelectorAll(".floor-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const floor = btn.dataset.floor;
      filterTablesByFloor(floor);
      document
        .querySelectorAll(".floor-btn")
        .forEach((b) => b.classList.remove("btn-outline-pill-active"));
      btn.classList.add("btn-outline-pill-active");
      updateFloorName(floor);
    });
  });

  function filterTablesByFloor(floor) {
    document.querySelectorAll(".grid-item").forEach((item) => {
      if (item.dataset.floor === floor) {
        item.style.display = "block";
      } else {
        item.style.display = "none";
      }
    });
  }

  document
    .getElementById("createFloorBtn")
    .addEventListener("click", async () => {
      const newFloorInput = document.getElementById("newFloorName");
      const newFloorName = newFloorInput.value.trim().toLowerCase();
      if (!newFloorName) {
        alert("Please enter a valid floor name.");
        return;
      }
      try {
        const response = await fetch("/api/floors", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            floor: newFloorName,
          }),
        });
        const data = await response.json();
        if (data.success) {
          alert("Floor added!");
          newFloorInput.value = "";
          await reloadFloorButtons();
          addFloorModalInstance.close();
        } else {
          alert("Failed to add floor.");
        }
      } catch (error) {
        console.error("Error adding floor:", error);
        alert("Error occurred.");
      }
    });
  const addFloorModalInstance = M.Modal.init(
    document.getElementById("addFloorModal")
  );

  async function reloadFloorButtons() {
    const res = await fetch("/api/floors");
    const data = await res.json();
    const floorContainer = document.getElementById("floor-btns-container");
    floorContainer.innerHTML = "";
    if (data.floors && data.floors.length > 0) {
      data.floors.forEach((floor) => {
        const newBtn = document.createElement("button");
        newBtn.className =
          "btn btn-outline d-flex align-items-center justify-content-center floor-btn";
        newBtn.dataset.floor = floor;
        newBtn.innerHTML = `<a>${
          floor.charAt(0).toUpperCase() + floor.slice(1)
        } Floor</a>`;
        newBtn.addEventListener("click", () => {
          filterTablesByFloor(floor);
          document
            .querySelectorAll(".floor-btn")
            .forEach((b) => b.classList.remove("btn-outline-pill-active"));
          newBtn.classList.add("btn-outline-pill-active");
          updateFloorName(floor);
        });
        floorContainer.appendChild(newBtn);
      });
    }
  }

  document
    .getElementById("add-floor-btn")
    .addEventListener("click", async (e) => {
      e.preventDefault(); // ⬅️ important
      const floorList = document.getElementById("floorList");
      floorList.innerHTML = "";
      try {
        const res = await fetch("/api/floors");
        const data = await res.json();
        if (data.floors && data.floors.length > 0) {
          data.floors.forEach((floor) => {
            const li = document.createElement("li");
            li.style.marginBottom = "8px";
            li.innerHTML = `
          <span>${floor.charAt(0).toUpperCase() + floor.slice(1)} Floor</span>
          <button class="btn btn-sm red lighten-1 delete-floor-btn" style="margin-left: 10px;">
            <i class="fa fa-trash"></i>
          </button>
        `;
            const deleteBtn = li.querySelector(".delete-floor-btn");
            deleteBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              if (confirm(`Delete floor "${floor}"?`)) {
                const deleteRes = await fetch(`/api/floors/${floor}`, {
                  method: "DELETE",
                });
                const deleteData = await deleteRes.json();
                if (deleteData.success) {
                  li.remove();
                  await reloadFloorButtons();
                } else {
                  alert("Failed to delete floor.");
                }
              }
            });
            floorList.appendChild(li);
          });
        } else {
          floorList.innerHTML = "<li>No floors added yet.</li>";
        }
        addFloorModalInstance.open();
      } catch (err) {
        console.error("Failed to load floors:", err);
        alert("Failed to load floors.");
      }
    });

  reservationForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const name = reservationForm
      .querySelector('input[type="text"]')
      .value.trim();
    const partySize = parseInt(
      reservationForm.querySelector('input[type="number"]').value
    );
    const notes = reservationForm.querySelector("textarea").value.trim();
    if (!name || isNaN(partySize)) return alert("Fill the form correctly.");
    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          partySize,
          notes,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = `
      <button class="waiting-party modal-trigger"
              data-target="deleteReservationModal"
              type="button"
              data-id="${data.id}"
              data-partysize="${partySize}"
              data-notes="${notes}">
        <div class="time-bar"></div>
        <div class="party-content">
          <div class="left-info d-flex align-items-center">
            <p class="waiting-name" style="margin: 0 10px 0 0;">${name}</p>
            <i class="fa-solid fa-note-sticky" style="color: #bebebe; font-size: 20px; margin-right: 15px;"></i>
          </div>
          <div class="right-info d-flex align-items-center">
            <i class="fa-solid fa-people-group" style="color: #bebebe; margin-right: 5px;"></i>
            <p style="margin: 0; color: #bebebe; font-weight: 500;">${partySize}</p>
          </div>
        </div>
        ${
          notes
            ? `<div class="bottom-bar"><small class="reservation-note" style="margin-left: 10px; display: none;">${notes}</small></div>`
            : ""
        }
      </button>
      `;
        const button = wrapper.firstElementChild;
        M.Modal.init(button);
        button.addEventListener("click", () => {
          reservationToDelete = button;
          noteElemToUpdate = button.querySelector(".reservation-note");
          reservationNotesElem.textContent = noteElemToUpdate
            ? `Note: ${noteElemToUpdate.textContent}`
            : "Note: No notes provided.";
          scanMsg.style.display = "none";
          document.getElementById("qr-reader").style.display = "block";
          qrReader.start(
            {
              facingMode: "environment",
            },
            {
              fps: 10,
              qrbox: 200,
            },
            onScanSuccess
          );
        });
        partyDetails.appendChild(button);
        updateReservationMessage();
        reservationForm.reset();
        M.updateTextFields();
      } else {
        alert("Failed to create reservation.");
      }
    } catch (err) {
      console.error("Reservation error:", err);
      alert("Something went wrong.");
    }
  });

  function setupOccupiedTableClicks() {
    document.querySelectorAll(".grid-item").forEach((gridItem) => {
      const status = gridItem.querySelector(".status");
      if (status && status.textContent.trim().toLowerCase() === "occupied") {
        gridItem.classList.add("red-glow");
        gridItem.style.cursor = "pointer";
        gridItem.addEventListener("click", () => {
          selectedTableItem = gridItem;
          const currentWarning =
            selectedTableItem.getAttribute("data-warning") || "";
          document.getElementById("warningText").value = currentWarning;
          M.updateTextFields();
          tableActionModalInstance.open();
        });
      }
    });
  }

  setupOccupiedTableClicks();
  updateReservationMessage();
  loadFloors();
});
