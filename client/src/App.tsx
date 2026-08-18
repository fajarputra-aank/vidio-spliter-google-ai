/**
 * Design reminder — Kamar Gelap Editorial: a warm, tactile AI photo workspace
 * with clear hierarchy, asymmetric composition, and amber used only for action.
 */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Credits from "./pages/Credits";
import Community from "./pages/Community";
import Admin from "./pages/Admin";
import NotificationSettings from "./pages/NotificationSettings";
import ArchivedAlbums from "./pages/ArchivedAlbums";
import BrandSettings from "./pages/BrandSettings";
import { BrandProvider } from "./contexts/BrandContext";
import Auth, { ChangePassword, EmailVerification, ForgotPassword, ResetPassword } from "./pages/Auth";
import ProfileSettings from "./pages/ProfileSettings";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/masuk" component={Auth} />
      <Route path="/daftar" component={Auth} />
      <Route path="/ganti-kata-sandi" component={ChangePassword} />
      <Route path="/lupa-kata-sandi" component={ForgotPassword} />
      <Route path="/reset-kata-sandi" component={ResetPassword} />
      <Route path="/verifikasi-email" component={EmailVerification} />
      <Route path="/profil" component={Profile} />
      <Route path="/kredit" component={Credits} />
      <Route path="/komunitas" component={Community} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/brand" component={BrandSettings} />
      <Route path="/pengaturan/notifikasi" component={NotificationSettings} />
      <Route path="/pengaturan/profil" component={ProfileSettings} />
      <Route path="/profil/album-terarsip" component={ArchivedAlbums} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <BrandProvider><TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider></BrandProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
