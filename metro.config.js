const path = require("path");
const http = require("http");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

// Path to the shared-types package (sibling of mobile app)
const sharedTypesPath = path.resolve(__dirname, "../../packages/shared-types");

const config = getDefaultConfig(__dirname);

// Tell Metro to watch the shared-types folder even though it's outside the project root
config.watchFolders = [sharedTypesPath];

config.resolver.extraNodeModules = {
  tailwindcss: path.resolve(__dirname, "node_modules/tailwindcss"),
  zod: path.resolve(__dirname, "node_modules/zod"),
  "expo-linking": path.resolve(__dirname, "node_modules/expo-linking"),
  "expo-router": path.resolve(__dirname, "node_modules/expo-router"),
  "react": path.resolve(__dirname, "node_modules/react"),
  "react-native": path.resolve(__dirname, "node_modules/react-native"),
};

// CORS proxy for web requests to bypass browser restrictions
config.server = {
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url.startsWith("/api/")) {
        const targetUrl = "http://localhost:3000" + req.url;
        const urlObj = new URL(targetUrl);
        
        const headers = { ...req.headers };
        headers.host = urlObj.host;
        
        const proxyReq = http.request({
          host: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: req.method,
          headers: headers
        }, (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        });
        
        proxyReq.on("error", (err) => {
          console.error("Metro API Proxy Error:", err);
          res.statusCode = 502;
          res.end("Proxy Error: " + err.message);
        });
        
        req.pipe(proxyReq);
        return;
      }
      return middleware(req, res, next);
    };
  }
};

module.exports = withNativeWind(config, { input: "./global.css" });

