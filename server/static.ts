import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export function serveStatic(app: Express) {
  // طريقة آمنة للحصول على المسار في Vercel
  let __dirname;
  try {
    const __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
  } catch (e) {
    // إذا فشل (بسبب cjs)، نستخدم المسار الافتراضي لـ Node
    __dirname = process.cwd();
  }

  // المسار الذي يبحث فيه Vercel عن الملفات بعد البناء
  const pathsToTry = [
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(__dirname, "dist", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "public")
  ];

  let publicPath = "";
  for (const p of pathsToTry) {
    if (fs.existsSync(p) && fs.readdirSync(p).includes("index.html")) {
      publicPath = p;
      break;
    }
  }

  if (!publicPath) {
    console.error("Critical: Could not find build directory in any of:", pathsToTry);
    return;
  }

  app.use(express.static(publicPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.resolve(publicPath, "index.html"));
  });
}