
"use strict";

const searchForm = document.getElementById("live-search-form");
const searchInput = document.getElementById("live-query");
const productsContainer = document.getElementById("live-products");
const statusMessage = document.getElementById("live-search-status");
const resultsHeading = document.getElementById("results-heading");
const resultsCount = document.getElementById("results-count");
const summaryContainer = document.getElementById("comparison-summary");
const sortSelect = document.getElementById("sort-price");
const searchButton = searchForm.querySelector('button[type="submit"]');
const chatbotToggle = document.getElementById("chatbot-toggle");
const chatbotPanel = document.getElementById("chatbot-panel");
const chatbotClose = document.getElementById("chatbot-close");
const chatbotForm = document.getElementById("chatbot-form");
const chatbotQuestion = document.getElementById("chatbot-question");
const chatbotMessages = document.getElementById("chatbot-messages");
const chatbotSend = document.getElementById("chatbot-send");

let currentProducts = [];
let currentQuery = "";
let activeController = null;

function addChatbotMessage(label, text, type) {
  const message = document.createElement("div");
  message.className = `chatbot-message chatbot-message-${type}`;

  const heading = document.createElement("strong");
  heading.textContent = label;

  const content = document.createElement("p");
  content.textContent = text;

  message.append(heading, content);
  chatbotMessages.appendChild(message);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  return message;
}

function setChatbotOpen(isOpen) {
  chatbotPanel.hidden = !isOpen;
  chatbotToggle.setAttribute("aria-expanded", String(isOpen));

  if (isOpen) {
    chatbotQuestion.focus();
  }
}

chatbotToggle.addEventListener("click", () => {
  setChatbotOpen(chatbotPanel.hidden);
});

chatbotClose.addEventListener("click", () => {
  setChatbotOpen(false);
});

document.querySelectorAll("[data-chat-question]").forEach(button => {
  button.addEventListener("click", () => {
    chatbotQuestion.value = button.dataset.chatQuestion || "";
    chatbotQuestion.focus();
  });
});

chatbotForm.addEventListener("submit", async event => {
  event.preventDefault();

  const question = chatbotQuestion.value.trim();

  if (!question) return;

  addChatbotMessage("You", question, "user");
  chatbotQuestion.value = "";
  chatbotSend.disabled = true;
  chatbotSend.textContent = "Sending...";

  try {
    const response = await fetch("/api/gemini-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Request failed with HTTP ${response.status}.`);
    }

    if (typeof data.answer !== "string" || !data.answer.trim()) {
      throw new Error("Gemini returned an empty answer.");
    }

    addChatbotMessage("Gemini", data.answer.trim(), "assistant");
  } catch (error) {
    addChatbotMessage(
      "Error",
      error.message || "Could not get a reply. Please try again.",
      "error"
    );
  } finally {
    chatbotSend.disabled = false;
    chatbotSend.textContent = "Send";
    chatbotQuestion.focus();
  }
});

document.getElementById("current-year").textContent =
  new Date().getFullYear();

// Safely display text returned by the API.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Convert API fields into readable text.
// Handles values such as { name: "Amazon" } instead of "[object Object]".
function getTextField(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (value && typeof value === "object") {
    return String(
      value.name ??
      value.title ??
      value.label ??
      value.domain ??
      value.url ??
      ""
    ).trim();
  }

  return "";
}

function getProductName(product) {
  return getTextField(
    product.title ??
    product.name ??
    product.productName ??
    product.product_name
  );
}

function getPlatform(product) {
  return getTextField(
    product.platform ??
    product.marketplace ??
    product.store ??
    product.source ??
    product.provider ??
    product.retailer
  ) || "Marketplace";
}

function getProductImage(product) {
  const image = product.image ??
    product.imageUrl ??
    product.image_url ??
    product.thumbnail ??
    product.productImage;

  if (typeof image === "object" && image !== null) {
    return getTextField(image.url ?? image.src);
  }

  return getTextField(image);
}

function getProductUrl(product) {
  const url = product.productUrl ??
    product.product_url ??
    product.url ??
    product.link ??
    product.affiliateUrl ??
    product.affiliate_url;

  if (typeof url === "object" && url !== null) {
    return getTextField(url.url ?? url.href);
  }

  return getTextField(url);
}

