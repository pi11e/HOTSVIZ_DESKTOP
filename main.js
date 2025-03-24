const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require("child_process");

const fs = require('fs'); // File system module

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
    <p>You may notice a brief slow down of your machine as the information is processed.</p>
    <p>When it has passed, click reload visualization to show the charts.</p>
    <button onclick="window.close()">OK</button>
        </body>
        </html>
    `);
});

// handle processReplays button
ipcMain.on("process-replays", () => {
    //console.log("process replay button pressed in main.js");
    
    
    loadHotsDB();
});

async function loadHotsDB() 
{
    const hotsdb = await import('./hotsviz_src/hotsdb.js');

    const dataPath = "./data/";
    const dataPath_dist = "./resources/app/data/";

    hotsdb.setEventEmitter(ipcMain);

    if(app.isPackaged)
    {
        hotsdb.initializeData(dataPath_dist);
    }
    else
    {
        hotsdb.initializeData(dataPath);
    }

    
    hotsdb.initializeDatabase();



    
}

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

    //console.log("calling getChartData with parameter:", config);
    
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


// Function to process all .stormreplay files in a folder
ipcMain.handle("convert-replays", async (_event, folderPath) => {
    return new Promise((resolve) => {
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                console.error(`Error reading folder: ${err.message}`);
                resolve({ success: false, message: "Failed to read folder." });
                return;
            }

            const stormReplays = files.filter(file => file.endsWith(".StormReplay"));
            const totalReplays = stormReplays.length;
            let newJsonCount = 0; // Tracks how many new JSON files are created

            if (totalReplays === 0) {
                console.log("No .StormReplay files found.");
                resolve({ success: false, message: "No replay files found." });
                return;
            }

            let processedCount = 0;
            stormReplays.forEach((file) => {
                const replayPath = path.join(folderPath, file);
                const jsonPath = replayPath + ".json";

                if (fs.existsSync(jsonPath)) {
                    console.log(`Skipping: ${file} (JSON already exists)`);
                } else {
                    console.log(`Processing: ${file}`);
                    newJsonCount++;

                    const exePath = path.join(__dirname, "heroesDecode", "HeroesDecode.exe");
                    const command = `"${exePath}" get-json --replay-path "${replayPath}" > "${jsonPath}"`;

                    const child = spawn(command, { shell: true });

                    child.on("close", (code) => {
                        if (code !== 0) {
                            console.error(`Error processing: ${file} (Exit code: ${code})`);
                        }
                        finalizeProcessing();
                    });

                    return;
                }

                finalizeProcessing();
            });

            function finalizeProcessing() {
                processedCount++;
                if (processedCount === totalReplays) {
                    const message = `Found ${totalReplays} replay files. Generated ${newJsonCount} new JSON files.`;
                    console.log(message);

                    // Send the result to the renderer
                    BrowserWindow.getAllWindows().forEach(win => win.webContents.send("convert-replays-done", {
                        totalReplays,
                        newJsonCount
                    }));

                    resolve({ success: true, message });
                }
            }
        });
    });
});


ipcMain.on("database-processing-start", (event) => {
    //console.log("Forwarding event: database-processing-start"); // Debug log
    BrowserWindow.getAllWindows().forEach(win => win.webContents.send("database-processing-start"));
});

ipcMain.on("database-processing-done", (event) => {
    //console.log("Forwarding event: database-processing-done"); // Debug log
    BrowserWindow.getAllWindows().forEach(win => win.webContents.send("database-processing-done"));
});

ipcMain.on("database-progress", (_event, count) => {
    //console.log("Forwarding event: database-progress with count = ", count); // Debug log
    BrowserWindow.getAllWindows().forEach(win => win.webContents.send("database-progress", count));
});

app.setPath('userData', path.join(app.getPath('appData'), 'HOTSVIZ'));


app.whenReady().then(createWindow);
