import { defineConfig } from "drizzle-kit";

// سيدي، جعلنا الكود يقرأ POSTGRES_URL الجديد أو DATABASE_URL القديم
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  throw new Error("Missing Database URL (POSTGRES_URL or DATABASE_URL)");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});