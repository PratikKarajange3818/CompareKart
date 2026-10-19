const { app, connectDatabase } = require("../server");

module.exports = async function handler(req, res) {
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
};
