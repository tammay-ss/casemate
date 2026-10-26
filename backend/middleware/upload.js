const path = require("path");
const multer = require("multer");

const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
];
const ALLOWED_EXTS = [".pdf", ".docx", ".doc", ".jpeg", ".jpg", ".png"];

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowed = ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXTS.includes(ext);
    callback(null, isAllowed);
  },
});
