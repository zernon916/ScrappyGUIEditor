const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scrappy", {
  invoke: (name, args) => ipcRenderer.invoke("scrappy:" + name, args || {}),
  on: (channel, fn) => {
    const wrapped = (_event, payload) => fn(payload);
    ipcRenderer.on("scrappy:" + channel, wrapped);
    return () => ipcRenderer.removeListener("scrappy:" + channel, wrapped);
  },
});
