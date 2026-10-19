const form = document.getElementById("productForm");
const productList = document.getElementById("productList");
const message = document.getElementById("message");
const adminKeyInput = document.getElementById("adminKey");
const connectButton = document.getElementById("connectBtn");

let adminKey = sessionStorage.getItem("comparekartAdminKey") || "";

if (adminKey) {
  adminKeyInput.value = adminKey;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-key": adminKey,
      ...(options.headers || {})
    }
  });

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "The server returned HTML instead of JSON. Open http://localhost:3000/admin.html and check server.js."
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
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

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "catalogue-card";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const brand = document.createElement("p");
    brand.textContent = "Brand: " + product.brand;

    const category = document.createElement("p");
    category.textContent = "Category: " + product.category;

    const prices = (product.offers || [])
      .map((offer) => Number(offer.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    const price = document.createElement("p");
    price.textContent = prices.length
      ? "Lowest price: ₹" +
        Math.min(...prices).toLocaleString("en-IN")
      : "No price available";

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete Product";
    deleteButton.className = "admin-button danger-admin-button";

    deleteButton.addEventListener("click", async () => {
      if (!confirm("Delete " + product.name + "?")) {
        return;
      }

      deleteButton.disabled = true;

      try {
        await api("/api/admin/products/" + product._id, {
          method: "DELETE"
        });

        message.textContent = "Product deleted successfully!";
        await loadProducts();
      } catch (error) {
        message.textContent = error.message;
        deleteButton.disabled = false;
      }
    });

    card.append(title, brand, category, price, deleteButton);
    productList.appendChild(card);
  });
}

async function connectAdmin() {
  adminKey = adminKeyInput.value.trim();

  if (!adminKey) {
    message.textContent = "Please enter your admin key.";
    return;
  }

  connectButton.disabled = true;
  message.textContent = "Connecting to server...";

  try {
    await loadProducts();
    sessionStorage.removeItem("comparekartAdminKey");
    message.textContent = "Admin connected successfully!";
  } catch (error) {
    adminKey = "";
    message.textContent = error.message;
  } finally {
    connectButton.disabled = false;
  }
}

connectButton.addEventListener("click", connectAdmin);

adminKeyInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    connectAdmin();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!adminKey) {
    message.textContent = "Connect as admin before adding products.";
    return;
  }

  const formData = new FormData(form);

  const name = String(formData.get("name") || "").trim();
  const brand = String(formData.get("brand") || "").trim();
  const category = String(formData.get("category") || "");
  const price = Number(formData.get("price"));

  if (
    !name ||
    !brand ||
    !["Mobiles", "Laptops", "Audio"].includes(category) ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    message.textContent = "Please enter valid product details.";
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  message.textContent = "Saving product...";

  try {
    await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        brand,
        category,
        image: "",
        offers: [
          {
            store: "Demo Store",
            price,
            url: "https://www.amazon.in/"
          }
        ]
      })
    });

    form.reset();
    message.textContent = "Product saved successfully!";
    await loadProducts();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});