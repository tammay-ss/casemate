require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const auth = require("./middleware/auth");
const upload = require("./middleware/upload");
const { getBucket } = require("./config/firebase");
const User = require("./models/User");
const Client = require("./models/Client");
const Case = require("./models/Case");
const Event = require("./models/Event");
const Document = require("./models/Document");

const app = express();
const normalizeOrigin = (origin) => origin?.trim().replace(/\/+$/, "").toLowerCase();
const defaultOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://casemate-plum.vercel.app",
];
const envOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

const isAllowedOrigin = (origin) => {
  if (!origin) return true; // curl, server-to-server, Render health checks
  const norm = normalizeOrigin(origin);
  if (allowedOrigins.includes(norm)) return true;
  // Also permit vercel preview deployments for this project (e.g. casemate-xxx.vercel.app)
  if (/^https:\/\/casemate(-[a-z0-9_-]+)?\.vercel\.app$/.test(norm)) return true;
  return false;
};

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "8h" });
const own = (Model, id, userId) => Model.findOne({ _id: id, owner: userId });
const googleClient = new OAuth2Client();

function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }

// A warm server process reuses its module/global state. Reusing this promise
// prevents each request from opening another MongoDB connection.
let connectionPromise = global.casemateMongoConnection || null;
function connectDatabase() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!process.env.MONGO_URI) {
    const err = new Error("MONGO_URI environment variable is not configured.");
    err.status = 503;
    err.code = "DB_CONFIG_MISSING";
    return Promise.reject(err);
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    }).catch((error) => {
      connectionPromise = null;
      global.casemateMongoConnection = null;
      const customErr = new Error("Database connection unavailable. Please ensure your MongoDB Atlas cluster is running and Network Access allows access (0.0.0.0/0).");
      customErr.status = 503;
      customErr.code = "DATABASE_UNAVAILABLE";
      customErr.originalMessage = error.message;
      throw customErr;
    });
    global.casemateMongoConnection = connectionPromise;
  }
  return connectionPromise;
}

// Health endpoint — intentionally before the DB middleware so it always responds immediately
app.get("/api/health", (_req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.json({
    ok: true,
    status: "healthy",
    database: isDbConnected ? "connected" : "connecting_or_disconnected",
    uptime: Math.round(process.uptime()),
    ts: Date.now(),
  });
});

app.use((req, _res, next) => {
  connectDatabase().then(() => next()).catch(next);
});

// ── Auth ───────────────────────────────────────────────────────────────────
app.post("/api/auth/google", asyncRoute(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: "Google sign-in is not configured." });
  if (typeof req.body.credential !== "string") return res.status(400).json({ message: "Google sign-in credential is required." });
  const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: process.env.GOOGLE_CLIENT_ID });
  const profile = ticket.getPayload();
  if (!profile?.sub || !profile.email || !profile.email_verified) return res.status(401).json({ message: "Google did not provide a verified email address." });
  const email = profile.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: profile.sub }, { email }] });
  if (user) {
    if (!user.googleId) { user.googleId = profile.sub; await user.save(); }
  } else {
    user = await User.create({ name: profile.name || profile.given_name || email.split("@")[0], email, googleId: profile.sub });
  }
  res.json({ token: tokenFor(user), user: publicUser(user) });
}));
app.get("/api/auth/me", auth, asyncRoute(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: "User not found." });
  res.json(publicUser(user));
}));

// ── Clients ────────────────────────────────────────────────────────────────
// Helpers
const normalizeEmail = (e) => (e || "").trim().toLowerCase();
const normalizePhone = (p) => (p || "").replace(/\D/g, "");

app.get("/api/clients", auth, asyncRoute(async (req, res) => {
  const search = req.query.search?.trim();
  const query = { owner: req.user.id };
  if (search) query.$or = [{ name: new RegExp(search, "i") }, { phone: new RegExp(search, "i") }];
  res.json(await Client.find(query).sort({ updatedAt: -1 }));
}));

