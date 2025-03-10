const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Securely expose ipcRenderer
            contextIsolation: true
        }
    });
    win.loadFile('index.html');
}

// Handle folder selection request from renderer
ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"]
    });
    return result.filePaths[0] || null;
});

app.whenReady().then(createWindow);
