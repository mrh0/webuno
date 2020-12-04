ip = "130.229.156.143";//"localhost";// "81.229.132.218"
port = 4242;
wsAddress = "ws://"+ip+":"+port;

var id = -100;
var name = "Player";
var willHost = false;
var isHost = false;
var gametoken = "";
var selectedColor = null;
var playerIdList = [];
var jumpin = false;
var audioOn = false;
hand = [];
cols = [
  "none",
  "red",
  "green",
  "blue",
  "yellow"
];
var drawCardAudio = [];
var pileCard;
var ws;
var latestData = {game:{direction:1, rules:{jumpin:false}}};

function ready(){
  new Card(0, 0).makePileCard();

  window.addEventListener("resize", orderCards, false);

  window.addEventListener("mousedown", dragBegin);
  window.addEventListener("mouseup", dragEnd);
  window.addEventListener("mousemove", drag);

  window.addEventListener("touchstart", dragBeginTouch);
  window.addEventListener("touchend", dragEndTouch);
  window.addEventListener("touchcancel", dragEndTouch);
  window.addEventListener("touchmove", dragTouch);

  let url_string = window.location.href;
  let url = new URL(url_string);
  gametoken = url.searchParams.get("g");

  showPanel("startpanel");
  window.requestAnimationFrame(animFrame);
  loadAudio([
    "draw1.mp3",
    "draw2.mp3",
    "draw3.mp3"
  ]);
}

function connect(){
  ws = new WebSocket(wsAddress);
  ws.onerror = (e) => {
    alert("Error: host unreachable.");
  }
  ws.onopen = (e) => {
    console.log("Connected!");
    if(willHost){
      sendData("host", {gamename:name+"\'s Game", name:name});
    }
    else{
      sendData("join", {token:gametoken, name:name});
    }
  }
  ws.onmessage = (e) => {
    d = JSON.parse(e.data);
    if(d.type == 'confirmjoin'){
      if(d.data.id == -1){
        alert("Game dosn't exist!");
        showPanel("modepanel");
        return;
      }
      if(d.data.id == -2){
        alert("Game is in play.");
        showPanel("modepanel");
        return;
      }
      id = d.data.id;
      gametoken = d.data.token;
      showPanel("lobbypanel");
      console.log("Got id: " + id);
    }
    if(d.type == 'confirmhost'){
      id = d.data.id;
      gametoken = d.data.token;
      isHost = true;
      showPanel("lobbypanel");
      console.log("Got host id: " + id);
    }
    if(d.type == 'datadrop'){
      latestData = d.data;
      clearHand();
      fillHand();
      pileCard.cardType(d.data.game.pilecard.col, d.data.game.pilecard.num);
      if(d.data.game.turn == id){
        console.log("Its my turn!");
      }
      document.getElementById("lobbyname").innerHTML = latestData.game.name || "Uno Game";
      updatePlayers();

      for(let k = 0; k < hand.length; k++){
        if(!canDrawCard(hand[k])){
          hand[k].elem.setAttribute("invalid", "");
        }
        if(latestData.game.turn != id){
          hand[k].elem.setAttribute("invalid", "");
        }
      }
      showJumpin();
    }
    if(d.type == 'gamestart'){
      showPanel();
    }
    if(d.type == 'newround'){
      jumpin = false;
      setSpinnerDirection(d.data.direction)
      if(d.data.turn == id){
        console.log(d.data.lastcolor, d.data.color);
        showFrontMessage("It's Your Turn!", d.data.lastcolor, d.data.color);
      }
      showJumpin();
    }
    if(d.type == 'showselector'){
      selectedColor = null;
      showColorSelector(true);
    }
    if(d.type == 'gameend'){
      document.getElementById("winnername").innerHTML = d.data.winnername+" Won!";
      document.getElementById("winnername").style.color = d.data.winnercolor;
      document.getElementById("gamestats").innerHTML = "Game lasted " + d.data.rounds + " turns.";
      showPanel("gameendpanel");
      //showFrontMessage(d.data.winnername + " Win!", d.data.winnercolor, "#cec435");
    }
    if(d.type == 'flashuno'){
      flashUno(d.data.name);
    }
    if(d.type == 'stack'){
      let se = document.getElementById("stackdisplay");
      if(d.data.size > 0){
        se.removeAttribute("hide");
        se.innerHTML = "+"+d.data.size;
      }
      else{
        se.setAttribute("hide", "");
      }
      console.log("Stack size:" + d.data.size);
    }
    if(d.type == "updaterules"){
      localrules = d.data.rules;
      updateRules();
    }
    if(d.type == "skipped"){
      showPlayerSkipped(d.data.skipped, pileCard.col);
    }
    if(d.type == "cardmove"){
      playDrawCardSound();
    }
    if(d.type == "canjumpin"){
      showJumpin();
      jumpin = true;
      console.log("Can jumpin");
    }
  }
}

