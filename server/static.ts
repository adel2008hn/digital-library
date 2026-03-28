import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  // هذا المسار يخرج من مجلد server ثم يذهب لـ dist/public حيث توجد ملفات الواجهة
  const distPath = path.resolve(__dirname, "..", "dist", "public");
  
  // في Vercel، قد تختلف المسارات قليلاً، لذا نضع هذا التحقق لضمان العمل
  const publicPath = fs.existsSync(distPath) 
    ? distPath 
    : path.resolve(__dirname, "public");

  if (!fs.existsSync(publicPath)) {
    console.log(`Warning: Build directory not found at ${publicPath}`);
  }

  // تقديم الملفات الثابتة (JS, CSS, Images)
  app.use(express.static(publicPath));

  // أي طلب لا يبدأ بـ /api يتم توجيهه لملف index.html لتعمل واجهة الـ React
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.resolve(publicPath, "index.html"), (err) => {
      if (err) {
        res.status(500).send(err);
      }
    });
  });
}