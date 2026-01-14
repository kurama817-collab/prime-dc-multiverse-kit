const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

fs.mkdirSync(distDir, { recursive: true });

for (const file of fs.readdirSync(srcDir)) {
  if (!file.endsWith(".ts")) {
    continue;
  }

  const sourcePath = path.join(srcDir, file);
  const targetPath = path.join(distDir, file.replace(/\.ts$/, ".js"));
  const contents = fs.readFileSync(sourcePath, "utf-8");
  fs.writeFileSync(targetPath, contents, "utf-8");
}

console.log("Build complete.");