class Card{
  constructor(col, num){
    this.dragAble = true;
    this.dragging = false;
    this.startPos = {x:0, y:0};
    this.relPos = {x:0, y:0};
    this.elem = document.createElement("DIV");
    this.elem.c = this;
    this.elem.setAttribute("class", "card");
    this.cardType(col, num);
  }
  getCardType(){
    return {col:this.col, num:this.num};
  }
  cardType(col, num){
    let cn = [
      "", "Red", "Green", "Blue", "Yellow"
    ];
    let jj = "";//" "+(col*100 + num)
    if(num == 0 && col == 0){
      this.elem.style.backgroundImage = "";
    }
    else if(num >= 0 && num <= 9){
      this.elem.style.backgroundImage = "url(./cards/" + cols[col] + "_" + num + ".png)";
      this.elem.setAttribute("title", cn[col] + " " + num + jj);
    }
    else if(num == 20){
      this.elem.style.backgroundImage = "url(./cards/" + cols[col] + "_reverse.png)";
      this.elem.setAttribute("title", cn[col] + " Reverse" + jj);
    }
    else if(num == 21){
      this.elem.style.backgroundImage = "url(./cards/" + cols[col] + "_skip.png)";
      this.elem.setAttribute("title", cn[col] + " Skip" + jj);
    }
    else if(num == 22){
      this.elem.style.backgroundImage = "url(./cards/" + cols[col] + "_picker.png)";
      this.elem.setAttribute("title", cn[col] + " +2" + jj);
    }
    else if(num == 23){
      if(col == 0){
        this.elem.style.backgroundImage = "url(./cards/wild_color_changer.png)";
        this.elem.setAttribute("title", "Wild Changer" + jj);
      }
      else{
        this.elem.style.backgroundImage = "url(./cards/wild_color_changer_" + cols[col] + ".png)";
        this.elem.setAttribute("title", cn[col] + " Wild Changer" + jj);
      }
    }
    else if(num == 24){
      if(col == 0){
        this.elem.style.backgroundImage = "url(./cards/wild_pick_four.png)";
        this.elem.setAttribute("title", "Wild +4" + jj);
      }
      else{
        this.elem.style.backgroundImage = "url(./cards/wild_pick_four_" + cols[col] + ".png)";
        this.elem.setAttribute("title", cn[col] + " Wild +4" + jj);
      }
    }
    this.num = num;
    this.col = col;
  }
  remove(){
    //this.elem.parentNode.removeChild(this.elem)
    this.elem.remove();
    for(let i = 0; i < hand.length; i++){
      if(hand[i] == this){
        hand.splice(i, 1);
        console.log("removing");
      }
    }
    orderCards();
  }
  putInHand(){
    document.getElementById("hand").appendChild(this.elem)
    hand.push(this);
    orderCards();
  }
  makePileCard(){
    this.elem.style.position = "absolute";
    this.elem.style.left = "calc(50vw - 65px + 56px)";
    this.elem.style.top = "calc(50vh - 91px)";
    pileCard = this;
    this.dragAble = false;
    document.getElementById("arena").appendChild(this.elem);
  }
}
function canDrawCard(c){
  if(c.num == 23 || c.num == 24){
    return true;
  }
  if(c.num == pileCard.num || c.col == pileCard.col){
    return true;
  }
  return false;
}
function orderCards(){
  let w = window.innerWidth - 256;
  let n = hand.length;
  let cw = 130;
  let m = 56;//-56;
  let csw = (cw-m)*n;

  if(csw > w){
    m += Math.abs(w-csw)/n;
  }

  let lm = w/2 - csw/2 + 128;
  lm = Math.max(lm, 128 + m/2);
  let handElem = document.getElementById("hand")
  handElem.style.marginLeft = lm + "px";
  let handCards = document.getElementsByClassName("card");
  handCards = Array.prototype.filter.call(handCards, function(handCards){
    return handCards.parentNode === handElem;
  });
  for(let i = 0; i < handCards.length; i++){
    handCards[i].style.marginLeft = -m + "px";
    handCards[i].style.zIndex = n;
  }
}
var dragElem = null;
var mvPos = {x:0,y:0};

