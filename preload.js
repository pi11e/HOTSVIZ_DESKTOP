const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("electron", {
    selectFolder: () => ipcRenderer.invoke("select-folder"),
    openDialog: () => ipcRenderer.send("open-dialog"),
    getDataPathConfig: () => ipcRenderer.invoke("get-data-path-config"),
    processReplays: () => ipcRenderer.send("process-replays"),
    getChartData: (config) => ipcRenderer.invoke("get-chart-data", config),
    convertReplays: (folder) => ipcRenderer.invoke("convert-replays", folder),
    onDatabaseProcessingStart: (callback) => ipcRenderer.on("database-processing-start", callback),
    onDatabaseProcessingDone: (callback) => ipcRenderer.on("database-processing-done", callback)
});
