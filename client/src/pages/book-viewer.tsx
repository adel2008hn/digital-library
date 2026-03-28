import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Book } from "@shared/schema";
import { useTheme } from "@/lib/theme";
import { t, getDirection } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Bookmark } from "lucide-react";
import BookCard from "@/components/book-card";

export default function BookViewerPage() {
  const { language } = useTheme();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const bookId = parseInt(params.id || "0");
  const { toast } = useToast();
  const dir = getDirection(language);
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const [bookmarkPage, setBookmarkPage] = useState("1");

  // جلب بيانات الكتاب
  const { data: book, isLoading } = useQuery<Book>({
    queryKey: ["/api/books", bookId],
    enabled: bookId > 0
  });

  const { data: suggestedBooks = [] } = useQuery<Book[]>({
    queryKey: ["/api/books/suggested", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/books/${bookId}/suggested`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: bookId > 0,
  });

  const { data: bookmark } = useQuery<{ page: number } | null>({
    queryKey: ["/api/bookmarks", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/bookmarks/${bookId}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: bookId > 0,
  });

  const { data: favoriteIds = [] } = useQuery<number[]>({
    queryKey: ["/api/favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites");
      if (!res.ok) return [];
      return res.json();
    },
  });

  useEffect(() => {
    if (bookmark?.page) setBookmarkPage(String(bookmark.page));
  }, [bookmark]);

  const saveBookmark = async () => {
    try {
      await apiRequest("POST", `/api/bookmarks/${bookId}`, { page: parseInt(bookmarkPage) || 1 });
      toast({ title: t("bookmark.saved", language) });
    } catch {}
  };

  if (isLoading) return <div className="flex justify-center p-20 animate-pulse">Loading...</div>;
  if (!book) return <div className="text-center p-20">Book not found</div>;

  const embedUrl = book.fileUrl?.includes("drive.google.com") 
    ? book.fileUrl.replace("/view", "/preview") 
    : book.fileUrl;

  const defaultCover = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" fill="#1a2744"><rect width="300" height="400" fill="#e8e0d0"/><text x="150" y="200" text-anchor="middle" fill="#1a2744" font-size="60">📖</text></svg>`)}`;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="bg-[#1a2744] dark:bg-[#0d1525] py-4 px-4 text-white">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => navigate("/")}>
            <BackArrow className="w-4 h-4 me-2" /> {t("back", language)}
          </Button>
          <span className="font-medium truncate">{book.title}</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-8">
              <img src={book.coverUrl || defaultCover} className="w-full rounded-lg mb-4 shadow-md" alt={book.title} />
              <h1 className="text-xl font-bold mb-2">{book.title}</h1>
              <p className="text-sm text-muted-foreground mb-4">{t("book.author", language)}: {book.authorName}</p>
              <div className="flex gap-2 mb-4">
                <Badge className="bg-[#d4a843]">{book.mainCategory}</Badge>
                <Badge variant="outline">{book.subCategory}</Badge>
              </div>
              {book.description && <p className="text-sm text-muted-foreground leading-relaxed mb-6">{book.description}</p>}
              
              <div className="border-t pt-4">
                <label className="text-sm font-medium mb-2 block">{t("bookmark.page", language)}</label>
                <div className="flex gap-2">
                  <Input type="number" value={bookmarkPage} onChange={(e) => setBookmarkPage(e.target.value)} />
                  <Button className="bg-[#d4a843]" onClick={saveBookmark}><Bookmark className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-2 border-[#1a2744]/10 shadow-xl">
              {embedUrl ? (
                <iframe src={embedUrl} className="w-full h-[80vh] border-0" allow="autoplay" title="PDF Viewer" />
              ) : (
                <div className="h-[50vh] flex items-center justify-center italic text-muted-foreground">No Preview Available</div>
              )}
            </Card>
          </div>
        </div>

        {suggestedBooks.length > 0 && (
          <div className="mt-16 mb-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">{t("suggested", language)}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {suggestedBooks.map((sb) => (
                <BookCard
                  key={sb.id}
                  book={sb}
                  isFavorite={favoriteIds.includes(sb.id)}
                  onToggleFavorite={() => {}}
                  language={language}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}