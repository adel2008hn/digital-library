import { eq, and, like, or, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import {
  users, books, ratings, favorites, bookmarks, siteStats, comments,
  type User, type InsertUser, type Book, type InsertBook,
  type Rating, type Favorite, type Bookmark, type Comment, type InsertComment,
  relatedCategories
} from "@shared/schema";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

const db = drizzle(pool);

async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 3000): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || '';
      const isRetryable = error?.code === 'XX000' || msg.includes('endpoint has been disabled') || msg.includes('connection refused') || msg.includes('terminating connection') || msg.includes('Connection terminated') || msg.includes('ECONNREFUSED');
      if (attempt === retries || !isRetryable) throw error;
      console.log(`Database retry attempt ${attempt}/${retries}, waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Exhausted retries");
}
export interface IStorage {
  // --- دوال المستخدمين ---
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAuthors(): Promise<User[]>;
  toggleAuthorStatus(id: number): Promise<void>;
  deleteAuthor(id: number): Promise<void>;
  hasAdmin(): Promise<boolean>;

  // --- دوال الكتب ---
  getBooks(search?: string, category?: string): Promise<Book[]>;
  getBook(id: number): Promise<Book | undefined>;
  getBooksByAuthor(authorId: number): Promise<Book[]>;
  createBook(book: any): Promise<Book>;
  updateBook(id: number, data: Partial<InsertBook>): Promise<Book>;
  deleteBook(id: number): Promise<void>;
  getSuggestedBooks(bookId: number): Promise<Book[]>;

  // --- دوال التفاعل ---
  rateBook(bookId: number, sessionId: string, rating: number): Promise<void>;
  getFavorites(sessionId: string): Promise<number[]>;
  toggleFavorite(bookId: number, sessionId: string): Promise<void>;
  getBookmark(bookId: number, sessionId: string): Promise<{ page: number } | null>;
  setBookmark(bookId: number, sessionId: string, page: number): Promise<void>;

  // --- دوال التعليقات (تم دمجها سيدي لتعمل بكفاءة) ---
  getCommentsByBook(bookId: number): Promise<Comment[]>;
  getComment(id: number): Promise<Comment | undefined>;
  createComment(comment: InsertComment & { sessionId: string }): Promise<Comment>;
  likeComment(id: number): Promise<Comment>;
  toggleLike(id: number, action: 'add' | 'remove'): Promise<Comment>;
  deleteComment(id: number): Promise<void>;
  updateComment(id: number, content: string): Promise<Comment>;

  // --- الإحصائيات ---
  getStats(): Promise<{ visits: number; bookCount: number }>;
  incrementVisits(): Promise<void>;
} // تأكد أن القوس يغلق هنا سيدي

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    });
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return withRetry(async () => {
      const [newUser] = await db.insert(users).values(insertUser as any).returning();
      return newUser;
    });
  }

  async getAuthors(): Promise<User[]> {
    return withRetry(() => db.select().from(users).where(eq(users.role, "author")));
  }

  async toggleAuthorStatus(id: number): Promise<void> {
    return withRetry(async () => {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (user) {
        await db.update(users).set({ isActive: !user.isActive }).where(eq(users.id, id));
      }
    });
  }

  async deleteAuthor(id: number): Promise<void> {
    return withRetry(async () => {
      await db.delete(books).where(eq(books.authorId, id));
      await db.delete(users).where(eq(users.id, id));
    });
  }

  async hasAdmin(): Promise<boolean> {
    return withRetry(async () => {
      const [admin] = await db.select().from(users).where(eq(users.role, "admin"));
      return !!admin;
    });
  }

  async getBooks(search?: string, category?: string): Promise<Book[]> {
    return withRetry(async () => {
      const conditions = [];
      if (search) {
        conditions.push(or(like(books.title, `%${search}%`), like(books.authorName, `%${search}%`)));
      }
      if (category) {
        conditions.push(eq(books.mainCategory, category));
      }
      return db.select().from(books).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(books.createdAt));
    });
  }

  async getBook(id: number): Promise<Book | undefined> {
    return withRetry(async () => {
      const [book] = await db.select().from(books).where(eq(books.id, id));
      return book;
    });
  }

  async getBooksByAuthor(authorId: number): Promise<Book[]> {
    return withRetry(() => db.select().from(books).where(eq(books.authorId, authorId)).orderBy(desc(books.createdAt)));
  }

  async createBook(book: any): Promise<Book> {
    return withRetry(async () => {
      const [newBook] = await db.insert(books).values({
        title: book.title,
        authorName: book.authorName,
        authorId: Number(book.authorId),
        mainCategory: book.mainCategory,
        subCategory: book.subCategory,
        volumes: Number(book.volumes) || 1,
        coverUrl: book.coverUrl || null,
        description: book.description || "",
        fileUrl: book.fileUrl || null,
        fileName: book.fileName || null,
        totalRating: 0,
        ratingCount: 0
      }).returning();
      return newBook;
    });
  }

  async updateBook(id: number, data: Partial<InsertBook>): Promise<Book> {
    return withRetry(async () => {
      const [updated] = await db.update(books).set(data).where(eq(books.id, id)).returning();
      return updated;
    });
  }

  async deleteBook(id: number): Promise<void> {
    return withRetry(() => db.delete(books).where(eq(books.id, id)).then(() => {}));
  }

  async getSuggestedBooks(bookId: number): Promise<Book[]> {
    return withRetry(async () => {
      const [book] = await db.select().from(books).where(eq(books.id, bookId));
      if (!book) return [];
      const related = relatedCategories[book.mainCategory] || [];
      if (related.length === 0) return [];
      const conditions = related.map((cat) => eq(books.mainCategory, cat));
      return db.select().from(books).where(and(or(...conditions), sql`${books.id} != ${bookId}`)).limit(4);
    });
  }

  async rateBook(bookId: number, sessionId: string, rating: number): Promise<void> {
    return withRetry(async () => {
      const [existing] = await db.select().from(ratings).where(and(eq(ratings.bookId, bookId), eq(ratings.sessionId, sessionId)));
      if (existing) {
        const oldRating = existing.rating;
        await db.update(ratings).set({ rating }).where(eq(ratings.id, existing.id));
        await db.update(books).set({ totalRating: sql`${books.totalRating} + ${rating} - ${oldRating}` }).where(eq(books.id, bookId));
      } else {
        await db.insert(ratings).values({ bookId, sessionId, rating });
        await db.update(books).set({ totalRating: sql`${books.totalRating} + ${rating}`, ratingCount: sql`${books.ratingCount} + 1` }).where(eq(books.id, bookId));
      }
    });
  }

  async getFavorites(sessionId: string): Promise<number[]> {
    return withRetry(async () => {
      const favs = await db.select().from(favorites).where(eq(favorites.sessionId, sessionId));
      return favs.map((f) => f.bookId);
    });
  }

  async toggleFavorite(bookId: number, sessionId: string): Promise<void> {
    return withRetry(async () => {
      const [existing] = await db.select().from(favorites).where(and(eq(favorites.bookId, bookId), eq(favorites.sessionId, sessionId)));
      if (existing) {
        await db.delete(favorites).where(eq(favorites.id, existing.id));
      } else {
        await db.insert(favorites).values({ bookId, sessionId });
      }
    });
  }

  async getBookmark(bookId: number, sessionId: string): Promise<{ page: number } | null> {
    return withRetry(async () => {
      const [bm] = await db.select().from(bookmarks).where(and(eq(bookmarks.bookId, bookId), eq(bookmarks.sessionId, sessionId)));
      return bm ? { page: bm.page } : null;
    });
  }

  async setBookmark(bookId: number, sessionId: string, page: number): Promise<void> {
    return withRetry(async () => {
      const [existing] = await db.select().from(bookmarks).where(and(eq(bookmarks.bookId, bookId), eq(bookmarks.sessionId, sessionId)));
      if (existing) {
        await db.update(bookmarks).set({ page }).where(eq(bookmarks.id, existing.id));
      } else {
        await db.insert(bookmarks).values({ bookId, sessionId, page });
      }
    });
  }

  async getStats(): Promise<{ visits: number; bookCount: number }> {
    return withRetry(async () => {
      const [stats] = await db.select().from(siteStats);
      const [bookCountResult] = await db.select({ count: sql<number>`count(*)` }).from(books);
      return { visits: stats?.visits || 0, bookCount: Number(bookCountResult?.count) || 0 };
    });
  }

  async incrementVisits(): Promise<void> {
    return withRetry(async () => {
      const [stats] = await db.select().from(siteStats);
      if (stats) {
        await db.update(siteStats).set({ visits: sql`${siteStats.visits} + 1` }).where(eq(siteStats.id, stats.id));
      } else {
        await db.insert(siteStats).values({ visits: 1 });
      }
    });
  }

  // دوال التعليقات المحدثة
  async getCommentsByBook(bookId: number): Promise<Comment[]> {
    return withRetry(() =>
      db.select().from(comments)
        .where(eq(comments.bookId, bookId))
        .orderBy(desc(comments.createdAt))
    );
  }
  async deleteComment(id: number): Promise<void> {
    return withRetry(async () => {
      await db.delete(comments).where(eq(comments.id, id));
    });
  }

  async updateComment(id: number, content: string): Promise<Comment> {
    return withRetry(async () => {
      const [updated] = await db.update(comments)
        .set({ content })
        .where(eq(comments.id, id))
        .returning();
      return updated;
    });
  }

  async toggleLike(id: number, action: 'add' | 'remove'): Promise<Comment> {
  return await withRetry(async () => {
    const [comment] = await db.select().from(comments).where(eq(comments.id, id));
    if (!comment) throw new Error("Comment not found");

    // سيدي، هنا يتم تحديد إذا كنا سنزيد 1 أو ننقص 1
    const currentLikes = comment.likes || 0;
    const newLikes = action === 'add' ? currentLikes + 1 : Math.max(0, currentLikes - 1);

    const [updated] = await db.update(comments)
      .set({ likes: newLikes })
      .where(eq(comments.id, id))
      .returning();
    return updated;
  });
}
// --- سيدي، أضف هذه الدوال داخل كلاس DatabaseStorage ---

async getComment(id: number): Promise<Comment | undefined> {
  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  return comment;
}

async likeComment(id: number): Promise<Comment> {
  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  if (!comment) throw new Error("Comment not found");
  
  const [updated] = await db
    .update(comments)
    .set({ likes: (comment.likes || 0) + 1 })
    .where(eq(comments.id, id))
    .returning();
  return updated;
}

async createComment(comment: InsertComment & { sessionId: string }): Promise<Comment> {
  const [newComment] = await db
    .insert(comments)
    .values({
      bookId: comment.bookId,
      authorName: comment.authorName,
      content: comment.content,
      sessionId: comment.sessionId,
      likes: 0
    })
    .returning();
  return newComment;
}
}

export const storage = new DatabaseStorage();

export const HARDCODED_ADMIN = {
  username: "admin",
  password: "admin123",
  role: "admin" as const,
  isActive: true,
};

export async function seedDatabase() {
  try {
    await withRetry(async () => {
      let [admin] = await db.select().from(users).where(eq(users.role, "admin"));
      if (!admin) {
        const hashedPassword = await bcrypt.hash(HARDCODED_ADMIN.password, 10);
        await db.insert(users).values({
          username: HARDCODED_ADMIN.username,
          password: hashedPassword,
          role: HARDCODED_ADMIN.role,
          isActive: HARDCODED_ADMIN.isActive,
        });
        console.log("Seeded default admin user");
      }
    });
  } catch (error) {
    console.error("Database seeding error:", error);
  }
}