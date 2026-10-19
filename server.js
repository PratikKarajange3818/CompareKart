
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const Product = require("./models/Product");
let databaseConnection;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ======================================
// HEALTH CHECK
// ======================================

 app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "CompareKart server is running",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        quickCommerceConfigured: Boolean(process.env.QUICKCOMMERCE_API_KEY)
    });
});
 
 
  
 // CHECK QUICKCOMMERCE CREDITS
app.get("/api/check-credits", async (req, res) => {
    try {
        const apiKey = process.env.QUICKCOMMERCE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "QuickCommerce API key is missing from .env"
            });
        }

        const response = await fetch(
            "https://api.quickcommerceapi.com/v1/credits",
            {
                headers: {
                    "X-API-Key": apiKey
                },
                signal: AbortSignal.timeout(15000)
            }
        );

        const result = await response.json();

        return res.status(response.status).json(result);
    } catch (error) {
        console.error("Credit check error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not check QuickCommerce credits."
        });
    }
});

// ======================================
// GEMINI AI CHAT
// ======================================

app.post("/api/gemini-chat", async (req, res) => {
    const question = req.body?.question;

    if (typeof question !== "string" || !question.trim()) {
        return res.status(400).json({
            success: false,
            message: "Question must be a non-empty string."
        });
    }

    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length > 2000) {
        return res.status(400).json({
            success: false,
            message: "Question is too long. Please keep it under 2000 characters."
        });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(503).json({
            success: false,
            message: "Gemini is not configured on the server."
        });
    }

    try {
        const requestBody = JSON.stringify({
            contents: [
                {
                    parts: [{ text: trimmedQuestion }]
                }
            ]
        });
        let response;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            response = await fetch(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey
                    },
                    body: requestBody,
                    signal: AbortSignal.timeout(60000)
                }
            );

            if (response.ok || ![429, 503].includes(response.status) || attempt === 2) {
                break;
            }

            await new Promise(resolve => {
                setTimeout(resolve, 1500 * (attempt + 1));
            });
        }

        if (!response.ok) {
            const upstreamError = await response.json().catch(() => ({}));
            const upstreamMessage = upstreamError.error?.message || "";

            console.error(
                "Gemini API request failed:",
                response.status,
                upstreamMessage
            );

            if (response.status === 429 || response.status === 503) {
                return res.status(503).json({
                    success: false,
                    message: "Gemini is temporarily busy. Please try again in a moment."
                });
            }

            return res.status(502).json({
                success: false,
                message: "Gemini could not process the request right now."
            });
        }

        const result = await response.json();
        const answer = result.candidates?.[0]?.content?.parts
            ?.map(part => part.text)
            .filter(text => typeof text === "string")
            .join("")
            .trim();

        if (!answer) {
            console.error("Gemini API returned no answer.");

            return res.status(502).json({
                success: false,
                message: "Gemini returned no answer."
            });
        }

        return res.json({ answer });
    } catch (error) {
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
            return res.status(504).json({
                success: false,
                message: "Gemini took too long to respond. Please try again."
            });
        }

        console.error("Gemini chat error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not contact Gemini right now."
        });
    }
});


// ======================================
// GET ALL CATALOGUE PRODUCTS
// These are saved in MongoDB.
// ======================================

app.get("/api/products", async (req, res) => {
    try {
        const products = await Product.find()
            .limit(1000)
            .lean();

        return res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        console.error("Product fetch error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch products."
        });
    }
});

// ======================================
// GET ONE PRODUCT
// ======================================

app.get("/api/products/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID."
            });
        }

        const product = await Product.findById(req.params.id).lean();

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        return res.json({
            success: true,
            data: product
        });
    } catch (error) {
        console.error("Product detail error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch product."
        });
    }
});

// ======================================
// ADMIN AUTHENTICATION
// ======================================

function checkAdminKey(req, res, next) {
    const correctKey = process.env.ADMIN_KEY;
    const suppliedKey = req.get("x-admin-key");

    if (!correctKey) {
        return res.status(500).json({
            success: false,
            message: "ADMIN_KEY is missing from .env."
        });
    }

    if (!suppliedKey || suppliedKey !== correctKey) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin key."
        });
    }

    next();
}

// ======================================
// ADMIN: LIST PRODUCTS
// ======================================

app.get("/api/admin/products", checkAdminKey, async (req, res) => {
    try {
        const products = await Product.find()
            .limit(1000)
            .lean();

        return res.json(products);
    } catch (error) {
        console.error("Admin product list error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to load admin products."
        });
    }
});

