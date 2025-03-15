

document.addEventListener("DOMContentLoaded", async () => 
{
    // SAMPLE CHART
    const ctx = document.getElementById('myChart').getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['January', 'February', 'March', 'April'],
            datasets: [{
                label: 'Sales ($)',
                data: [500, 700, 400, 900],
                backgroundColor: ['red', 'blue', 'green', 'orange']
            }]
        }
    });

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

    // HANDLING PROCESS REPLAYS
    document.getElementById("processReplays").addEventListener("click", async () =>     
    {
        var defaultText = "0 replays processed. Visualization pending."

        console.log("process replays clicked inside renderer");
        window.electron.processReplays();
        
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

function createChart(chartName) 
{
    console.log("creating chart " + chartName);

    window.electron.getChartData(chartName).then(response => 
        {
            var result = JSON.parse(response);
    
            // render chart based on data from response
            const ctx = document.getElementById(chartName).getContext('2d');
    
            new Chart(ctx, {
                type: result.type,
                data: result.data,
                options: result.options
            });
            
        }).catch(error => {
        console.error(`Error loading ${chartName}:`, error);
        });
}
