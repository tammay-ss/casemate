const mongoose = require("mongoose");
module.exports = mongoose.model("Event", new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  case: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  title: { type: String, required: true, trim: true },
  date: { type: String, required: true, index: true },
  time: { type: String, required: true },
  kind: { type: String, enum: ["hearing", "meeting", "task"], default: "task" },
  note: { type: String, default: "" },
  completed: { type: Boolean, default: false },
}, { timestamps: true, toJSON: { virtuals: true } }));
