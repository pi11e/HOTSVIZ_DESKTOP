const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs'); // File system module

const hotsdb = require('./hotsviz_src/hotsdb.js');
const hotsdata = require('./hotsviz_src/hotsdata.js');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            devTools: true
        }
    });
    win.loadFile('index.html');

    // open dev tools by default
    win.webContents.openDevTools();

}

// Handle folder selection and count .stormreplay files
ipcMain.handle("select-folder", async () => {
    const userProfile = process.env.USERPROFILE || process.env.HOME;
    const targetFolder = path.join(userProfile, "Documents", "Heroes of the Storm", "Accounts");

    // Check if the folder exists
    const defaultPath = fs.existsSync(targetFolder) ? targetFolder : undefined;

    // Open folder selection dialog
    const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
        defaultPath: defaultPath
    });

    if (!result.canceled && result.filePaths.length > 0) {
        const selectedFolder = result.filePaths[0];

        const configPath = path.join(__dirname, "data", "data_path.cfg");
        

        // Count .stormreplay files
        let replayCount = 0;
        try {
            const files = fs.readdirSync(selectedFolder);
            replayCount = files.filter(file => file.endsWith(".StormReplay")).length;
        } catch (error) {
            console.error("Error reading folder:", error);
        }

        // Write selected folder path to "/data/data_path.cfg"
        try {
            fs.writeFileSync(configPath, selectedFolder, "utf-8");
            console.log(`Saved path to config: ${selectedFolder}`);
        } catch (error) {
            console.error("Error writing to config file:", error);
        }

        return { folderPath: selectedFolder, fileCount: replayCount };
    }

    return null;
});

// Handle opening a separate dialog window
ipcMain.on("open-dialog", () => {
    const dialogWin = new BrowserWindow({
        width: 400,
        height: 300,
        title: "New Dialog",
        modal: true, // Keeps it on top
        parent: BrowserWindow.getAllWindows()[0], // Attach to the main window
        webPreferences: {
            contextIsolation: true
        }
    });

    dialogWin.loadURL(`data:text/html,
        <html>
        <head><title>Setup</title></head>
        <body>
        
    <p>Welcome, traveler! Follow these steps to set up your stats visualization.</p>
    <p>Use the buttons in the main window to point the app to your multiplayer replay folder. It should be full of .StormReplay files and will typically look like this:</p>
    <p>...\Documents\Heroes Of The Storm\Accounts\\78865423\\2-Hero-1-1884623\Replays\Multiplayer</p>
    <p>You'll notice the app will tell you how many total replays it detected in that folder. If that's more than 0, you probably did it right!</p>
    <p>When that's the case, use the second button to trigger processing replay files. </p>
    <p>This will only look at unprocessed replays and may take a while, especially the first time, depending on how many unprocessed replays there are.</p>
    <p>During this process, your .StormReplay files will be analysed and a somewhat more readable version will be created in your replay folder.</p>
    <p>Don't worry, these files are usually small as they're text only and won't bother anyone. </p>
    <p>The app will then load the information contained in these files and visualize it using a variety of charts.</p>
    <p>When done, the visualization will reload.</p>
    <button onclick="window.close()">OK</button>
        </body>
        </html>
    `);
});

// handle processReplays button
ipcMain.on("process-replays", () => {
    console.log("process replay button pressed in main.js");
    hotsdb.initializeDatabase();
});

// load filepath from data_path.cfg if it exists
ipcMain.handle("get-data-path-config", async () => {
    const filePath = path.join(__dirname, "data", "data_path.cfg");

    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, "utf-8"); // Read and return contents
    } else {
        return "No path selected"; // Default message if file doesn't exist
    }
});

ipcMain.handle("get-chart-data", (event, config) => 
{

    console.log("calling getChartData with parameter:", config);
    //return "Chart created successfully"; // Optional response
    let response;
    

    if(hotsdata.isValidChartType(config))
    {
        //later, this should come from here
        response = hotsdata.createResponseForChartType(config);
        
        // testing
        
    }
    else
    {
        response = "ERROR: invalid chart type requested: " + config;
    }
    
    // returning the response as-is results in "An object could not be cloned" error as the response may contain complex
    // objects that themselves contain objects. one option to fix this is by serializing and un-serializing using 
    // JSON.stringify and JSON.parse on the other end.

    //return response;
    return JSON.stringify(response);

});

app.whenReady().then(createWindow);
