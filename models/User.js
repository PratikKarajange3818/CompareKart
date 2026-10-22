const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 80
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    passwordHash: {
        type: String,
        required: true
    },
    sessionToken: {
        type: String,
        default: null,
        select: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre("save", function updateTimestamp() {
    this.updatedAt = new Date();
});

module.exports = mongoose.model("User", userSchema);