function safeHttpUrl(value) {
  try {
    if (!value) return "";

    const parsed = new URL(value);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

function getPrice(product) {
  const raw = product.price ??
    product.salePrice ??
    product.sale_price ??
    product.currentPrice ??
    product.current_price;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }

  if (typeof raw === "string") {
    const cleaned = raw.replace(/[₹,\s]/g, "");
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function formatPrice(price) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(price);
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Remove common words that don't identify a product category.
function getSearchTerms(query) {
  const ignored = new Set([
    "the", "a", "an", "for", "and", "or", "with",
    "in", "on", "of", "to", "buy", "online",
    "best", "price", "product", "products"
  ]);

  return normalizeText(query)
    .split(/\s+/)
    .filter(term => term.length > 1 && !ignored.has(term));
}

// Reject obvious mismatches instead of displaying unrelated products.
 
function matchesSearchQuery(title, query) {
  const product = normalizeText(title);
  const search = normalizeText(query);

  if (!product || !search) return false;

  // Strict category matching for earbuds and headphones.
  const asksForAudio =
    /\b(earbud|earbuds|earphone|earphones|headphone|headphones|headset)\b/.test(search);

  if (asksForAudio) {
    const isAudioProduct =
      /\b(earbud|earbuds|earphone|earphones|headphone|headphones|headset)\b/.test(product);

    const isUnrelatedProduct =
      /\b(cotton|swab|swabs|paper stick|ear cleaning|ear cleaner|ear plug|ear plugs|earplug|earplugs)\b/.test(product);

    if (!isAudioProduct || isUnrelatedProduct) return false;

    if (
      /\b(wireless|bluetooth)\b/.test(search) &&
      !/\b(wireless|bluetooth|tws)\b/.test(product)
    ) {
      return false;
    }

    return true;
  }

  // For other searches, require every meaningful search term.
  const ignored = new Set([
    "the", "a", "an", "for", "and", "or", "with",
    "in", "on", "of", "to", "buy", "online",
    "best", "price", "product", "products"
  ]);

  const terms = search
    .split(/\s+/)
    .filter(term => term.length > 1 && !ignored.has(term));

  return terms.length > 0 &&
    terms.every(term => product.includes(term));
}

// Support common QuickCommerce response formats.
function extractProductRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const possibleArrays = [
    payload.data,
    payload.products,
    payload.results,
    payload.items,
    payload.data?.products,
    payload.data?.results,
    payload.data?.items,
    payload.results?.products
  ];

  const rows = possibleArrays.find(Array.isArray);

  if (rows) {
    return rows;
  }

  // Some APIs return separate arrays grouped by marketplace.
  if (payload.data && typeof payload.data === "object") {
    return Object.entries(payload.data).flatMap(([platform, items]) => {
      if (!Array.isArray(items)) return [];

      return items.map(item => ({
        ...item,
        platform: item.platform ?? item.marketplace ?? platform
      }));
    });
  }

  return [];
}

// Normalize API results, remove irrelevant products, and
// keep only results with a valid price.
function normalizeProducts(payload) {
  const rows = extractProductRows(payload);

  return rows
    .map(item => {
      const title = getProductName(item);
      const platform = getPlatform(item);
      const price = getPrice(item);
      const image = safeHttpUrl(getProductImage(item));
      const url = safeHttpUrl(getProductUrl(item));

      return {
        title,
        platform,
        price,
        image,
        url
      };
    })
    .filter(product => {
      return (
        product.title.length > 0 &&
        product.price !== null &&
        product.price > 0 &&
        matchesSearchQuery(product.title, currentQuery)
      );
    });
}

function showStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`.trim();
}

function showLoading() {
  summaryContainer.classList.add("hidden");
  summaryContainer.innerHTML = "";

  productsContainer.innerHTML = `
    <div class="loading-grid" style="grid-column:1/-1">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;
}

function showEmpty(title, description) {
  productsContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⌕</div>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(description)}</p>
    </div>
  `;
}

function renderSummary(products) {
  if (!products.length) {
    summaryContainer.classList.add("hidden");
    summaryContainer.innerHTML = "";
    return;
  }

  const lowest = products.reduce(
    (best, product) =>
      product.price < best.price ? product : best,
    products[0]
  );

  const highestPrice = Math.max(
    ...products.map(product => product.price)
  );

  const difference = highestPrice - lowest.price;

  summaryContainer.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Best available price</span>
      <span class="summary-value">${formatPrice(lowest.price)}</span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Best deal marketplace</span>
      <span class="summary-value">${escapeHTML(lowest.platform)}</span>
    </div>

    <div class="summary-item">
      <span class="summary-label">Price difference</span>
      <span class="summary-value">${formatPrice(difference)}</span>
    </div>
  `;

  summaryContainer.classList.remove("hidden");
}

