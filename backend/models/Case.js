const mongoose = require("mongoose");
module.exports = mongoose.model("Case", new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
  title: { type: String, required: true, trim: true, index: true },
  matter: { type: String, trim: true },
  caseNumber: { type: String, trim: true },
  status: { type: String, enum: ["active", "closed", "on-hold"], default: "active" },
  notes: { type: String, default: "" },
}, { timestamps: true, toJSON: { virtuals: true } }));
