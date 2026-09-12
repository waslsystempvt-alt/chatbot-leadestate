import { copyFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dist = resolve(root, "dist");

const copies = [
  [resolve(root, "embed.js"), resolve(dist, "embed.js")],
  [resolve(root, "thankyou.html"), resolve(dist, "thankyou.html")],
  [resolve(root, "widget/public/profile.webp"), resolve(dist, "profile.webp")],
  [resolve(root, "profile.webp"), resolve(dist, "profile.webp")],
];

mkdirSync(dist, { recursive: true });

const widgetCss = resolve(dist, "widget.css");
const chatbotCss = resolve(dist, "chatbot.css");
if (existsSync(widgetCss)) {
  renameSync(widgetCss, chatbotCss);
  console.log("renamed widget.css -> chatbot.css");
}

for (const [src, dest] of copies) {
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log("copied", dest);
  }
}
