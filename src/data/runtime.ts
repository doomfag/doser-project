import { Capacitor } from "@capacitor/core";
export const nativeMobile = Capacitor.isNativePlatform();
export const nativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
export const standalone =
  nativeMobile ||
  document.documentElement.dataset.doserStandalone === "true" ||
  location.protocol === "file:";

export const nativePackaged =
  nativeMobile || document.documentElement.dataset.doserNative === "true";