function dragBegin(e){
  let margin = 56;
  let t = e.srcElement;
  dragElem = t;
  if(t.c != null){
    if(t.c.dragAble){
      t.c.startPos = {x:e.clientX, y:e.clientY};
      let v = t.getBoundingClientRect();
      t.c.relPos = {x:t.c.startPos.x - v.left - margin, y:t.c.startPos.y - v.top};
      t.style.position = "fixed";
      t.c.dragging = true;
      t.style.left = e.clientX - t.c.relPos.x + "px";
      t.style.top = e.clientY - t.c.relPos.y + "px";
    }
  }
}
function dragBeginTouch(e){
  let margin = 56;
  let t = e.srcElement;
  dragElem = t;
  if(t.c != null){
    if(t.c.dragAble){
      t.c.startPos = {x:e.targetTouches[0].clientX, y:e.targetTouches[0].clientY};
      let v = t.getBoundingClientRect();
      t.c.relPos = {x:t.c.startPos.x - v.left - margin, y:t.c.startPos.y - v.top};
      t.style.position = "fixed";
      t.c.dragging = true;
      t.style.left = e.targetTouches[0].clientX - t.c.relPos.x + "px";
      t.style.top = e.targetTouches[0].clientY - t.c.relPos.y + "px";
    }
  }
}
function dragEnd(e){
  let t = dragElem;
  if(t != null){
    if(t.c != null){
      if(t.c.dragAble){
        t.c.startPos = {x:0, y:0};
        t.c.relPos = {x:0, y:0};
        t.style.position = "relative";
        t.style.left = "";
        t.style.top = "";
        t.c.dragging = false;

        let w = window.innerWidth;
        let h = window.innerHeight;
        let dropDis = 100;

        if(distance(e.clientX, e.clientY, w/2, h/2) < dropDis){
          console.log("Droping");
          //t.c.remove();
          sendData("playcard", t.c.getCardType());
          console.log(t.c.getCardType());
        }
        orderCards();
        dragElem = null;
      }
    }
  }
}
function dragEndTouch(e){
  let t = dragElem;
  if(t != null){
    if(t.c != null){
      if(t.c.dragAble){
        t.c.startPos = {x:0, y:0};
        t.c.relPos = {x:0, y:0};
        t.style.position = "relative";
        t.style.left = "";
        t.style.top = "";
        t.c.dragging = false;

        let w = window.innerWidth;
        let h = window.innerHeight;
        let dropDis = 100;

        if(distance(mvPos.x, mvPos.y, w/2, h/2) < dropDis){
          console.log("Droping");
          //t.c.remove();
          sendData("playcard", t.c.getCardType());
          console.log(t.c.getCardType());
        }
        orderCards();
        dragElem = null;
      }
    }
  }
}
function drag(e){
  let t = dragElem;
  if(t != null){
    if(t.c != null){
      if(t.c.dragging){
        t.style.left = e.clientX - t.c.relPos.x + "px";
        t.style.top = e.clientY - t.c.relPos.y + "px";
      }
    }
  }
}
function dragTouch(e){
  let t = dragElem;
  if(t != null){
    if(t.c != null){
      if(t.c.dragging){
        mvPos = {x:e.targetTouches[0].clientX, y:e.targetTouches[0].clientY};
        t.style.left = e.targetTouches[0].clientX - t.c.relPos.x + "px";
        t.style.top = e.targetTouches[0].clientY - t.c.relPos.y + "px";
      }
    }
  }
}

