import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/mcp", "/*/subscribe?"] }, sitemap: "https://ag-ui.ai/sitemap.xml", host: "https://ag-ui.ai" }; }
