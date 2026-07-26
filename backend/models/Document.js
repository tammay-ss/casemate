const mongoose = require("mongoose");
module.exports = mongoose.model("Document", new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  case: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  name: { type: String, required: true }, contentType: String, size: Number,
  storagePath: { type: String, required: true }, url: { type: String, required: true },
}, { timestamps: true, toJSON: { virtuals: true } }));
