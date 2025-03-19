window.charts = [];

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
            //console.log("convert replays pressed in renderer");
            
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
            //console.log("creating charts.");
        
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

    
});

function createChart(chartName) 
{
    //console.log("creating chart " + chartName);

    // reset existing charts and clear the charts array
    window.charts.forEach(chart => chart.destroy());
    window.charts = [];

    window.electron.getChartData(chartName).then(response => 
        {
            var result = JSON.parse(response);
    
            //console.log("getChartData result = " + result);

            // render chart based on data from response
            const ctx = document.getElementById(chartName).getContext('2d');
    
            const newChart = new Chart(ctx, {
                type: result.type,
                data: result.data,
                options: result.options
            });

            // DEBUG:: 
            // this fixes the tooltips never updating from before. investigate if it can still be done differently somehow, otherwise try to reapply response.options after the chart was created.
            
            if(chartName == "heatmap")
            {
                // add special runtime tooltip, labelling and scaling handlers - this needs to happen after the chart has been created
            
                newChart.options.plugins.tooltip.callbacks.label = function (context) {
                    console.log("Tooltip recalculating - function added after new Chart()");
                    return `Data: ${context.dataset.data[context.dataIndex].v}`;
                  };
            }

            
              
            
            // store new charts in the charts array so they can be destroyed before redrawing charts when reloading
            charts.push(newChart);

            
            
        }).catch(error => {
        console.error(`Error loading ${chartName}:`, error);
        });
}
