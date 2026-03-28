import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Book } from "@shared/schema";
import { categories } from "@shared/schema";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { t, getDirection } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Search, Star, Heart, Settings, Moon, Sun,
  ArrowLeft, ArrowRight, Users, BookCopy, QrCode, Plus,
  ExternalLink
} from "lucide-react";
import SettingsPanel from "@/components/settings-panel";
import BookCard from "@/components/book-card";

const arabicLetters = "ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي";

const categoryKeys = Object.keys(categories);

export default function Home() {
  const { isDark, toggleTheme, language } = useTheme();
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dir = getDirection(language);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // التعديل هنا سيدي: نستخدم sessionStorage لضمان حساب الزيارة مرة واحدة لكل فتحة متصفح
  useEffect(() => {
    const hasVisited = sessionStorage.getItem("visit_counted");
    
    if (!hasVisited) {
      fetch("/api/stats/visit", { method: "POST" })
        .then(() => {
          sessionStorage.setItem("visit_counted", "true");
        })
        .catch((err) => console.error("Error logging visit:", err));
    }
  }, []);

  const { data: stats } = useQuery<{ visits: number; bookCount: number }>({
    queryKey: ["/api/stats"],
  });

  const { data: books = [], isLoading: booksLoading } = useQuery<Book[]>({
    queryKey: ["/api/books", debouncedSearch, activeCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (activeCategory !== "all" && activeCategory !== "favorites") params.set("category", activeCategory);
      const res = await fetch(`/api/books?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch books");
      return res.json();
    },
  });

  const { data: favoriteIds = [] } = useQuery<number[]>({
    queryKey: ["/api/favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: qrCodeUrl } = useQuery<string>({
    queryKey: ["/api/qrcode"],
    queryFn: async () => {
      const res = await fetch("/api/qrcode");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data.qrCode;
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async (bookId: number) => {
      await apiRequest("POST", `/api/favorites/${bookId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
  });

  const filteredBooks = activeCategory === "favorites"
    ? books.filter((b) => favoriteIds.includes(b.id))
    : books;

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setDebouncedSearch(searchQuery);
    }
  };

  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen bg-background text-foreground" dir={dir}>
      <nav className="sticky top-0 z-50 bg-[#1a2744] dark:bg-[#0d1525] border-b border-[#2a3a5c] shadow-lg" data-testid="navbar">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3" data-testid="nav-logo">
            <BookOpen className="w-8 h-8 text-[#d4a843]" />
            <span className="text-xl font-bold text-[#d4a843] hidden sm:block">مكتبة المعرفة الرقمية</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {user && (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/90"
                onClick={() => navigate("/dashboard")}
                data-testid="nav-dashboard"
              >
                <Settings className="w-4 h-4 me-1" />
                {t("nav.dashboard", language)}
              </Button>
            )}

            {!user && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#d4a843] text-[#d4a843] bg-transparent"
                onClick={() => navigate("/login")}
                data-testid="nav-login"
              >
                {t("nav.login", language)}
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="text-white/80"
              onClick={() => setShowSettings(!showSettings)}
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      <section className="relative bg-gradient-to-b from-[#1a2744] via-[#1e2f4f] to-[#243656] dark:from-[#0d1525] dark:via-[#111d33] dark:to-[#152040] py-16 md:py-24 overflow-hidden" data-testid="hero-section">
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-4 overflow-hidden pointer-events-none select-none opacity-[0.08]">
          {arabicLetters.split(" ").map((letter, i) => (
            <span
              key={i}
              className="text-[#d4a843] text-4xl md:text-6xl lg:text-8xl font-bold"
              style={{
                transform: `rotate(${Math.random() * 60 - 30}deg)`,
                position: "absolute",
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-[#d4a843] p-3 rounded-2xl mb-4 shadow-2xl">
              <BookOpen className="w-12 h-12 text-[#1a2744]" />
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md">
              {language === "ar" ? "مكتبة المعرفة الرقمية" : "Voice of Dhad Digital Library"}
            </h1>
            <div className="h-1.5 w-32 bg-[#d4a843] rounded-full shadow-inner"></div>
          </div>

          <Card className="bg-white/5 backdrop-blur-md border-white/10 p-6 md:p-8 rounded-2xl shadow-2xl mt-6">
            <p className="text-white/90 text-lg md:text-xl leading-relaxed font-medium">
              أُنشئ هذا الموقع استجابةً لإعلان وزارة التربية والتعليم عن مسابقة <span className="text-[#d4a843] font-bold">"أفضل مدرسة داعمة للغة العربية"</span> تحت عنوان <span className="text-[#d4a843] font-bold">"صوت الضاد"</span>، وذلك بهدف إبراز مكانة اللغة العربية وتعزيز حضورها بين الطلبة بأساليب إبداعية ومعاصرة.
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 text-white/70 text-base italic font-bold">
              وقد تم إعداد هذا الموقع بإشراف مدرسة خالد بن الوليد الثانوية للبنين / لواء الموقر، ليكون منصة تعليمية تجمع بين المعرفة والمتعة، وتقدم محتوى متنوعًا في مجالات اللغة العربية من معاجم وشعر وقصص ونحو وبلاغة، بما يسهم في خدمة لغتنا الجميلة وترسيخ حبها في نفوس الطلبة.
            </div>
          </Card>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 -mt-8 relative z-20" data-testid="stats-section">
        <div className="bg-white dark:bg-[#1a2744] rounded-xl shadow-xl border border-gray-200 dark:border-[#2a3a5c] p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="flex flex-col items-center gap-2" data-testid="stats-qr">
              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" className="w-28 h-28 rounded-lg" data-testid="img-qrcode" />
              )}
              <span className="text-sm text-[#d4a843] font-medium">{t("stats.share", language)}</span>
            </div>

            <div className="flex flex-col items-center gap-1" data-testid="stats-visits">
              <Users className="w-8 h-8 text-muted-foreground" />
              <span className="text-3xl font-bold text-foreground">{stats?.visits || 0}</span>
              <span className="text-sm text-muted-foreground">{t("stats.visits", language)}</span>
            </div>

            <div className="flex flex-col items-center gap-1" data-testid="stats-books">
              <BookCopy className="w-8 h-8 text-muted-foreground" />
              <span className="text-3xl font-bold text-foreground">{stats?.bookCount || 0}</span>
              <span className="text-sm text-muted-foreground">{t("stats.books", language)}</span>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 mt-8" data-testid="search-section">
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-5 h-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("search.placeholder", language)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="ps-10 py-3 text-base rounded-full border-2 border-[#d4a843]/30 focus:border-[#d4a843] bg-white dark:bg-[#1a2744]"
            data-testid="input-search"
          />
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 mt-8" data-testid="categories-section">
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant={activeCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory("all")}
            className={activeCategory === "all" ? "bg-[#d4a843] text-white" : "border-[#d4a843]/30 text-foreground"}
            data-testid="cat-all"
          >
            {t("cat.all", language)}
          </Button>
          <Button
            variant={activeCategory === "favorites" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory("favorites")}
            className={activeCategory === "favorites" ? "bg-[#d4a843] text-white" : "border-[#d4a843]/30 text-foreground"}
            data-testid="cat-favorites"
          >
            <Heart className="w-4 h-4 me-1" />
            {t("cat.favorites", language)}
          </Button>
      
          {categoryKeys.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat ? "bg-[#d4a843] text-white" : "border-[#d4a843]/30 text-foreground"}
              data-testid={`cat-${cat}`}
            >
              {cat}
            </Button>
          ))}
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 mt-8 pb-8" data-testid="books-section">
        {user && (
          <div className="flex justify-center mb-6">
            <Button
              onClick={() => navigate("/add-book")}
              className="bg-[#d4a843] text-white"
              data-testid="button-add-book"
            >
              <Plus className="w-4 h-4 me-2" />
              {t("book.addContent", language)}
            </Button>
          </div>
        )}

        {booksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse h-80 bg-muted" />
            ))}
          </div>
        ) : filteredBooks.length === 0 ? (
          <div className="text-center py-16" data-testid="text-no-books">
            <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">
              {language === "ar" ? "لا توجد كتب في هذا القسم" : language === "en" ? "No books in this section" : "此分类暂无书籍"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isFavorite={favoriteIds.includes(book.id)}
                onToggleFavorite={() => toggleFavorite.mutate(book.id)}
                language={language}
              />
            ))}
          </div>
        )}
      </section>

<footer className="bg-[#1a2744] dark:bg-[#0d1525] text-white py-6 mt-4 border-t border-[#d4a843]/30" data-testid="footer">
        <div className="max-w-4xl mx-auto text-center px-4 space-y-3">

          <div className="space-y-0">
            <p className="text-[#d4a843] text-md font-medium opacity-80 uppercase tracking-tighter">
              {language === "ar" ? "تصميم وتطوير الطالب" : "Designed & Developed By"}
            </p>
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              عادل حازم النتشة
            </h2>
          </div>

          <div className="pt-1">
            <a
              href="https://forms.gle/X2sk65YvVQJMhNVE8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-[#d4a843] text-[#1a2744] text-sm font-bold hover:bg-[#c49833] transition-all no-underline"
              data-testid="link-complaints"
            >
              {t("footer.complaints", language)}
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <p className="text-[#d4a843]/60 text-md pt-2 font-bold border-t border-white/5">
            © 2026 {t("footer.rights", language)}
          </p>
        </div>
      </footer>
    </div>
  );
}