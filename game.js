(function(){
'use strict';
const VERSION=1;
const MAX_SCORE=7500;
const GAME_DURATION_MS=15*60*1000;
const clampTime=value=>Math.min(60,Math.max(5,Math.round((Number(value)||30)/5)*5));
const pointsFor=id=>(5-Math.floor(id/5))*100;
function createGame(name,seconds,avatar=0,now=Date.now()){
  return {version:VERSION,name:name.trim().slice(0,24),seconds:clampTime(seconds),avatar,startedAt:now,finishedAt:null,answers:Array(25).fill(null),active:null};
}
function scoreOf(game){return game.answers.reduce((sum,a,i)=>sum+(a?.correct?pointsFor(i):0),0);}
function completed(game){return game.answers.every(Boolean);}
function ended(game){return game.finishedAt!==null||completed(game);}
function remainingGameSeconds(game,now=Date.now()){
  return Math.max(0,Math.ceil((game.startedAt+GAME_DURATION_MS-(game.finishedAt??now))/1000));
}
function expireGame(game,now=Date.now()){
  const deadline=game.startedAt+GAME_DURATION_MS;
  if(ended(game)||now<deadline)return false;
  if(game.active)game.answers[game.active.id]={selection:null,correct:false,timedOut:true,answeredAt:deadline};
  game.active=null;game.finishedAt=deadline;game.endReason='time-limit';
  return true;
}
function openQuestion(game,id,now=Date.now()){
  if(expireGame(game,now)||ended(game))return false;
  if(!Number.isInteger(id)||id<0||id>24||game.answers[id]||game.active)return false;
  game.active={id,deadline:now+game.seconds*1000};return true;
}
function answerQuestion(game,selection,correctAnswer,now=Date.now()){
  if(expireGame(game,now)||ended(game))return null;
  if(!game.active)return null;
  const {id,deadline}=game.active;
  if(game.answers[id])return null;
  const timedOut=now>=deadline;
  if(!timedOut&&typeof selection!=='boolean')return null;
  const answer={selection:timedOut?null:selection,correct:!timedOut&&selection===correctAnswer,timedOut,answeredAt:now};
  game.answers[id]=answer;game.active=null;
  if(completed(game))game.finishedAt=now;
  return {id,...answer,earned:answer.correct?pointsFor(id):0};
}
function restoreGame(value){
  if(!value||value.version!==VERSION||typeof value.name!=='string'||!value.name.trim()||!Number.isFinite(value.startedAt)||!Array.isArray(value.answers)||value.answers.length!==25||clampTime(value.seconds)!==value.seconds)return null;
  if(value.answers.some(a=>a!==null&&(!a||typeof a.correct!=='boolean'||typeof a.timedOut!=='boolean'||!Number.isFinite(a.answeredAt)||(a.selection!==null&&typeof a.selection!=='boolean'))))return null;
  if(value.active&&(!Number.isInteger(value.active.id)||value.active.id<0||value.active.id>24||!Number.isFinite(value.active.deadline)||value.answers[value.active.id]))return null;
  if(value.finishedAt!==null&&!Number.isFinite(value.finishedAt))return null;
  return {...value,name:value.name.slice(0,24),avatar:[0,1,2].includes(value.avatar)?value.avatar:0};
}

globalThis.RICEGame=Object.freeze({VERSION,MAX_SCORE,GAME_DURATION_MS,clampTime,pointsFor,createGame,scoreOf,completed,ended,remainingGameSeconds,expireGame,openQuestion,answerQuestion,restoreGame});
})();

