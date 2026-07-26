const multer = require("multer");

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype));
  },
});
