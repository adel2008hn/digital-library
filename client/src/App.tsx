import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import Home from "@/pages/home";
import LoginPage from "@/pages/login";
import SetupPage from "@/pages/setup";
import AddBookPage from "@/pages/add-book";
import BookViewerPage from "@/pages/book-viewer";
import DashboardPage from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
// أضف هذا الجزء في بداية ملف App.tsx (خارج دالة App)
if (typeof window !== "undefined" && !(window as any).currentSessionId) {
  const savedId = localStorage.getItem("book_lib_session");
  if (savedId) {
    (window as any).currentSessionId = savedId;
  } else {
    const newId = "sess_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("book_lib_session", newId);
    (window as any).currentSessionId = newId;
  }
}
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/setup" component={SetupPage} />
      <Route path="/add-book" component={AddBookPage} />
      <Route path="/book/:id" component={BookViewerPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
