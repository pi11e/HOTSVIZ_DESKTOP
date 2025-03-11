const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); // File system module

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });
    win.loadFile('index.html');
}

ipcMain.handle("select-folder", async () => {
    // Define the target folder
    const userProfile = process.env.USERPROFILE || process.env.HOME; // Get user home directory
    const targetFolder = path.join(userProfile, "Documents", "Heroes of the Storm", "Accounts");

    // Check if the folder exists
    const defaultPath = fs.existsSync(targetFolder) ? targetFolder : undefined;

    // Show the folder selection dialog
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        defaultPath: defaultPath // Set the default folder if it exists
    });

    return result.filePaths[0] || null;
});

app.whenReady().then(createWindow);