// ======================================
// ADMIN: ADD PRODUCT
// ======================================

app.post("/api/admin/products", checkAdminKey, async (req, res) => {
    try {
        const { name, brand, category, image, offers } = req.body;

        if (
            typeof name !== "string" || !name.trim() ||
            typeof brand !== "string" || !brand.trim() ||
            typeof category !== "string" || !category.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Name, brand and category are required."
            });
        }

        if (offers !== undefined && !Array.isArray(offers)) {
            return res.status(400).json({
                success: false,
                message: "Offers must be an array."
            });
        }

        const product = new Product({
            name: name.trim(),
            brand: brand.trim(),
            category: category.trim(),
            image: typeof image === "string" ? image.trim() : "",
            offers: offers || []
        });

        const savedProduct = await product.save();

        return res.status(201).json({
            success: true,
            message: "Product added successfully.",
            data: savedProduct
        });
    } catch (error) {
        console.error("Admin add product error:", error.message);

        return res.status(400).json({
            success: false,
            message: "Could not add product."
        });
    }
});

// ======================================
// ADMIN: DELETE PRODUCT
// ======================================

app.delete(
    "/api/admin/products/:id",
    checkAdminKey,
    async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID."
                });
            }

            const deletedProduct =
                await Product.findByIdAndDelete(req.params.id);

            if (!deletedProduct) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }

            return res.json({
                success: true,
                message: "Product deleted successfully."
            });
        } catch (error) {
            console.error("Admin delete error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not delete product."
            });
        }
    }
);

// ======================================
// LIVE PRODUCT PRICE COMPARISON
// ======================================

// Safely convert strings, numbers and objects to readable text.
function textValue(value) {
    if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
        return String(
            value.name ??
            value.title ??
            value.label ??
            value.display_name ??
            ""
        ).trim();
    }

    return "";
}

// Convert prices such as "₹1,299" to numbers.
function positivePrice(value) {
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? value : null;
    }

    if (typeof value !== "string") {
        if (value && typeof value === "object") {
            return positivePrice(
                value.amount ?? value.value ?? value.price
            );
        }

        return null;
    }

    const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
    const parsed = Number(cleaned);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Support common API response formats.
function extractSearchItems(result) {
    const candidates = [
        result?.data,
        result?.data?.products,
        result?.products,
        result?.results,
        result?.items
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }

    return [];
}

// Normalize text for matching.
function normalizeText(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

// Common product-type equivalents.
const SYNONYM_GROUPS = [
    ["earbud", "earbuds", "earphone", "earphones", "earpiece", "earpieces", "tws"],
    ["headphone", "headphones", "headset", "headsets"],
    ["wireless", "bluetooth"],
    ["mobile", "phone", "phones", "smartphone", "smartphones"],
    ["laptop", "notebook"],
    ["shoe", "shoes", "sneaker", "sneakers"],
    ["television", "tv"],
    ["refrigerator", "fridge"],
    ["washing machine", "washer"]
];

const PRODUCT_TYPE_GROUPS = [
    ["shirt", "shirts", "t shirt", "t shirts", "tshirt", "tshirts"],
    ["bra", "bras", "brassiere"],
    ["top", "tops"],
    ["dress", "dresses"],
    ["trouser", "trousers", "pant", "pants", "jeans"],
    ["underwear", "underwears", "brief", "briefs"],
    ["laptop", "notebook"],
    ["phone", "phones", "mobile", "smartphone", "smartphones"],
    ["earbud", "earbuds", "earphone", "earphones", "tws"],
    ["headphone", "headphones", "headset", "headsets"],
    ["shoe", "shoes", "sneaker", "sneakers"],
    ["television", "tv"],
    ["refrigerator", "fridge"],
    ["washing machine", "washer"]
];

const NON_PRODUCT_TYPE_TERMS = [
    "bag", "bags", "case", "cases", "cover", "covers",
    "sleeve", "sleeves", "stand", "stands", "charger",
    "cable", "cables", "accessory", "accessories"
];

const IGNORED_QUERY_WORDS = new Set([
    "best", "buy", "price", "compare", "online",
    "product", "products", "show", "find", "for", "the"
]);

function containsTerm(text, term) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;

    const variants = normalizedTerm.endsWith("s")
        ? [normalizedTerm, normalizedTerm.slice(0, -1)]
        : [normalizedTerm, `${normalizedTerm}s`];

    return variants.some(variant =>
        (` ${text} `).includes(` ${variant} `)
    );
}

