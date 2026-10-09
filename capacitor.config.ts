import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "id.lensasaku.app",
  appName: "Lensa Saku",
  webDir: "dist/public",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  plugins: {
    Preferences: {
      group: "LensaSaku",
    },
  },
};

export default config;
