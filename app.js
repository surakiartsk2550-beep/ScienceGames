(function(){
'use strict';
const {VERSION,MAX_SCORE,GAME_DURATION_MS,clampTime,pointsFor,createGame,scoreOf,completed,ended,remainingGameSeconds,expireGame,openQuestion,answerQuestion,restoreGame}=globalThis.RICEGame;
const QUESTIONS=globalThis.RICE_QUESTIONS;
const $=id=>document.getElementById(id);
const SAVE_KEY='sciencegames.rice.v1';
const HISTORY_KEY='sciencegames.rice.history.v1';
const PREFS_KEY='sciencegames.rice.preferences.v1';
let game=null,seconds=30,avatar=0,feedbackId=null,screen='setup',storageAvailable=true;
const screens={setup:$('setup-screen'),board:$('board-screen'),question:$('question-screen')};
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{storageAvailable=false;$('storage-notice').hidden=false;}}
function persist(){if(game)save(SAVE_KEY,game);}
function announce(message){$('status').textContent=message;}
function show(name){screen=name;for(const [key,el] of Object.entries(screens))el.hidden=key!==name;}
function place(el,x,y,w,h){Object.assign(el.style,{left:`${x/1672*100}%`,top:`${y/941*100}%`,width:`${w/1672*100}%`,height:`${h/941*100}%`});}
document.querySelectorAll('[data-box]').forEach(el=>place(el,...el.dataset.box.split(',').map(Number)));
const cols=[[307,205],[520,205],[733,206],[946,205],[1159,206]];
const rows=[[126,154],[287,156],[450,156],[613,147],[767,155]];
const tiles=[];
for(let id=0;id<25;id++){
  const [x,w]=cols[id%5],[y,h]=rows[Math.floor(id/5)];
  const button=document.createElement('button');button.className='tile';button.dataset.cell=id;place(button,x,y,w,h);
  const art=document.createElement('img');art.className='tile-art';art.src='assets/board-closed.png';art.alt='';art.draggable=false;
  Object.assign(art.style,{width:`${1672/w*100}%`,height:`${941/h*100}%`,left:`${-x/w*100}%`,top:`${-y/h*100}%`});button.append(art);
  button.addEventListener('click',()=>choose(id));$('tiles').append(button);tiles.push(button);
}
function avatarStyle(el,value){
  el.hidden=value===0;if(value===0)return;
  // The two optional avatars are crops of the approved RICE master illustration.
  // Each is presented through a CSS viewport; source artwork remains unchanged.
  const crop=value===1?{x:295,y:430,size:337}:{x:927,y:548,size:208};
  Object.assign(el.style,{backgroundSize:`${1432/crop.size*100}% ${1099/crop.size*100}%`,backgroundPosition:`${crop.x/(1432-crop.size)*100}% ${crop.y/(1099-crop.size)*100}%`});
}
function updateSettings(){
  $('setup-time').textContent=`${seconds} S`;$('time-plus').disabled=seconds>=60;$('time-minus').disabled=seconds<=5;
  avatarStyle($('setup-avatar'),avatar);
  save(PREFS_KEY,{seconds,avatar,name:$('player-name').value});
}
function changeTime(step){seconds=clampTime(seconds+step);updateSettings();}
$('time-plus').addEventListener('click',()=>changeTime(5));$('time-minus').addEventListener('click',()=>changeTime(-5));
$('avatar-prev').addEventListener('click',()=>{avatar=(avatar+2)%3;updateSettings();announce(`เลือกตัวละคร ${avatar+1} จาก 3`);});
$('avatar-next').addEventListener('click',()=>{avatar=(avatar+1)%3;updateSettings();announce(`เลือกตัวละคร ${avatar+1} จาก 3`);});
$('player-name').addEventListener('input',()=>{$('name-error').textContent='';$('player-name').setCustomValidity('');updateSettings();});
$('player-name').addEventListener('invalid',()=>{$('name-error').textContent='กรุณาใส่ชื่อผู้เล่นก่อนเริ่มเกม';});
function updateResume(){const saved=restoreGame(read(SAVE_KEY));$('resume-game').hidden=!saved;if(saved)$('resume-game').textContent=`${ended(saved)?'ดูเกมล่าสุด':'เล่นต่อ'} · ${saved.name} · ${scoreOf(saved).toLocaleString('th-TH')} คะแนน`;}
function newGame(){
  const name=$('player-name').value.trim();
  if(!name){$('name-error').textContent='กรุณาใส่ชื่อผู้เล่นก่อนเริ่มเกม';$('player-name').setCustomValidity('กรุณาใส่ชื่อผู้เล่น');$('player-name').reportValidity();return;}
  game=createGame(name,seconds,avatar);persist();renderBoard();show('board');tiles[0].focus({preventScroll:true});
}
$('setup-form').addEventListener('submit',event=>{event.preventDefault();const saved=restoreGame(read(SAVE_KEY));if(saved)expireGame(saved);if(saved&&!ended(saved)&&!ended(game||saved)){
  if(!window.confirm('เริ่มเกมใหม่และแทนที่เกมที่บันทึกไว้หรือไม่? หากต้องการเล่นต่อ กด “ยกเลิก” แล้วเลือก “เล่นต่อ”'))return;
}newGame();});
function renderBoard(){
  if(!game)return;
  $('profile-name').textContent=game.name;$('profile-name').title=game.name;
  $('score').textContent=`คะแนน : ${scoreOf(game).toLocaleString('th-TH')}`;
  avatarStyle($('profile-avatar'),game.avatar);
  for(let id=0;id<25;id++){const opened=!!game.answers[id];tiles[id].classList.toggle('opened',opened);tiles[id].disabled=opened||ended(game);tiles[id].setAttribute('aria-label',opened?`ช่อง ${id+1} เปิดภาพแล้ว`:`ช่อง ${id+1} ${ended(game)?'ยังไม่เปิด จบเกมแล้ว':`คำถาม ${pointsFor(id)} คะแนน`}`);}
  $('view-result').hidden=!ended(game);tick();
}
function choose(id){const now=Date.now();if(!game||finishIfExpired(now)||!openQuestion(game,id,now))return;persist();showQuestion();}
function showQuestion(){
  if(!game?.active)return;
  const {id}=game.active;$('question-text').textContent=QUESTIONS[id].text;
  $('answer-true').disabled=false;$('answer-false').disabled=false;show('question');tick();
  $('question-text').focus({preventScroll:true});
}
function submitAnswer(value){
  const now=Date.now();if(finishIfExpired(now))return;
  if(!game?.active)return;
  const id=game.active.id,q=QUESTIONS[id];const result=answerQuestion(game,value,q.answer,now);if(!result)return;
  $('answer-true').disabled=true;$('answer-false').disabled=true;persist();feedbackId=id;
  const earned=result.correct?pointsFor(id):0;
  $('feedback-points').textContent=result.correct?`+${earned} คะแนน`:'ข้อนี้ได้ 0 คะแนน';
  $('feedback-title').textContent=result.timedOut?'หมดเวลาแล้ว':result.correct?'ตอบถูกแล้ว!':'ยังไม่ถูก ลองเรียนรู้จากเฉลยกัน';
  $('feedback-answer').textContent=`ข้อความนี้ “${q.answer?'ถูก':'ผิด'}”`;
  $('feedback-explanation').textContent=q.explanation;
  $('feedback-source').href=q.source;$('feedback-source').textContent=q.source.includes('nhs.uk')?'อ้างอิง: NHS':'อ้างอิง: St John Ambulance';
  if(!$('feedback-dialog').open)$('feedback-dialog').showModal();
  announce(result.timedOut?'หมดเวลา ได้ 0 คะแนน':result.correct?`ตอบถูก ได้ ${earned} คะแนน`:'ตอบผิด ได้ 0 คะแนน');
  if(completed(game))recordHistory();
}
$('answer-true').addEventListener('click',()=>submitAnswer(true));$('answer-false').addEventListener('click',()=>submitAnswer(false));
$('feedback-dialog').addEventListener('cancel',event=>{event.preventDefault();leaveFeedback();});
$('feedback-next').addEventListener('click',leaveFeedback);
function leaveFeedback(){
  if(finishIfExpired())return;
  $('feedback-dialog').close();const id=feedbackId;feedbackId=null;renderBoard();show('board');
  if(id!==null){tiles[id].classList.add('revealing');setTimeout(()=>tiles[id].classList.remove('revealing'),500);}
  const next=tiles.find(tile=>!tile.disabled);if(next)next.focus({preventScroll:true});
  if(ended(game))showFinish();
}
function recordHistory(){const old=read(HISTORY_KEY);const history=Array.isArray(old)?old:[];if(!history.some(item=>item.startedAt===game.startedAt)){history.unshift({name:game.name,score:scoreOf(game),correct:game.answers.filter(a=>a?.correct).length,seconds:game.seconds,startedAt:game.startedAt,finishedAt:game.finishedAt,endReason:game.endReason||'completed'});save(HISTORY_KEY,history.slice(0,20));}}
function showFinish(){
  const outOfTime=game.endReason==='time-limit';
  $('finish-reason').textContent=outOfTime?'หมดเวลาเล่น 15 นาทีแล้ว':'เปิดภาพครบ 25 ช่องแล้ว';
  $('finish-title').textContent=outOfTime?'หมดเวลา จบเกมแล้ว!':'จบเกมแล้ว!';
  $('finish-view').textContent=completed(game)?'ดูภาพที่เปิดครบแล้ว':'ดูกระดานและคะแนน';
  $('finish-player').textContent=game.name;$('finish-score').textContent=`${scoreOf(game).toLocaleString('th-TH')} / ${MAX_SCORE.toLocaleString('th-TH')}`;
  const correct=game.answers.filter(a=>a?.correct).length,timeout=game.answers.filter(a=>a?.timedOut).length;
  const unanswered=game.answers.filter(a=>!a).length;
  $('finish-stats').textContent=`ตอบถูก ${correct} ข้อ · ตอบผิด ${25-unanswered-correct-timeout} ข้อ · หมดเวลา ${timeout} ข้อ${unanswered?` · ยังไม่เปิด ${unanswered} ข้อ`:''}`;
  if(!$('finish-dialog').open)$('finish-dialog').showModal();
}
$('finish-view').addEventListener('click',()=>$('finish-dialog').close());$('view-result').addEventListener('click',showFinish);
$('finish-new').addEventListener('click',()=>{$('finish-dialog').close();game=null;updateResume();show('setup');$('player-name').focus();});
$('exit-game').addEventListener('click',()=>{persist();updateResume();show('setup');});
$('resume-game').addEventListener('click',()=>{game=restoreGame(read(SAVE_KEY));if(!game){updateResume();return;}renderBoard();if(game.active)showQuestion();else{show('board');if(ended(game))showFinish();}});
function finishIfExpired(now=Date.now()){
  if(!game)return false;
  if(expireGame(game,now)){
    persist();recordHistory();feedbackId=null;$('feedback-dialog').close();
    if(screen==='setup')updateResume();
    else{show('board');renderBoard();showFinish();announce('หมดเวลาเล่น 15 นาที จบเกมแล้ว');}
  }
  return game.endReason==='time-limit';
}
function tick(){
  if(!game)return;
  const now=Date.now(),remainingTotal=remainingGameSeconds(game,now);
  $('elapsed').textContent=`${Math.floor(remainingTotal/60)} M ${String(remainingTotal%60).padStart(2,'0')}S`;
  if(finishIfExpired(now))return;
  if(screen==='question'&&game.active){const remaining=Math.max(0,Math.ceil((game.active.deadline-now)/1000));$('question-time').textContent=`${remaining} S`;$('question-time').classList.toggle('urgent',remaining<=5);if(remaining===0)submitAnswer(null);}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
window.addEventListener('pagehide',persist);setInterval(tick,150);
const prefs=read(PREFS_KEY);if(prefs){seconds=clampTime(prefs.seconds);avatar=[0,1,2].includes(prefs.avatar)?prefs.avatar:0;$('player-name').value=typeof prefs.name==='string'?prefs.name.slice(0,24):'';}
updateSettings();updateResume();show('setup');
// Preload gameplay images so a click never reveals a blank transition.
for(const src of ['board-open.png','board-closed.png','question.png','characters.png']){const image=new Image();image.src=`assets/${src}`;}

})();

