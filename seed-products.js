
require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

const categories = [
  {
    category: "Mobiles",
    brands: ["Samsung", "Apple", "OnePlus", "Xiaomi", "Motorola", "Realme", "Vivo", "OPPO", "Google", "Nothing"],
    models: ["Smartphone", "5G Phone", "Pro Phone", "Plus Phone"],
    min: 7999,
    max: 129999
  },
  {
    category: "Laptops",
    brands: ["HP", "Dell", "Lenovo", "ASUS", "Acer", "Apple", "MSI"],
    models: ["Laptop", "Gaming Laptop", "Business Laptop", "Notebook"],
    min: 24999,
    max: 249999
  },
  {
    category: "Audio",
    brands: ["Sony", "JBL", "boAt", "Bose", "Sennheiser", "Apple"],
    models: ["Headphones", "Earbuds", "Bluetooth Speaker", "Soundbar"],
    min: 499,
    max: 39999
  },
  {
    category: "Tablets",
    brands: ["Apple", "Samsung", "Lenovo", "Xiaomi", "OnePlus"],
    models: ["Tablet", "Pro Tablet", "Android Tablet"],
    min: 7999,
    max: 119999
  },
  {
    category: "TVs",
    brands: ["Sony", "Samsung", "LG", "TCL", "Xiaomi"],
    models: ["4K Smart TV", "OLED TV", "LED TV", "QLED TV"],
    min: 11999,
    max: 299999
  },
  {
    category: "Cameras",
    brands: ["Canon", "Nikon", "Sony", "Fujifilm", "GoPro"],
    models: ["Digital Camera", "DSLR Camera", "Action Camera"],
    min: 9999,
    max: 399999
  },
  {
    category: "Gaming",
    brands: ["Sony", "Microsoft", "Nintendo", "Logitech", "Razer"],
    models: ["Gaming Console", "Gaming Mouse", "Gaming Keyboard", "Controller"],
    min: 1499,
    max: 69999
  },
  {
    category: "Smartwatches",
    brands: ["Apple", "Samsung", "Noise", "boAt", "Amazfit"],
    models: ["Smartwatch", "Fitness Watch", "GPS Watch"],
    min: 999,
    max: 89999
  },
  {
    category: "Home Appliances",
    brands: ["LG", "Samsung", "Whirlpool", "Godrej", "Bosch"],
    models: ["Refrigerator", "Washing Machine", "Microwave Oven", "Air Conditioner"],
    min: 7999,
    max: 149999
  },
  {
    category: "Kitchen Appliances",
    brands: ["Philips", "Prestige", "Havells", "Bajaj", "Butterfly"],
    models: ["Mixer Grinder", "Air Fryer", "Electric Kettle", "Toaster"],
    min: 699,
    max: 24999
  },
  {
    category: "Monitors",
    brands: ["Dell", "LG", "Samsung", "Acer", "ASUS"],
    models: ["Full HD Monitor", "4K Monitor", "Gaming Monitor"],
    min: 5999,
    max: 99999
  },
  {
    category: "Printers",
    brands: ["HP", "Canon", "Epson", "Brother"],
    models: ["Ink Tank Printer", "Laser Printer", "Wireless Printer"],
    min: 3999,
    max: 49999
  },
  {
    category: "Storage",
    brands: ["Samsung", "SanDisk", "Kingston", "Seagate", "Crucial"],
    models: ["Portable SSD", "External Hard Drive", "USB Drive", "Memory Card"],
    min: 399,
    max: 39999
  },
  {
    category: "Accessories",
    brands: ["Anker", "Belkin", "Portronics", "Logitech", "Ambrane"],
    models: ["Power Bank", "Fast Charger", "Wireless Mouse", "USB-C Hub"],
    min: 199,
    max: 9999
  },
  {
    category: "Personal Care",
    brands: ["Philips", "Braun", "Havells", "Dyson", "Vega"],
    models: ["Hair Dryer", "Trimmer", "Electric Shaver", "Hair Straightener"],
    min: 399,
    max: 59999
  },
  {
    category: "Furniture",
    brands: ["IKEA", "Wakefit", "Nilkamal", "Featherlite"],
    models: ["Office Chair", "Study Desk", "Bookshelf", "Computer Table"],
    min: 1499,
    max: 49999
  },
  {
    category: "Fitness",
    brands: ["Decathlon", "Cultsport", "Fitbit", "Garmin", "Boldfit"],
    models: ["Yoga Mat", "Dumbbell Set", "Treadmill", "Exercise Cycle"],
    min: 299,
    max: 89999
  },
  {
    category: "Fashion",
    brands: ["Puma", "Adidas", "Nike", "Campus", "Levis", "Bata"],
    models: ["Running Shoes", "Sneakers", "Backpack", "T-Shirt", "Jeans"],
    min: 499,
    max: 19999
  },
  {
    category: "Books",
    brands: ["Penguin", "Pearson", "McGraw Hill", "Rupa"],
    models: ["Programming Book", "Fiction Novel", "Business Book", "Study Guide"],
    min: 149,
    max: 2999
  },
  {
    category: "Automotive",
    brands: ["Bosch", "Philips", "3M", "Garmin"],
    models: ["Car Vacuum Cleaner", "Dash Camera", "Tyre Inflator", "Car Charger"],
    min: 499,
    max: 29999
  },
  {
    category: "Pet Supplies",
    brands: ["Pedigree", "Drools", "Whiskas", "Trixie"],
    models: ["Pet Food Pack", "Pet Bed", "Pet Carrier", "Grooming Kit"],
    min: 299,
    max: 9999
  },
  {
    category: "Baby Products",
    brands: ["Pigeon", "Mee Mee", "LuvLap", "Chicco"],
    models: ["Baby Monitor", "Baby Stroller", "Baby Carrier", "High Chair"],
    min: 499,
    max: 39999
  },
  {
    category: "Networking",
    brands: ["TP-Link", "D-Link", "Netgear", "ASUS"],
    models: ["Wi-Fi Router", "Mesh Wi-Fi System", "Range Extender"],
    min: 599,
    max: 49999
  },
  {
    category: "Office Supplies",
    brands: ["HP", "Logitech", "Pilot", "Deli"],
    models: ["Webcam", "Document Scanner", "Keyboard", "Desk Organizer"],
    min: 99,
    max: 29999
  }
];

