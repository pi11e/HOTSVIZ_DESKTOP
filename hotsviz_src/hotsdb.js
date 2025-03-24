//https://www.w3schools.com/nodejs/nodejs_mysql.asp
//import mysql from 'mysql2/promise';

import * as fs from 'fs';

import * as path from 'path';
import sqlite3 from 'sqlite3';

var uniqueGamesJSON = [];
var dataFolderPath = undefined;
var replayFilePath = undefined;



const queryForHeroStats = "SELECT game_hero, COUNT(*) AS total_games, SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS total_wins, CAST(SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) AS win_rate FROM uniqueGames WHERE game_mode = 'stormLeague' GROUP BY game_hero ORDER BY total_games DESC LIMIT 0, 1000";
const queryForMapStats = "SELECT game_map, COUNT(*) AS total_games, SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS total_wins, CAST(SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) AS win_rate FROM uniqueGames WHERE game_mode = 'stormLeague' GROUP BY game_map ORDER BY game_map LIMIT 0, 1000";
const queryForRankedHeroes = "SELECT DISTINCT game_hero FROM uniqueGames WHERE game_mode = 'stormLeague' ORDER BY game_hero";
const queryForRankedMaps = "SELECT DISTINCT game_map FROM uniqueGames WHERE game_mode = 'stormLeague' ORDER BY game_map";
const queryForPartyWinrate = "SELECT game_winner, game_players FROM uniqueGames";
var queryForHeatmap = undefined;
var queryForLineChart = undefined;
var queryForNestedMap = undefined;

let activeInsertions = 0;
let eventEmitter = null;

export function setEventEmitter(ipc)
{
    eventEmitter = ipc;
}



function serializeQuery(queryResult, filename)
{
    // create JSON blobs for the various chart types here

    // Step 1: Take incoming query result and form a JSON string

    // Step 2: Write JSON string as file of the given filename
    // filename expects something like 'abc.json'
    const filepath = dataFolderPath+filename;

    fs.writeFileSync(filepath, JSON.stringify(queryResult));
}



function handleResultset (err, result) {
  var i, len;
  if (err) 
    {
    if(err.code == 'ER_DATA_TOO_LONG')
      {
        console.log("ERROR: data exceeding max length")
        
      }
      else{
        throw err;
      }
      
  }
  len = result.length;
  
  console.log("query successful.");
  

}

// new queryDatabase (using local sqlite file)
async function queryDatabase(queryString)
{
  const fileDB = new sqlite3.Database(dataFolderPath + "gameData_sqlite.db")
  fileDB.run('PRAGMA sjournal_mode = WAL;');
  const parameters = [];

  activeInsertions++;
  
  if(eventEmitter)
  {
    if(activeInsertions === 1)
      {
        //console.log("sending event database-processing-start");
        eventEmitter.emit("database-processing-start");
        
      }
      else
      {
        eventEmitter.emit("database-progress", null, activeInsertions);
      }  
  }
  
  
   // using db.each 
  const resultSet = fileDB.all(queryString, parameters, (err, result) => 
  {
    activeInsertions--;
    // each row processed here
    if(err)
      {
        
        if(err.code == 'SQLITE_BUSY')
          {
            console.log("Database busy - retrying...");
            //console.log(queryString.slice(0,100));
            queryDatabase(queryString);
          }
          else{
            console.error("ERROR: " + err);
          }
      }

      else
      {
        
        //console.log("Input operation successful.");
        
        console.log("active insertion count = " + activeInsertions);
        if(eventEmitter)
        {
          if(activeInsertions === 0)
          {
              //console.log("sending event database-processing-done");
              eventEmitter.emit("database-processing-done");
          }
          else
          {
            eventEmitter.emit("database-progress", null, activeInsertions);
          }
        }
        

      }
  });
  //await sleep(1000);



  fileDB.close();

  
  
}

