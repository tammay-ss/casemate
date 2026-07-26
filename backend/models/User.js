const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true, toJSON: { virtuals: true } });

userSchema.methods.verifyPassword = function (password) { return bcrypt.compare(password, this.passwordHash); };
module.exports = mongoose.model("User", userSchema);
