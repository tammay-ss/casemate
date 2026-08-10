const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  googleId: { type: String, required: true, unique: true },
}, { timestamps: true, toJSON: { virtuals: true } });

module.exports = mongoose.model("User", userSchema);
