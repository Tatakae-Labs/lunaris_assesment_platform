/**
 * Centralized Ad Placement Registry for Lunaris Assessment Platform
 *
 * Placements are shown ONLY on:
 *  1. Main Landing Page (PublicWebsite - home)
 *  2. Login Page (PublicWebsite - login)
 *  3. Organization Dashboard for FREE-tier users only (OrgDashboard when plan_id === "free")
 *
 * Paid users, SuperAdmins, and Candidates taking exams NEVER see ads.
 *
 * To activate Adsterra scripts, paste the `key` (32-char hash from Adsterra) and
 * `scriptSrc` (full invoke URL, e.g. "https://www.highperformanceformat.com/<key>/invoke.js"
 * or "//pl....") for each placement below, or set the corresponding VITE_AD_* env var.
 */

export const ADSENSE_CLIENT_ID = "ca-pub-2586489862357963";

export const AD_PLACEMENTS = {
  Popunder_1: {
    id: "32510498",
    name: "Popunder_1",
    type: "popunder",
    scriptSrc: import.meta.env.VITE_AD_POPUNDER_1_SRC || ""
  },
  SocialBar_1: {
    id: "32510499",
    name: "SocialBar_1",
    type: "social_bar",
    scriptSrc: import.meta.env.VITE_AD_SOCIALBAR_1_SRC || ""
  },
  Smartlink_1: {
    id: "32510500",
    name: "Smartlink_1",
    type: "smartlink",
    href: import.meta.env.VITE_AD_SMARTLINK_1_URL || ""
  },
  NativeBanner_1: {
    id: "32510501",
    name: "NativeBanner_1",
    type: "native",
    containerId: import.meta.env.VITE_AD_NATIVE_1_CONTAINER || "container-32510501",
    scriptSrc: import.meta.env.VITE_AD_NATIVE_1_SRC || ""
  },
  "468x60_1": {
    id: "32510502",
    name: "468x60_1",
    type: "banner",
    width: 468,
    height: 60,
    key: import.meta.env.VITE_AD_468X60_1_KEY || "",
    scriptSrc: import.meta.env.VITE_AD_468X60_1_SRC || ""
  },
  "300x250_1": {
    id: "32510503",
    name: "300x250_1",
    type: "banner",
    width: 300,
    height: 250,
    key: import.meta.env.VITE_AD_300X250_1_KEY || "",
    scriptSrc: import.meta.env.VITE_AD_300X250_1_SRC || ""
  },
  "160x600_1": {
    id: "32510504",
    name: "160x600_1",
    type: "banner",
    width: 160,
    height: 600,
    key: import.meta.env.VITE_AD_160X600_1_KEY || "",
    scriptSrc: import.meta.env.VITE_AD_160X600_1_SRC || ""
  },
  "160x300_1": {
    id: "32510505",
    name: "160x300_1",
    type: "banner",
    width: 160,
    height: 300,
    key: import.meta.env.VITE_AD_160X300_1_KEY || "",
    scriptSrc: import.meta.env.VITE_AD_160X300_1_SRC || ""
  }
};
