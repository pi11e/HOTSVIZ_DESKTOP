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
    
            var newChart = undefined;

            if(chartName == "heatmap")
            {
                //console.log("creating heatmap from response");
                //console.log(result);

                // TO DO: Properly initialize these variables based on response data
                var heroWinrate = result.heroWinrate;
                var mapWinrate = result.mapWinrate;

                var tealColor = 'rgba(0,128,128,0.3)';

                var mapLabels = result.mapLabels;
                var heroLabels = result.heroLabels;

                var matrixRowCount = mapLabels.length;
                var matrixColumnCount = heroLabels.length;

                var heatmapData = result.heatmapData;
                var nestedMapStats = result.nestedMapStats;

                const chartData = {
                    datasets: [{
                      label: 'Hero winrate heatmap',
                      data: heatmapData,
                      backgroundColor(context) {
                        const value = context.dataset.data[context.dataIndex].v;
                  
                        //console.log(heatmapData);
                  
                        const tempHeroName = context.dataset.data[context.dataIndex].x;
                        const tempMapName = context.dataset.data[context.dataIndex].y;
                  
                        
                        
                  
                        const alpha = (value*50 - 5) / 40;
                        
                        var color = undefined;
                  
                          if(value == null) {
                            color = 'rgba(0,0,0,0.5)';
                          } else {
                            // color = 'rgba(0,128,0,'+alpha+')';
                            color = calculateRGBA(value, nestedMapStats[tempMapName][tempHeroName].games_played);
                          }
                          return color;
                      },
                      borderColor(context) {
                        const value = context.dataset.data[context.dataIndex].v;
                        const alpha = (value*30 - 5) / 40;
                        return 'rgba(0,0,0,0.5)'
                      },
                      borderWidth: 1,
                      width: ({chart}) => (chart.chartArea || {}).width / matrixColumnCount -1, // x axis ... that's amount of columns-1 ie heroes. magic number: 51 distinct heroes in the dataset (incl non SL games)
                      height: ({chart}) =>(chart.chartArea || {}).height / matrixRowCount -1 // y axis ... that's amount of maps ie amount of objects in the dataset. magic number: 18 distinct maps in the dataset (incl non SL maps)
                    }]
                  };
                  
                  
                  const config = {
                    type: 'matrix',
                    data: chartData,
                    options: {
                      plugins: {
                        legend: false,
                        tooltip: {
                          callbacks: {
                            title() {
                              return '';
                            },
                            label(context) {
                              const v = context.dataset.data[context.dataIndex];
                              
                              const wr = v.v == null ? "N/A" : Math.round(v.v*100) + "%";
                              //const mapAndHeroStats = nestedMapStats.get(v.y).get(v.x);
                              const mapAndHeroStats = nestedMapStats[v.y][v.x];
                              const gamesPlayed = mapAndHeroStats == undefined ? "none" : mapAndHeroStats.games_played;
                              
                              return [v.x + ' on ' + v.y, 'winrate: ' + wr, 'games played: ' + gamesPlayed];
                            }
                          }
                        }
                      },
                      scales: {
                        x: {
                          type: 'category',
                          //labels: ['A', 'B', 'C'], // this should be the heroes
                          labels: heroLabels,
                          ticks: {
                            display: true, 
                            callback : function (value, index, ticks)
                            {
                              var tempHeroName = heroLabels[value];
                              if(tempHeroName != null)
                              {
                                const win_rate = heroWinrate[tempHeroName][0];
                                return tempHeroName +" "+Math.round(win_rate*1000)/10 + "%";
                              }
                  
                              return tempHeroName;
                              //console.log(index);
                              //console.log(ticks);
                            }
                          },
                          grid: {
                            display: false
                          }
                        },
                        y: {
                          type: 'category',
                          //labels: ['X', 'Y', 'Z'], // this should be the maps
                          labels: mapLabels,
                          offset: true,
                          ticks: {
                            display: true,
                            callback : function (value, index, ticks)
                            {
                              var tempMapName = mapLabels[value];
                              if(tempMapName != null)
                              {
                                return tempMapName +" "+Math.round(mapWinrate[tempMapName]*1000)/10 + "%";
                              }
                  
                              return tempMapName;
                            }
                          },
                          grid: {
                            display: false
                          }
                        }
                      }
                    }
                  };
                  
                  
                  
                    newChart = new Chart(
                      ctx,
                      config
                    );


                // add special runtime tooltip, labelling and scaling handlers - this needs to happen after the chart has been created
                /*
                newChart.options.plugins.tooltip.callbacks.label = function (context) {
                    console.log("Tooltip recalculating - function added after new Chart()");
                    return `Data: ${context.dataset.data[context.dataIndex].v}`;
                  };
                  */
            }
            else
            {
                newChart = new Chart(ctx, {
                    type: result.type,
                    data: result.data,
                    options: result.options
                });
            }

            
              
            
            // store new charts in the charts array so they can be destroyed before redrawing charts when reloading
            charts.push(newChart);

            
            
        }).catch(error => {
        console.error(`Error loading ${chartName}:`, error);
        });
}

function calculateRGBA(winrate, gamesPlayed) {

    //console.log("Calculating color value for heatmap");
  
    // Calculate the red, green, and alpha components
    const red = Math.round(255 * (1 - winrate));
    const blue = 0; // Blue component is always 0
    const green = Math.round(255 * winrate);
  
    // Normalize gamesPlayed to a range for alpha (for example, between 0.1 and 1)
    // Adjust the scale factor as needed to fit your data
    const scaleFactor = 0.2;
    const alpha = Math.min(Math.max((gamesPlayed * scaleFactor), 0.1), 1).toFixed(2);
  
    // Return the RGBA color string
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  