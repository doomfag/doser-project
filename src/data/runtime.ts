import { Capacitor } from "@capacitor/core";
export const nativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export const standalone =
  nativeAndroid ||
  document.documentElement.dataset.doserStandalone === "true" ||
  location.protocol === "file:";
