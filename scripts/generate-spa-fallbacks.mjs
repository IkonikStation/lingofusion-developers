import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, "../dist");
const indexHtmlPath = path.join(distDir, "index.html");

if (!fs.existsSync(indexHtmlPath)) {
  console.error("dist/index.html does not exist. Run vite build first.");
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexHtmlPath, "utf-8");

// Write 404.html and .nojekyll
fs.writeFileSync(path.join(distDir, "404.html"), indexHtml, "utf-8");
fs.writeFileSync(path.join(distDir, ".nojekyll"), "", "utf-8");

const routes = [
  "models",
  "subscriptions",
  "subscriptions/ultra",
  "ultra",
  "playground",
  "checkout",
  "teams",
  "contact-sales",
  "docs/speech-generation",
  "docs/text-generation",
  "docs/image-translation",
  "docs/dubbing",
  "docs/sdks-and-libraries",
  "docs/error-codes",
  "docs/changelog",
  "docs/support",
  "docs/status",
  "docs/quickstart",
  "docs/overview",
  "models/lingofusion",
  "models/lingofusion-nano",
  "models/lingofusion-lite",
  "models/lingofusion-pro",
  "models/explainfusion",
  "models/lingofusion-explain",
  "models/lingofusion-ultra",
  "models/lingofusion-native-1-7b",
  "models/lingofusion-native-9b",
  "models/lingofusion-native-35b",
];

for (const route of routes) {
  const targetDir = path.join(distDir, route);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, "index.html"), indexHtml, "utf-8");
}

console.log(`Successfully generated SPA fallbacks for ${routes.length} routes in dist/`);
