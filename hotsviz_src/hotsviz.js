/*

hotsvis.jz
This script is responsible for creating charts on a given canvas element (specified in index.html) and assigning relevant
options and data to them. 

*/

// not needed - chart.js should already be loaded via index.html 
//import Chart from 'chart.js/auto';

//import * as fs from'fs'; // instead of importing fs here where you can't use it, resolve FS operations in main.js where it is available, then call functions exported here with the result
//const fs = require('fs');

//import { MatrixController, MatrixElement } from '../node_modules/chartjs-chart-matrix';
const {MatrixController, MatrixElement} = require('chartjs-chart-matrix');

import * as hotsdata from './hotsdata.js'


export async function createBarChartFromHeroStats(queryForHeroStatsResult, queryForMapStatsResult)
{
  const heroStats = JSON.parse(queryForHeroStatsResult);
  const mapStats = JSON.parse(queryForMapStatsResult);

  var heroWinrate = new Map();
  heroStats.forEach(element => 
    {
      heroWinrate.set(element.game_hero, [element.win_rate, element.total_games]);
  });

  // mapwinrate is used to display global map winrate on y axis labels
  var mapWinrate = new Map();
  mapStats.forEach(element => 
    {
      mapWinrate.set(element.game_map, element.win_rate);
  });

  
  // we need a labels[] that contains all the map names
  // we need a wins[] and losses[] that contain the total wins / losses for the map
  let barChartData = hotsdata.generateDataForChartType("barchart");

  let lossData = barChartData.loss;
  let winData = barChartData.wins;

  const totalGames = lossData.concat(winData).reduce((partialSum, a) => partialSum + a, 0);
  const totalWins = winData.reduce((partialSum, a) => partialSum + a, 0);

  const winRate = Math.round(totalWins *10000 / totalGames) / 100;

  // with all the data in hand, now we can create a new bar chart

  return new Chart(
    document.getElementById('barchart'),
    {
      type: 'bar',
      data: {
        labels: barChartData.labels,//xAxisLabels,
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
      },
      options :{
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
      }
    }
  );

}

// OLD HOTSVIZ.JS - port this stuff then delete

(async function() 
{
 

  // BEGIN BAR CHART


  

  // END BAR CHART
  let pieChartData = hotsdata.generateDataForChartType("piechart"); // used in both pie and hero charts :S
  
  // BEGIN HERO (another bar) CHART
  let heroChartData = hotsdata.generateDataForChartType("herochart");

  new Chart(
    document.getElementById('herochart'),
    {
        type: 'bar',
        data: {
            labels: heroChartData.labels, // array[36] = ["Raynor", "Tracer", ...]
            datasets: [
                {
                    label: 'winrate',
                    data: heroChartData.data // array[36] = [4,35,...]
                }
            ]
        }, 
        options :{
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
                  console.log(heroWinrate);
                  return heroChartData.labels[value] + ": " + pieChartData.data[value];
                }
              }
            }
          }}

});

  // END HERO (another bar) CHART

  // BEGIN PIE CHART
  //console.log(Array.from(heroWins.keys()));  
  //console.log(Array.from(heroWins.values()));


  new Chart(
    document.getElementById('piechart'),
    {
        type: 'doughnut',
        data: {
            labels: pieChartData.labels, // array[36] = ["Raynor", "Tracer", ...]
            datasets: [
                {
                    label: 'Games',
                    data: pieChartData.data // array[36] = [4,35,...]
                }
            ]
        }, 
        options :{
          plugins: {
            title : {
              display: true,
              text: "Total ranked games per hero"
            }
          }}

});

// END PIE CHART

// BEGIN HEATMAP

//this registers the MatrixController and MatrixElement plugins
Chart.register(MatrixController, MatrixElement);