function distance(x1, y1, x2, y2){
  return Math.abs(Math.sqrt(x1*x1 + y1*y1) - Math.sqrt(x2*x2 + y2*y2));
}

function sendData(type, data){
  let d = JSON.stringify({type:type, data:data});
  ws.send(d);
}

function showPanel(p = null){
  let menu = document.getElementById("menupanel");
  document.getElementById("createpanel").style.visibility = "hidden";
  document.getElementById("joinpanel").style.visibility = "hidden";
  document.getElementById("lobbypanel").style.visibility = "hidden";
  document.getElementById("startpanel").style.visibility = "hidden";
  document.getElementById("modepanel").style.visibility = "hidden";
  document.getElementById("joiningpanel").style.visibility = "hidden";
  document.getElementById("startgame").style.visibility = "hidden";
  document.getElementById("gameendpanel").style.visibility = "hidden";
  if(p){
    menu.style.visibility = "visible";
    document.getElementById(p).style.visibility = "visible";
    if(p == "lobbypanel"){
      let url = new URL(document.location).hostname;
      document.getElementById("sharelink").value = url + "?g="+gametoken;
      //document.getElementById("lobbyname").innerHTML = latestData.game.name || "Uno Game";
      if(isHost){
        document.getElementById("startgame").style.visibility = "visible";
      }
    }
  }
  else{
    menu.style.visibility = "hidden";
  }
}

function updatePlayers(){
  let pl = latestData.players;
  let fp = false;
  let k = false;
  for(let i = 0; i < pl.length; i++){
    if(pl[i].id == id){
      k = true; //check if id exists
    }
  }
  if(id == -1 || !k){
    throw "Invalid id (" + id + ").";
    return;
  }
  while(pl[pl.length-1].id != id && id != -1 && k){
    pl.unshift(pl.pop());
  }
  let me = pl[pl.length-1];
  pl.pop();
  document.getElementById("otherplayers").innerHTML = "";
  playerIdList = [];
  for(let i = 0; i < pl.length; i++){
    playerIdList.push(pl[i].id);
    createPlayer(pl[i].name, pl[i].cards, pl[i].id == latestData.game.turn, pl[i].color);
  }
  createPlayer(me.name, me.cards, id == latestData.game.turn, me.color, true);
  console.log("is my turn: ", id == latestData.game.turn);
}

function createPlayer(user, cards, turn = false, color, me = false){
  let op = document.getElementById("otherplayers");
  let p = document.createElement("DIV");
  let un = document.createElement("P");
  let cn = document.createElement("P");
  let c = document.createElement("DIV");
  p.className = "player";
  p.style.borderLeft = "8px solid " + color;
  un.className = "playerusername";
  cn.className = "playercardsnumber";
  c.className = "playercards";
  un.innerHTML = user;
  cn.innerHTML = cards;
  if(turn){
    p.setAttribute("turn", "")
  }
  if(!me){
    for(let i = 0; i < cards; i++){
      let cc = document.createElement("DIV");
      cc.className = "smallCard";
      c.appendChild(cc);
    }
  }
  p.appendChild(un);
  p.appendChild(cn);
  p.appendChild(c);
  if(me){
    op = document.getElementById("ui");
    op.innerHTML = "";
    p.setAttribute("me", "");
  }
  op.appendChild(p);
}

