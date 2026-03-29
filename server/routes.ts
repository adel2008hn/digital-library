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
  limits: { fileSize: 20 * 1024 * 1024 * 1024 }, // سيدي، 20 جيجابايت كما طلبت
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

export async function registerRoutes(app: Express): Promise<void> {
  // 1. إعداد الثقة في البروكسي سيدي
  app.set("trust proxy", 1); 

  // 2. إعداد الجلسات
  app.use(session({
    store: new PgSession({ 
      pool, 
      tableName: 'session',
      createTableIfMissing: true 
    }),
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
      secure: process.env.NODE_ENV === "production", 
      httpOnly: true, 
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000 
    }
  }));

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

  // ========== Books ==========
  app.get("/api/books", async (req, res) => {
    try {
      const { search, category } = req.query;
      const result = await storage.getBooks(search as string, category as string);
      res.json(result);
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
      const book = await storage.createBook({
        title: data.title,
        authorName: data.authorName || data.author_name,
        authorId: req.user.id,
        mainCategory: data.mainCategory || data.category_main,
        subCategory: data.subCategory || data.category_sub,
        volumes: Number(data.volumes || data.parts_count) || 1,
        coverUrl: data.coverUrl || data.cover_url,
        description: data.description || "",
        fileUrl: data.fileUrl || data.pdf_url,
        fileName: data.fileName,
      });
      res.status(201).json(book);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== File Upload to Supabase ==========
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "يجب تسجيل الدخول سيدي" });
      if (!req.file) return res.status(400).json({ message: "لم يتم اختيار ملف" });

      const file = req.file;
      const fileExt = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${fileExt}`;

      const { data, error } = await supabase.storage
        .from('books') 
        .upload(fileName, fs.readFileSync(file.path), {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('books')
        .getPublicUrl(fileName);

      fs.unlinkSync(file.path);

      res.json({
        url: urlData.publicUrl,
        fileName: file.originalname,
      });
    } catch (error: any) {
      res.status(500).json({ message: "فشل الرفع: " + error.message });
    }
  });

  // ========== Stats & QR ==========
  app.get("/api/stats", async (_req, res) => {
    try { res.json(await storage.getStats()); } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/qrcode", async (req, res) => {
    try {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = req.headers.host || "localhost:5000";
      const qrCode = await QRCode.toDataURL(`${protocol}://${host}`, { width: 300 });
      res.json({ qrCode });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });
}