/*
Usage:
https://chartjs-chart-matrix.pages.dev/usage.html

Tree data should be provided in tree property of dataset. 
data is then automatically build. 
key defines the key name in data objects to use for value. 
groups array can be provided to display multiple levels of hierarchy. 
Data is summarized to groups internally.

Samples:
https://github.com/kurkle/chartjs-chart-matrix/tree/main/docs/samples

example for providing tree instead of data:

*/

var tealColor = 'rgba(0,128,128,0.3)';

// testing: get the data from hotsdata.js
var heatmapData = hotsdata.generateDataForChartType("heatmap");

//console.log(JSON.stringify(heatmapData));


const rankedMaps = Array.from(JSON.parse(fs.readFileSync('./data/queryForRankedMapsResult.json', 'utf-8')));
const rankedHeroes = Array.from(JSON.parse(fs.readFileSync('./data/queryForRankedHeroesResult.json', 'utf-8')));

const mapLabels = [];
const heroLabels = [];

rankedHeroes.forEach(element => { heroLabels.push(element.game_hero)});
rankedMaps.forEach(element => { mapLabels.push(element.game_map)});

const matrixRowCount = rankedMaps.length;
const matrixColumnCount = rankedHeroes.length;

const nestedMapStats = hotsdata.generateDataForChartType("nestedmap");




// NESTED MAP STATS = 
// {$map, new Map(){$hero, {games_won, games_played}}}
// example usage:
// const tracerWinrateOnAlteracPass = nestedMapStats.get('Alterac Pass').get('Tracer').games_won / nestedMapStats.get('Alterac Pass').get('Tracer').games_played // round to 2 decimals using Math.round() after

// HERO STATS =
// [{map:map1, hero1:winrate, hero2:winrate, ...},{map:map2, hero1:winrate, hero2:winrate,...}]
// example usage:
// foreach (obj in heroStats) => obj.hero1 ...




const data = {
  datasets: [{
    label: 'Hero winrate heatmap',
    data: heatmapData,
    backgroundColor(context) {
      const value = context.dataset.data[context.dataIndex].v;

      //console.log(heatmapData);

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
    },
    borderWidth: 1,
    width: ({chart}) => (chart.chartArea || {}).width / matrixColumnCount -1, // x axis ... that's amount of columns-1 ie heroes. magic number: 51 distinct heroes in the dataset (incl non SL games)
    height: ({chart}) =>(chart.chartArea || {}).height / matrixRowCount -1 // y axis ... that's amount of maps ie amount of objects in the dataset. magic number: 18 distinct maps in the dataset (incl non SL maps)
  }]
};


const config = {
  type: 'matrix',
  data: data,
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
            const mapAndHeroStats = nestedMapStats.get(v.y).get(v.x);
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



  new Chart(
    document.getElementById('heatmap'),
    config
  )

// END HEATMAP

// BEGIN LINE CHART - indicating winrate over time
let lineChartData = hotsdata.generateDataForChartType('linechart');

const lineChartConfig = {
  type: 'line',
  data: lineChartData,
  options: {
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
  },
};



new Chart(document.getElementById('linechart'), lineChartConfig);
// END LINECHART

// BEGIN PARTYSIZE CHART
let partyWinrateData = hotsdata.generateDataForChartType("partywinrate");

new Chart(
  document.getElementById('partywinrate'),
  {
    type: 'bar',
    data: {
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
    },
    options :{
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
    }
  }
);

})();

function calculateRGBA(winrate, gamesPlayed) {
  // Calculate the red, green, and alpha components
  const red = Math.round(255 * (1 - winrate));
  const green = Math.round(255 * winrate);
  const blue = 0; // Blue component is always 0

  // Normalize gamesPlayed to a range for alpha (for example, between 0.1 and 1)
  // Adjust the scale factor as needed to fit your data
  const scaleFactor = 0.2;
  const alpha = Math.min(Math.max((gamesPlayed * scaleFactor), 0.1), 1).toFixed(2);

  // Return the RGBA color string
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
