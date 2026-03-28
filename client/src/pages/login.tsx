import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { t, getDirection } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, BookOpen, Lock, User } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const { language } = useTheme();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const dir = getDirection(language);
  const BackArrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      toast({ title: language === "ar" ? "تم تسجيل الدخول بنجاح" : "Login successful" });
      navigate("/");
    } else {
      toast({ title: language === "ar" ? "خطأ في اسم المستخدم أو كلمة السر" : "Invalid credentials", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a2744] to-[#243656] dark:from-[#0d1525] dark:to-[#152040] flex items-center justify-center px-4" dir={dir}>
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          className="text-white/80 mb-6"
          onClick={() => navigate("/")}
          data-testid="button-back-login"
        >
          <BackArrow className="w-4 h-4 me-2" />
          {t("back", language)}
        </Button>

        <Card className="p-8 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c] shadow-2xl" data-testid="login-card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#d4a843]/20 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-[#d4a843]" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t("auth.authorLogin", language)}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                {t("auth.username", language)}
              </label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="ps-10"
                  placeholder={t("auth.username", language)}
                  data-testid="input-username"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1.5">
                {t("auth.password", language)}
              </label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ps-10"
                  placeholder={t("auth.password", language)}
                  data-testid="input-password"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#d4a843] text-white py-3"
              disabled={loading}
              data-testid="button-login"
            >
              {loading ? "..." : t("auth.loginBtn", language)}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
