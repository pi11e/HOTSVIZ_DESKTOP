## DEVELOPERS

TO RUN FROM TERMINAL:
npx electron .

TO PACKAGE FOR DISTRIBUTION (for Windows 64bit):
electron-packager . HOTSVIZ-Desktop --platform=win32 --arch=x64 --out=dist


TO DO:
- fix matrix chart visualization
- better user guidance / step by step explanations and buttons
- implement frontend feedback during I/O intense operations about their progress (processing x out of y replays to JSON; DB input operations)

## HOW TO USE

Program Structure:
Step 1. Select Replay folder.
Step 2. Generate JSON files from replays.
Step 3. Process JSON files turning them into chart data.
Step 4. Load visualization with the chart data prepared.

Frontend Structure:
There's one button for each of these steps.
When navigating for the replay folder, you have to find the one that is full of .StormReplay files. 
Typically it looks like this:
%userprofile%\Documents\Heroes of the Storm\Accounts\75534426\2-Hero-1-1919475\Replays\Multiplayer