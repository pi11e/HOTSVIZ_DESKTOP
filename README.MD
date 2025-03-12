TO RUN FROM TERMINAL:
npx electron .

TO PACKAGE FOR DISTRIBUTION (for Windows 64bit):
electron-packager . HOTSVIZ-Desktop --platform=win32 --arch=x64 --out=dist


TO DO:
- port hotsdb.js #DONE
- port hotsdata.js (preparing the data from queryResult json files)
- port hotsvis.js (visualizing the data prepped by the model)
- distribute!!