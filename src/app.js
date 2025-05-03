const express = require("express");
const routes = require("./routes");
const errorHandler = require("./middleware/errorHandler");
const utils = require("./utils");
const { startPolling } = require("./poller/messagePoller");
require("./db/init"); // this runs once and ensures users table exists

const app = express();
utils.createSendMessageUIScript();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "iMessage API Server Running" });
});

app.use("/api", routes);

app.use(errorHandler);
// startPolling(1000); // every 1s

module.exports = app;
