const { contextBridge, ipcRenderer } = require("electron");




contextBridge.exposeInMainWorld("electron", {
    selectFolder: () => ipcRenderer.invoke("select-folder"),
    openDialog: () => ipcRenderer.send("open-dialog"),
    getDataPathConfig: () => ipcRenderer.invoke("get-data-path-config"),
    processReplays: () => ipcRenderer.send("process-replays")
});
