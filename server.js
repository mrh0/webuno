const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const gameEngine = require('./game.js');
Client = gameEngine.Client;
Game = gameEngine.Game;

wsport = 4242;
httpport = 8080;
maxPlayers = 8;

const app = express();
app.listen(httpport, () => console.log('Listening on port '+httpport+'.'));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/', express.static(path.join(__dirname + '/public')));
console.log(path.join(__dirname + '/public/index.html'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname + '/public/index.html')));
//app.get('/play', (req, res) => res.sendFile(path.join(__dirname + '/public/game.html')));

//clients = [];
curId = 0;
games = [];
tokenList = [];


wss = new WebSocket.Server({
  port: wsport,
  clientTracking: true
});
console.log("Server started.");

wss.on('connection', (ws, req) => {
  addr = req.connection.remoteAddress;

  let id = curId++;
  let c = new Client(ws, id, addr);
  ws.client = c;
  createUserToken(ws);

  ws.on('close', () => {
    if(ws.readyState == 3 || ws.readyState == 2){
      console.log("Connection to: " + ws.client.id + " closed.");
      if(ws.client.game){
        if(ws.client.id == ws.client.game.turn){
          ws.client.game.newPileCard();
          ws.client.game.nextRound();
        }
        ws.client.game.removePlayer(ws);
        ws.client.game.sendUpdate();
      }
    }
  })
  ws.on('error', () => {
    console.log("Error!");
  });
  ws.on('message', (data) => {
    try{
      d = JSON.parse(data);
      if(d.type == 'join'){
        let k = joinGame(ws, d.data.token);
        if(k >= 0){
          ws.client.name = htmlEntities(d.data.name);
          ws.client.sendData("confirmjoin", {id:ws.client.id, token:d.data.token});
          console.log("Player joining.");
        }
        else if(k == -1){
          ws.client.sendData("confirmjoin", {id:-1});
          ws.close();
          console.log("Game dosn't exist");
        }
        else if(k == -2){
          ws.client.sendData("confirmjoin", {id:-2});
          ws.close();
          console.log("Game in play");
        }
        if(ws.client.game){
          ws.client.game.sendUpdate();
        }
      }
      if(d.type == 'host'){
        ws.client.name = htmlEntities(d.data.name);
        let t = createGame(ws, htmlEntities(d.data.gamename));
        ws.client.sendData("confirmhost", {id:ws.client.id, token:t});
        ws.client.game.sendUpdate();
      }
      if(d.type == 'startgame'){
        ws.client.game.startGame();
      }
      if(d.type == 'playcard'){
        let c  = ws.client;
        if(c.id == c.game.turn){//temp
          console.log("col, num", d.data.col, d.data.num);
          c.playCard(d.data.col, d.data.num);
          //console.log("invalid played card.");
          return;
        }
        else{
          if(c.game.rules.jumpin){
            if(c.canJumpin() && c.game.lastCard != 0){
              console.log("jumpin, col, num", d.data.col, d.data.num);
              c.playCard(d.data.col, d.data.num, true);
              let ct = c.game.getPlayerById(c.game.turn);
              if(!ct.client.canPlayCard()){
                ct.client.drawCard();
                ct.client.game.nextRound();
                console.log("Could not place after jumpin.");
              }
            }
          }
        }
        console.log("not my turn.");
        return;
      }
      if(d.type == 'selectedcolor'){
        if(ws.client.game){
          if(ws.client.game.waitingForSelector && ws.client.id == ws.client.game.turn){
            ws.client.game.setSelectedColor(d.data.color);
          }
        }
      }
      if(d.type == 'clickeduno'){
        if(ws.client.game){
          console.log(ws.client.name + " clicked UNO");
          ws.client.game.clickuno(ws);
        }
      }
      if(d.type == "setrules"){
        if(ws.client.host){
          ws.client.game.rules = d.data.rules;
          ws.client.game.broadcast("updaterules", {rules:ws.client.game.rules});
        }
      }
      if(d.type == "resetgame"){
        if(ws.client.game){
          if(ws.client.host){
            console.log("Game Reset.");
            ws.client.game.resetGame();
          }
          else{
            console.log("Not host, can't reset game.");
          }
        }
      }
    }
    catch(e){
      console.log(e);
      return;
    }
  });
});

function joinGame(ws, game){
  for(let i = 0; i < games.length; i++){
    if(game == games[i].token){
      if(games[i].started){
        return -2;
      }
      if(games[i].players.length >= maxPlayers){
        return -3;
      }
      games[i].join(ws);
      return 1;
    }
  }
  return -1;
}
function createGame(ws, name = "UNO Game"){
  let t = createToken(6, true);
  let g = new Game(t);
  games.push(g);
  g.join(ws);
  g.name = name;
  ws.client.host = true;
  return t;
}

function createToken(len = 32, uf = false){
  let letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  if(uf){
    letters = "abcdefghjkmnprstwxyz23456789";
  }
  let r = "";
  for(let i = 0; i < len; i++){
    r += letters.charAt(Math.floor(Math.random()*letters.length));
  }
  return r;
}
function createUserToken(ws){
  r = createToken()
  if(tokenList[r] != null){
    createUserToken(ws);
    return;
  }
  tokenList[r] = ws;
  ws.client.token = r;
}
function getWsOfToken(token){
  return tokenList[token];
}
function htmlEntities(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
