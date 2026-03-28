import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { t, Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Moon, Sun, X, Globe, LogOut } from "lucide-react";

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { isDark, toggleTheme, language, setLanguage } = useTheme();
  const { user, logout } = useAuth();

  const languages: { code: Language; name: string }[] = [
    { code: "ar", name: "العربية" },
    { code: "en", name: "English" },
    { code: "zh", name: "中文" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/40" onClick={onClose} data-testid="settings-overlay">
      <Card
        className="w-full max-w-sm mx-4 p-6 bg-white dark:bg-[#1a2744] border border-gray-200 dark:border-[#2a3a5c] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="settings-panel"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-foreground">{t("settings.title", language)}</h3>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-settings">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              <Globe className="w-4 h-4 inline me-1" />
              {t("settings.language", language)}
            </label>
            <div className="flex gap-2">
              {languages.map((lang) => (
                <Button
                  key={lang.code}
                  variant={language === lang.code ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage(lang.code)}
                  className={language === lang.code ? "bg-[#d4a843] text-white" : ""}
                  data-testid={`button-lang-${lang.code}`}
                >
                  {lang.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              {isDark ? <Moon className="w-4 h-4 inline me-1" /> : <Sun className="w-4 h-4 inline me-1" />}
              {t("settings.theme", language)}
            </label>
            <Button
              variant="outline"
              onClick={toggleTheme}
              className="w-full justify-start gap-2"
              data-testid="button-toggle-theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? t("settings.lightMode", language) : t("settings.darkMode", language)}
            </Button>
          </div>

          {user && (
            <div>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 text-destructive border-destructive/30"
                onClick={() => { logout(); onClose(); }}
                data-testid="button-settings-logout"
              >
                <LogOut className="w-4 h-4" />
                {t("nav.logout", language)}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
