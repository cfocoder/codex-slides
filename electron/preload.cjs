const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("pptAnythingDesktop", Object.freeze({
  platform: process.platform,
  isDesktop: true,
}));