// NEW queryDatabaseAndSerializeResult (using sqlite local file)
export async function queryDatabaseAndSerializeResult(queryString, filename)
{
  const fileDB = new sqlite3.Database(dataFolderPath + "gameData_sqlite.db")
  
  const parameters = [];
  
   // using db.each 
  const resultSet = fileDB.all(queryString, parameters, (err, result) => 
    {
    // serialize result
    if (err) 
      {
      if(err.code == 'ER_DATA_TOO_LONG')
        {
          console.log("ERROR: data exceeding max length")
          
        }
        else{
          throw err;
        }
        
    }

    serializeQuery(result,filename);
    //console.log("Output operation successful.");
  });
  fileDB.close();

}


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createRowFromJSON(obj)
{
  //console.log(obj);

  // check if a replay owner exists - otherwise the replay may be incomplete or otherwise garbage
  if(obj.ReplayOwner == null)
  {
    console.warn("No replay owner found. Skipping file.")
    return; 
  }
  
  //var hero = undefined;
  var playerInfo = [];  



  var replay_gameID = obj.RandomValue;
  var replay_timestamp = obj.Timestamp;
  var replay_winner = "'N/A'";
  var replay_mode = obj.GameMode;
  var replay_hero = undefined;
  var replay_map = obj.MapInfo.MapName;
  var replay_players = playerInfo

  

  
  if(replay_map.includes("'"))
  {
    replay_map = obj.MapInfo.MapId;
  }

  // loop over all players
  Array.from(obj.Players).forEach(player => 
  {
      
      

      // determine if the replay owner was the winner of this match and store their hero name as well
      if(obj.ReplayOwner == player.PlayerToonId)
      {
        var sanitizedHeroName = undefined;

        //console.log("Replay owner is " + player.PlayerToonId);
        // sanitize hero names that contain ' because SQL doesn't like that
        if(player.PlayerHero.HeroName.includes("'"))
          {
            sanitizedHeroName = player.PlayerHero.HeroId;
          }
          else
          {
            sanitizedHeroName = player.PlayerHero.HeroName;
          }
          
          replay_winner = player.IsWinner.toString();
          replay_hero = sanitizedHeroName;

          if(replay_hero == undefined) console.log("replay_hero still undefined!");
          
      }

      playerInfo.push({
        name : player.Name,
        battleTag : player.BattleTagName,
        toonId : player.PlayerToonId,
        heroPlayed : replay_hero,
        team : player.Team,
        isWinner : player.IsWinner.toString(),
        isReplayOwner : (player.PlayerToonId == obj.ReplayOwner),
        accountLevel : player.AccountLevel,
        party : player.PartyValue,
        talents : player.HeroTalents,
        scoreEvents : undefined // if desired in the future, add properties contained in "player.ScoreResult" here
      });

  });

    
  const replay = {
    game_id : replay_gameID,
    game_timestamp : replay_timestamp,
    game_winner : replay_winner,
    game_mode : replay_mode,
    game_hero : replay_hero,
    game_map : replay_map,
    game_players : replay_players
  }

  // use mysql model:
  var insertThis = "INSERT INTO uniqueGames VALUES ("+replay.game_id+", '" + replay.game_timestamp + "', " + replay.game_winner +", '"+replay.game_mode+"', '"+replay.game_hero+"', '"+replay.game_map+"', '"+JSON.stringify(playerInfo).replaceAll("'","")+"');";
  queryDatabase(insertThis);

}

/*
 given a collection of filenames and the filepath taken from data_path.cfg, 
 this function will loop over each file, parse it as json, and create a record in the database treating each as a unique game
*/
function populateDatabase(files)
{
  for(const file of files)
    {
      // check for JSON file
      if(file.endsWith(".json"))
      {
        const fullPath = path.join(replayFilePath, file);
      try {
        const jsonData = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        createRowFromJSON(jsonData);  
      } catch (error) 
      {
        console.warn("Database population failed for replay " + fullPath +". Check replay integrity. Skipping file.")
        //console.log(error)  
      }
      }

      
      
    };

}

//PROGRAM EXECUTION BELOW

// to recreate the entire table, execute the following queries:
// DROP uniqueGames
// and then
/*
CREATE TABLE uniqueGames (
    game_id varchar(255),
    game_timestamp varchar(255),
    game_winner varchar(255),
	game_mode varchar(255),
    game_hero varchar(255),
    game_map varchar(255),
    game_players varchar(255)
);

*/






