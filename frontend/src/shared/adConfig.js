/**
 * Centralized Ad Placement Registry for Lunaris Assessment Platform
 *
 * Placements are shown ONLY on:
 *  1. Main Landing Page (PublicWebsite - home)
 *  2. Login Page (PublicWebsite - login)
 *  3. Organization Dashboard for FREE-tier users only (OrgDashboard when plan_id === "free")
 *
 * Paid users, SuperAdmins, and Candidates taking exams NEVER see ads.
 */

export const ADSENSE_CLIENT_ID = "ca-pub-2586489862357963";

export const AD_PLACEMENTS = {
  NativeBanner_1: {
    id: "32510501",
    name: "NativeBanner_1",
    type: "native",
    containerId: import.meta.env.VITE_AD_NATIVE_1_CONTAINER || "container-242d0befd8e05c45e61d5f2f41529e2c",
    scriptSrc: import.meta.env.VITE_AD_NATIVE_1_SRC || "https://bauval.org/21/242d0befd8e05c45e61d5f2f41529e2c"
  },
  "468x60_1": {
    id: "32510502",
    name: "468x60_1",
    type: "banner",
    width: 468,
    height: 60,
    key: import.meta.env.VITE_AD_468X60_1_KEY || "bc4e08faa14262881638185c03567df0",
    scriptSrc: import.meta.env.VITE_AD_468X60_1_SRC || "https://bauval.org/22/bc4e08faa14262881638185c03567df0"
  },
  "300x250_1": {
    id: "32510503",
    name: "300x250_1",
    type: "banner",
    width: 300,
    height: 250,
    key: import.meta.env.VITE_AD_300X250_1_KEY || "b07e26afd6273f2d096997641c2846f5",
    scriptSrc: import.meta.env.VITE_AD_300X250_1_SRC || "https://bauval.org/22/b07e26afd6273f2d096997641c2846f5"
  },
  "160x600_1": {
    id: "32510504",
    name: "160x600_1",
    type: "banner",
    width: 160,
    height: 600,
    key: import.meta.env.VITE_AD_160X600_1_KEY || "68602d864686854ccf7a0178999a5b23",
    scriptSrc: import.meta.env.VITE_AD_160X600_1_SRC || "https://bauval.org/22/68602d864686854ccf7a0178999a5b23"
  },
  "160x300_1": {
    id: "32510505",
    name: "160x300_1",
    type: "banner",
    width: 160,
    height: 300,
    key: import.meta.env.VITE_AD_160X300_1_KEY || "59f4d50afdfee7c1eaa8c7a75b40a60a",
    scriptSrc: import.meta.env.VITE_AD_160X300_1_SRC || "https://bauval.org/22/59f4d50afdfee7c1eaa8c7a75b40a60a"
  }
};
