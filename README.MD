TO RUN FROM TERMINAL:
npx electron .

TO PACKAGE FOR DISTRIBUTION (for Windows 64bit):
electron-packager . HOTSVIZ-Desktop --platform=win32 --arch=x64 --out=dist


TO DO:
- implement functional "processing replay" counter to provide feedback on database generation
- fix database generation in distributed mode: worked for me but not 
- port hotsvis.js (visualizing the data prepped by the model)
- distribute!!