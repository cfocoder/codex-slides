const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pptAnythingDesktop", Object.freeze({
  platform: process.platform,
  isDesktop: true,
  copyText: (value) => ipcRenderer.invoke("ppt-anything:copy-text", value),
}));
