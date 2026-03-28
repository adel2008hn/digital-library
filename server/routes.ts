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
import { storage, HARDCODED_ADMIN, pool } from "./storage";

const PgSession = connectPgSimple(session);

const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

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
  app.set("trust proxy", 1);
  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
        tableName: "session",
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: true,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
      },
    })
  );

  app.use("/uploads", express.static(uploadDir));

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

  // ========== File Upload ==========

  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({
      url: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
    });
  });

 // ========== نظام التعليقات المطور (التحكم بالتعليق الشخصي + صلاحيات الأدمن) ==========
  
 // 1. جلب التعليقات (يبقى كما هو)
app.get("/api/comments/:bookId", async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId);
    if (isNaN(bookId)) return res.status(400).json({ message: "ID الكتاب غير صالح" });
    const commentsList = await storage.getCommentsByBook(bookId);
    res.json(commentsList);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 2. إضافة تعليق (تأكد من تمرير الحقول كاملة للـ Storage)
app.post("/api/comments", async (req, res) => {
  try {
    // سيدي، نستخدم الـ sessionId القادم من req.body لضمان المزامنة مع الـ localStorage
    const { bookId, content, authorName, sessionId } = req.body;
    const newComment = await storage.createComment({
      bookId,
      content,
      authorName,
      sessionId: sessionId || getSessionId(req), // الأولوية للقادم من الفرونت إند
      likes: 0
    });
    res.status(201).json(newComment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 3. الحذف (مع الحماية التي وضعتها أنت سيدي)
app.delete("/api/comments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sessionId = req.body.sessionId || getSessionId(req); // الحصول على السيشين للتحقق

    // جلب التعليق للتأكد من الصلاحية
    const comment = await storage.getComment(id); // تأكد أن لديك دالة getComment في الـ storage
    if (!comment) return res.status(404).json({ message: "التعليق غير موجود" });

    let isAdmin = false;
    if (req.session?.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user?.role === "admin") isAdmin = true;
    }

    // السماح بالحذف إذا كان صاحب التعليق أو أدمن
    if (comment.sessionId === sessionId || isAdmin) {
      await storage.deleteComment(id);
      res.sendStatus(204);
    } else {
      res.status(403).json({ message: "لا تملك صلاحية حذف هذا التعليق" });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/comments/:id/like", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action } = req.body; // 'add' أو 'remove' سيدي

    // نستخدم التابع الجديد الذي سنضيفه في الـ storage بعد قليل
    const updated = await storage.toggleLike(id, action);
    
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 5. التعديل (PATCH) - يبقى كما هو في كودك
app.patch("/api/comments/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content, sessionId } = req.body;
    const comment = await storage.getComment(id);

    if (!comment) return res.status(404).json({ message: "التعليق غير موجود" });

    if (comment.sessionId === sessionId) {
      const updated = await storage.updateComment(id, content);
      res.json(updated);
    } else {
      res.status(403).json({ message: "لا تملك صلاحية تعديل هذا التعليق" });
    }
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

  return httpServer;
}