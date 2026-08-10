require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const auth = require("./middleware/auth");
const upload = require("./middleware/upload");
const { getBucket } = require("./config/firebase");
const User = require("./models/User");
const Client = require("./models/Client");
const Case = require("./models/Case");
const Event = require("./models/Event");
const Document = require("./models/Document");

const app = express();
const normalizeOrigin = (origin) => origin?.trim().replace(/\/+$/, "");
const allowedOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Requests from curl, Render health checks, and server-to-server tools have no Origin header.
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const tokenFor = (user) => jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "8h" });
const own = (Model, id, userId) => Model.findOne({ _id: id, owner: userId });
const googleClient = new OAuth2Client();

function publicUser(user) { return { id: user.id, name: user.name, email: user.email }; }

// A warm Vercel function reuses its module/global state. Reusing this promise
// prevents each request from opening another MongoDB connection.
let connectionPromise = global.casemateMongoConnection || null;
function connectDatabase() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!process.env.MONGO_URI) return Promise.reject(new Error("MONGO_URI must be set."));

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    }).catch((error) => {
      connectionPromise = null;
      global.casemateMongoConnection = null;
      throw error;
    });
    global.casemateMongoConnection = connectionPromise;
  }
  return connectionPromise;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use((req, _res, next) => {
  connectDatabase().then(() => next()).catch(next);
});
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
app.get("/api/auth/me", auth, asyncRoute(async (req, res) => { const user = await User.findById(req.user.id); res.json({ id: user.id, name: user.name, email: user.email }); }));

app.get("/api/clients", auth, asyncRoute(async (req, res) => {
  const search = req.query.search?.trim(); const query = { owner: req.user.id };
  if (search) query.$or = [{ name: new RegExp(search, "i") }, { phone: new RegExp(search, "i") }];
  res.json(await Client.find(query).sort({ updatedAt: -1 }));
}));
app.post("/api/clients", auth, asyncRoute(async (req, res) => res.status(201).json(await Client.create({ ...req.body, owner: req.user.id }))));
app.patch("/api/clients/:id", auth, asyncRoute(async (req, res) => { const client = await own(Client, req.params.id, req.user.id); if (!client) return res.sendStatus(404); Object.assign(client, req.body); res.json(await client.save()); }));
app.delete("/api/clients/:id", auth, asyncRoute(async (req, res) => { const client = await own(Client, req.params.id, req.user.id); if (!client) return res.sendStatus(404); const cases = await Case.find({ client: client.id, owner: req.user.id }); await Event.deleteMany({ case: { $in: cases.map((item) => item.id) }, owner: req.user.id }); await Document.deleteMany({ case: { $in: cases.map((item) => item.id) }, owner: req.user.id }); await Case.deleteMany({ client: client.id, owner: req.user.id }); await client.deleteOne(); res.sendStatus(204); }));

app.get("/api/clients/:clientId/cases", auth, asyncRoute(async (req, res) => res.json(await Case.find({ client: req.params.clientId, owner: req.user.id }).sort({ updatedAt: -1 }))));
app.post("/api/clients/:clientId/cases", auth, asyncRoute(async (req, res) => { if (!await own(Client, req.params.clientId, req.user.id)) return res.sendStatus(404); res.status(201).json(await Case.create({ ...req.body, client: req.params.clientId, owner: req.user.id })); }));
app.patch("/api/cases/:id", auth, asyncRoute(async (req, res) => { const item = await own(Case, req.params.id, req.user.id); if (!item) return res.sendStatus(404); Object.assign(item, req.body); res.json(await item.save()); }));
app.delete("/api/cases/:id", auth, asyncRoute(async (req, res) => { const item = await own(Case, req.params.id, req.user.id); if (!item) return res.sendStatus(404); await Event.deleteMany({ case: item.id, owner: req.user.id }); await Document.deleteMany({ case: item.id, owner: req.user.id }); await item.deleteOne(); res.sendStatus(204); }));

app.get("/api/events", auth, asyncRoute(async (req, res) => { const query = { owner: req.user.id }; if (req.query.from || req.query.to) query.date = { ...(req.query.from && { $gte: req.query.from }), ...(req.query.to && { $lte: req.query.to }) }; if (req.query.caseId) query.case = req.query.caseId; res.json(await Event.find(query).populate({ path: "case", populate: { path: "client", select: "name phone" } }).sort({ date: 1, time: 1 })); }));
app.post("/api/events", auth, asyncRoute(async (req, res) => { if (!await own(Case, req.body.caseId, req.user.id)) return res.status(400).json({ message: "A valid case is required." }); const { caseId, ...data } = req.body; res.status(201).json(await Event.create({ ...data, case: caseId, owner: req.user.id })); }));
app.patch("/api/events/:id", auth, asyncRoute(async (req, res) => { const item = await own(Event, req.params.id, req.user.id); if (!item) return res.sendStatus(404); Object.assign(item, req.body); res.json(await item.save()); }));
app.patch("/api/events/:id/note", auth, asyncRoute(async (req, res) => { const item = await own(Event, req.params.id, req.user.id); if (!item) return res.sendStatus(404); item.note = req.body.note || ""; res.json(await item.save()); }));
app.delete("/api/events/:id", auth, asyncRoute(async (req, res) => { const item = await own(Event, req.params.id, req.user.id); if (!item) return res.sendStatus(404); await item.deleteOne(); res.sendStatus(204); }));

app.get("/api/dashboard", auth, asyncRoute(async (req, res) => { const today = new Date().toISOString().slice(0, 10); const owner = req.user.id; const [activeCases, todaysHearings, upcomingMeetings, pendingTasks] = await Promise.all([Case.countDocuments({ owner, status: "active" }), Event.countDocuments({ owner, date: today, kind: "hearing" }), Event.countDocuments({ owner, date: { $gte: today }, kind: "meeting", completed: false }), Event.countDocuments({ owner, kind: "task", completed: false })]); res.json({ activeCases, todaysHearings, upcomingMeetings, pendingTasks }); }));
app.post("/api/cases/:caseId/documents", auth, upload.single("file"), asyncRoute(async (req, res) => { if (!req.file) return res.status(400).json({ message: "Upload a PDF, PNG, or JPEG file." }); if (!await own(Case, req.params.caseId, req.user.id)) return res.sendStatus(404); const bucket = getBucket(); if (!bucket) return res.status(503).json({ message: "Document storage is not configured." }); const storagePath = `cases/${req.params.caseId}/${crypto.randomUUID()}-${req.file.originalname}`; const file = bucket.file(storagePath); await file.save(req.file.buffer, { contentType: req.file.mimetype }); const [url] = await file.getSignedUrl({ action: "read", expires: "03-01-2500" }); res.status(201).json(await Document.create({ owner: req.user.id, case: req.params.caseId, name: req.file.originalname, contentType: req.file.mimetype, size: req.file.size, storagePath, url })); }));
app.get("/api/cases/:caseId/documents", auth, asyncRoute(async (req, res) => res.json(await Document.find({ case: req.params.caseId, owner: req.user.id }).sort({ createdAt: -1 }))));

app.use((err, _req, res, _next) => { console.error(err); res.status(err.status || 500).json({ message: err.message || "Something went wrong." }); });
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET must be set in .env");
    process.exit(1);
  }
  connectDatabase()
    .then(() => app.listen(PORT, () => console.log(`CaseMate API running on port ${PORT}`)))
    .catch((err) => {
      console.error("Could not connect to MongoDB:", err.message);
      console.error("Check that the Atlas cluster is running and that your current IP is in Network Access.");
      process.exit(1);
    });
}
