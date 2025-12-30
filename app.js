const API_BASE = "http://localhost:5000";

const elements = {
  statusText: document.getElementById("api-status-text"),
  statusIndicator: document.getElementById("api-status"),
  refreshStatus: document.getElementById("refresh-status"),
  binFilter: document.getElementById("bin-filter"),
  itemFilter: document.getElementById("item-filter"),
  binsList: document.getElementById("bins-list"),
  itemsList: document.getElementById("items-list"),
  binForm: document.getElementById("bin-form"),
  itemForm: document.getElementById("item-form"),
  binMessage: document.getElementById("bin-message"),
  itemMessage: document.getElementById("item-message"),
};

const state = {
  bins: [],
  items: [],
  expandedBins: new Set(),
};

const parseTags = (value) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const showMessage = (el, message, type = "info") => {
  el.textContent = message;
  el.dataset.type = type;
  if (!message) {
    el.removeAttribute("data-type");
  }
};

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const updateStatus = async () => {
  try {
    await request("/health");
    elements.statusIndicator.classList.remove("offline");
    elements.statusText.textContent = "Online";
  } catch (error) {
    elements.statusIndicator.classList.add("offline");
    elements.statusText.textContent = "Offline";
  }
};

const renderTags = (tags = []) =>
  tags.length
    ? tags.map((tag) => `<span class="tag">${tag}</span>`).join("")
    : "<span class=\"tag muted\">No tags</span>";

const renderBins = () => {
  if (!state.bins.length) {
    elements.binsList.innerHTML =
      "<p class=\"empty\">No bins yet. Add one to get started.</p>";
    return;
  }

  elements.binsList.innerHTML = state.bins
    .map((bin) => {
      const expanded = state.expandedBins.has(bin.id);
      return `
        <article class="card">
          <header>
            <div>
              <h3>Bin ${bin.id}</h3>
              <p>${bin.location}</p>
            </div>
            <div class="card-actions">
              <button class="ghost" data-action="toggle" data-id="${bin.id}">
                ${expanded ? "Hide items" : "View items"}
              </button>
              <button class="danger" data-action="delete" data-id="${bin.id}">
                Delete
              </button>
            </div>
          </header>
          <div class="tags">${renderTags(bin.tags)}</div>
          <div class="nested" id="bin-items-${bin.id}" ${expanded ? "" : "hidden"}></div>
        </article>
      `;
    })
    .join("");
};

const renderItems = () => {
  if (!state.items.length) {
    elements.itemsList.innerHTML =
      "<p class=\"empty\">No items yet. Add an item or change the filter.</p>";
    return;
  }

  elements.itemsList.innerHTML = state.items
    .map(
      (item) => `
        <article class="card">
          <header>
            <div>
              <h3>${item.name}</h3>
              <p>ID: ${item.id}</p>
            </div>
            <div class="card-actions">
              <button class="danger" data-action="delete-item" data-id="${item.id}">
                Delete
              </button>
            </div>
          </header>
          <p class="muted">Stored in bin ${item.bin_id}</p>
          <div class="tags">${renderTags(item.tags)}</div>
        </article>
      `
    )
    .join("");
};

const renderBinItems = async (binId) => {
  const container = document.getElementById(`bin-items-${binId}`);
  if (!container) return;
  container.innerHTML = "<p class=\"loading\">Loading items...</p>";
  try {
    const tag = elements.itemFilter.value.trim();
    const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
    const items = await request(`/bins/${binId}/items${query}`);
    container.innerHTML = items.length
      ? items
          .map(
            (item) => `
            <div class="nested-item">
              <div>
                <strong>${item.name}</strong>
                <span class="muted">(${item.id})</span>
              </div>
              <div class="tags">${renderTags(item.tags)}</div>
            </div>
          `
          )
          .join("")
      : "<p class=\"empty\">No items in this bin.</p>";
  } catch (error) {
    container.innerHTML = `<p class="error">${error.message}</p>`;
  }
};

const loadBins = async () => {
  const tag = elements.binFilter.value.trim();
  const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  try {
    state.bins = await request(`/bins${query}`);
    renderBins();
    state.expandedBins.forEach((binId) => renderBinItems(binId));
  } catch (error) {
    elements.binsList.innerHTML = `<p class="error">${error.message}</p>`;
  }
};

const loadItems = async () => {
  const tag = elements.itemFilter.value.trim();
  const query = tag ? `?tag=${encodeURIComponent(tag)}` : "";
  try {
    state.items = await request(`/items${query}`);
    renderItems();
  } catch (error) {
    elements.itemsList.innerHTML = `<p class="error">${error.message}</p>`;
  }
};

const handleBinForm = async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.binForm);
  const payload = {
    id: formData.get("id").trim(),
    location: formData.get("location").trim(),
    tags: parseTags(formData.get("tags") || ""),
  };

  if (!/^\d{4}$/.test(payload.id)) {
    showMessage(elements.binMessage, "Bin ID must be 4 digits.", "error");
    return;
  }

  try {
    await request("/bins", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    elements.binForm.reset();
    showMessage(elements.binMessage, "Bin created successfully.", "success");
    loadBins();
  } catch (error) {
    showMessage(elements.binMessage, error.message, "error");
  }
};

const handleItemForm = async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.itemForm);
  const payload = {
    id: formData.get("id").trim(),
    name: formData.get("name").trim(),
    bin_id: formData.get("bin_id").trim(),
    tags: parseTags(formData.get("tags") || ""),
  };

  try {
    await request("/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    elements.itemForm.reset();
    showMessage(elements.itemMessage, "Item created successfully.", "success");
    loadItems();
    loadBins();
  } catch (error) {
    showMessage(elements.itemMessage, error.message, "error");
  }
};

const handleBinActions = async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { action, id } = button.dataset;
  if (!action || !id) return;

  if (action === "toggle") {
    if (state.expandedBins.has(id)) {
      state.expandedBins.delete(id);
    } else {
      state.expandedBins.add(id);
    }
    renderBins();
    if (state.expandedBins.has(id)) {
      renderBinItems(id);
    }
  }

  if (action === "delete") {
    try {
      await request(`/bins/${id}`, { method: "DELETE" });
      state.expandedBins.delete(id);
      loadBins();
    } catch (error) {
      alert(error.message);
    }
  }
};

const handleItemActions = async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action !== "delete-item" || !id) return;

  try {
    await request(`/items/${id}`, { method: "DELETE" });
    loadItems();
    loadBins();
  } catch (error) {
    alert(error.message);
  }
};

const init = () => {
  updateStatus();
  loadBins();
  loadItems();

  elements.refreshStatus.addEventListener("click", updateStatus);
  elements.binFilter.addEventListener("input", () => {
    state.expandedBins.clear();
    loadBins();
  });
  elements.itemFilter.addEventListener("input", () => {
    loadItems();
    state.expandedBins.forEach((binId) => renderBinItems(binId));
  });

  elements.binForm.addEventListener("submit", handleBinForm);
  elements.itemForm.addEventListener("submit", handleItemForm);
  elements.binsList.addEventListener("click", handleBinActions);
  elements.itemsList.addEventListener("click", handleItemActions);
};

init();
