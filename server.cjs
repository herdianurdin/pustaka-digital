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
var import_multer = __toESM(require("multer"), 1);
var import_rest = require("@octokit/rest");
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
function decodeToken(input) {
  if (!input) return "";
  let val = input.trim();
  if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
    val = val.slice(1, -1).trim();
  }
  if (val.startsWith("ghp_") || val.startsWith("github_pat_")) {
    return val;
  }
  if (val.startsWith("rev:")) {
    const reversed = val.slice(4).split("").reverse().join("");
    try {
      return Buffer.from(reversed, "base64").toString("utf-8");
    } catch {
    }
  }
  try {
    const decoded = Buffer.from(val, "base64").toString("utf-8");
    if (decoded.startsWith("ghp_") || decoded.startsWith("github_pat_") || decoded.length > 20) {
      return decoded;
    }
  } catch {
  }
  return val;
}
var octokitClient = null;
function getOctokit() {
  if (!octokitClient) {
    const rawToken = process.env.VITE_GITHUB_PAT_ENC || process.env.VITE_GITHUB_PAT || process.env.GITHUB_PAT || "";
    const token = decodeToken(rawToken);
    octokitClient = new import_rest.Octokit({ auth: token });
  }
  return octokitClient;
}
var GITHUB_OWNER = process.env.VITE_GITHUB_OWNER || "";
var GITHUB_REPO = process.env.VITE_GITHUB_REPO || "";
var cachedDefaultBranch = null;
async function getDefaultBranch(octokit) {
  if (cachedDefaultBranch) return cachedDefaultBranch;
  try {
    const { data } = await octokit.repos.get({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO
    });
    cachedDefaultBranch = data.default_branch || "main";
    return cachedDefaultBranch;
  } catch (err) {
    console.warn(
      "Failed to fetch default branch from GitHub, defaulting to 'main':",
      err.message
    );
    return "main";
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    console.log(`[DEBUG] Incoming request: ${req.method} ${req.url}`);
    next();
  });
  const upload = (0, import_multer.default)({ storage: import_multer.default.memoryStorage() });
  const baseUrl = process.env.VITE_BASE_URL || "/pustaka-digital/";
  const basePath = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const apiRouter = import_express.default.Router();
  apiRouter.post("/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const octokit = getOctokit();
      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const ext = import_path.default.extname(originalName);
      const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const extLower = ext.toLowerCase();
      const isPdf = extLower === ".pdf" || req.file.mimetype === "application/pdf";
      const folderPath = isPdf ? "books" : "covers";
      const filePath = `${folderPath}/${uniqueFilename}`;
      const base64Content = fileBuffer.toString("base64");
      const defaultBranch = await getDefaultBranch(octokit);
      let response;
      try {
        response = await octokit.repos.createOrUpdateFileContents({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: filePath,
          message: `Upload ${isPdf ? "book PDF" : "book cover"}: ${originalName}`,
          content: base64Content,
          branch: defaultBranch
        });
      } catch (branchError) {
        console.warn(
          `Failed to upload file to branch '${defaultBranch}', retrying without branch parameter (empty repository fallback)...`,
          branchError.message
        );
        response = await octokit.repos.createOrUpdateFileContents({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path: filePath,
          message: `Upload ${isPdf ? "book PDF" : "book cover"}: ${originalName}`,
          content: base64Content
        });
      }
      const cdnUrl = `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@${defaultBranch}/${filePath}`;
      res.json({
        success: true,
        url: cdnUrl,
        filePath,
        githubResponse: response.data
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: "Failed to upload file to GitHub",
        details: error.message
      });
    }
  });
  apiRouter.post("/delete-file", async (req, res) => {
    try {
      const { filePath } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "No filePath provided" });
      }
      const filePathStr = String(filePath);
      if (filePathStr.startsWith("http") || filePathStr.includes("dummy") || !filePathStr.includes("/")) {
        return res.json({
          success: true,
          message: "Skipped deleting default or external path"
        });
      }
      const octokit = getOctokit();
      const defaultBranch = await getDefaultBranch(octokit);
      try {
        let sha;
        try {
          const { data } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: filePathStr,
            ref: defaultBranch
          });
          sha = data.sha;
        } catch (getErr) {
          console.warn(
            `Failed to get content on branch '${defaultBranch}', retrying without ref parameter...`,
            getErr.message
          );
          const { data } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: filePathStr
          });
          sha = data.sha;
        }
        if (sha) {
          try {
            await octokit.repos.deleteFile({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              path: filePathStr,
              message: `Delete book file: ${filePathStr}`,
              sha,
              branch: defaultBranch
            });
          } catch (delErr) {
            console.warn(
              `Failed to delete file on branch '${defaultBranch}', retrying without branch parameter...`,
              delErr.message
            );
            await octokit.repos.deleteFile({
              owner: GITHUB_OWNER,
              repo: GITHUB_REPO,
              path: filePathStr,
              message: `Delete book file: ${filePathStr}`,
              sha
            });
          }
          console.log(`Successfully deleted file from GitHub: ${filePathStr}`);
        }
      } catch (ghErr) {
        if (ghErr.status === 404) {
          console.warn(
            `File not found on GitHub, skipping deletion: ${filePathStr}`
          );
        } else {
          throw ghErr;
        }
      }
      res.json({
        success: true,
        message: "File deleted from GitHub successfully"
      });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({
        error: "Failed to delete file from GitHub",
        details: error.message
      });
    }
  });
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
