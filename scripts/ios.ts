import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const args = existsSync("ios") ? ["cap", "sync", "ios"] : ["cap", "add", "ios"];
const result = spawnSync("npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.status !== 0) process.exit(result.status ?? 1);
const info = "ios/App/App/Info.plist";
writeFileSync(
  info,
  readFileSync(info, "utf8").replace(
    "<string>App</string>",
    "<string>Doser</string>",
  ),
);
const icon =
  "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png";
if (existsSync(icon)) copyFileSync("desktop/icon-1024.png", icon);

const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const project = "ios/App/App.xcodeproj/project.pbxproj";
writeFileSync(
  project,
  readFileSync(project, "utf8")
    .replace(
      /IPHONEOS_DEPLOYMENT_TARGET = 15.0;/g,
      "IPHONEOS_DEPLOYMENT_TARGET = 15.4;",
    )
    .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
    .replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      "CURRENT_PROJECT_VERSION = 8;",
    ),
);
