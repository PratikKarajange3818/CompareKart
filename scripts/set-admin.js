require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Usage: node scripts/set-admin.js user@example.com");
    process.exit(1);
}

async function promoteUser() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is missing from .env.");
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOneAndUpdate(
        { email },
        { $set: { role: "admin" } },
        { new: true, runValidators: true }
    ).select("_id name email role");

    if (!user) {
        throw new Error(`No user found for ${email}. Register the user first.`);
    }

    console.log(`Administrator role granted to ${user.email}.`);
}

promoteUser()
    .catch(error => {
        console.error("Could not grant administrator role:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });
