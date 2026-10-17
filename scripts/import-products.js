
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { parse } = require("csv-parse/sync");
const Product = require("../models/Product");

function text(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

function key(value) {
    return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function get(row, names) {
    const entries = Object.entries(row || {});

    for (const name of names) {
        const found = entries.find(([field, value]) =>
            key(field) === key(name) &&
            value !== undefined &&
            value !== null &&
            text(value) !== ""
        );

        if (found) return found[1];
    }

    return "";
}

function price(value) {
    const cleaned = text(value).replace(/[₹$€£,\s]/g, "");

    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
        return null;
    }

    const result = Number(cleaned);
    return Number.isFinite(result) && result >= 0 ? result : null;
}

function httpUrl(value) {
    const valueText = text(value);

    if (!valueText) return "";

    try {
        const parsed = new URL(valueText);

        if (!["http:", "https:"].includes(parsed.protocol)) {
            return "";
        }

        return parsed.toString();
    } catch {
        return "";
    }
}

function normalizeOffer(row, defaultStore = "") {
    const store = text(
        get(row, ["store", "seller", "retailer", "merchant"])
    ) || defaultStore;

    const amount = price(
        get(row, ["price", "selling_price", "sale_price", "offer_price"])
    );

    const url = httpUrl(
        get(row, [
            "url",
            "product_url",
            "productUrl",
            "link",
            "affiliate_url",
            "affiliate_link"
        ])
    );

    if (!store) throw new Error("Offer is missing its store name.");
    if (amount === null) throw new Error("Offer has a missing or invalid price.");
    if (!url) throw new Error("Offer is missing a valid product URL.");

    return { store, price: amount, url };
}

function normalizeProduct(row, defaultStore = "") {
    const name = text(
        get(row, ["name", "title", "product_name", "product_title"])
    );

    const brand = text(
        get(row, ["brand", "brand_name", "manufacturer"])
    );

    const category = text(
        get(row, ["category", "category_name", "product_category"])
    );

    const image = httpUrl(
        get(row, ["image", "image_url", "imageUrl", "product_image"])
    );

    if (!name) throw new Error("Product is missing its name/title.");
    if (!brand) throw new Error(`"${name}" is missing its brand.`);
    if (!category) throw new Error(`"${name}" is missing its category.`);

    let offers = [];

    // JSON may provide multiple offers for one product.
    if (Array.isArray(row.offers)) {
        offers = row.offers.map((offer) =>
            normalizeOffer(offer, defaultStore)
        );
    } else {
        // CSV rows and simple JSON records each provide one offer.
        offers = [normalizeOffer(row, defaultStore)];
    }

    return { name, brand, category, image, offers };
}

function readFeed(filePath, defaultStore) {
    const extension = path.extname(filePath).toLowerCase();

    if (![".csv", ".json"].includes(extension)) {
        throw new Error("Please use a .csv or .json file.");
    }

    const stats = fs.statSync(filePath);

    if (stats.size > 25 * 1024 * 1024) {
        throw new Error("Feed is larger than 25 MB.");
    }

    const content = fs.readFileSync(filePath, "utf8");
    let rows;

    if (extension === ".csv") {
        rows = parse(content, {
            columns: true,
            skip_empty_lines: true,
            bom: true,
            trim: true
        });
    } else {
        const json = JSON.parse(content);

        if (Array.isArray(json)) {
            rows = json;
        } else if (json && Array.isArray(json.products)) {
            rows = json.products;
        } else if (json && Array.isArray(json.items)) {
            rows = json.items;
        } else if (json && Array.isArray(json.data)) {
            rows = json.data;
        } else {
            throw new Error(
                "JSON must be an array or contain a products, items, or data array."
            );
        }
    }

    if (rows.length === 0) {
        throw new Error("The feed contains no products.");
    }

    if (rows.length > 50000) {
        throw new Error("Feed exceeds the 50,000-row limit.");
    }

    // Convert each row to the shape used by Product.js.
    const products = [];
    const groups = new Map();

    rows.forEach((row, index) => {
        try {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
                throw new Error("Row must be a product object.");
            }

            const product = normalizeProduct(row, defaultStore);

            // Group products with the same name, brand and category.
            const groupKey = [
                product.name,
                product.brand,
                product.category
            ].map(value => value.toLowerCase()).join("|");

            if (!groups.has(groupKey)) {
                groups.set(groupKey, product);
                products.push(product);
            } else {
                const existing = groups.get(groupKey);

                if (!existing.image && product.image) {
                    existing.image = product.image;
                }

                for (const offer of product.offers) {
                    existing.offers.push(offer);
                }
            }
        } catch (error) {
            throw new Error(`Row ${index + 2}: ${error.message}`);
        }
    });

    // Remove repeated offers for the same store and product.
    for (const product of products) {
        const storeOffers = new Map();

        for (const offer of product.offers) {
            storeOffers.set(offer.store.toLowerCase(), offer);
        }

        product.offers = [...storeOffers.values()];
    }

    return products;
}