function renderProducts() {
  const sorted = [...currentProducts].sort((a, b) => {
    return sortSelect.value === "high"
      ? b.price - a.price
      : a.price - b.price;
  });

  if (!sorted.length) {
    summaryContainer.classList.add("hidden");
    summaryContainer.innerHTML = "";

    resultsCount.textContent = "No relevant products with valid prices.";

    showEmpty(
      "No matching products found",
      "Try a different search. Only relevant products with valid prices are displayed."
    );

    return;
  }

  const lowestPrice = Math.min(
    ...sorted.map(product => product.price)
  );

  renderSummary(sorted);

  resultsCount.textContent =
    `${sorted.length} relevant priced offer${sorted.length === 1 ? "" : "s"} found.`;

  productsContainer.innerHTML = sorted.map((product, index) => {
    const isBest = product.price === lowestPrice;
    const title = escapeHTML(product.title);
    const platform = escapeHTML(product.platform);

    const imageMarkup = product.image
      ? `
        <img
          class="product-image"
          src="${escapeHTML(product.image)}"
          alt="${title}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
        >
        <div class="image-placeholder" style="display:none" aria-hidden="true">▧</div>
      `
      : `
        <div class="image-placeholder" aria-label="Product image unavailable">▧</div>
      `;

    const dealButton = product.url
      ? `
        <a
          class="btn btn-deal"
          href="${escapeHTML(product.url)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Deal <span aria-hidden="true">↗</span>
        </a>
      `
      : `
        <button class="btn btn-deal" type="button" disabled>
          Link unavailable
        </button>
      `;

    return `
      <article
        class="product-card ${isBest ? "best-card" : ""}"
        style="animation-delay:${Math.min(index * 45, 300)}ms"
      >
        ${isBest ? '<span class="best-badge">✦ Best Deal</span>' : ""}

        <div class="product-image-wrap">
          ${imageMarkup}
        </div>

        <div class="product-content">
          <div class="product-platform">
            <span class="platform-dot"></span>
            ${platform}
          </div>

          <h3 class="product-title">${title}</h3>

          <div class="price-row">
            <span class="product-price">${formatPrice(product.price)}</span>
          </div>

          <div class="best-price-note">
            ${isBest
              ? "Lowest valid price in these results"
              : "Price returned by the API"}
          </div>

          <div class="product-actions">
            ${dealButton}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function searchProducts(query) {
  const cleanQuery = query.trim();

  if (!cleanQuery) {
    showStatus("Please enter a product name.", "error");
    searchInput.focus();
    return;
  }

  // Cancel an earlier request if the user starts another search.
  if (activeController) {
    activeController.abort();
  }

  const controller = new AbortController();
  activeController = controller;

  currentQuery = cleanQuery;
  currentProducts = [];

  searchButton.disabled = true;
  searchButton.querySelector(".button-label").textContent = "Searching...";
  searchInput.disabled = true;

  resultsHeading.textContent = `Results for "${cleanQuery}"`;

  showStatus("Fetching available marketplace offers...");
  showLoading();

  try {
    const response = await fetch(
      `/api/compare-products?q=${encodeURIComponent(cleanQuery)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: controller.signal
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload.message ||
        payload.error ||
        `Search failed with HTTP ${response.status}.`
      );
    }

    if (payload.success === false) {
      throw new Error(
        payload.message || "The API search was unsuccessful."
      );
    }

    // Ignore stale results from a previous search.
    if (activeController !== controller) return;

    currentProducts = normalizeProducts(payload);

    renderProducts();

    if (currentProducts.length > 0) {
      showStatus(
        `Showing relevant API results for "${cleanQuery}". Verify the final price on the seller's website.`,
        "success"
      );
    } else {
      showStatus(
        "No relevant products with valid prices were returned. Try another search."
      );
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    if (activeController !== controller) return;

    console.error("CompareKart search error:", error);

    currentProducts = [];

    summaryContainer.classList.add("hidden");
    summaryContainer.innerHTML = "";

    showEmpty(
      "Unable to load prices",
      "Please try again. If the problem continues, check the server terminal."
    );

    showStatus(
      error.message || "Could not fetch prices. Please try again.",
      "error"
    );

    resultsCount.textContent = "Search could not be completed.";
  } finally {
    if (activeController === controller) {
      activeController = null;

      searchButton.disabled = false;
      searchButton.querySelector(".button-label").textContent = "Compare Prices";
      searchInput.disabled = false;
    }
  }
}

// Search form.
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  searchProducts(searchInput.value);
});

// Suggested searches.
document.querySelectorAll(".suggestion-chip").forEach(button => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query || "";
    searchProducts(searchInput.value);
  });
});

// Price sorting.
sortSelect.addEventListener("change", () => {
  if (currentProducts.length) {
    renderProducts();
  }
});