function getQueryTerms(query) {
    const normalized = normalizeText(query);
    const terms = normalized.split(" ").filter(Boolean);
    const groups = [];
    const consumed = new Set();

    // Match multi-word categories before individual words.
    for (const synonymGroup of SYNONYM_GROUPS) {
        for (const phrase of synonymGroup) {
            if (phrase.includes(" ") && normalized.includes(phrase)) {
                groups.push(synonymGroup);
                phrase.split(" ").forEach(word => consumed.add(word));
                synonymGroup.forEach(word => {
                    word.split(" ").forEach(part => consumed.add(part));
                });
                break;
            }
        }
    }

    for (const word of terms) {
        if (consumed.has(word) || IGNORED_QUERY_WORDS.has(word)) {
            continue;
        }

        const group = SYNONYM_GROUPS.find(list => list.includes(word));

        if (group) {
            if (!groups.includes(group)) {
                groups.push(group);
            }

            group.forEach(item => {
                item.split(" ").forEach(part => consumed.add(part));
            });
        } else {
            groups.push([word]);
            consumed.add(word);
        }
    }

    return groups;
}

function getProductTypeGroups(query) {
    const normalizedQuery = normalizeText(query);

    return PRODUCT_TYPE_GROUPS.filter(group =>
        group.some(term => containsTerm(normalizedQuery, term))
    );
}

// Product type is checked using name/category fields, not description alone.
function isRelevantProduct(query, product) {
    if (!product.name || normalizeText(product.name) === "unknown product") {
        return false;
    }

    const name = normalizeText(product.name);
    const category = normalizeText(product.category);
    const productTypeText = normalizeText(
        `${product.name} ${product.category} ${product.productType || ""}`
    );
    const searchable = normalizeText([
        product.name,
        product.brand,
        product.category,
        product.color,
        product.model,
        product.size,
        product.description
    ].join(" "));
    const queryGroups = getQueryTerms(query);
    const productTypeGroups = getProductTypeGroups(query);

    if (!queryGroups.length) {
        return false;
    }

    if (productTypeGroups.length &&
        !productTypeGroups.every(group =>
            group.some(term => containsTerm(productTypeText, term))
        )) {
        return false;
    }

    // Reject explicit conflicting types, such as "T-Shirt Bra" for "shirt".
    if (productTypeGroups.length &&
        PRODUCT_TYPE_GROUPS.some(group =>
            group.some(term => containsTerm(`${name} ${category}`, term)) &&
            !group.some(term => containsTerm(normalizeText(query), term))
        )) {
        return false;
    }

    if (productTypeGroups.length &&
        NON_PRODUCT_TYPE_TERMS.some(term =>
            containsTerm(`${name} ${category}`, term) &&
            !containsTerm(normalizeText(query), term)
        )) {
        return false;
    }

    return queryGroups.every(group =>
        group.some(term => containsTerm(searchable, term))
    );
}

// Treat explicit false/zero availability values as unavailable.
function isUnavailable(value) {
    return value === false ||
        value === 0 ||
        value === "false" ||
        value === "out_of_stock" ||
        value === "unavailable";
}

