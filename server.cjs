var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_vite = require("vite");
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var firebaseAdminApp = null;
function getFirebaseAdmin() {
  if (!firebaseAdminApp) {
    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (serviceAccountJson) {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson);
          firebaseAdminApp = (0, import_app.initializeApp)({
            credential: (0, import_app.cert)(serviceAccount)
          });
        } catch (parseError) {
          console.error(
            "Invalid JSON in FIREBASE_SERVICE_ACCOUNT_KEY environment variable.",
            parseError
          );
        }
      } else {
        firebaseAdminApp = (0, import_app.initializeApp)();
      }
    } catch (error) {
      console.warn("Could not initialize Firebase Admin SDK.", error);
    }
  }
  return firebaseAdminApp;
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json());
  const baseUrl = process.env.VITE_BASE_URL || "/pustaka-digital/";
  const basePath = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const apiRouter = import_express.default.Router();
  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });
  apiRouter.post("/users/:uid/password", async (req, res) => {
    try {
      const { uid } = req.params;
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }
      const adminApp = getFirebaseAdmin();
      if (!adminApp) {
        return res.status(500).json({ error: "Firebase Admin SDK is not initialized." });
      }
      await (0, import_auth.getAuth)(adminApp).updateUser(uid, { password });
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
      console.error("Update password error:", error);
      let errorMessage = error.message;
      if (errorMessage?.includes("identitytoolkit.googleapis.com")) {
        errorMessage = "Konfigurasi Firebase Admin tidak valid. Tambahkan FIREBASE_SERVICE_ACCOUNT_KEY di Secrets (Environment Variables).";
      }
      res.status(500).json({ error: errorMessage });
    }
  });
  apiRouter.post("/users/:uid/delete", async (req, res) => {
    try {
      const { uid } = req.params;
      const adminApp = getFirebaseAdmin();
      if (!adminApp) {
        return res.status(500).json({ error: "Firebase Admin SDK is not initialized." });
      }
      await (0, import_auth.getAuth)(adminApp).deleteUser(uid);
      res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.use("/api", apiRouter);
  app.use("/pustaka-digital/api", apiRouter);
  if (basePath && basePath !== "/pustaka-digital") {
    app.use(`${basePath}/api`, apiRouter);
  }
  app.get("/", (req, res, next) => {
    if (baseUrl !== "/" && req.path === "/") {
      return res.redirect(baseUrl);
    }
    next();
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    if (baseUrl !== "/") {
      app.use(baseUrl, import_express.default.static(distPath));
    }
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.use((req, res, next) => {
    if (req.path.includes("/api/")) {
      res.status(404).json({ error: `API Route not found: ${req.method} ${req.path}` });
    } else {
      next();
    }
  });
  app.use(
    (err, req, res, next) => {
      console.error("Express global error handler caught:", err);
      if (res.headersSent) {
        return next(err);
      }
      res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
    }
  );
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
