import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t, getDirection } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { BookOpen, Shield, Lock, User } from "lucide-react";

export default function SetupPage() {
  const { language } = useTheme();
  const { checkAuth } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dir = getDirection(language);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/setup", { username, password });
      toast({ title: language === "ar" ? "تم إنشاء حساب المدير بنجاح" : "Admin account created" });
      await checkAuth();
      navigate("/");
    } catch {
      toast({ title: language === "ar" ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#243656] flex items-center justify-center px-4" dir={dir}>
      <Card className="w-full max-w-md p-8 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c] shadow-2xl" data-testid="setup-card">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-[#d4a843]/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-[#d4a843]" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {language === "ar" ? "إعداد حساب المدير" : language === "en" ? "Admin Setup" : "管理员设置"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {language === "ar" ? "أنشئ حساب المالك للتحكم بالمكتبة" : language === "en" ? "Create the owner account to manage the library" : "创建所有者帐户来管理图书馆"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("auth.username", language)}</label>
            <div className="relative">
              <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={username} onChange={(e) => setUsername(e.target.value)} className="ps-10" data-testid="input-setup-username" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1.5">{t("auth.password", language)}</label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10" data-testid="input-setup-password" />
            </div>
          </div>

          <Button type="submit" className="w-full bg-[#d4a843] text-white py-3" disabled={loading} data-testid="button-setup">
            {loading ? "..." : language === "ar" ? "إنشاء الحساب" : language === "en" ? "Create Account" : "创建帐户"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
