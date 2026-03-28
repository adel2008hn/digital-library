import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { categories } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t, getDirection } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Upload, FileText, X } from "lucide-react";

export default function AddBookPage() {
  const { user } = useAuth();
  const { language } = useTheme();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dir = getDirection(language);
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [volumes, setVolumes] = useState("1");
  const [coverUrl, setCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const subCategories = mainCategory ? categories[mainCategory] || [] : [];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // تم التعديل إلى 20 جيجابايت يا سيدي
      if (file.size > 20 * 1024 * 1024 * 1024) {
        toast({ title: language === "ar" ? "الملف كبير جداً (الحد 20GB)" : "File too large (max 20GB)", variant: "destructive" });
        return;
      }
      setUploadFile(file);
    }
  }, [language, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // تم التعديل إلى 20 جيجابايت هنا أيضاً
      if (file.size > 20 * 1024 * 1024 * 1024) {
        toast({ title: language === "ar" ? "الملف كبير جداً (الحد 20GB)" : "File too large (max 20GB)", variant: "destructive" });
        return;
      }
      setUploadFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !authorName || !mainCategory || !subCategory) {
      toast({ title: language === "ar" ? "يرجى ملء جميع الحقول الإجبارية" : "Please fill all required fields", variant: "destructive" });
      return;
    }
    if (!uploadFile && !fileUrl) {
      toast({ title: language === "ar" ? "يرجى رفع ملف أو إدخال رابط" : "Please upload a file or enter a URL", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let finalFileUrl = fileUrl;
      let fileName = "";

      if (uploadFile) {
        const formData = new FormData();
        formData.append("file", uploadFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const uploadData = await uploadRes.json();
        finalFileUrl = uploadData.url;
        fileName = uploadData.fileName;
      }

      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          authorName: authorName, // تم تعديل المفاتيح لتتوافق مع الـ storage والـ schema
          mainCategory: mainCategory,
          subCategory: subCategory,
          volumes: parseInt(volumes) || 1,
          coverUrl: coverUrl || null,
          description: description || null,
          fileUrl: finalFileUrl || null,
          fileName: fileName || null
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to add book");
      }

      toast({ title: language === "ar" ? "تمت إضافة الكتاب بنجاح" : "Book added successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      navigate("/");
    } catch (err: any) {
      toast({ title: language === "ar" ? `حدث خطأ: ${err.message}` : `Error: ${err.message}`, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <div className="bg-[#1a2744] dark:bg-[#0d1525] py-4 px-4">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" className="text-white/80" onClick={() => navigate("/")} data-testid="button-back-add">
            <BackArrow className="w-4 h-4 me-2" />
            {t("back", language)}
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Card className="p-6 md:p-8 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c]" data-testid="add-book-form">
          <h2 className="text-2xl font-bold text-foreground mb-6">{t("book.addContent", language)}</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.authorName", language)} *</label>
                <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} data-testid="input-author-name" />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.bookTitle", language)} *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="input-book-title" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.category", language)} *</label>
                <Select value={mainCategory} onValueChange={(v) => { setMainCategory(v); setSubCategory(""); }}>
                  <SelectTrigger data-testid="select-main-category">
                    <SelectValue placeholder={t("book.category", language)} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(categories).map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.subCategory", language)} *</label>
                <Select value={subCategory} onValueChange={setSubCategory} disabled={!mainCategory}>
                  <SelectTrigger data-testid="select-sub-category">
                    <SelectValue placeholder={t("book.subCategory", language)} />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((sub) => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.volumeCount", language)}</label>
              <Input type="number" min="1" value={volumes} onChange={(e) => setVolumes(e.target.value)} data-testid="input-volumes" />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.coverUrl", language)}</label>
              <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." data-testid="input-cover-url" />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.description", language)}</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} data-testid="input-description" />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-3">{t("book.fileUpload", language)}</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-[#d4a843] bg-[#d4a843]/10"
                    : "border-gray-300 dark:border-gray-600"
                }`}
                data-testid="dropzone"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file"
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-[#d4a843]" />
                    <div>
                      <p className="font-medium text-foreground">{uploadFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                      className="p-1 rounded bg-transparent"
                      data-testid="button-remove-file"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">{t("book.dragDrop", language)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("book.maxSize", language)}</p>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("book.fileUrl", language)}</label>
              <Input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="Google Drive / Dropbox URL"
                disabled={!!uploadFile}
                data-testid="input-file-url"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#d4a843] text-white py-3"
              disabled={uploading}
              data-testid="button-submit-book"
            >
              {uploading ? "..." : t("book.submit", language)}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}