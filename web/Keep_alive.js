const express  = require("express");
const path     = require("path");
const fs       = require("fs");
const sever    = require("./browse/sever");

module.exports = function keep_alive() {
  const app  = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // 
  sever(app);

  app.use(express.static(path.join(__dirname, "browse")));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "browse", "index.html"));
  });

  app.get("/profile", (req, res) => {
    res.sendFile(path.join(__dirname, "browse", "profile.html"));
  });

  app.listen(PORT, () => {
    console.log(` URL: ${process.env.URL || `http://localhost:${PORT}`}`);
  });
};