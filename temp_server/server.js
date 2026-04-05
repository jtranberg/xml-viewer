/* eslint-disable no-undef */
/* eslint-env node */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 10000;

const allowedOrigins = [
  "http://localhost:5173",
  "https://xml-feeds-viewer.netlify.app",
  ...(process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS.split(",").map((s) => s.trim()).filter(Boolean)
    : []),
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "xml-viewer-proxy",
    time: new Date().toISOString(),
    allowedOrigins,
  });
});

app.get("/proxy-feed", async (req, res) => {
  try {
    const { url, username = "", password = "" } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing required ?url= parameter" });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid URL" });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Only http and https URLs are allowed" });
    }

    const headers = {
      "User-Agent": "XML-Feed-Viewer-Proxy/1.0",
      Accept: "application/xml, text/xml, application/rss+xml, application/atom+xml, */*",
    };

    if (username || password) {
      headers.Authorization =
        "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
    }

    const upstream = await fetch(parsedUrl.toString(), {
      method: "GET",
      headers,
      redirect: "follow",
    });

    if (!upstream.ok) {
      const bodyPreview = await upstream.text().catch(() => "");
      return res.status(upstream.status).json({
        error: `Upstream request failed: ${upstream.status} ${upstream.statusText}`,
        preview: bodyPreview.slice(0, 500),
      });
    }

    const contentType =
      upstream.headers.get("content-type") || "application/xml; charset=utf-8";

    const text = await upstream.text();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      error: "Proxy error",
      message: err.message || "Unknown server error",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`XML viewer proxy running on port ${PORT}`);
});