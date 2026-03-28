import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// --- جدول المستخدمين ---
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("author"),
  isActive: boolean("is_active").notNull().default(true),
});

// --- جدول الكتب (المصحح ليتوافق مع Supabase 100%) ---
export const books = pgTable("books", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  authorName: text("author_name").notNull(), 
  authorId: integer("author").notNull(), // تم التغيير من author_id إلى author ليطابق الصورة
  mainCategory: text("main_category").notNull(), 
  subCategory: text("sub_category").notNull(),   
  volumes: integer("volumes").default(1),
  coverUrl: text("cover_url"),
  description: text("description"),
  fileUrl: text("file_url"), 
  fileName: text("file_name"),
  totalRating: integer("total_rating").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- جدول التقييمات ---
export const ratings = pgTable("ratings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer("book_id").notNull(),
  sessionId: text("session_id").notNull(),
  rating: integer("rating").notNull(),
});

// --- جدول المفضلة ---
export const favorites = pgTable("favorites", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer("book_id").notNull(),
  sessionId: text("session_id").notNull(),
});

// --- جدول علامات القراءة (Bookmarks) ---
export const bookmarks = pgTable("bookmarks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer("book_id").notNull(),
  sessionId: text("session_id").notNull(),
  page: integer("page").notNull().default(1),
});

// --- جدول إحصائيات الموقع ---
export const siteStats = pgTable("site_stats", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  visits: integer("visits").notNull().default(0),
});

// --- مخططات التحقق (Zod Schemas) المصححة سيدي ---

// ملاحظة: نستخدم النوع الخام أولاً ثم نختار الحقول المطلوبة لضمان التوافق
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
  isActive: true,
});

export const insertBookSchema = createInsertSchema(books).pick({
  title: true,
  authorName: true,
  authorId: true,
  mainCategory: true,
  subCategory: true,
  volumes: true,
  coverUrl: true,
  description: true,
  fileUrl: true,
  fileName: true,
});

export const insertRatingSchema = createInsertSchema(ratings).pick({
  bookId: true,
  sessionId: true,
  rating: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).pick({
  bookId: true,
  sessionId: true,
});

export const insertBookmarkSchema = createInsertSchema(bookmarks).pick({
  bookId: true,
  sessionId: true,
  page: true,
});

// --- تصدير الأنواع (Types) ---
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertBookmark = z.infer<typeof insertBookmarkSchema>;
export type Bookmark = typeof bookmarks.$inferSelect;
export type SiteStats = typeof siteStats.$inferSelect;

// --- تصنيفات الكتب ---
export const categories: Record<string, string[]> = {
  "أعمال طلاب المدرسة": ["مقالات أدبية", "قصص قصيرة", "قصائد شعرية", "بحوث لغوية", "مساهمات طلابية"],
  "علوم النحو والصرف": ["النحو الأساسي", "شرح القواعد", "إعراب الأدوات", "متون النحو", "فقه اللغة", "النحو الحديث"],
  "علوم البلاغة": ["علم البيان", "علم البديع", "تعليم البلاغة", "علم المعاني", "البلاغة الشاملة", "دراسات بلاغية"],
  "الأدب والنقد": ["فن الخطابة", "الأدب والموسيقى", "النقد الحديث", "فنون الكتابة", "موسوعات أدبية", "القصص النثري"],
  "الشعر": ["شعر الحكمة والفخر", "الشعر الجاهلي والمعلقات", "الشعر العربي الحديث", "عيون الشعر القديم", "مختارات الشعر العربي", "الشعر العربي المعاصر"],
  "علم العروض والقوافي": ["بحور الشعر", "صناعة الشعر", "القوافي", "أوزان الشعر", "قواعد العروض", "النقد الشعري"],
  "المعاجم والقواميس": ["المعاجم اللغوية", "معاجم الألفاظ", "فلسفة اللغة", "القواميس الموسوعية", "غريب الألفاظ", "المعاجم الحديثة"],
  "تاريخ الأدب العربي": ["العصور الأدبية", "الدراسات الاستشراقية", "روائع الأدب", "التأريخ الأدبي", "الأدب الإسلامي", "الأدب الجاهلي"],
};

// --- التصنيفات ذات الصلة ---
export const relatedCategories: Record<string, string[]> = {
  "أعمال طلاب المدرسة": ["الأدب والنقد", "الشعر"], 
  "علوم النحو والصرف": ["علوم البلاغة", "المعاجم والقواميس"],
  "علوم البلاغة": ["علوم النحو والصرف", "الأدب والنقد"],
  "الأدب والنقد": ["علوم البلاغة", "الشعر", "أعمال طلاب المدرسة"],
  "الشعر": ["علم العروض والقوافي", "الأدب والنقد", "أعمال طلاب المدرسة"],
  "علم العروض والقوافي": ["الشعر", "علوم البلاغة"],
  "المعاجم والقواميس": ["علوم النحو والصرف", "تاريخ الأدب العربي"],
  "تاريخ الأدب العربي": ["الأدب والنقد", "الشعر"],
};

// في schema.ts
export const comments = pgTable("comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  bookId: integer("book_id").notNull(),
  authorName: text("author_name"),
  content: text("content").notNull(),
  sessionId: text("session_id").notNull(), // الحقل المطلوب للتحقق
  likes: integer("likes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  bookId: true,
  authorName: true,
  content: true,
  sessionId: true, // سيدي، أضف هذا السطر هنا ضروري جداً
  likes: true
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;