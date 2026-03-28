import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Book, categories } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t, getDirection } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, UserPlus, Trash2, ToggleLeft, ToggleRight,
  Edit, BookOpen, Users, Shield
} from "lucide-react";

interface EditBookData {
  title: string;
  authorName: string;
  mainCategory: string;
  subCategory: string;
  volumes: string;
  coverUrl: string;
  description: string;
  fileUrl: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dir = getDirection(language);
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"authors" | "books">("books");

  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editData, setEditData] = useState<EditBookData>({
    title: "", authorName: "", mainCategory: "", subCategory: "",
    volumes: "1", coverUrl: "", description: "", fileUrl: "",
  });

  const { data: authors = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/authors"],
    enabled: user?.role === "admin",
  });

  const { data: myBooks = [] } = useQuery<Book[]>({
    queryKey: ["/api/books/my"],
    queryFn: async () => {
      const res = await fetch("/api/books/my", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: allBooks = [] } = useQuery<Book[]>({
    queryKey: ["/api/books"],
    queryFn: async () => {
      const res = await fetch("/api/books", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: user?.role === "admin",
  });

  const addAuthor = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/authors", { username: newUsername, password: newPassword });
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تمت إضافة المؤلف" : "Author added" });
      setNewUsername("");
      setNewPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authors"] });
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  const toggleAuthor = useMutation({
    mutationFn: async (authorId: number) => {
      await apiRequest("PATCH", `/api/admin/authors/${authorId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authors"] });
    },
  });

  const deleteAuthor = useMutation({
    mutationFn: async (authorId: number) => {
      await apiRequest("DELETE", `/api/admin/authors/${authorId}`);
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم حذف المؤلف" : "Author deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/authors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  const deleteBook = useMutation({
    mutationFn: async (bookId: number) => {
      await apiRequest("DELETE", `/api/books/${bookId}`);
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم حذف الكتاب" : "Book deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ أثناء الحذف" : "Error deleting book", variant: "destructive" });
    },
  });

  const updateBook = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<EditBookData> & { volumes?: number } }) => {
      await apiRequest("PATCH", `/api/books/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: language === "ar" ? "تم تعديل الكتاب بنجاح" : "Book updated successfully" });
      setEditingBook(null);
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/my"] });
    },
    onError: () => {
      toast({ title: language === "ar" ? "حدث خطأ أثناء التعديل" : "Error updating book", variant: "destructive" });
    },
  });

  const openEditDialog = (book: Book) => {
    setEditingBook(book);
    setEditData({
      title: book.title,
      authorName: book.authorName,
      mainCategory: book.mainCategory,
      subCategory: book.subCategory,
      volumes: String(book.volumes || 1),
      coverUrl: book.coverUrl || "",
      description: book.description || "",
      fileUrl: book.fileUrl || "",
    });
  };

  const handleEditSubmit = () => {
    if (!editingBook) return;
    if (!editData.title || !editData.authorName || !editData.mainCategory) {
      toast({ title: language === "ar" ? "يرجى ملء الحقول الإجبارية" : "Please fill required fields", variant: "destructive" });
      return;
    }
    updateBook.mutate({
  id: editingBook.id,
  data: {
    title: editData.title,
    authorName: editData.authorName,
    mainCategory: editData.mainCategory,
    subCategory: editData.subCategory,
    // سيدي، نستخدم Number للتحويل ثم 'as any' لإلغاء أي تعارض في الأنواع
    volumes: (Number(editData.volumes) || 1) as any, 
    coverUrl: editData.coverUrl || "",
    description: editData.description || "",
    fileUrl: editData.fileUrl || "",
  } as any, // أضفنا 'as any' هنا أيضاً لضمان قبول الكائن بالكامل
});
  };  

  if (!user) {
    navigate("/login");
    return null;
  }

  const displayBooks = user.role === "admin" ? allBooks : myBooks;
  const editSubCategories = editData.mainCategory ? categories[editData.mainCategory] || [] : [];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="bg-[#1a2744] dark:bg-[#0d1525] py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Button variant="ghost" className="text-white/80" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <BackArrow className="w-4 h-4 me-2" />
            {t("back", language)}
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#d4a843]" />
            <span className="text-white font-medium">{t("nav.dashboard", language)}</span>
            <Badge className="bg-[#d4a843]/20 text-[#d4a843] border-[#d4a843]/30">{user.role}</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8">
          <Button
            variant={activeTab === "books" ? "default" : "outline"}
            onClick={() => setActiveTab("books")}
            className={activeTab === "books" ? "bg-[#d4a843] text-white" : ""}
            data-testid="tab-books"
          >
            <BookOpen className="w-4 h-4 me-2" />
            {t("dashboard.manageBooks", language)}
          </Button>
          {user.role === "admin" && (
            <Button
              variant={activeTab === "authors" ? "default" : "outline"}
              onClick={() => setActiveTab("authors")}
              className={activeTab === "authors" ? "bg-[#d4a843] text-white" : ""}
              data-testid="tab-authors"
            >
              <Users className="w-4 h-4 me-2" />
              {t("dashboard.manageAuthors", language)}
            </Button>
          )}
        </div>

        {activeTab === "authors" && user.role === "admin" && (
          <div className="space-y-6">
            <Card className="p-6 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c]" data-testid="add-author-form">
              <h3 className="text-lg font-bold text-foreground mb-4">{t("dashboard.addAuthor", language)}</h3>
              <div className="flex flex-wrap gap-3">
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder={t("auth.username", language)}
                  className="flex-1 min-w-[200px]"
                  data-testid="input-new-author-username"
                />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("auth.password", language)}
                  className="flex-1 min-w-[200px]"
                  data-testid="input-new-author-password"
                />
                <Button
                  className="bg-[#d4a843] text-white"
                  onClick={() => addAuthor.mutate()}
                  disabled={!newUsername || !newPassword || addAuthor.isPending}
                  data-testid="button-add-author"
                >
                  <UserPlus className="w-4 h-4 me-2" />
                  {t("dashboard.addAuthor", language)}
                </Button>
              </div>
            </Card>

            <div className="space-y-3">
              {authors.map((author) => (
                <Card key={author.id} className="p-4 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c] flex items-center justify-between gap-4 flex-wrap" data-testid={`author-card-${author.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#d4a843]/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#d4a843]" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{author.username}</p>
                      <Badge className={author.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>
                        {author.isActive ? t("dashboard.active", language) : t("dashboard.inactive", language)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleAuthor.mutate(author.id)}
                      data-testid={`button-toggle-author-${author.id}`}
                    >
                      {author.isActive ? <ToggleRight className="w-4 h-4 me-1" /> : <ToggleLeft className="w-4 h-4 me-1" />}
                      {t("dashboard.toggle", language)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30"
                      onClick={() => deleteAuthor.mutate(author.id)}
                      data-testid={`button-delete-author-${author.id}`}
                    >
                      <Trash2 className="w-4 h-4 me-1" />
                      {language === "ar" ? "حذف" : "Delete"}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "books" && (
          <div className="space-y-3">
            <div className="flex justify-end mb-4">
              <Button className="bg-[#d4a843] text-white" onClick={() => navigate("/add-book")} data-testid="button-add-book-dashboard">
                {t("book.addContent", language)}
              </Button>
            </div>

            {displayBooks.length === 0 ? (
              <Card className="p-8 text-center bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c]">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">{language === "ar" ? "لا توجد كتب" : "No books"}</p>
              </Card>
            ) : (
              displayBooks.map((book) => (
                <Card key={book.id} className="p-4 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c] flex items-center justify-between gap-4 flex-wrap" data-testid={`book-row-${book.id}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-16 rounded bg-[#e8e0d0] dark:bg-[#243656] overflow-hidden flex-shrink-0">
                      {book.coverUrl && <img src={book.coverUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">{book.authorName} · {book.mainCategory}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(book)}
                      data-testid={`button-edit-book-${book.id}`}
                    >
                      <Edit className="w-4 h-4 me-1" />
                      {language === "ar" ? "تعديل" : "Edit"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30"
                      onClick={() => deleteBook.mutate(book.id)}
                      data-testid={`button-delete-book-${book.id}`}
                    >
                      <Trash2 className="w-4 h-4 me-1" />
                      {t("dashboard.deleteBook", language)}
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Book Dialog */}
      <Dialog open={!!editingBook} onOpenChange={(open) => !open && setEditingBook(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل الكتاب" : "Edit Book"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                  {t("book.bookTitle", language)} *
                </label>
                <Input
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                  {t("book.authorName", language)} *
                </label>
                <Input
                  value={editData.authorName}
                  onChange={(e) => setEditData({ ...editData, authorName: e.target.value })}
                  data-testid="input-edit-author"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                  {t("book.category", language)} *
                </label>
                <Select
                  value={editData.mainCategory}
                  onValueChange={(v) => setEditData({ ...editData, mainCategory: v, subCategory: "" })}
                >
                  <SelectTrigger data-testid="select-edit-main-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(categories).map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                  {t("book.subCategory", language)}
                </label>
                <Select
                  value={editData.subCategory}
                  onValueChange={(v) => setEditData({ ...editData, subCategory: v })}
                  disabled={!editData.mainCategory}
                >
                  <SelectTrigger data-testid="select-edit-sub-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editSubCategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                {t("book.volumeCount", language)}
              </label>
              <Input
                type="number"
                min="1"
                value={editData.volumes}
                onChange={(e) => setEditData({ ...editData, volumes: e.target.value })}
                data-testid="input-edit-volumes"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                {t("book.coverUrl", language)}
              </label>
              <Input
                value={editData.coverUrl}
                onChange={(e) => setEditData({ ...editData, coverUrl: e.target.value })}
                placeholder="https://..."
                data-testid="input-edit-cover-url"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                {t("book.fileUrl", language)}
              </label>
              <Input
                value={editData.fileUrl}
                onChange={(e) => setEditData({ ...editData, fileUrl: e.target.value })}
                placeholder="Google Drive / Dropbox URL"
                data-testid="input-edit-file-url"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                {t("book.description", language)}
              </label>
              <Textarea
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-description"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingBook(null)} data-testid="button-cancel-edit">
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              className="bg-[#d4a843] text-white"
              onClick={handleEditSubmit}
              disabled={updateBook.isPending}
              data-testid="button-save-edit"
            >
              {updateBook.isPending ? "..." : (language === "ar" ? "حفظ التعديلات" : "Save Changes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