app.get("/api/compare-products", async (req, res) => {
    try {
        const q = String(req.query.q || "").trim();

        if (!q) {
            return res.status(400).json({
                success: false,
                message: "Enter a product name using ?q=product-name."
            });
        }

        if (q.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Search query is too long."
            });
        }

        const apiKey = process.env.QUICKCOMMERCE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "QuickCommerce API key is missing."
            });
        }

        const platforms = ["Amazon", "Flipkart", "Myntra", "Nykaa"];

        const results = await Promise.allSettled(
            platforms.map(async platform => {
                const params = new URLSearchParams({
                    q,
                    platform,
                    lat: process.env.SEARCH_LAT || "16.7",
                    lon: process.env.SEARCH_LON || "74.2"
                });

                const response = await fetch(
                    `https://api.quickcommerceapi.com/v1/search?${params.toString()}`,
                    {
                        method: "GET",
                        headers: { "X-API-Key": apiKey },
                        signal: AbortSignal.timeout(20000)
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `${platform} API returned HTTP ${response.status}`
                    );
                }

                const result = await response.json();
                const items = extractSearchItems(result);

                return items.map(item => {
                    const name = textValue(
                        item?.name ??
                        item?.title ??
                        item?.product_name
                    );

                    const brand = textValue(item?.brand) || "Unknown";

                    const rawPrice =
                        item?.price ??
                        item?.offer_price ??
                        item?.sale_price ??
                        item?.selling_price ??
                        item?.final_price ??
                        item?.mrp;

                    const rawMrp =
                        item?.mrp ??
                        item?.original_price ??
                        item?.list_price ??
                        rawPrice;

                    const imageValue =
                        item?.image ??
                        item?.image_url ??
                        item?.thumbnail ??
                        (Array.isArray(item?.images) ? item.images[0] : "");

                    const urlValue =
                        item?.productUrl ??
                        item?.product_url ??
                        item?.deeplink ??
                        item?.url ??
                        item?.link ??
                        "";

                    return {
                        name,
                        brand,
                        category: textValue(
                            item?.category ??
                            item?.subcategory ??
                            item?.product_type ??
                            item?.productType
                        ),
                        color: textValue(
                            item?.color ??
                            item?.colour ??
                            item?.attributes?.color ??
                            item?.attributes?.colour
                        ),
                        model: textValue(
                            item?.model ??
                            item?.model_name ??
                            item?.modelNumber
                        ),
                        size: textValue(item?.size ?? item?.attributes?.size),
                        description: textValue(item?.description),
                        image: textValue(imageValue),
                        price: positivePrice(rawPrice),
                        mrp: positivePrice(rawMrp),
                        rating: item?.rating ?? null,
                        available: item?.available ?? item?.in_stock ?? null,
                        productUrl: textValue(urlValue),
                        platform: textValue(item?.platform) || platform,
                        source: "QuickCommerce API"
                    };
                });
            })
        );

        const products = [];
        const marketplaceErrors = [];

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                products.push(...result.value);
            } else {
                marketplaceErrors.push({
                    platform: platforms[index],
                    message: result.reason?.message || "Search failed"
                });

                console.error(
                    `${platforms[index]} search error:`,
                    result.reason?.message
                );
            }
        });

        // Filter unavailable, invalid and irrelevant products.
        const filteredProducts = products.filter(product => {
            if (isUnavailable(product.available)) return false;
            if (!product.name || product.price === null) return false;

            return isRelevantProduct(q, product);
        });

        // Remove duplicate listings using the product URL.
        // If the same URL has multiple prices, keep the lowest.
        const uniqueProducts = new Map();

        for (const product of filteredProducts) {
            const key = product.productUrl
                ? product.productUrl.split("?")[0].toLowerCase()
                : `${normalizeText(product.name)}-${normalizeText(product.platform)}`;

            const existing = uniqueProducts.get(key);

            if (!existing || product.price < existing.price) {
                uniqueProducts.set(key, product);
            }
        }

        // Lowest price first.
        const comparableProducts = Array.from(uniqueProducts.values())
            .sort((a, b) => a.price - b.price);

        const bestPrice = comparableProducts.length
            ? comparableProducts[0].price
            : null;

        const data = comparableProducts.map((product, index) => ({
            ...product,
            bestDeal: product.price === bestPrice,
            rank: index + 1
        }));

        return res.json({
            success: true,
            query: q,
            count: data.length,
            bestPrice,
            data,
            marketplaceErrors,
            message: data.length
                ? "Matching live results sorted by price."
                : "No exact matching products found."
        });
    } catch (error) {
        console.error("Compare products error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to compare products right now."
        });
    }
});

// ======================================
// CONNECT TO MONGODB AND START SERVER
// ======================================

function connectDatabase() {
    if (mongoose.connection.readyState === 1) {
        return Promise.resolve();
    }

    if (databaseConnection) {
        return databaseConnection;
    }

    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        return Promise.reject(new Error("MONGODB_URI is missing from .env."));
    }

    databaseConnection = mongoose.connect(mongoUri)
        .then(() => {
            console.log("Connected to MongoDB successfully");
        })
        .catch((error) => {
            databaseConnection = undefined;
            throw error;
        });

    return databaseConnection;
}

async function startServer() {
    try {
        await connectDatabase();

        app.listen(PORT, () => {
            console.log(`CompareKart running at http://localhost:${PORT}`);
            console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
        });
    } catch (error) {
        console.error("Could not start CompareKart:", error.message);
        process.exit(1);
    }
}

async function vercelHandler(req, res) {
    try {
        await connectDatabase();
        return app(req, res);
    } catch (error) {
        console.error("Could not connect to MongoDB:", error.message);
        return res.status(500).json({
            success: false,
            message: "The database is unavailable."
        });
    }
}

if (require.main === module) {
    startServer();
}

vercelHandler.app = app;
vercelHandler.connectDatabase = connectDatabase;
vercelHandler.startServer = startServer;

module.exports = vercelHandler;