async function main() {
    const fileArgument = process.argv[2];
    const defaultStore = text(process.argv[3]);
    const confirmed = process.argv.includes("--confirm");

    if (!fileArgument || !defaultStore) {
        console.log("");
        console.log("CompareKart CSV / JSON Importer");
        console.log("");
        console.log("First, test without saving:");
        console.log(
            'node scripts/import-products.js "feeds/products.csv" "MySupplier"'
        );
        console.log("");
        console.log("Save after reviewing the test:");
        console.log(
            'node scripts/import-products.js "feeds/products.csv" "MySupplier" --confirm'
        );
        console.log("");
        console.log("Replace the file name and supplier name as needed.");
        process.exitCode = 1;
        return;
    }

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing from your .env file.");
    }

    const filePath = path.resolve(process.cwd(), fileArgument);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const products = readFeed(filePath, defaultStore);

    console.log("\nCompareKart Product Import");
    console.log("--------------------------");
    console.log(`Supplier: ${defaultStore}`);
    console.log(`Products after grouping: ${products.length}`);
    console.log(
        `Offers in feed: ${products.reduce((sum, p) => sum + p.offers.length, 0)}`
    );

    if (!confirmed) {
        console.log("\nDRY RUN: Nothing has been saved to MongoDB.");
        console.log("If the preview looks correct, rerun with --confirm.");
        return;
    }

    await mongoose.connect(process.env.MONGODB_URI);

    let addedProducts = 0;
    let updatedProducts = 0;
    let addedOffers = 0;
    let updatedOffers = 0;

    for (const incoming of products) {
        // Match a product using the fields in your existing Product.js.
        let existing = await Product.findOne({
            name: incoming.name,
            brand: incoming.brand,
            category: incoming.category
        });

        if (!existing) {
            existing = new Product({
                name: incoming.name,
                brand: incoming.brand,
                category: incoming.category,
                image: incoming.image || "",
                offers: incoming.offers
            });

            await existing.save();

            addedProducts++;
            addedOffers += incoming.offers.length;
            continue;
        }

        if (incoming.image) {
            existing.image = incoming.image;
        }

        for (const incomingOffer of incoming.offers) {
            const matchingOffer = existing.offers.find(
                offer =>
                    text(offer.store).toLowerCase() ===
                    incomingOffer.store.toLowerCase()
            );

            if (matchingOffer) {
                matchingOffer.price = incomingOffer.price;
                matchingOffer.url = incomingOffer.url;
                updatedOffers++;
            } else {
                existing.offers.push(incomingOffer);
                addedOffers++;
            }
        }

        await existing.save();
        updatedProducts++;
    }

    console.log("\nImport completed successfully.");
    console.log(`New products: ${addedProducts}`);
    console.log(`Existing products updated: ${updatedProducts}`);
    console.log(`New store offers: ${addedOffers}`);
    console.log(`Existing store offers updated: ${updatedOffers}`);
    console.log("\nCheck MongoDB Compass to verify the imported records.");
}

main()
    .catch(error => {
        console.error("\nIMPORT FAILED:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
