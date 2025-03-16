let charts = [];

document.addEventListener("DOMContentLoaded", async () => 
{

    // HANDLING OPEN DIALOG
    document.getElementById("openDialog").addEventListener("click", () => {
        window.electron.openDialog();
    });

    

    // ✅ Request the file contents from main.js
    const dataPath = await window.electron.getDataPathConfig();

    // ✅ Display the result inside the <p> element
    document.getElementById("selectedFolder").textContent = dataPath;

    // HANDLING SELECT FOLDER
    document.getElementById("selectFolder").addEventListener("click", async () => {
        const result = await window.electron.selectFolder();
        if (result) {
            document.getElementById("selectedFolder").textContent = result.folderPath;
            document.getElementById("fileCount").textContent = `Replay files found: ${result.fileCount}`;
        } else {
            document.getElementById("selectedFolder").textContent = "No folder selected";
            document.getElementById("fileCount").textContent = "";
        }
    });

    document.getElementById("convertReplays").addEventListener("click", async () =>     
        {
            console.log("convert replays pressed in renderer");
            
            // call heroes decode here
            var folderPath = document.getElementById("selectedFolder").textContent;
            window.electron.convertReplays(folderPath);

        });

    // HANDLING PROCESS REPLAYS
    document.getElementById("processReplays").addEventListener("click", async () =>     
    {
        window.electron.processReplays();   
    });

    document.getElementById("reloadVisualization").addEventListener("click", async () =>     
        {
            console.log("creating charts.");
        
            // List of chart names
            const chartNames = [
                "barchart",
                "herochart",
                "piechart",
                "heatmap",
                "linechart",
                "partysizechart"
            ];

            // Loop through and create each chart
            chartNames.forEach(createChart);           
        });

    // expose main.js chart creation and call it here (then in main forward the call to hotsviz.js)
    
    
    
    /*
    const chartConfig = { type: "bar", data: [10, 20, 30] }; // Example config

    window.electron.getChartData(chartConfig).then(response => {
    console.log("Main process responded:", response);
    }).catch(error => {
    console.error("Error:", error);
    });
    */



    // TO DO:
    // instead of passing the config here, call getChartData multiple times to get the data for each chart type
    // then create the new chart using the corresponding chartData
    // ex.
    //  var barChartData = window.electron.getChartData('barChart').then(response => {
    //  console.log("Main process responded:", response);

        //  now create the new chart using the data from response
        //const ctx = document.getElementById('barChart').getContext('2d'); // or just get the canvas
        //new Chart(ctx, {type:bar, data:response});


    //  }).catch(error => {
    //  console.error("Error:", error);
    //  });

    // Chart Types:
    // 1. BarChart that displays winrate over the last X games 
    // 2. PieChart that displays top hero games
    // 3. 

    


});

function createChart(chartName) 
{
    console.log("creating chart " + chartName);

    // reset existing charts and clear the charts array
    charts.forEach(chart => chart.destroy());
    charts = [];

    window.electron.getChartData(chartName).then(response => 
        {
            var result = JSON.parse(response);
    
            console.log("getChartData result = " + result);

            // render chart based on data from response
            const ctx = document.getElementById(chartName).getContext('2d');
    
            const newChart = new Chart(ctx, {
                type: result.type,
                data: result.data,
                options: result.options
            });

            // store new charts in the charts array so they can be destroyed before redrawing charts when reloading
            charts.push(newChart);
            
        }).catch(error => {
        console.error(`Error loading ${chartName}:`, error);
        });
}
