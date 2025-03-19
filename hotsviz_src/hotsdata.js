
import * as fs from 'fs';

/*

This script is responsible for generating JSON blobs from a local MySQL database.
It also exposes functions to serve this data so it can be plugged into 
the Chart.js charts used by the visualizer (hotsviz) to render player statistics.

*/



export function isValidChartType(chartType) {
    const validChartTypes = new Set([
        "heatmap", "piechart", "barchart", 
        "linechart", "herochart", "partysizechart"
    ]);

    return validChartTypes.has(chartType);
}


export function createResponseForChartType(chartType)
{
    //console.log("creating response for chart type " + chartType);

    var dataSet = undefined;

    switch (chartType) {
        case "heatmap":
            dataSet = createHeatMapResponse();
            console.log("Heat Map Dataset:");
            console.log(dataSet);
            break;
        case "piechart": // done and working
            dataSet = createPieChartResponse();
            break;
        case "barchart": // done and working
            dataSet = createBarChartResponse();
            break;
        case "linechart": // done and working
            dataSet = createLineChartResponse();
            break;
        case "herochart": // done and working
            dataSet = createHeroChartResponse();
            break;
        case "partysizechart": // done and working
            dataSet = createPartySizeChartResponse();
            break;
        default:
            break;
    }

    //console.log(dataSet);
    return dataSet;
}