app.post("/api/clients", auth, asyncRoute(async (req, res) => {
  const { name, phone, email, address } = req.body;

  // Server-side validation
  if (!name || !name.trim()) return res.status(400).json({ message: "Client name is required.", field: "name" });
  if (!phone || !phone.trim()) return res.status(400).json({ message: "Phone number is required.", field: "phone" });
  if (/[a-zA-Z]/.test(phone)) return res.status(400).json({ message: "Phone number cannot contain letters.", field: "phone" });

  const phoneDigits = normalizePhone(phone);
  if (phoneDigits.length !== 10) {
    return res.status(400).json({ message: "Phone number must contain exactly 10 digits.", field: "phone" });
  }

  // Phone uniqueness check
  const existingPhone = await Client.findOne({ owner: req.user.id, phoneNormalized: phoneDigits });
  if (existingPhone) {
    return res.status(409).json({ message: "A client with this phone number already exists.", field: "phone" });
  }

  // Email format & uniqueness check (optional field)
  let emailNorm = "";
  if (email && email.trim()) {
    emailNorm = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ message: "Please enter a valid email address.", field: "email" });
    }
    const existingEmail = await Client.findOne({ owner: req.user.id, emailNormalized: emailNorm });
    if (existingEmail) {
      return res.status(409).json({ message: "A client with this email address already exists.", field: "email" });
    }
  }

  try {
    const client = await Client.create({
      owner: req.user.id,
      name: name.trim(),
      phone: phone.trim(),
      phoneNormalized: phoneDigits,
      email: email ? email.trim() : "",
      emailNormalized: emailNorm,
      address: address ? address.trim() : "",
    });
    res.status(201).json(client);
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern?.phoneNormalized || err.message?.includes("phoneNormalized")) {
        return res.status(409).json({ message: "A client with this phone number already exists.", field: "phone" });
      }
      if (err.keyPattern?.emailNormalized || err.message?.includes("emailNormalized")) {
        return res.status(409).json({ message: "A client with this email address already exists.", field: "email" });
      }
    }
    throw err;
  }
}));

app.patch("/api/clients/:id", auth, asyncRoute(async (req, res) => {
  const client = await own(Client, req.params.id, req.user.id);
  if (!client) return res.sendStatus(404);

  const { name, phone, email, address } = req.body;

  if (name !== undefined) {
    if (!name.trim()) return res.status(400).json({ message: "Client name is required.", field: "name" });
    client.name = name.trim();
  }

  if (phone !== undefined) {
    if (!phone.trim()) return res.status(400).json({ message: "Phone number is required.", field: "phone" });
    if (/[a-zA-Z]/.test(phone)) return res.status(400).json({ message: "Phone number cannot contain letters.", field: "phone" });
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ message: "Phone number must contain exactly 10 digits.", field: "phone" });
    }

    const existingPhone = await Client.findOne({
      owner: req.user.id,
      phoneNormalized: phoneDigits,
      _id: { $ne: client._id },
    });
    if (existingPhone) {
      return res.status(409).json({ message: "A client with this phone number already exists.", field: "phone" });
    }
    client.phone = phone.trim();
    client.phoneNormalized = phoneDigits;
  }

  if (email !== undefined) {
    if (email && email.trim()) {
      const emailNorm = normalizeEmail(email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ message: "Please enter a valid email address.", field: "email" });
      }
      const existingEmail = await Client.findOne({
        owner: req.user.id,
        emailNormalized: emailNorm,
        _id: { $ne: client._id },
      });
      if (existingEmail) {
        return res.status(409).json({ message: "A client with this email address already exists.", field: "email" });
      }
      client.email = email.trim();
      client.emailNormalized = emailNorm;
    } else {
      client.email = "";
      client.emailNormalized = "";
    }
  }

  if (address !== undefined) client.address = address ? address.trim() : "";

  try {
    res.json(await client.save());
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern?.phoneNormalized || err.message?.includes("phoneNormalized")) {
        return res.status(409).json({ message: "A client with this phone number already exists.", field: "phone" });
      }
      if (err.keyPattern?.emailNormalized || err.message?.includes("emailNormalized")) {
        return res.status(409).json({ message: "A client with this email address already exists.", field: "email" });
      }
    }
    throw err;
  }
}));

