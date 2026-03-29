import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import path from "path"; 
import fs from "fs";     
import { registerRoutes } from "./routes.js";
import { seedDatabase } from "./storage.js";
import { createServer } from "http";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path; 
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("جاري التحقق من قاعدة البيانات وإنشاء الحسابات الأساسية سيدي...");
    await seedDatabase(); 
    
    // سيدي، تم التأكد من تمرير app فقط لـ registerRoutes
    await registerRoutes(app);
    
  } catch (error) {
    log(`خطأ في تشغيل البيانات سيدي: ${error}`);
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    const publicPath = path.resolve(__dirname, "../../client/dist");
    const fallbackPath = path.resolve(__dirname, "../dist/public");
    const staticPath = fs.existsSync(publicPath) ? publicPath : fallbackPath;
    
    log(`استخدام مسار الملفات الساكنة سيدي: ${staticPath}`);
    
    app.use(express.static(staticPath));

    app.get(/^(?!\/api).+/, (_req, res) => {
        res.sendFile(path.join(staticPath, "index.html"));
    });
  
  } else {
    const { setupVite } = await import("./vite.js");
    // سيدي، قمت بتبديل الترتيب هنا ليصبح السيرفر أولاً ثم app
    // هذا سيحل خطأ 'Argument of type Express' فوراً
    await setupVite(httpServer, app);
  }

  const port = Number(process.env.PORT) || 5000;
  httpServer.listen(port, "0.0.0.0", () => {
    log(`✓ السيرفر يعمل الآن على المنفذ ${port} سيدي`);
  });
})();

export default app;