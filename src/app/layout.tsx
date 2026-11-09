import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, Pixelify_Sans, Space_Grotesk } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import { getOptionalUser } from "@/server/auth";
import { DEFAULT_PREFERENCES, getPreferences } from "@/server/preferences/service";
import type { Preferences } from "@/lib/types";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Heading faces for the other themes; globals.css picks one per theme through --theme-font-heading.
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], preload: false }) // theme-only font: no preload;
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], preload: false }) // theme-only font: no preload;
const pixelify = Pixelify_Sans({ variable: "--font-pixelify", subsets: ["latin"], preload: false }) // theme-only font: no preload;

export const metadata: Metadata = {
  title: "PocketPlan",
  description: "Envelope budgeting for the money you have.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** Signed out, or the preference read failed: the default look. A theme must never block sign-in. */
async function loadPreferences(): Promise<Preferences> {
  const user = await getOptionalUser();
  if (!user) return DEFAULT_PREFERENCES;
  try {
    return await getPreferences(user.id);
  } catch (e) {
    console.error("getPreferences failed; using defaults", e);
    return DEFAULT_PREFERENCES;
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { theme, mode } = await loadPreferences();
  const fonts = [geistSans, geistMono, fraunces, spaceGrotesk, pixelify].map((f) => f.variable).join(" ");
  return (
    <html lang="en" data-theme={theme} data-mode={mode} className={`${fonts} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
