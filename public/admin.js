"use strict";

const form = document.getElementById("productForm");
const productList = document.getElementById("productList");
const message = document.getElementById("message");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");
const connectButton = document.getElementById("connectBtn");
const userSearchInput = document.getElementById("userSearch");
const userSearchButton = document.getElementById("userSearchButton");
const userTableBody = document.getElementById("userTableBody");
const userStatus = document.getElementById("userStatus");
const userCountBadge = document.getElementById("userCountBadge");
const userPageLabel = document.getElementById("userPageLabel");
const previousUsers = document.getElementById("previousUsers");
const nextUsers = document.getElementById("nextUsers");

let isAdminAuthenticated = false;
let userPage = 1;
let userTotalPages = 1;
let userTotalCount = 0;

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

function setUserStatus(text, isError = false) {
  userStatus.textContent = text;
  userStatus.classList.toggle("error", isError);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : {};

  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function loadProducts() {
  const products = await api("/api/admin/products");
  productList.replaceChildren();

  if (products.length === 0) {
    productList.textContent = "No products found yet.";
    return;
  }

  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "catalogue-card";

    const title = document.createElement("h3");
    title.textContent = product.name;
    const brand = document.createElement("p");
    brand.textContent = "Brand: " + product.brand;
    const category = document.createElement("p");
    category.textContent = "Category: " + product.category;
    const prices = (product.offers || [])
      .map(offer => Number(offer.price))
      .filter(price => Number.isFinite(price) && price > 0);
    const price = document.createElement("p");
    price.textContent = prices.length
      ? "Lowest price: ₹" + Math.min(...prices).toLocaleString("en-IN")
      : "No price available";
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete Product";
    deleteButton.className = "admin-button danger-admin-button";

    deleteButton.addEventListener("click", async () => {
      if (!confirm("Delete " + product.name + "?")) return;
      deleteButton.disabled = true;

      try {
        await api("/api/admin/products/" + product._id, { method: "DELETE" });
        setMessage("Product deleted successfully!");
        await loadProducts();
      } catch (error) {
        setMessage(error.message, true);
        deleteButton.disabled = false;
      }
    });

    card.append(title, brand, category, price, deleteButton);
    productList.appendChild(card);
  });
}

function renderUsers(users) {
  userTableBody.replaceChildren();

  if (users.length === 0) {
    setUserStatus("No registered users match this search.");
    return;
  }

  setUserStatus("");
  users.forEach(user => {
    const row = document.createElement("tr");
    const id = document.createElement("td");
    id.textContent = String(user.id);
    id.className = "user-id-cell";
    const name = document.createElement("td");
    name.textContent = user.name;
    const email = document.createElement("td");
    email.textContent = user.email;
    const registered = document.createElement("td");
    registered.textContent = new Date(user.createdAt).toLocaleString();
    const role = document.createElement("td");
    role.textContent = user.role;
    role.className = user.role === "admin" ? "admin-role" : "";
    row.append(id, name, email, registered, role);
    userTableBody.appendChild(row);
  });
}

async function loadUsers() {
  userSearchButton.disabled = true;
  previousUsers.disabled = true;
  nextUsers.disabled = true;
  setUserStatus("Loading users...");

  try {
    const params = new URLSearchParams({
      page: String(userPage),
      limit: "10",
      search: userSearchInput.value.trim()
    });
    const result = await api("/api/admin/users?" + params);
    userTotalPages = Math.max(1, result.pagination.totalPages);
    userTotalCount = result.pagination.totalUsers;
    userPage = result.pagination.page;
    const totalRegisteredUsers = result.stats?.totalRegisteredUsers ?? userTotalCount;
    userCountBadge.textContent = `${totalRegisteredUsers} registered user${totalRegisteredUsers === 1 ? "" : "s"}`;
    userPageLabel.textContent = `Page ${userPage} of ${userTotalPages}`;
    previousUsers.disabled = userPage <= 1;
    nextUsers.disabled = userPage >= userTotalPages;
    renderUsers(result.data);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      isAdminAuthenticated = false;
      setUserStatus(error.message, true);
      setMessage("Administrator authorization is required.", true);
    } else {
      setUserStatus(error.message, true);
    }
  } finally {
    userSearchButton.disabled = false;
  }
}

async function connectAdmin() {
  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  if (!email || !password) {
    setMessage("Enter the administrator email and password.", true);
    return;
  }

  connectButton.disabled = true;
  setMessage("Signing in and verifying administrator access...");

  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    if (result.user?.role !== "admin") {
      throw new Error("This account is not authorized to access the admin panel.");
    }

    isAdminAuthenticated = true;
    adminPasswordInput.value = "";
    setMessage("Administrator access verified.");
    await Promise.all([loadProducts(), loadUsers()]);
  } catch (error) {
    isAdminAuthenticated = false;
    setMessage(error.message, true);
  } finally {
    connectButton.disabled = false;
  }
}

connectButton.addEventListener("click", connectAdmin);
adminPasswordInput.addEventListener("keydown", event => {
  if (event.key === "Enter") connectAdmin();
});
userSearchButton.addEventListener("click", () => {
  userPage = 1;
  loadUsers();
});
userSearchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    userPage = 1;
    loadUsers();
  }
});
previousUsers.addEventListener("click", () => {
  if (userPage > 1) {
    userPage -= 1;
    loadUsers();
  }
});
nextUsers.addEventListener("click", () => {
  if (userPage < userTotalPages) {
    userPage += 1;
    loadUsers();
  }
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!isAdminAuthenticated) {
    setMessage("Sign in with an administrator account first.", true);
    return;
  }

  const formData = new FormData(form);
  const name = String(formData.get("name") || "").trim();
  const brand = String(formData.get("brand") || "").trim();
  const category = String(formData.get("category") || "");
  const price = Number(formData.get("price"));

  if (!name || !brand || !["Mobiles", "Laptops", "Audio"].includes(category) ||
      !Number.isFinite(price) || price <= 0) {
    setMessage("Please enter valid product details.", true);
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  setMessage("Saving product...");

  try {
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        brand,
        category,
        image: "",
        offers: [{ store: "Demo Store", price, url: "https://www.amazon.in/" }]
      })
    });
    form.reset();
    setMessage("Product saved successfully!");
    await loadProducts();
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});
