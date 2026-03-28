import express, { type Express } from "express";
import path from "path";
import fs from "fs";

export function serveStatic(app: Express) {
 // استخدم path.join مع __dirname لضمان الوصول للمسار في Vercel
const publicPath = path.resolve(process.cwd(), "dist", "public");

  // 1. تقديم الملفات الثابتة (CSS, JS, Images)
  app.use(express.static(publicPath));

  // 2. معالجة طلبات الصفحات (Frontend Routing)
  app.get("*", (req, res, next) => {
    // إذا كان الطلب يبدأ بـ /api نتركه يمر للمسارات البرمجية
    if (req.path.startsWith("/api")) return next();

    const indexPath = path.resolve(publicPath, "index.html");

    // التحقق من وجود الملف قبل إرساله لمنع خطأ 500
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      // رسالة خطأ واضحة في حال فقدان ملف الواجهة
      res.status(404).send("سيدي، لم أتمكن من العثور على ملف الواجهة الرئيسي.");
    }
  });
}