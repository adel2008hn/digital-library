import { useState } from "react";
import { useLocation } from "wouter";
import { Book } from "@shared/schema";
import { Language, t } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Heart, BookOpen, BookCopy } from "lucide-react";

interface BookCardProps {
  book: Book;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  language: Language;
}

export default function BookCard({ book, isFavorite, onToggleFavorite, language }: BookCardProps) {
  const [, navigate] = useLocation();
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const avgRating = book.ratingCount > 0 ? (book.totalRating / book.ratingCount).toFixed(1) : "0";

  const handleRate = async (rating: number) => {
    setUserRating(rating);
    try {
      await apiRequest("POST", `/api/books/${book.id}/rate`, { rating });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    } catch {}
  };

  const defaultCover = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" fill="#1a2744"><rect width="300" height="400" fill="#e8e0d0"/><text x="150" y="200" text-anchor="middle" fill="#1a2744" font-size="60" font-family="serif">📖</text></svg>`)}`;

  return (
    <Card className="group relative overflow-visible bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c] rounded-xl flex flex-col" data-testid={`card-book-${book.id}`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-xl bg-[#e8e0d0] dark:bg-[#243656]">
        <img
          src={book.coverUrl || defaultCover}
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          referrerPolicy="no-referrer"
          onError={(e) => { (e.target as HTMLImageElement).src = defaultCover; }}
          data-testid={`img-cover-${book.id}`}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-3 end-3 w-9 h-9 rounded-full bg-white/80 dark:bg-black/50 flex items-center justify-center transition-colors"
          data-testid={`button-favorite-${book.id}`}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-600 dark:text-gray-300"}`} />
        </button>
        <Badge className="absolute top-3 start-3 bg-[#d4a843] text-white text-xs" data-testid={`badge-new-${book.id}`}>
          {t("book.new", language)}
        </Badge>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-lg text-foreground mb-1 line-clamp-1" data-testid={`text-title-${book.id}`}>
          {book.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-2" data-testid={`text-author-${book.id}`}>
          {t("book.author", language)} {book.authorName}
        </p>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1" data-testid={`rating-${book.id}`}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => handleRate(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-0 border-0 bg-transparent cursor-pointer"
                data-testid={`star-${book.id}-${s}`}
              >
                <Star
                  className={`w-4 h-4 ${
                    s <= (hoverRating || userRating || Math.round(Number(avgRating)))
                      ? "fill-[#d4a843] text-[#d4a843]"
                      : "text-gray-300 dark:text-gray-600"
                  }`}
                />
              </button>
            ))}
            <span className="text-xs text-muted-foreground ms-1">({book.ratingCount})</span>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground" data-testid={`volumes-${book.id}`}>
            <BookCopy className="w-4 h-4" />
            <span className="text-xs">{book.volumes || 1} {t("book.volumes", language)}</span>
          </div>
        </div>

        <Button
          className="w-full bg-[#1a2744] dark:bg-[#d4a843] text-white mt-auto"
          onClick={() => navigate(`/book/${book.id}`)}
          data-testid={`button-browse-${book.id}`}
        >
          <BookOpen className="w-4 h-4 me-2" />
          {t("book.browse", language)}
        </Button>
      </div>
    </Card>
  );
}
