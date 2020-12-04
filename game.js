options = {
  chances:{
    //of 1 to 100
    regulars:     [1, 70],//70%
    plustwo:      [71, 77],//7%
    reverse:      [78, 84],//7%
    skip:         [85, 90],//6%
    colorswitch:  [91, 95],//5%
    plusfour:     [96, 100]//5%
  },
  newRoundDelay:1000,
  drawCardDelay:500,
  jumpInTime:500,
  startcards:[5, 7, 10, 12],
  playerColors:[
    "#BE5655",
    "#30B17D",
    "#0E9AB3",
    "#C0B24E",
    "#9b42f4",
    "#f49541",
    "#4179f4",
    "#ff608a"
  ]
}
class Client{
  constructor(ws, id, addr){
    this.ws = ws;
    this.id = id;
    this.name = "";
    this.color = "";
    this.host = false;
    this.addr = addr;
    this.game = null;
    this.cards = [];
    this.connected = true;
    this.gamecode = "";
  }
  drawCard(){
    this.cards.push(generateCard());
    this.cards = cardSort(this.cards);
    this.game.broadcast("cardmove", {from:-1, to:this.id, placing:false});
  }
  canPlayCard(){
    for(let i = 0; i < this.cards.length; i++){
      let c = this.cards[i];
      if(c.card == 23 || c.card == 24){
        if(!this.game.rules.endonwild){
          if(this.cards.length > 1){
            return true;
          }
          return false;
        }
        return true;
      }
      if(c.card == this.game.lastCard || c.color == this.game.lastColor){
        return true;
      }
    }
    return false;
  }
  canStack(){
    for(let i = 0; i < this.cards.length; i++){
      let c = this.cards[i];
      if((c.card == 22 && c.color == this.game.lastColor) || c.card == 24){
        return true;
      }
    }
    return false;
  }
  canJumpin(){
    for(let i = 0; i < this.cards.length; i++){
      let c = this.cards[i];
      if(c.card == this.game.lastCard && c.color == this.game.lastColor && c.card < 20){
        return true;
      }
    }
    return false;
  }
  drawAfterDelay(){
    setTimeout(() => {
      this.game.turnClient.drawCard();
      this.game.sendUpdate();
      if(!this.game.turnClient.canPlayCard()){
        console.log("You have to draw again!");
        this.game.turnClient.drawAfterDelay();
      }
      else{
        this.action = true;
      }
    }, options.drawCardDelay);
  }
  myTurn(){
    if(!this.canPlayCard()){
      console.log("You have to draw!");
      this.game.action = false;
      if(!this.game.rules.forceplay){
        this.drawCard();
        setTimeout(() => {
          this.game.nextRound();
        }, options.drawCardDelay);
        return;
      }
      this.drawAfterDelay();
    }
  }
  timeoutCard(n, f = () => {}){
    for(let k = 0; k < n; k++){
      if(k+1 < n){
        setTimeout(()=>{this.drawCard(); this.game.sendUpdate();}, options.drawCardDelay*(k+1));
      }
      else{
        setTimeout(f, options.drawCardDelay*(k+1));
      }
    }
  }
  playCard(col, num, jmp = false, playall = true){
    for(let i = 0; i < this.cards.length; i++){
      if(this.cards[i].card == num && this.cards[i].color == col){
        if(!this.game.rules.endonwild){
          if(num == 23 || num == 24){
            if(this.cards.length == 1){
              return;
            }
          }
        }
        if(this.game.rules.stacking){
          if(this.game.stack > 0){
            if(num != 22 && num != 24){
              console.log("Did stack, will draw (playcard)");
              this.timeoutCard(this.game.stack, () => {
                this.drawCard();
                this.game.sendUpdate();
                this.game.broadcast("stack", {size:this.game.stack, turn:this.game.turn});
                this.game.stack = 0;
                setTimeout(()=>{this.game.broadcast("stack", {size:0, turn:this.game.turn});}, 1000);
                this.game.action = true;
              });
            }
          }
        }
        if(num == 23){
          this.pushToPile(this.cards[i], i);
          this.game.sendUpdate();
          this.game.waitForSelector(this);
          console.log("has played wildcard.");
          return;
        }
        if(num == 24){
          this.pushToPile(this.cards[i], i);

          if(this.game.rules.stacking){
            /*if(this.game.getWhosNext().client.canStack()){
              this.game.addToStack(4);
              this.game.sendUpdate();
              this.game.waitForSelector(this);
              return;
            }
            if(this.game.stack > 0){
              this.game.sendUpdate();
              this.game.waitForSelector(this);
              return;
            }*/
            this.game.addToStack(4);
            this.game.action = false;
            this.game.sendUpdate();
            this.game.waitForSelector(this);
            return;
          }

          this.game.action = false;
          setTimeout(()=>{this.game.getWhosNext().client.drawCard(); this.game.sendUpdate();}, options.drawCardDelay);
          setTimeout(()=>{this.game.getWhosNext().client.drawCard(); this.game.sendUpdate();}, options.drawCardDelay*2);
          setTimeout(()=>{this.game.getWhosNext().client.drawCard(); this.game.sendUpdate();}, options.drawCardDelay*3);
          setTimeout(()=>{
            this.game.getWhosNext().client.drawCard();
            this.game.sendUpdate();
            this.game.waitForSelector(this);
          }, options.drawCardDelay*4);

          console.log("has played wildcard.");
          return;
        }
        if(col == this.game.lastColor || num == this.game.lastCard && num != -1){
          if(num == 20){
            this.game.reverse();
          }
          if(num == 21){
            this.game.forward();
            this.game.broadcast("skipped", {skipped:this.game.turn});
          }
          if(num == 22){
            this.pushToPile(this.cards[i], i);
            if(this.game.rules.stacking){
              this.game.addToStack(2);
              if(jmp){
                this.game.sendUpdate();
                return;
              }
              this.game.nextRound();
              return;
              /*if(this.game.getWhosNext().client.canStack()){
                this.game.nextRound();
                return;
              }
              if(this.game.stack > 0){
                this.game.nextRound();
                return;
              }*/
            }
            this.game.action = false;
            setTimeout(()=>{this.game.getWhosNext().client.drawCard(); this.game.sendUpdate();}, options.drawCardDelay);
            setTimeout(()=>{
              this.game.getWhosNext().client.drawCard();
              this.game.action = true;
              this.game.nextRound();
            }, options.drawCardDelay*2);
            return;
          }
          console.log("Should play all: " + this.game.rules.playstack + ":" + playall);
          this.pushToPile(this.cards[i], i, this.game.rules.playstack && playall && num < 20);
          if(jmp){
            this.game.sendUpdate();
            return;
          }
          this.game.nextRound();
          console.log("has played card.");
          return;
        }
        else{
          console.log("Invalid card play.");
        }
        return;
      }
    }
  }
  pushToPile(c, i, all = false){
    this.game.lastCard = c.card;
    this.game.lastColor = c.color;
    if(!all || this.cards.length == 1){
      this.cards.splice(i, 1);
    }
    else{
      console.log("Played All");
      let cont = true;
      while(cont){
        let find = -1;
        for(let k = 0; k < this.cards.length; k++){
          if(this.cards[k].card == c.card && this.cards[k].color == c.color){
            find = k;
          }
        }
        if(find != -1){
          if(this.cards.length > 1){
            console.log("Removed " + find);
            this.cards.splice(find, 1);
          }
          else{
            cont = false;
          }
        }
        else {
          cont = false;
        }
      }
    }
    this.cards = cardSort(this.cards);
    this.game.playerPlayedCard(this);
    this.game.broadcast("cardmove", {from:this.id, to:-1, placing:true, num:c.card, col:c.color});
  }
  sendData(type, data){
    if(this.ws.readyState == 3 || this.ws.readyState == 2){
      console.log("Connection to: " + this.id + ", in game: " + this.game.id + " closed.");
      if(this.game){
        this.game.removePlayer(this.ws);
        this.game.sendUpdate();
      }
      return;
    }
    let d = JSON.stringify({type:type, data:data});
    this.ws.send(d);
  }
}
class Game{
  constructor(token){
    this.token = token;
    this.players = [];
    this.init();
    this.rules = {
      stacking:true,
      endonwild:true,
      forceplay:true,
      jumpin:true,
      quicktimeuno:true,
      startcards: 7,
      turntimer: 30,
      specialcards: false,
      playstack: true
    };
  }
  init(){
    this.alive = true;

    this.started = false;
    this.waitingForSelector = false;
    this.action = true;
    this.onuno = -1;
    this.nooneclicked = true;
    this.stack = 0;

    if(this.roundTimeout){
      clearTimeout(this.roundTimeout);
    }
    this.roundTimeout = null;

    this.round = 0;
    this.direction = 1;
    this.turn = -1; //id
    this.turnClient //client class
    this.lastColor = 0; //0:none, 1:red, 2:green, 3:blue, 4:yellow
    this.lastCard = 0; //0-9:number, 20:reverse, 21:skip, 22:+2, 23:colorswitch, 24:+4
  }
  resetGame(){
    for(let i = 0; i < this.players.length; i++){
      this.players[i].client.cards = [];
    }
    this.sendUpdate();
    this.init();
  }
  sendUpdate(){
    let playerData = [];
    for(let i = 0; i < this.players.length; i++){
      let p = this.players[i].client;
      playerData.push({
        id:p.id,
        name:p.name,
        color:p.color,
        cards:p.cards.length
      })
    }

    for(let i = 0; i < this.players.length; i++){
      this.players[i].client.sendData("datadrop", {
        players:playerData,
        game:{
          name:this.name,
          rules:this.rules,
          started:this.started,
          turn:this.turn,
          round:this.round,
          direction:this.direction,
          pilecard:{col:this.lastColor, num:this.lastCard}
        },
        me:{
          cards:this.players[i].client.cards,
          host:this.players[i].client.host
        }
      });
    }
  }
  newRound(){
    if(this.rules.stacking){
      if(this.stack > 0){
        if(!this.turnClient.canStack()){
          console.log("Can't stack, will draw. (newround)");
          this.turnClient.timeoutCard(this.stack, () => {
            this.turnClient.drawCard();
            this.sendUpdate();
            this.broadcast("stack", {size:this.stack, turn:this.turn});
            this.stack = 0;
            setTimeout(()=>{this.broadcast("stack", {size:0, turn:this.turn});}, 1000);
            this.action = true;
          });
        }
      }
    }
    this.sendUpdate();
  }
  addToStack(n){
    this.stack += n;
    this.broadcast("stack", {size:this.stack, turn:this.turn});
  }
  reverse(){
    if(this.direction == 1){
      this.direction = -1;
    }
    else{
      this.direction = 1;
    }
  }
  clickuno(ws){
    this.broadcast("clickedunofirst", {id:ws.client.id});
    console.log("clicked Uno!");
    this.nooneclicked = false;
    if(this.onuno != ws.client.id && this.onuno != -1){
      console.log("Enemy clicked Uno!");
      this.action = false;
      setTimeout(()=>{
        let bb = this.getPlayerById(this.onuno)
        if(bb){
          bb.client.drawCard();
          this.sendUpdate();
        }
      }, options.drawCardDelay);
      setTimeout(()=>{
        let bb = this.getPlayerById(this.onuno)
        if(bb){
          bb.client.drawCard();
        }
        this.action = true;
        this.nextRound();
        this.onuno = -1;
      }, options.drawCardDelay*2);
    }
    else{
      console.log("Uno saved!");
      this.onuno = -1;
    }
  }
  getPlayerById(id){
    if(id == -1){
      return null;
    }
    for(let i = 0; i < this.players.length; i++){
      if(this.players[i].client.id == id){
        return this.players[i];
      }
    }
    return null;
  }
  getWhosNext(){
    let t = 0;
    for(let i = 0; i < this.players.length; i++){
      if(this.turn == this.players[i].client.id){
        t = i;
      }
    }
    t += this.direction;
    if(t < 0){
      t = this.players.length-1;
    }
    if(t > this.players.length-1){
      t = 0;
    }
    return this.players[t];
  }
  forward(){
    let lastTurn = this.turn;
    let lastColor;
    let t = 0;
    for(let i = 0; i < this.players.length; i++){
      if(this.turn == this.players[i].client.id){
        t = i;
        lastColor = this.players[i].client.color;
      }
    }
    t += this.direction;
    if(t < 0){
      t = this.players.length-1;
    }
    if(t > this.players.length-1){
      t = 0;
    }
    if(this.players[t]){
      this.turn = this.players[t].client.id;
      this.turnClient = this.players[t].client;
    }
    else{
      console.error("Fault in Game.forward(), missing Player.", this.players, t);
    }
    return {t:t, lastTurn:lastTurn, lastColor:lastColor};
  }
  playerPlayedCard(p){
    if(p.id == p.game.turn){
      this.cancelTimeout();
    }
    if(p){
      if(p.cards.length == 0){
        this.broadcast("gameend", {winnerid:p.id, winnername:p.name, winnercolor:p.color, rounds:this.round});
        this.action = false;
      }
      if(p.cards.length == 1 && this.rules.quicktimeuno){
        this.broadcast("flashuno", {id:p.id, name:p.name});
        this.action = false;
        this.onuno = p.id;
        setTimeout(() => {
          if(this.onuno != -1 && !this.nooneclicked){
            this.onuno = -1;
            this.action = true;
          }
        }, 4000);
      }
    }
    if(this.rules.jumpin){
      console.log("Jumpin enabled");
      for(let k = 0; k < this.players.length; k++){
        let cc = this.players[k].client;
        for(let i = 0; i < cc.cards.length; i++){
          if(cc.cards[i].card == this.lastCard && this.action && cc.id != this.getWhosNext().client.id){
            console.log("Can jumpin");
            cc.sendData("canjumpin", {});
          }
        }
      }
      /*if(!this.turnClient.canDrawCard()){ //////ERROR---------------------------------------------------------------------------------
        this.turnClient.drawCard();
        this.nextRound();
      }*/
    }
  }
  nextRound(){
    /*this.roundTimeout = setTimeout(() => {
      console.log("Player ran out of time.");
      if(!this.waitingForSelector && this.action && this && this.players.length > 0){//Disable timer
        this.turnClient.drawCard();
        this.nextRound();
      }
    }, this.rules.turntimer * 1000);*/

    let k = this.forward();
    if(this.players[k.t || 0] == null){
      console.log("Issue in nextRound() averted");
      this.broadcast("newround", {round:++this.round, turn:this.turn, color:'white', lastturn:k.lastTurn, lastcolor:k.lastColor, direction:this.direction});
    }
    else{
      this.broadcast("newround", {round:++this.round, turn:this.turn, color:this.players[k.t || 0].client.color, lastturn:k.lastTurn, lastcolor:k.lastColor, direction:this.direction});
    }
    this.turnClient.myTurn();
    this.newRound();
  }
  cancelTimeout(){
    if(this.roundTimeout){
      clearTimeout(this.roundTimeout);
    }
  }
  whosTurn(){
    //return this.players[this.turn];
    //return ws of turn
  }
  newPileCard(){
    let pc = generateCard();
    while(pc.card > 9){
      pc = generateCard();
    }
    this.lastCard = pc.card;
    this.lastColor = pc.color;
  }
  startGame(){
    this.inlobby = false;
    this.started = true;
    this.newPileCard();
    for(let i = 0; i < this.players.length; i++){
      for(let k = 0; k < this.rules.startcards; k++){
        this.players[i].client.drawCard();
      }
    }
    this.broadcast("gamestart", {});
    this.nextRound();
  }
  close(){
    let k = this.getListIndex();
    if(k != -1){
      games.splice(k, 1);
      console.log("Removed a game, " + games.length + " games remaining.");
    }
  }
  removePlayer(ws){
    for(let i = 0; i < this.players.length; i++){
      if(this.players[i] == ws){
        this.players[i].connected = false;
        this.players.splice(i, 1);
        if(this.players.length == 0){
          this.close();
        }
      }
    }
  }
  join(ws){
    ws.client.game = this;
    for(let i = 0; i < this.players.length+1; i++){
      if(this.players[i] == null){
        this.players[i] = ws;
        this.players[i].client.color = options.playerColors[this.players.length-1];
        console.log("Player joined a game.");
        return;
      }
    }
    //this.broadcast("newplayer", {id:ws.client.id, name:ws.client.name, col:ws.client.color});
    this.sendUpdate();
  }
  getListIndex(){
    for(let i = 0; i < games.length; i++){
      if(games[i] == this){
        return i;
      }
    }
    return -1;
  }
  broadcast(type, data){
    for(let i = 0; i < this.players.length; i++){
      this.players[i].client.sendData(type, data);
    }
  }
  waitForSelector(c){
    this.waitingForSelector = true;
    this.action = false;
    c.ws.client.sendData("showselector", {});
  }
  setSelectedColor(c){
    this.waitingForSelector = false;
    this.action = true;
    this.lastColor = c;
    this.nextRound();
  }
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function generateCard(){
  let i = getRandomInt(1, 100);
  if(i >= options.chances.regulars[0] && i <= options.chances.regulars[1]){
    return {card:getRandomInt(0, 9), color:getRandomInt(1, 4)};
  }
  if(i >= options.chances.reverse[0] && i <= options.chances.reverse[1]){
    return {card:20, color:getRandomInt(1, 4)};
  }
  if(i >= options.chances.skip[0] && i <= options.chances.skip[1]){
    return {card:21, color:getRandomInt(1, 4)};
  }
  if(i >= options.chances.plustwo[0] && i <= options.chances.plustwo[1]){
    return {card:22, color:getRandomInt(1, 4)};
  }
  if(i >= options.chances.colorswitch[0] && i <= options.chances.colorswitch[1]){
    return {card:23, color:0};
  }
  if(i >= options.chances.plusfour[0] && i <= options.chances.plusfour[1]){
    return {card:24, color:0};
  }
}
function cardSort(l) {
  let temp;
  let min;
  for(let i = 0; i < l.length; i++){
    min = i;
    for(let j = i + 1; j < l.length; j++) {
      if((l[j].color*100 + l[j].card) < (l[min].color*100 + l[min].card)){
        min = j;
      }
    }
    temp = l[i];
    l[i] = l[min];
    l[min] = temp;
  }
  return l;
}

exports.Client = Client;
exports.Game = Game;