function createHeatMapResponse()
{
    const response = {_type:undefined, _data:undefined, _options:undefined};

    var tealColor = 'rgba(0,128,128,0.3)';

    // testing: get the data from hotsdata.js
    var heatmapData = generateHeatmapDataSet2();

    const rankedMaps = Array.from(JSON.parse(fs.readFileSync('./data/queryForRankedMapsResult.json', 'utf-8')));
    const rankedHeroes = Array.from(JSON.parse(fs.readFileSync('./data/queryForRankedHeroesResult.json', 'utf-8')));

    const mapLabels = [];
    const heroLabels = [];

    

    rankedHeroes.forEach(element => { heroLabels.push(element.game_hero)});
    rankedMaps.forEach(element => { mapLabels.push(element.game_map)});

    console.log("maplabels: " + mapLabels);
    console.log("herolabels: " + heroLabels);

    const matrixRowCount = rankedMaps.length;
    const matrixColumnCount = rankedHeroes.length;

    const nestedMapStats = generateNestedMapDataSet();


    // DEBUG - COMMENT:
    // It looks like all the data is correct. However, the tooltips and backgroundColor callbacks are never called it seems. 
    // For example, the helper function to calculate the RGBA cell colors also never seems to get called.

    const chartData = {
      datasets: [{
        label: 'Hero winrate heatmap',
        data: heatmapData,
        
        /*
        backgroundColor(context) {
          const value = context.dataset.data[context.dataIndex].v;
    
          
          console.log("context");
          console.log(context);


          console.log("heatmapdata in datasets");
          console.log(heatmapData);
    
          const tempHeroName = context.dataset.data[context.dataIndex].x;
          const tempMapName = context.dataset.data[context.dataIndex].y;
    
          //console.log(nestedMapStats.get(tempMapName).get(tempHeroName));
          
    
          const alpha = (value*50 - 5) / 40;
          
          var color = undefined;
    
          // if(!nestedMapStats.get(tempMapName).has(tempHeroName)) 
          //   {
              
          //     color = 'rgba(0,0,0,0.5)';
          //   } 
          //   else 
          //   {
              
          //     color = 'rgba(0,128,0,'+alpha+')';
          //   }
            if(value == null) {
              color = 'rgba(0,0,0,0.5)';
            } else {
              // color = 'rgba(0,128,0,'+alpha+')';
              color = calculateRGBA(value, nestedMapStats.get(tempMapName).get(tempHeroName).games_played);
            }
            return color;
        },
        borderColor(context) {
          const value = context.dataset.data[context.dataIndex].v;
          const alpha = (value*30 - 5) / 40;
          return 'rgba(0,0,0,0.5)'
        },*/
        borderWidth: 1,
        width: ({chart}) => (chart.chartArea || {}).width / (matrixColumnCount-1), // x axis ... that's amount of columns-1 ie heroes. magic number: 51 distinct heroes in the dataset (incl non SL games)
        //width: 25,
        height: ({chart}) =>(chart.chartArea || {}).height / (matrixRowCount-1)// y axis ... that's amount of maps ie amount of objects in the dataset. magic number: 18 distinct maps in the dataset (incl non SL maps)
        //height: 20
      }]
    };

    console.log("calculated width of each element:")
    console.log(chartData.datasets[0].width);
    
    console.log("calculated height of each element:")
    console.log(chartData.datasets[0].height);
    
    const config = {
      type: 'matrix',
      data: chartData,
      options: {
        plugins: {
          legend: false,
          tooltip: {
            callbacks: {
              title() {
                console.log("title callback in action");
                return '';
              },
              label(context) {
                const v = context.dataset.data[context.dataIndex];
                console.log("Tooltip recalculating... function added before new Chart()"); // Ensure this logs every time
  
                const wr = v.v == null ? "N/A" : Math.round(v.v*100) + "%";
                const mapAndHeroStats = nestedMapStats.get(v.y).get(v.x);
                const gamesPlayed = mapAndHeroStats == undefined ? "none" : mapAndHeroStats.games_played;
                console.log("tooltip label in action");
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
                console.log("callback in action");
                var tempHeroName = heroLabels[value];
                if(tempHeroName != null)
                {
                  const win_rate = heroWinrate.get(tempHeroName)[0];
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
                  return tempMapName +" "+Math.round(mapWinrate.get(tempMapName)*1000)/10 + "%";
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
    
    return config;
}

export function configureHeatmap(chart, context)
{
  console.log("adding dynamic configuration for heatmap");
}

function createPieChartResponse()
{
    const response = {type:undefined, data:undefined, options:undefined};
    var pieChartData = generatePieChartDataSet();

    response.type = 'doughnut';
    response.data = {
        labels: pieChartData.labels, // array[36] = ["Raynor", "Tracer", ...]
        datasets: [
            {
                label: 'Games',
                data: pieChartData.data // array[36] = [4,35,...]
            }
        ]
    }; 
    response.options = {
      plugins: {
        title : {
          display: true,
          text: "Total ranked games per hero"
        }
      }};


    return response;
}

function createLineChartResponse()
{
    const response = {type:undefined, data:undefined, options:undefined};
    var lineChartData = generateLineChartDataSet();

    response.type = 'line';
    response.data = lineChartData;
    response.options = {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'daily vs. aggregate winrate'
          }
        },
        scales: {
          y: {
            position: 'left'
          },
          y1: {
            position: 'right',
            max : 0.6,
            min : 0.4
          },
          x:
          {
            ticks: {
              callback : function (value, index, ticks)
              {
                return lineChartData.labels[value].substring(0,10);
              }
            }
          }
        }
      };

    return response;
}

function createPartySizeChartResponse()
{
    const response = {type:undefined, data:undefined, options:undefined};
    var partyWinrateData = generatePartyWinrateDataSet();

    response.type = 'bar';

    response.data = {
        labels: [1,2,3,4,5],//xAxisLabels,
        datasets: [
          {
            label: 'Defeats',
            data: partyWinrateData[1],
            backgroundColor: 'rgb(255, 99, 132)' //red
          },
          {
            label: 'Wins',
            data: partyWinrateData[0],
            backgroundColor: 'rgb(75, 192, 192)' // green
          }
        ]
      };
      response.options = {
        plugins: {
          title : {
            display: true,
            text: 'Winrate per party size'
          }
        },
        responsive: true,
        scales:{
          x: { stacked: true},y: { stacked: true}
        }
      };
    

    return response;
}

function generateNestedMapDataSet()
{
    
    const jsonResponse = parseQueryJSON("queryForNestedMapResult.json");

        // Initialize the nested map structure
    const mapOfMaps = new Map();

    // Iterate over each item in the JSON data
    jsonResponse.forEach(item => {
        const gameMap = item.game_map;
        const gameHero = item.game_hero;
        const gamesPlayed = item.games_played;
        const gamesWon = item.games_won;

        // Check if the game map already exists in the outer map
        if (!mapOfMaps.has(gameMap)) {
            mapOfMaps.set(gameMap, new Map());
        }

        // Get the inner map corresponding to the current game map
        const heroMap = mapOfMaps.get(gameMap);

        // Set the number of games played and won for the current hero in the inner map
        heroMap.set(gameHero, { games_played: gamesPlayed, games_won: gamesWon });
    });

    return mapOfMaps;
}

function createBarChartResponse()
{
    const response = {type:undefined, data:undefined, options:undefined};
    let barChartData = generateBarChartDataSet();

    let lossData = barChartData.loss;
    let winData = barChartData.wins;

    const totalGames = lossData.concat(winData).reduce((partialSum, a) => partialSum + a, 0);
    const totalWins = winData.reduce((partialSum, a) => partialSum + a, 0);

    const winRate = Math.round(totalWins *10000 / totalGames) / 100;

    response.type = 'bar';
    response.data = {
        labels: barChartData.labels,
        datasets: [
            {
              label: 'Defeat',
              data: lossData,
              backgroundColor: 'rgb(255, 99, 132)' //red
            },
            {
              label: 'Win',
              data: winData,
              backgroundColor: 'rgb(75, 192, 192)' // green
            }
          ]
        };
    response.options = {
        plugins: {
          title : {
            display: true,
            text: 'Winrate over the last '+totalGames+' ranked games: ' + winRate + "%" 
          }
        },
        responsive: true,
        scales:{
          x: { stacked: true, ticks: {callback : function (value, index, ticks) 
            {
              var totalGamesOnMap = lossData[value] + winData[value];
              var winrateOnMap = Math.round(winData[value]/totalGamesOnMap*100);
              return barChartData.labels[value] + ": " + winrateOnMap + "%"
            }}},y: { stacked: true}
        }
      };


    return response;
}

function generateBarChartDataSet()
{
    var barChartData = { labels : [], wins : [], loss : []};

    // read response
    const jsonResponse = parseQueryJSON("queryForMapStatsResult.json");

    Array.from(jsonResponse).forEach(element => 
    {
        barChartData.labels.push(element.game_map);
        barChartData.wins.push(element.total_wins);

        const total_loss = element.total_games - element.total_wins;
        barChartData.loss.push(total_loss);

    });

    //console.log("bar chart = " + barChartData);
    return barChartData;
}

function createHeroChartResponse()
{
    const response = {type:undefined, data:undefined, options:undefined};
    let pieChartData = generatePieChartDataSet();
    let heroChartData = generateHeroChartDataSet();

    response.type = 'bar';
    response.data = {
        labels: heroChartData.labels, // array[36] = ["Raynor", "Tracer", ...]
        datasets: [
            {
                label: 'winrate',
                data: heroChartData.data // array[36] = [4,35,...]
            }
        ]
    }; 
    response.options = {
      plugins: {
        title : {
          display: true,
          text: "Winrate in % per hero with more than 2 games"
        }
      },
      scales: {
        x: {
          ticks: {
            callback : function (value, index, ticks)
            {
              // show # of total games on the ticks
              return heroChartData.labels[value] + ": " + pieChartData.data[value];
            }
          }
        }
      }
    };

    return response;
}

function generateHeroChartDataSet()
{
    // serve and adjust the datasets here
    var heroChartData = { labels : [], data : []};

    // read response
    
    const jsonResponse = parseQueryJSON("queryForHeroStatsResult.json");

    Array.from(jsonResponse).forEach(element => 
        {
            //console.log("checking hero " + JSON.stringify(element));
            if(element.total_games > 2)
                {
                    //console.log("checking hero " + JSON.stringify(element));
                    heroChartData.labels.push(element.game_hero);
                    heroChartData.data.push(element.win_rate*100);
                }
            
    });

    
    
    return heroChartData;
}

function generatePieChartDataSet()
{


    // serve and adjust the datasets here
    var pieChartData = { labels : [], data : []};

    const jsonResponse = parseQueryJSON("queryForHeroStatsResult.json");

    Array.from(jsonResponse).forEach(element => 
        {
            
            pieChartData.labels.push(element.game_hero);
            
            pieChartData.data.push(element.total_games);
    });

    
    //console.log(pieChartData);
    return pieChartData;
}

function generateHeatmapDataSet2()
{
    // as an alternative to the original monstrous query, build a data structure that looks like this from the nested map obtained from generateNestedMapDataSet()
    const nestedMap = generateNestedMapDataSet();

    const rankedMaps = parseQueryJSON("queryForRankedMapsResult.json");
    const rankedHeroes = parseQueryJSON("queryForRankedHeroesResult.json");

    var dataSet = [];
    
// NESTED MAP STATS = 
// {$map, new Map(){$hero, {games_won, games_played}}}
// example usage:
// const tracerWinrateOnAlteracPass = nestedMapStats.get('Alterac Pass').get('Tracer').games_won / nestedMapStats.get('Alterac Pass').get('Tracer').games_played // round to 2 decimals using Math.round() after

// HERO STATS =
// [{map:map1, hero1:winrate, hero2:winrate, ...},{map:map2, hero1:winrate, hero2:winrate,...}]
// example usage:
// foreach (obj in heroStats) => obj.hero1 ...

    rankedMaps.forEach(rankedMap => 
        {
            const mapName = rankedMap.game_map;

            // now collect all the hero winrates on that map
            

            rankedHeroes.forEach(rankedHero => 
            {
                const heroName = rankedHero.game_hero;
                var winRate = null;

                if(nestedMap.get(mapName).has(heroName))
                {
                    winRate = nestedMap.get(mapName).get(heroName).games_won / nestedMap.get(mapName).get(heroName).games_played;
                }

                dataSet.push({x: heroName, y: mapName, v: winRate});

            });

            
    });


    return dataSet;
}

function generateLineChartDataSet()
{
    // REAL DATA:
    const jsonResponse = parseQueryJSON("queryForLineChartResult.json");

    // assume data consists of an array of (about 500) json blobs where each looks like this:
    // {game_date : "2024-01-04", winrate_each_day : 0.66667, games_played : 3, games_won : 2, aggregate_winrate : 0.6333}
    // this will contain one entry for each day at least one game was played on, the amount of wins and total games that day,
    // the individual winrate on that day (ie that day's wins divided by total games played) and an accumulated winrate over this
    // and all previous days, i.e. the total amount of wins divided by defeats on and up until that day
    //console.log(jsonResponse);

    const labels = [];
    const winrate_per_day = []; // dataset 1
    const winrate_aggregate = []; // dataset 2

    // should probably ignore the first x elements as the aggregate will take a few swings til it settles
    const game = Array.from(jsonResponse);
    if(game.length < 40)
    {
        console.log("ERROR: Not enough games to show winrate evolution.");
        return undefined;
    }  

    for(var i = 30; i < game.length; i++)
    {
        var element = game[i];
        labels.push(element.game_date);
        winrate_per_day.push(element.winrate_each_day);
        winrate_aggregate.push(element.aggregate_winrate);
    }

    /*
    Array.from(jsonResponse).forEach(element => 
        {
            
            labels.push(element.game_date);
            winrate_per_day.push(element.winrate_each_day);
            winrate_aggregate.push(element.aggregate_winrate);
    });*/

    //console.log(labels);

    // line chart data
    const lineChartData = {
    labels: labels,
    datasets: [
    {
      label: 'daily winrate',
      data: winrate_per_day,
      borderColor: 'rgba(0,128,128,0.3)',
      yAxisID: 'y'
    },
    {
        label: 'aggregate winrate',
        data: winrate_aggregate,
        borderColor: 'rgba(255,0,0,0.5)',
        yAxisID: 'y1'
    }
  ]
};

    //console.log(jsonResponse);
    return lineChartData;
}

function generatePartyWinrateDataSet()
{
    const jsonResponse = parseQueryJSON("queryForPartyWinrateResult.json");

    var winData = [0,0,0,0,0]; // data[x] = winrate for party size x where x is the amount of party members (0 - solo, 4 - five stack)
    var lossData = [0,0,0,0,0];

    jsonResponse.forEach(element => 
    {
        var players = JSON.parse(element.game_players);
        var isWinner = JSON.parse(element.game_winner);
        var replayOwnerParty = undefined;
        var playersPerId = new Map();

        

        players.forEach(player => 
        {
                // here we'll find 10 players, one of which will be the replay owner.
                // properties of each player are:
                // accountLevel, battleTag, isReplayOwner, isWinner, name, party, talents[], team, toonId
                // check for replay owner, then party id
                if(player.party != null)
                {
                    if(!playersPerId.has(player.party))
                    {
                        // if the party ID has not been recorded yet, set it up and set its player count to 1
                        playersPerId.set(player.party, 1);    
                    }
                    else
                    {
                        // if the party ID has been recorded previously, grab its current value, increase by one and save it back
                        var playerCountForParty = playersPerId.get(player.party);
                        playerCountForParty++;
                        playersPerId.set(player.party, playerCountForParty);
                    }
                    
                }
                if(player.isReplayOwner)
                {
                    
                    // if the replay owner was not in a party, register a win or loss for party size 0.
                    if(player.party == null) 
                    {
                        isWinner == 1 ? winData[0] += 1 : lossData[0] += 1;
                    } else {
                        // otherwise, store party ID to later figure out the amount of party members
                        replayOwnerParty = player.party;
                    }
                }
                // at this point, we have:
                // - stored each party id if the player has one
                // - stored the party id of the replay owner, if there is one (otherwise we register a win with party size of 0)

        });

        if(replayOwnerParty != undefined) // if replayOwnerParty is still undefined here, the replay owner was not in a party and we don't need to do anything else
        {
            //however if they were in a party, we need to record a win for the respective size of the party.
            var partySize = playersPerId.get(replayOwnerParty);
            isWinner == 1 ? winData[partySize-1] += 1 : lossData[partySize-1] += 1;
            //console.log("adding "+ isWinner == 1 ? "win" : "loss" +" for party size " + partySize-1)
        }


    });
    

    return [winData,lossData];
}

function parseQueryJSON(filename)
{
  var parsedQuery = undefined;

  const dataPath = "./data/";
  const dataPath_dist = "./resources/app/data/";

  try 
  {
    // first, assume the query json resides in ./data/
    parsedQuery = JSON.parse(fs.readFileSync(dataPath + filename, 'utf-8'));
    
  } catch (error) {
    if(error.code === 'ENOENT')
    {
      // if the file wasn't found, check if it can be found where the packaged executable would place it, which is in ./resources/app/data
      
      try {
        parsedQuery = JSON.parse(fs.readFileSync(dataPath_dist + filename, 'utf-8'));  
      } catch (error) {
        console.log("File not found: " + filename + ". May need to process replays first?");
      }
    }
    else {
      console.error('An unexpected error occurred:', error);
  }
  }

  return parsedQuery;
}

function calculateRGBA(winrate, gamesPlayed) {

  console.log("Calculating color value for heatmap");

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
