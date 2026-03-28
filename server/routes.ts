import express from "express";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { storage, HARDCODED_ADMIN, pool } from "./storage.js";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const PgSession = connectPgSimple(session);

// التعديل الملكي للمجلدات سيدي
const isProduction = process.env.NODE_ENV === "production";
// نستخدم مساراً نسبياً متوافقاً مع بنية المشروع
const uploadDir = path.resolve(process.cwd(), "public", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = [".pdf", ".doc", ".docx"];
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  // تم التأكيد سيدي: الحد 20 جيجابايت
  limits: { fileSize: 20 * 1024 * 1024 * 1024 }, 
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOC files are allowed"));
    }
  },
});

declare module "express-session" {
  interface SessionData {
    userId?: number;
    sessionId?: string;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const isProduction = process.env.NODE_ENV === "production";
 // سيدي، هذا السطر يخبر السيرفر أن يثق في Vercel كوسيط (Proxy)
  app.set("trust proxy", 1); 

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        tableName: "session",
      }),
      secret: process.env.SESSION_SECRET || "default_secret",
      resave: false,
      saveUninitialized: false, // سيدي، جعلناها false لمنع إنشاء جلسات وهمية غير ضرورية
      proxy: true,              // ضروري جداً ليعمل الـ Cookie خلف بروكسي Vercel
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: true,           // يجب أن تكون true لأن Vercel يستخدم HTTPS دائماً
      },
    })
  );

  app.use("/uploads", express.static(uploadDir, { fallthrough: true }));

  function getSessionId(req: Request): string {
    if (!req.session.sessionId) {
      req.session.sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return req.session.sessionId;
  }

  const requireAuth = async (req: any, res: any, next: any) => {
    const userId = Number(req.session.userId);
    if (!userId || isNaN(userId)) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(userId);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    req.user = user;
    next();
  };

  // ========== Auth ==========

  app.get("/api/auth/check-setup", async (_req, res) => {
    try {
      const hasAdmin = await storage.hasAdmin();
      res.json({ needsSetup: !hasAdmin });
    } catch {
      res.json({ needsSetup: false });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (username === HARDCODED_ADMIN.username && password === HARDCODED_ADMIN.password) {
        let user = await storage.getUserByUsername(HARDCODED_ADMIN.username);
        if (!user) {
          const hashedPassword = await bcrypt.hash(HARDCODED_ADMIN.password, 10);
          user = await storage.createUser({
            username: HARDCODED_ADMIN.username,
            password: hashedPassword,
            role: HARDCODED_ADMIN.role,
            isActive: HARDCODED_ADMIN.isActive,
          });
        }
        req.session.userId = user.id;
        return res.json({ id: user.id, username: user.username, role: user.role });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      if (!user.isActive) return res.status(403).json({ message: "Account disabled" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      req.session.userId = user.id;
      res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "User not found" });
      res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.userId = undefined;
    res.json({ success: true });
  });

  // ========== Admin: Authors ==========

  app.get("/api/admin/authors", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const authors = await storage.getAuthors();
      res.json(authors.map((a) => ({ id: a.id, username: a.username, role: a.role, isActive: a.isActive })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/authors", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      const hashedPassword = await bcrypt.hash(password, 10);
      const newAuthor = await storage.createUser({ username, password: hashedPassword, role: "author", isActive: true });
      res.status(201).json({ id: newAuthor.id, username: newAuthor.username, role: newAuthor.role, isActive: newAuthor.isActive });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/authors/:id/toggle", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      await storage.toggleAuthorStatus(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/authors/:id", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      await storage.deleteAuthor(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== Books ==========

  app.get("/api/books/my", requireAuth, async (req: any, res) => {
    try {
      const books = await storage.getBooksByAuthor(req.user.id);
      res.json(books);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/books", async (req, res) => {
    try {
      const { search, category } = req.query;
      const result = await storage.getBooks(search as string, category as string);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/books/:id/suggested", async (req, res) => {
    try {
      const suggested = await storage.getSuggestedBooks(parseInt(req.params.id));
      res.json(suggested);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/books/:id", async (req, res) => {
    try {
      const book = await storage.getBook(parseInt(req.params.id));
      if (!book) return res.status(404).json({ message: "Book not found" });
      res.json(book);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/books", requireAuth, async (req: any, res) => {
    try {
      const data = req.body;
      const title = data.title;
      const authorName = data.author_name || data.authorName;
      const mainCategory = data.category_main || data.mainCategory;
      const subCategory = data.category_sub || data.subCategory;
      const volumes = data.parts_count || data.volumes;
      const fileUrl = data.pdf_url || data.fileUrl;
      const fileName = data.fileName;

      if (!title || !authorName || !mainCategory) {
        return res.status(400).json({ message: "يرجى ملء الحقول الأساسية: العنوان، المؤلف، والتصنيف" });
      }

      const book = await storage.createBook({
        title,
        authorName,
        authorId: req.user.id,
        mainCategory,
        subCategory,
        volumes: Number(volumes) || 1,
        coverUrl: data.cover_url || data.coverUrl,
        description: data.description || "",
        fileUrl,
        fileName,
      });

      res.status(201).json(book);
    } catch (error: any) {
      console.error("Error creating book:", error);
      res.status(500).json({ message: error.message || "حدث خطأ أثناء إضافة الكتاب" });
    }
  });

  app.patch("/api/books/:id", requireAuth, async (req: any, res) => {
    try {
      const bookId = parseInt(req.params.id);
      const book = await storage.getBook(bookId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      if (req.user.role !== "admin" && book.authorId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const data = req.body;
      const updated = await storage.updateBook(bookId, {
        title: data.title || book.title,
        authorName: data.authorName || book.authorName,
        mainCategory: data.mainCategory || book.mainCategory,
        subCategory: data.subCategory || book.subCategory,
        volumes: data.volumes !== undefined ? Number(data.volumes) : book.volumes,
        coverUrl: data.coverUrl !== undefined ? data.coverUrl : book.coverUrl,
        description: data.description !== undefined ? data.description : book.description,
        fileUrl: data.fileUrl !== undefined ? data.fileUrl : book.fileUrl,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating book:", error);
      res.status(500).json({ message: error.message || "حدث خطأ أثناء تعديل الكتاب" });
    }
  });

  app.delete("/api/books/:id", requireAuth, async (req: any, res) => {
    try {
      const bookId = parseInt(req.params.id);
      const book = await storage.getBook(bookId);
      if (!book) return res.status(404).json({ message: "Book not found" });

      if (req.user.role !== "admin" && book.authorId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteBook(bookId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== Ratings ==========

  app.post("/api/books/:id/rate", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const { rating } = req.body;
      if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: "Invalid rating" });
      await storage.rateBook(parseInt(req.params.id), sessionId, rating);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== Favorites ==========

  app.get("/api/favorites", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const favs = await storage.getFavorites(sessionId);
      res.json(favs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/favorites/:id", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      await storage.toggleFavorite(parseInt(req.params.id), sessionId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== Bookmarks ==========

  app.get("/api/bookmarks/:bookId", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const bm = await storage.getBookmark(parseInt(req.params.bookId), sessionId);
      res.json(bm);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bookmarks/:bookId", async (req, res) => {
    try {
      const sessionId = getSessionId(req);
      const { page } = req.body;
      await storage.setBookmark(parseInt(req.params.bookId), sessionId, page || 1);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== Stats ==========

  app.get("/api/stats", async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/stats/visit", async (_req, res) => {
    try {
      await storage.incrementVisits();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ========== QR Code ==========

  app.get("/api/qrcode", async (req, res) => {
    try {
      const protocol = isProduction ? "https" : "http";
      const host = req.headers.host || "localhost:5000";
      const url = `${protocol}://${host}`;
      const qrCode = await QRCode.toDataURL(url, { width: 300, margin: 2 });
      res.json({ qrCode });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

 // ========== File Upload to Supabase (الملك عادل) ==========

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "سيدي، يجب تسجيل الدخول أولاً" });
      if (!req.file) return res.status(400).json({ message: "لم يتم اختيار ملف" });

      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${fileExt}`;

      // رفع الملف إلى Bucket اسمه 'books' في سوبابيس
      // سيدي، تأكد من إنشاء Bucket بهذا الاسم وجعله Public
      const { data, error } = await supabase.storage
        .from('books') 
        .upload(fileName, fs.readFileSync(file.path), {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;

      // الحصول على الرابط العام (Public URL)
      const { data: urlData } = supabase.storage
        .from('books')
        .getPublicUrl(fileName);

      // حذف الملف المؤقت من سيرفر Render للحفاظ على المساحة
      fs.unlinkSync(file.path);

      res.json({
        url: urlData.publicUrl,
        fileName: file.originalname,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "فشل الرفع لسوبابيس: " + error.message });
    }
  });

  return httpServer;
}