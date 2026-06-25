/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const BUILD_TIME = new Date().toISOString();

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icon.svg",
        "icon-maskable.svg",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "Seven",
        short_name: "Seven",
        description:
          "A storytelling party game. Take turns writing seven words.",
        theme_color: "#fafaf9",
        background_color: "#fafaf9",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        // Don't intercept Firestore long-poll / auth network traffic.
        navigateFallbackDenylist: [/^\/__/, /\/firestore\//, /\/identitytoolkit\//],
        // Activate new SWs immediately so users pick up fixes without
        // having to force-quit the installed PWA.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
