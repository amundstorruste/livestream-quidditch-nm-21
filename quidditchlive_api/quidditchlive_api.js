(async function() {

  'use strict'

  const io           = require('socket.io-client')
  const fetch        = require("node-fetch")
  const chalk        = require("chalk")
  const readlineSync = require('readline-sync')
  const fs           = require('fs')
  const http         = require('http')
  const svg2img      = require('svg2img')
  const download     = require('download-file')

  /**********************/
  /*** HELP FUNCTIONS ***/
  /**********************/
  const log = function() { let args = Array.from(arguments); args.unshift(get_current_time_string() + ": "); console.log.apply(console, args) } // redefine log 
  function get_current_time_string() { let today = new Date(); return today.getFullYear().pad(4)+'-'+(today.getMonth()+1).pad(2)+'-'+today.getDate().pad(2)+' @ '+today.getHours().pad(2)+':'+today.getMinutes().pad(2)+':'+today.getSeconds().pad(2) }
  Number.prototype.pad = function(size) { let s = String(this); while(s.length<(size||2)) { s = '0'+s } return s }
  function sleep(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)) } // sleep for <milliseconds> 
  function get_timestamp_ms() { return Date.now() }
  async function sync_to_server() {
    let start = get_timestamp_ms()
    log(chalk.bold('Fetching from "'+'http'+(ssl?'s':'')+'://'+remote_server+'/getServerTime.php'+'"'))
    let server_time = await fetch('http'+(ssl?'s':'')+'://'+remote_server+'/getServerTime.php').then(function(response) { return response.json() })
    log(chalk.bold('Server timestamp is '+server_time.timestamp))
    let stop = get_timestamp_ms()
    let diff = parseInt((start+stop)/2 - server_time.timestamp)
    log(chalk.bold('Time difference between local and server time is ')+chalk.bold.blue(diff+'ms')+chalk.bold('. '+(diff>0?'The server lags behind.':'Your local machine lags behind.')))
    return diff
  } /*if result is positive, local time is ahead and server time lags behind*/
  
  /*********************/
  /*** SERVER + AUTH ***/
  /*********************/
  const debug          = false
  const remote_server  = debug ? 'localhost' : 'quidditch.live'
  const ssl            = !debug
  log(chalk.bold('Remote server is "')+chalk.bold.blue(remote_server)+chalk.bold('".'))
  const config         = await fetch('http'+(ssl?'s':'')+'://'+remote_server+'/getStreamingSettings.php').then(function(response) { return response.json() })
  const socket_address = config.socket_address //'https://quidditch.live/api';//
  //const socket_port = 443;//config.socket_port;
  const auth_file      = './auth.txt'
  const delay          = 10; // delay of gametime loop execution in milliseconds (=maximum time resolution)
  
  /************************/
  /*** SCRIPT VARIABLES ***/
  /************************/
  var public_id, auth
  var graphics   = {}
  var teamnames  = {}
  var saved_data = {}
  var diff       = 0

  /**********************/
  /*** INITIALIZATION ***/
  /**********************/
  async function get_auth(auth_file) {
    let auth;
    let from_file=true;
    try { auth=fs.readFileSync(auth_file, 'utf8') }
    catch(err) {
      from_file = false
      log(chalk.bold.yellow('You can simplify authentication by creating a file "auth.txt" that contains only your authentication code and placing it in the same folder as this script.'));
      auth = readlineSync.question(get_current_time_string()+chalk.bold(' Auth? ')) 
    }
    if(auth) { log(chalk.bold.green('Authentication read'+(from_file?' from file':'')+'.')); return auth }
    else { log(chalk.red.inverse('No authentication provided. Exiting.')); process.exit() }
  }
  async function read_game_id() {
    let public_id
    public_id = readlineSync.question(get_current_time_string()+chalk.bold(' Public Game ID? '))
    log(chalk.bold('You entered: '+public_id))
    return public_id
  }
  
  /*************************/
  /*** SOCKET CONNECTION *** ==> only complete data sets are pushed due to no_delta being true
  /*************************/
  async function create_socket_connection(auth, public_id) {
    if(public_id && auth) {
      let filenames = [
        'scoreA.txt', 
        'scoreB.txt', 
        'teamnameA.txt', 
        'teamnameB.txt', 
        'colorA.png', 
        'colorB.png',
        'jerseyA.png',
        'jerseyB.png',
        'logoA.png',
        'logoB.png',
        'gametime.txt',
        'connected.txt'
      ];
      for(let ii=0; ii<filenames.length; ii++) { try { fs.unlinkSync(filenames[ii]) } catch(err) { /*nothing*/ } }
      log(chalk.bold('Establishing connection with '+socket_address+'.'))

      const socket = io(socket_address)

      socket.on('connect', function() {
        socket.emit('auth', { auth: auth, games: [public_id], no_delta: true })
        socket.on('complete', function(data) {
          log(chalk.bold.black.bgGreen('New data received.'))
          saved_data = data
          //log(saved_data);
          save_teamname_data(data)
          save_logo_jersey_color(saved_data)
          save_score_data(saved_data)
        });
        socket.on('err', function(data) {
          if('msg' in data) {
            log(chalk.red.inverse('Socket error: '+data.msg))
          }
        })
        socket.on('disconnect', function()
        {
          log(chalk.red.inverse('Disconnected'));
          process.exit();
        })
      })
    } else {
      log(chalk.red.inverse('Both, public game id and authentication must be set. Exiting. ')); process.exit() 
    }
  }
  
  /*******************/
  /*** IMAGE FILES ***/
  /*******************/
  async function save_teamname_data(data) {
    let teamnames_before={A:null,B:null};
    let teamnames_after={A:data.teams.A.name, B:data.teams.B.name};
    let team_letters = ['A', 'B'];
    for(var ii=0;ii<team_letters.length;ii++) {
      let team_letter=team_letters[ii];
      try{teamnames_before[team_letter] = fs.readFileSync('teamname'+team_letter+'.txt', 'utf8');}catch(err){teamnames_before[team_letter]=null;}
      if(teamnames_before[team_letter]!==teamnames_after[team_letter]) {
        fs.writeFile('teamname'+team_letter+'.txt', teamnames_after[team_letter], (err) => {
          if(err){log(err);}
          else{log(chalk.bold('Team name of Team '+team_letter+' is ')+chalk.bold.cyan(teamnames_after[team_letter])+chalk(' ==> saved to file "teamname'+team_letter+'.txt".'));}
        })
      }
    }
  }
  async function save_logo_jersey_color(data) {
    let assets        = ['logo', 'jersey'];
    let assets_folder = ['/src/img/logo/', '/src/svg/jerseys/'];
    let team_letters  = ['A', 'B'];
    for(let ii=0; ii<team_letters.length; ii++)
    {
      let team_letter=team_letters[ii];
      for(let jj=0; jj<assets.length; jj++)
      {
        let asset = assets[jj];
        let asset_folder = assets_folder[jj];
        if(graphics[asset+team_letter] != data.teams[team_letter][asset])
        {
          let url = 'http'+(ssl?'s':'')+'://'+remote_server+asset_folder+data.teams[team_letter][asset];
          if(asset=='jersey'){url+='.svg';}
          if(url.endsWith('.svg')) {
            svg2img(url,{'width':1024, 'height':1024},function(error, buffer)
            {
              fs.writeFileSync(asset+team_letter+'.png', buffer);
              graphics[asset+team_letter]=data.teams[team_letter][asset];
              log(chalk.bold('Converted '+asset+' for team "'+data.teams[team_letter].name+'" from SVG to PNG and saved it in file "'+asset+team_letter+'.png".'));
            })
          }
          else if(url.endsWith('.png'))
          {
            download(url, { directory : '.', filename: asset+team_letter+'.png' }, function(err)
            {
              if(err)
              {
                log(chalk.red.inverse('Could not download '+asset+' for team "'+data.teams[team_letter].name+'" (team '+team_letter+').'))
              }
              else
              {
                log(chalk.bold('Saved '+asset+' for team "'+data.teams[team_letter].name+'" in file "'+asset+team_letter+'.png".'))
                graphics[asset+team_letter]=data.teams[team_letter][asset];
              }
            });
          }
          else
          {
            log(chalk.red.inverse('Could not download '+asset+' for team "'+data.teams[team_letter].name+'" (team '+team_letter+').'))
          }
        }
      }
      /* SAVE COLORS */
      if(graphics['color'+team_letter] != data.teams[team_letter].jerseyPrimaryColor)
      {
        let color_width = 100, color_height = 300;
        let svgString = '<svg xmlns="http://www.w3.org/2000/svg" width="'+color_width+'" height="'+color_height+'" viewBox="0 0 '+color_width+' '+color_height+'" fill="none" stroke="none"><rect width="'+color_width+'" height="'+color_height+'" style="fill:'+data.teams[team_letter].jerseyPrimaryColor+';"/></svg>';
        svg2img(svgString, { width: color_width, height: color_height }, function(error, buffer)
        {
          fs.writeFileSync('color'+team_letter+'.png', buffer)
          graphics['color'+team_letter]=data.teams[team_letter].jerseyPrimaryColor
          log(chalk.bold('Color "'+graphics['color'+team_letter]+'" ')+(' ')+chalk.bgHex(graphics['color'+team_letter]).bold('   ')+(' ')+chalk.bold(' for team "'+data.teams[team_letter].name+'" saved in file "color'+team_letter+'.png".'))
        });
      }
    }
  } /* SAVE LOGO AND JERSEY */
  
  /*************************/
  /*** SCORE INFORMATION ***/
  /*************************/
  async function save_score_data(data) {
    let score = await get_score(data)
    if(score===false) { log(chalk.bold.blue('No score data available.')); return true }
    let score_before = { A:null, B:null }
    let team_letters = ['A', 'B']
    for(let ii=0; ii<team_letters.length; ii++)
    {
      let team_letter=team_letters[ii];
      try{score_before[team_letter] = fs.readFileSync('score'+team_letter+'.txt', 'utf8');}catch(err){score_before[team_letter]='';}
      if(score_before[team_letter]!=score[team_letter])
      {
        fs.writeFile('score'+team_letter+'.txt', score[team_letter], (err) => 
        {
          if(err){log(err);}
          else{log(chalk.bold('Score is ')+chalk.bold.cyan(score.A+'-'+score.B)+chalk(' ==> saved to file "score'+team_letter+'.txt".'));}
        })
      }
    }
  }
  async function get_score(data) {
    try {
      if(data.data_available) {
        let points_str = { A: data.score.A.total.toString(), B: data.score.B.total.toString() }
        for(let team in points_str) {
          let other_team = (team=='B') ? 'A' : 'B';
          let caught = data.score[team].snitch_caught;
          let caught_other_team = data.score[other_team].snitch_caught;
          if(!caught && !caught_other_team) { break }
          else if(caught){ points_str[team] += '*' }
          else if(caught_other_team) { points_str[team] += '°' }
        }
        return points_str
      }
    }
    catch(err) { log(err) }
    return false;
  }
  
  /*****************/
  /*** GAME TIME *** ==> latest after 30 seconds you realize if you aren't connected to the timekeeper anymore
  /*****************/
  function get_gametime_string(gameduration_ms) {
    let minutes = parseInt(Math.floor(gameduration_ms/1000/60))
    let seconds = parseInt(Math.floor(gameduration_ms/1000-minutes*60))
    return minutes.pad(2)+":"+seconds.pad(2)
  }
  async function gametime_loop(delay) {
    let last_gametime_str = ''
    let gametime_str = ''
    let last_connected
    while(true) {
      await sleep(delay)
      if(Object.keys(saved_data).length!=0) {
        try {
          let period_gameduration
          if(saved_data.gametime.running) {
            period_gameduration = saved_data.gametime.last_stop+(get_timestamp_ms()-diff)-saved_data.gametime.last_start;
          }
          else { period_gameduration = saved_data.gametime.last_stop }

          let gametime_str = get_gametime_string(period_gameduration)
          
          if(gametime_str != last_gametime_str) {
            last_gametime_str = gametime_str
            fs.writeFile('gametime.txt', gametime_str, (err) => {
              if(err) { log(err) }
              else{
                log(chalk.bold('Gametime is ')+chalk.bold.blue(gametime_str)+chalk(' ==> saved to file "gametime.txt".'));
              }
            })
          }
          if('alive_timestamp' in saved_data) {
            let delta_from_last_alive_ms = ((get_timestamp_ms()-diff)-saved_data.alive_timestamp*1000)
            let connected = delta_from_last_alive_ms<30000
            if(connected !== last_connected) {
              last_connected = connected
              fs.writeFile('connected.txt', connected ? 'true' : 'false', (err) => {
                if(err) { log(err) }
                else if(connected) {
                  log(chalk.bold('The timekeeper is currently ')+chalk.bold.green('connected')+chalk(' ==> saved to file "connected.txt".'));
                } else {
                  log(chalk.bold('The timekeeper is currently ')+chalk.bold.red('not connected')+chalk(' ==> saved to file "connected.txt".'));
                }
              })
            }
          }
        }
        catch(err) { log(err) }
      }
    }
  }
  /*****************/
  /*** EXECUTION ***/
  /*****************/
  auth = await get_auth(auth_file)
  public_id = await read_game_id()
  diff = await sync_to_server()
  gametime_loop(delay)
  create_socket_connection(auth, public_id)

})()