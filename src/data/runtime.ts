export const standalone =
  document.documentElement.dataset.doserStandalone === "true" ||
  location.protocol === "file:";
