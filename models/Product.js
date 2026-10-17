
const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
    store: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    url: {
        type: String,
        required: true
    }
});

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    image: {
        type: String,
        default: ""
    },
    offers: [offerSchema]
});

module.exports = mongoose.model("Product", productSchema);
