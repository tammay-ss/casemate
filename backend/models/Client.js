const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, default: "" },
  // Normalized email (trimmed, lowercase) used for uniqueness enforcement
  emailNormalized: { type: String, trim: true, lowercase: true, default: "" },
  address: { type: String, trim: true, default: "" },
}, { timestamps: true, toJSON: { virtuals: true } });

// Compound unique index: one email per owner (sparse so empty strings are excluded per-document).
// We use a partial filter expression so that blank emailNormalized values don't collide.
clientSchema.index(
  { owner: 1, emailNormalized: 1 },
  { unique: true, partialFilterExpression: { emailNormalized: { $gt: "" } }, name: "owner_email_unique" }
);

module.exports = mongoose.model("Client", clientSchema);