// load them in the visualization module
function queryHeroWinrate()
{
    //this is for the bar chart

    // this query should return a result that contains a table with game_hero, total_games, total_wins, win_rate stats
    

    queryDatabaseAndSerializeResult(queryForHeroStats, 'queryForHeroStatsResult.json');
    // result should be an array ordered by the highest number of total wins per unique hero
}

function queryMapWinrate()
{
    // this is for another bar chart, data should look like this:
    queryDatabaseAndSerializeResult(queryForMapStats, 'queryForMapStatsResult.json');
}

function queryWinrateOverTime()
{
    // this is for the line chart, data should look like this:
    // data: [0.54,0.60,0.51,0.42],
    // labels : [day1, ...]
    queryDatabaseAndSerializeResult(queryForLineChart, 'queryForLineChartResult.json');

  
}

function queryHeroPerformancePerMap()
{
  queryDatabaseAndSerializeResult(queryForHeatmap, 'queryForHeatmapResult.json');
}

function queryRankedHeroes()
{
  
  queryDatabaseAndSerializeResult(queryForRankedHeroes, "queryForRankedHeroesResult.json");
}

function queryRankedMaps()
{
  
  queryDatabaseAndSerializeResult(queryForRankedMaps, "queryForRankedMapsResult.json");
}

function queryNestedMap()
{
  queryDatabaseAndSerializeResult(queryForNestedMap, "queryForNestedMapResult.json");
}

function queryPartyWinrate()
{
  queryDatabaseAndSerializeResult(queryForPartyWinrate, "queryForPartyWinrateResult.json");
}

function resetDatabase()
{
  
  
  // read all files in the folder and build a collection
  const replays = fs.readdirSync(replayFilePath);

  const fileDB = new sqlite3.Database(dataFolderPath + "gameData_sqlite.db")

  const parameters = [];
  
   // using db.each 
  const resultSet = fileDB.all("DROP TABLE uniqueGames", parameters, (err, result) => {
    // each row processed here
    if(err)
      {
        console.error("ERROR: " + err);
      }
      else
      {
        console.log("Database reset successful. Initialising...");
        
      }

      const newConnection = new sqlite3.Database(dataFolderPath + "gameData_sqlite.db");
      const initializationString = `CREATE TABLE uniqueGames (game_id varchar(255),
                                        game_timestamp varchar(255),
                                        game_winner varchar(255),
                                      game_mode varchar(255),
                                        game_hero varchar(255),
                                        game_map varchar(255),
                                        game_players varchar(255)
                                    );`;
                          

      newConnection.all(initializationString, parameters, (err, result) => {
          // use this to fill the uniqueGames table in the games database on localhost with
          // replay data stored as JSON files found in the folder specified in data_path.cfg
          populateDatabase(replays);
      });

      newConnection.close();
      
  });

  fileDB.close();  

}

export async function initializeDatabase()
{
      // RESET DATABASE AND INITIALIZE DATA

      resetDatabase();

      await sleep(5000);

      queryHeroWinrate(); // this should generate a queryForHeroStatsResponse.json that holds all heroes, their total wins, games and winrate using the queryForHeroStats query.
      queryMapWinrate(); // this should generate a queryForMapStatsResponse.json that holds all maps, their total wins, games and winrate using the queryForMapStats query.
      queryWinrateOverTime();
      queryHeroPerformancePerMap();

      queryRankedHeroes();
      queryRankedMaps();
      queryNestedMap();
      queryPartyWinrate();


}

export function initializeData(param_dataFolderPath)
{
  dataFolderPath = param_dataFolderPath;
  replayFilePath = fs.readFileSync(dataFolderPath + "data_path.cfg", "utf-8");

  queryForHeatmap = fs.readFileSync(dataFolderPath + 'heatmapquery.cfg', 'utf-8'); 
  queryForLineChart = fs.readFileSync(dataFolderPath + 'linechartquery.cfg', 'utf-8');
  queryForNestedMap = fs.readFileSync(dataFolderPath + 'nestedmapquery.cfg', 'utf-8');
}

//main();

