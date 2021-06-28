const express = require("express");

const apiV1 = require("./routes/api-v1");

function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/", async (req, res) => {
    res.send("SYRF - Geo Data Slicer");
  });

  app.use("/api/v1", apiV1);
  return app;
}

module.exports = createServer;