app.delete("/api/clients/:id", auth, asyncRoute(async (req, res) => {
  const client = await own(Client, req.params.id, req.user.id);
  if (!client) return res.sendStatus(404);
  const cases = await Case.find({ client: client.id, owner: req.user.id });
  await Event.deleteMany({ case: { $in: cases.map((item) => item.id) }, owner: req.user.id });
  await Document.deleteMany({ case: { $in: cases.map((item) => item.id) }, owner: req.user.id });
  await Case.deleteMany({ client: client.id, owner: req.user.id });
  await client.deleteOne();
  res.sendStatus(204);
}));

// ── Cases ──────────────────────────────────────────────────────────────────
app.get("/api/clients/:clientId/cases", auth, asyncRoute(async (req, res) =>
  res.json(await Case.find({ client: req.params.clientId, owner: req.user.id }).sort({ updatedAt: -1 }))
));
app.post("/api/clients/:clientId/cases", auth, asyncRoute(async (req, res) => {
  if (!await own(Client, req.params.clientId, req.user.id)) return res.sendStatus(404);
  const { title, matter, caseNumber, status, notes } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ message: "Case title is required.", field: "title" });
  res.status(201).json(await Case.create({ title: title.trim(), matter, caseNumber, status, notes, client: req.params.clientId, owner: req.user.id }));
}));
app.patch("/api/cases/:id", auth, asyncRoute(async (req, res) => {
  const item = await own(Case, req.params.id, req.user.id);
  if (!item) return res.sendStatus(404);
  Object.assign(item, req.body);
  res.json(await item.save());
}));
app.delete("/api/cases/:id", auth, asyncRoute(async (req, res) => {
  const item = await own(Case, req.params.id, req.user.id);
  if (!item) return res.sendStatus(404);
  await Event.deleteMany({ case: item.id, owner: req.user.id });
  await Document.deleteMany({ case: item.id, owner: req.user.id });
  await item.deleteOne();
  res.sendStatus(204);
}));

// ── Events ─────────────────────────────────────────────────────────────────
app.get("/api/events", auth, asyncRoute(async (req, res) => {
  const query = { owner: req.user.id };
  if (req.query.from || req.query.to) query.date = { ...(req.query.from && { $gte: req.query.from }), ...(req.query.to && { $lte: req.query.to }) };
  if (req.query.caseId) query.case = req.query.caseId;
  res.json(await Event.find(query).populate({ path: "case", populate: { path: "client", select: "name phone" } }).sort({ date: 1, time: 1 }));
}));
app.post("/api/events", auth, asyncRoute(async (req, res) => {
  if (!await own(Case, req.body.caseId, req.user.id)) return res.status(400).json({ message: "A valid case is required." });
  const { caseId, ...data } = req.body;
  res.status(201).json(await Event.create({ ...data, case: caseId, owner: req.user.id }));
}));
app.patch("/api/events/:id", auth, asyncRoute(async (req, res) => {
  const item = await own(Event, req.params.id, req.user.id);
  if (!item) return res.sendStatus(404);
  Object.assign(item, req.body);
  res.json(await item.save());
}));
app.patch("/api/events/:id/note", auth, asyncRoute(async (req, res) => {
  const item = await own(Event, req.params.id, req.user.id);
  if (!item) return res.sendStatus(404);
  item.note = req.body.note || "";
  res.json(await item.save());
}));
app.delete("/api/events/:id", auth, asyncRoute(async (req, res) => {
  const item = await own(Event, req.params.id, req.user.id);
  if (!item) return res.sendStatus(404);
  await item.deleteOne();
  res.sendStatus(204);
}));

// ── Dashboard ──────────────────────────────────────────────────────────────
app.get("/api/dashboard", auth, asyncRoute(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const owner = req.user.id;
  const [activeCases, todaysHearings, upcomingMeetings, pendingTasks] = await Promise.all([
    Case.countDocuments({ owner, status: "active" }),
    Event.countDocuments({ owner, date: today, kind: "hearing" }),
    Event.countDocuments({ owner, date: { $gte: today }, kind: "meeting", completed: false }),
    Event.countDocuments({ owner, kind: "task", completed: false }),
  ]);
  res.json({ activeCases, todaysHearings, upcomingMeetings, pendingTasks });
}));

