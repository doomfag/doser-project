import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  globSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const args = existsSync("android")
  ? ["cap", "sync", "android"]
  : ["cap", "add", "android"];
const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.status !== 0) process.exit(result.status ?? 1);

const manifestPath = "android/app/src/main/AndroidManifest.xml";
writeFileSync(
  manifestPath,
  readFileSync(manifestPath, "utf8").replace(
    'android:allowBackup="true"',
    'android:allowBackup="false"',
  ),
);
const gradlePath = "android/app/build.gradle";
writeFileSync(
  gradlePath,
  readFileSync(gradlePath, "utf8").replace(
    /versionName "[^"]+"/,
    'versionName "0.5.0"',
  ),
);

for (const path of globSync(
  "android/app/src/main/res/mipmap-*/ic_launcher*.png",
))
  copyFileSync("desktop/icon.png", path);
