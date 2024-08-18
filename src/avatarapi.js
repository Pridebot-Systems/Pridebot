const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

module.exports = (client) => {
  const app = express();
  const port = 2611;

  app.listen(port, () => {
    console.log(`Avatar API is running on port ${port}`);
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors());

  app.get("/", (req, res) => {
    res.status(404).json({
      message: "These are the API requests you can make:",
      endpoints: {
        avatar: "/avatar/:userId/:flag|flags.png",
      },
    });
  });

  app.get("/:userId/:flag.png", (req, res) => {
    const { userId, flag } = req.params;
    const imagePath = path.join(
      __dirname,
      "..",
      "src",
      "pfps",
      userId,
      `${flag}.png`
    );
    if (fs.existsSync(imagePath)) {
      res.sendFile(imagePath);
    } else {
      res.status(404).send("Image not found");
    }
  });
};