// ── Documents ──────────────────────────────────────────────────────────────
app.post("/api/cases/:caseId/documents", auth, upload.single("file"), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Please select a supported file (PDF, DOCX, DOC, PNG, or JPEG)." });
  if (!await own(Case, req.params.caseId, req.user.id)) return res.sendStatus(404);
  const bucket = getBucket();
  if (!bucket) return res.status(503).json({ message: "Document storage is not configured. Please set Firebase environment variables on Render." });

  // Sanitize filename — strip path separators, limit length
  const safeName = req.file.originalname.replace(/[/\\]/g, "_").slice(0, 200);
  const storagePath = `cases/${req.params.caseId}/${crypto.randomUUID()}-${safeName}`;
  const file = bucket.file(storagePath);

  try {
    await file.save(req.file.buffer, { contentType: req.file.mimetype });
  } catch (storageErr) {
    console.error("Firebase Storage upload failed:", storageErr.message);
    return res.status(502).json({ message: "File storage failed. Please try again." });
  }

  let url;
  try {
    [url] = await file.getSignedUrl({ action: "read", expires: "03-01-2500" });
  } catch (urlErr) {
    // Metadata can still be saved without a URL — attempt cleanup
    await file.delete().catch(() => {});
    console.error("Signed URL generation failed:", urlErr.message);
    return res.status(502).json({ message: "File was uploaded but a download link could not be generated. Please try again." });
  }

  try {
    const doc = await Document.create({
      owner: req.user.id,
      case: req.params.caseId,
      name: safeName,
      contentType: req.file.mimetype,
      size: req.file.size,
      storagePath,
      url,
    });
    res.status(201).json(doc);
  } catch (dbErr) {
    // Metadata write failed — delete the orphaned file
    await file.delete().catch(() => {});
    console.error("Document metadata write failed:", dbErr.message);
    return res.status(500).json({ message: "File was uploaded but metadata could not be saved. The upload has been rolled back." });
  }
}));

app.get("/api/cases/:caseId/documents", auth, asyncRoute(async (req, res) =>
  res.json(await Document.find({ case: req.params.caseId, owner: req.user.id }).sort({ createdAt: -1 }))
));

app.delete("/api/cases/:caseId/documents/:id", auth, asyncRoute(async (req, res) => {
  const doc = await own(Document, req.params.id, req.user.id);
  if (!doc) return res.sendStatus(404);
  const bucket = getBucket();
  if (bucket && doc.storagePath) {
    await bucket.file(doc.storagePath).delete().catch(() => {});
  }
  await doc.deleteOne();
  res.sendStatus(204);
}));

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  const isDbErr = err.code === "DATABASE_UNAVAILABLE" ||
    err.code === "DB_CONFIG_MISSING" ||
    err.name === "MongoServerSelectionError" ||
    err.message?.includes("ENOTFOUND") ||
    err.message?.includes("buffering timed out");

  const status = err.status || (isDbErr ? 503 : 500);
  const message = isDbErr
    ? (err.message || "Database connection unavailable. Please check MongoDB Atlas cluster status.")
    : (err.message || "An unexpected server error occurred.");

  console.error(`[Error ${status}]`, err.message || err);

  res.status(status).json({
    message,
    code: err.code || (status === 503 ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR"),
    ...(err.field ? { field: err.field } : {}),
  });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  if (!process.env.JWT_SECRET) {
    console.warn("Warning: JWT_SECRET is not set in environment variables.");
  }

  // Bind and listen on 0.0.0.0:PORT immediately so Render health checks pass
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`CaseMate API listening on 0.0.0.0:${PORT}`);
    // Initiate background connection to MongoDB
    connectDatabase()
      .then(() => console.log("Connected to MongoDB Atlas successfully."))
      .catch((err) => {
        console.error("Warning: Initial MongoDB Atlas connection failed:", err.originalMessage || err.message);
        console.error("Server is still running on port", PORT, "to serve health checks and will retry on requests.");
      });
  });

  const shutdown = () => {
    server.close(() => {
      mongoose.connection.close(false).catch(() => {});
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
