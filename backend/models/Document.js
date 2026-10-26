const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    case: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    name: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    fileId: { type: mongoose.Schema.Types.ObjectId, index: true },
    storagePath: { type: String },
    url: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

module.exports = mongoose.model("Document", documentSchema);
