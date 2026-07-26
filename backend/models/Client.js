const mongoose = require("mongoose");
module.exports = mongoose.model("Client", new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  address: { type: String, trim: true },
}, { timestamps: true, toJSON: { virtuals: true } }));
