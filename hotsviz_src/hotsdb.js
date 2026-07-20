//https://www.w3schools.com/nodejs/nodejs_mysql.asp
//import mysql from 'mysql2/promise';

import * as fs from 'fs';

import * as path from 'path';
import sqlite3 from 'sqlite3';

var uniqueGamesJSON = [];
var dataFolderPath = undefined;
var replayFilePath = undefined;



const queryForHeroStats = "SELECT game_hero, COUNT(*) AS total_games, SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS total_wins, CAST(SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) AS win_rate FROM uniqueGames WHERE game_mode = 'stormLeague' GROUP BY game_hero ORDER BY total_games DESC";
const queryForMapStats = "SELECT game_map, COUNT(*) AS total_games, SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS total_wins, CAST(SUM(CASE WHEN game_winner = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) AS win_rate FROM uniqueGames WHERE game_mode = 'stormLeague' GROUP BY game_map ORDER BY game_map";
const queryForRankedHeroes = "SELECT DISTINCT game_hero FROM uniqueGames WHERE game_mode = 'stormLeague' ORDER BY game_hero";
const queryForRankedMaps = "SELECT DISTINCT game_map FROM uniqueGames WHERE game_mode = 'stormLeague' ORDER BY game_map";
const queryForPartyWinrate = "SELECT game_winner, game_players FROM uniqueGames";
var queryForHeatmap = undefined;
var queryForLineChart = undefined;
var queryForNestedMap = undefined;

let activeInsertions = 0;
let eventEmitter = null;

let _filters = undefined; // this expects an object to be set that conforms to {gameCount, sinceDate, mapFilter}

export function setFilters(filters)
{
  //console.log("database filters set; mapFilter: " + filters.mapFilter);
  _filters = filters;
}

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

export async function queryDatabaseWithFiltersAndSerializeResult(baseQuery, filename, filters) {
  const fileDB = new sqlite3.Database(dataFolderPath + "gameData_sqlite.db");

  // Build the query dynamically based on filters
  const {query, parameters} = buildQuery(baseQuery, filters);

  console.log("#HOTSDB.js: rebuilding query with filters:");
  console.log(query);
  console.log("#HOTSDB.js: and parameters:");
  console.log(parameters);

  fileDB.all(query, parameters, (err, result) => {
      if (err) {
          if (err.code === 'ER_DATA_TOO_LONG') {
              console.log("ERROR: data exceeding max length");
          } else {
              throw err;
          }
      }

      // Serialize result to JSON file
      serializeQuery(result, filename);
  });

  fileDB.close();
}

function buildQuery(baseQuery, filters) {
  let query = baseQuery.trim(); // Ensure no trailing spaces
  let parameters = [];
  let whereClauses = [];

  // Check and apply filters
  if (filters) {
      if (filters.sinceDate) {
          whereClauses.push("game_timestamp >= ?");
          parameters.push(filters.sinceDate);
      }

      if (filters.mapFilter) {
          whereClauses.push("map_name = ?");
          parameters.push(filters.mapFilter);
      }
  }

  // Append WHERE clause correctly
  if (whereClauses.length > 0) {
      // Remove existing LIMIT if present
      query = query.replace(/\bLIMIT\b.*/i, "").trim();
      query += " WHERE " + whereClauses.join(" AND ");
  }

  // Append LIMIT only if it's not already in the base query
  if (filters.gameCount) {
      if (/\bLIMIT\b/i.test(baseQuery)) {
          console.warn("Warning: Base query already has a LIMIT clause. Skipping additional LIMIT.");
      } else {
          query += " LIMIT ?";
          parameters.push(filters.gameCount);
      }
  }

  console.log("Final Query:", query);
  console.log("Parameters:", parameters);

  return { query, parameters };
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





function queryHeroWinrate() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForHeroStats, 'queryForHeroStatsResult.json', _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForHeroStats, 'queryForHeroStatsResult.json');
  }
}

function queryMapWinrate() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForMapStats, 'queryForMapStatsResult.json', _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForMapStats, 'queryForMapStatsResult.json');
  }
}

function queryWinrateOverTime() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForLineChart, 'queryForLineChartResult.json', _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForLineChart, 'queryForLineChartResult.json');
  }
}

function queryHeroPerformancePerMap() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForHeatmap, 'queryForHeatmapResult.json', _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForHeatmap, 'queryForHeatmapResult.json');
  }
}

function queryRankedHeroes() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForRankedHeroes, "queryForRankedHeroesResult.json", _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForRankedHeroes, "queryForRankedHeroesResult.json");
  }
}

function queryRankedMaps() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForRankedMaps, "queryForRankedMapsResult.json", _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForRankedMaps, "queryForRankedMapsResult.json");
  }
}

function queryNestedMap() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForNestedMap, "queryForNestedMapResult.json", _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForNestedMap, "queryForNestedMapResult.json");
  }
}

function queryPartyWinrate() {
  if (_filters && (Boolean(_filters.gameCount) || Boolean(_filters.sinceDate) || Boolean(_filters.mapFilter))) {
      queryDatabaseWithFiltersAndSerializeResult(queryForPartyWinrate, "queryForPartyWinrateResult.json", _filters);
  } else {
      queryDatabaseAndSerializeResult(queryForPartyWinrate, "queryForPartyWinrateResult.json");
  }
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

