const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  // Normalized phone (digits only) used for uniqueness enforcement
  phoneNormalized: { type: String, trim: true, default: "" },
  email: { type: String, trim: true, default: "" },
  // Normalized email (trimmed, lowercase) used for uniqueness enforcement
  emailNormalized: { type: String, trim: true, lowercase: true, default: "" },
  address: { type: String, trim: true, default: "" },
}, { timestamps: true, toJSON: { virtuals: true } });

// Compound unique indexes: one email and one phone per owner
clientSchema.index(
  { owner: 1, emailNormalized: 1 },
  { unique: true, partialFilterExpression: { emailNormalized: { $gt: "" } }, name: "owner_email_unique" }
);

clientSchema.index(
  { owner: 1, phoneNormalized: 1 },
  { unique: true, partialFilterExpression: { phoneNormalized: { $gt: "" } }, name: "owner_phone_unique" }
);

module.exports = mongoose.model("Client", clientSchema);