function enterName(){
  let n = document.getElementById("entername").value;
  if(n.length >= 2){
    showPanel("modepanel");
    name = n;
    if(gametoken){
      if(gametoken.length == 6){
        setTimeout(connect, 500);
        showPanel("joiningpanel");
      }
    }
  }
}
function toCreate(){
  showPanel("createpanel");
}
function toJoin(){
  showPanel("joinpanel");
}
function host(){
  willHost = true;
  setTimeout(connect, 500);
  showPanel("joiningpanel");
}
function menuJoin(){
  gametoken = document.getElementById("entertoken").value;
  showPanel("joiningpanel");
  setTimeout(connect, 500);
}
function startGame(){
  sendData("startgame", {});
}
function isMyTurn(){
  return latestData.game.turn == id;
}
function clearHand(){
  for(let k = 0; k < hand.length; k++){
    hand[k].elem.remove();
  }
  hand = [];
}
function fillHand(){
  for(let i = 0; i < latestData.me.cards.length; i++){
    //{card:24, color:0}
    let c = latestData.me.cards[i];
    new Card(c.color, c.card).putInHand();
  }
  orderCards();
}
function showFrontMessage(text, col1, col2){
  let fm = document.getElementById("frontmessage");
  let fmb = document.getElementById("frontmessagebar");
  fm.style.backgroundColor = col1;
  fmb.style.backgroundColor = col2;
  fm.setAttribute("show", "");
  document.getElementById("frontmessagetext").innerHTML = text;
  setTimeout(() => {
    let fm = document.getElementById("frontmessage");
    let fmb = document.getElementById("frontmessagebar");
    fm.removeAttribute("show");
    fm.style.backgroundColor = fmb.style.backgroundColor;
  }, 2000);
}
function setSpinnerDirection(dir){
  if(dir == 1){
    document.getElementById("dirIndic").removeAttribute("reverse");
  }
  else{
    document.getElementById("dirIndic").setAttribute("reverse", "");
  }
}
function showColorSelector(b){
  let sel = document.getElementById("colorSelector");
  if(b){
    sel.removeAttribute("hide");
    sel.removeAttribute("selcol_1");
    sel.removeAttribute("selcol_2");
    sel.removeAttribute("selcol_3");
    sel.removeAttribute("selcol_4");
  }
  else{
    sel.setAttribute("hide", "");
  }
}
function selectCol(col){
  let sel = document.getElementById("colorSelector");
  sel.setAttribute("selcol_"+col, "");
  selectedColor = col;
  setTimeout(() => {
    showColorSelector(false);
    sendData("selectedcolor", {color:col});
  }, 500);
}
function flashUno(n){
  console.log(n+" Is UNO!");
  let uno = document.getElementById("calluno");
  uno.removeAttribute("hide");
  setTimeout(() => {
    uno.setAttribute("hide", "");
  }, 3000)
}
function clickUno(){
  console.log("Clicked Uno!");
  sendData("clickeduno", {});
  let uno = document.getElementById("calluno");
  uno.setAttribute("hide", "");
}
localrules = {
  stacking:true,
  endonwild:true,
  forceplay:true,
  jumpin:true,
  quicktimeuno:true,
  startcards:7,
  turntimer:30,
  specialcards:false
};
function updateRules(){
  setRuleBtn(document.getElementById("rulestacking"), localrules.stacking);
  setRuleBtn(document.getElementById("ruleendonwild"), localrules.endonwild);
  setRuleBtn(document.getElementById("ruleforceplay"), localrules.forceplay);
  setRuleBtn(document.getElementById("rulejumpin"), localrules.jumpin);
  setRuleBtn(document.getElementById("rulequicktimeuno"), localrules.quicktimeuno);
  setRuleBtn(document.getElementById("rulestartcards"), localrules.startcards != 7);
  setRuleBtn(document.getElementById("ruleturntimer"), localrules.turntimer);
  setRuleBtn(document.getElementById("rulespecialcards"), localrules.specialcards);
}
function setRule(r){
  if(latestData.me.host){
    if(localrules[r]){
      localrules[r] = false;
      setRuleBtn(document.getElementById("rule"+r), false);
    }
    else{
      localrules[r] = true;
      setRuleBtn(document.getElementById("rule"+r), true);
    }
    sendData("setrules", {rules:localrules});
  }
}
function setRuleStartCards(){
  if(latestData.me.host){
    let k = localrules["startcards"];
    let r;
    if(k == 5){r = 7;}
    if(k == 7){r = 10;}
    if(k == 10){r = 12;}
    if(k == 12){r = 5;}
    if(r == 7){
      setRuleBtn(document.getElementById("rulestartcards"), false);
    }
    else{
      setRuleBtn(document.getElementById("rulestartcards"), true);
    }
    document.getElementById("rulestartcards").setAttribute("val", r);
    localrules["startcards"] = r;
    sendData("setrules", {rules:localrules});
  }
}
function setRuleBtn(t, b){
  if(b){
    t.removeAttribute("off");
  }
  else{
    t.setAttribute("off", "");
  }
}
var lastDir = 1;
var ang = 0;