const stores = [
  { store: "Amazon", url: "https://www.amazon.in/" },
  { store: "Flipkart", url: "https://www.flipkart.com/" },
  { store: "Croma", url: "https://www.croma.com/" },
  { store: "Reliance Digital", url: "https://www.reliancedigital.in/" }
];

function createProducts(total) {
  const products = [];

  for (let i = 0; i < total; i++) {
    const group = categories[i % categories.length];
    const variant = Math.floor(i / categories.length);
    const brand = group.brands[variant % group.brands.length];
    const model = group.models[(variant + i) % group.models.length];

    const basePrice =
      Math.round(
        (group.min +
          ((i * 7919) % 1000) / 1000 *
          (group.max - group.min)) / 100
      ) * 100;

    const offers = stores.slice(i % 2, (i % 2) + 3).map((store, j) => ({
      store: store.store,
      price: Math.round(basePrice * (1 + j * 0.025)),
      url: store.url
    }));

    products.push({
      name: `${brand} ${model} ${1000 + i}`,
      brand,
      category: group.category,
      image: "",
      offers,
      demoData: true,
      createdAt: new Date()
    });
  }

  return products;
}

async function main() {
  if (!uri) {
    throw new Error("MONGODB_URI is missing from your .env file.");
  }

  await mongoose.connect(uri);

  const collection = mongoose.connection.db.collection("products");

  // Add 500 products. Existing products are not deleted.
  const products = createProducts(500);
  const result = await collection.insertMany(products);

  console.log(`Successfully added ${result.insertedCount} products.`);
  console.log("Existing products were kept.");
  console.log("Prices are sample demo prices, not live verified prices.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Error:", error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exitCode = 1;
});
