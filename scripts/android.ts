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
let baseManifest = readFileSync(manifestPath, "utf8")
  .replace(
    /<uses-feature[^>]+android:name="(?:android.software.leanback|android.hardware.touchscreen)"[^>]*\/>/g,
    "",
  )
  .replace(/android:banner="@drawable\/tv_banner"/g, "")
  .replace(
    /<category android:name="android.intent.category.LEANBACK_LAUNCHER" \/>/g,
    "",
  );
writeFileSync(manifestPath, baseManifest);
const activityPath =
  "android/app/src/main/java/io/github/doomfag/doser/MainActivity.java";
writeFileSync(
  activityPath,
  "package io.github.doomfag.doser;\nimport com.getcapacitor.BridgeActivity;\npublic class MainActivity extends BridgeActivity {}\n",
);
const gradlePath = "android/app/build.gradle";
writeFileSync(
  gradlePath,
  readFileSync(gradlePath, "utf8").replace(
    /applicationId "io.github.doomfag.doser(?:\.tv)?"/,
    'applicationId "io.github.doomfag.doser"',
  ),
);

writeFileSync(
  gradlePath,
  readFileSync(gradlePath, "utf8").replace(
    /versionName "[^"]+"/,
    'versionName "0.6.0"',
  ),
);

for (const path of globSync(
  "android/app/src/main/res/mipmap-*/ic_launcher*.png",
))
  copyFileSync("desktop/icon.png", path);

if (process.argv.includes("--tv")) {
  let manifest = readFileSync(manifestPath, "utf8");
  manifest = manifest.replace(
    "<application",
    '<uses-feature android:name="android.software.leanback" android:required="false"/><uses-feature android:name="android.hardware.touchscreen" android:required="false"/><application android:banner="@drawable/tv_banner"',
  );
  manifest = manifest.replace(
    '<category android:name="android.intent.category.LAUNCHER" />',
    '<category android:name="android.intent.category.LAUNCHER" /><category android:name="android.intent.category.LEANBACK_LAUNCHER" />',
  );
  writeFileSync(manifestPath, manifest);
  copyFileSync(
    "desktop/tv-banner.png",
    "android/app/src/main/res/drawable/tv_banner.png",
  );
  writeFileSync(
    gradlePath,
    readFileSync(gradlePath, "utf8").replace(
      'applicationId "io.github.doomfag.doser"',
      'applicationId "io.github.doomfag.doser.tv"',
    ),
  );
  writeFileSync(
    "android/app/src/main/java/io/github/doomfag/doser/MainActivity.java",
    `package io.github.doomfag.doser;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public boolean dispatchKeyEvent(KeyEvent event){
  if(event.getKeyCode()==KeyEvent.KEYCODE_BACK){
   if(event.getAction()==KeyEvent.ACTION_UP && getBridge()!=null){getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'BrowserBack',bubbles:true,cancelable:true}))",result->{if("true".equals(result))finish();});}
   return true;
  }
  return super.dispatchKeyEvent(event);
 }
}`,
  );
}