function animFrame(){
  let dir = document.getElementById("dirIndic");
  dir.style.transform = "rotate("+ang*(latestData.game.direction || 1)+"deg)";
  ang += 30 * (1/60);
  if(ang > 360){
    ang %= 360;
  }
  if(lastDir != latestData.game.direction){
    dir.setAttribute("fx", "");
    setTimeout(() => {
      document.getElementById("dirIndic").removeAttribute("fx");
    }, 250);
  }
  lastDir = latestData.game.direction;
  window.requestAnimationFrame(animFrame);
}
function getPlayerPosById(id){
  for(let i = 0; i < playerIdList.length; i++){
    if(playerIdList[i] == id){
      return i;
    }
  }
  return -1;
}
var skipi = 0;
function showPlayerSkipped(id, col){
  skipi = getPlayerPosById(id);
  let b = document.getElementById("skipflash");
  b.style.backgroundImage = "url(./"+cols[col]+"_skip.png)";
  b.removeAttribute("hide");
  setTimeout(() => {
    let b = document.getElementById("skipflash");
    if(skipi >= 0){
      let ww = window.innerWidth;
      let ew = ww/playerIdList.length;
      let l = (ew*skipi) + (ew/2);
      b.style.top = "40px";
      b.style.left = l + "px";
    }
    else{
      b.style.top = "calc(100vh - 100px)";
      b.style.left = "50vw";
    }
  }, 500);
  setTimeout(() => {
    let b = document.getElementById("skipflash");
    b.setAttribute("hide", "");
    b.style.top = "50vh";
    b.style.left = "50vw";
  }, 2500);
}
function loadAudio(a){
  for(let i = 0; i < a.length; a++){
    drawCardAudio.push(new Audio("./"+a[i]));
  }
}
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
var laud = 0;
function playDrawCardSound(){
  laud++;
  if(laud > drawCardAudio.length-1){
    laud = 0;
  }
  if(audioOn){
    drawCardAudio[laud].play();
  }
}
function showJumpin(){
  hideJumpin();
  if(latestData.game.turn != id && latestData.game.rules.jumpin){
    for(let i = 0; i < hand.length; i++){
      let c = hand[i];
      if(c.num == pileCard.num && c.num < 20){
        console.log("Card can jump in.", c.elem);
        c.elem.setAttribute("jumpin", "");
      }
    }
  }
}
function hideJumpin(){
  console.log("hide jumpin.");
  for(let i = 0; i < hand.length; i++){
    hand[i].elem.removeAttribute("jumpin");
  }
}
function showLobby(){
  showPanel("lobbypanel");
  if(latestData.me.host){
    sendData("resetgame", {});
  }
}
