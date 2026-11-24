import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clampTime,createGame,scoreOf,completed,openQuestion,answerQuestion,restoreGame,pointsFor,MAX_SCORE} from './load-game.mjs';
import {QUESTIONS} from './load-game.mjs';
import {GAME_DURATION_MS,ended,remainingGameSeconds,expireGame} from './load-game.mjs';

test('game counts down from 15 minutes and clamps at zero',()=>{
  const g=createGame('A',30,0,1000);
  assert.equal(remainingGameSeconds(g,1000),900);
  assert.equal(remainingGameSeconds(g,2000),899);
  assert.equal(remainingGameSeconds(g,1000+GAME_DURATION_MS-1),1);
  assert.equal(remainingGameSeconds(g,1000+GAME_DURATION_MS),0);
  assert.equal(remainingGameSeconds(g,1000+GAME_DURATION_MS+10000),0);
});
test('total deadline ends an unfinished board without giving or losing points',()=>{
  const g=createGame('A',30,0,1000);openQuestion(g,0,1000);answerQuestion(g,true,true,2000);
  assert.equal(expireGame(g,1000+GAME_DURATION_MS-1),false);
  assert.equal(expireGame(g,1000+GAME_DURATION_MS),true);
  assert.equal(ended(g),true);assert.equal(completed(g),false);
  assert.equal(scoreOf(g),500);assert.equal(g.finishedAt,1000+GAME_DURATION_MS);
  assert.equal(g.endReason,'time-limit');assert.equal(g.answers.filter(Boolean).length,1);
  assert.equal(openQuestion(g,1,1000+GAME_DURATION_MS+1),false);
  assert.equal(expireGame(g,1000+GAME_DURATION_MS+2),false);
});
test('total deadline wins over a still-running question and rejects a late correct answer',()=>{
  const g=createGame('A',60,0,0);openQuestion(g,2,GAME_DURATION_MS-1000);
  assert.equal(answerQuestion(g,true,true,GAME_DURATION_MS),null);
  assert.equal(g.active,null);assert.equal(g.answers[2].timedOut,true);
  assert.equal(scoreOf(g),0);assert.equal(ended(g),true);
});
test('total deadline survives reload, including older saves without a new deadline field',()=>{
  const original=createGame('A',30,0,1000);openQuestion(original,3,2000);
  const saved=restoreGame(JSON.parse(JSON.stringify(original)));
  assert.equal(remainingGameSeconds(saved,61000),840);
  assert.equal(expireGame(saved,1000+GAME_DURATION_MS+10000),true);
  assert.equal(remainingGameSeconds(saved,1000+GAME_DURATION_MS+20000),0);
  const endedSave=restoreGame(JSON.parse(JSON.stringify(saved)));
  assert.equal(endedSave.endReason,'time-limit');assert.equal(ended(endedSave),true);
});
test('finishing all questions early freezes remaining game time',()=>{
  const g=createGame('A',30,0,0);
  for(let id=0;id<25;id++){openQuestion(g,id,id*100);answerQuestion(g,true,true,id*100+1);}
  const remaining=remainingGameSeconds(g,3000);
  assert.equal(expireGame(g,GAME_DURATION_MS+1000),false);
  assert.equal(remainingGameSeconds(g,GAME_DURATION_MS+1000),remaining);
  assert.equal(scoreOf(g),MAX_SCORE);
});
test('time settings clamp to 5–60 in five-second increments',()=>{assert.equal(clampTime(0),30);assert.equal(clampTime(-5),5);assert.equal(clampTime(65),60);for(let n=5;n<=60;n+=5)assert.equal(clampTime(n),n);});
test('points reflect row and total is 7500',()=>{assert.deepEqual([0,5,10,15,20].map(pointsFor),[500,400,300,200,100]);assert.equal(Array.from({length:25},(_,i)=>pointsFor(i)).reduce((a,b)=>a+b),MAX_SCORE);});
test('correct, incorrect and timed-out questions all reveal, award only once',()=>{const g=createGame('นักเรียน',5,0,1000);openQuestion(g,0,1000);assert.equal(answerQuestion(g,true,true,2000).correct,true);assert.equal(scoreOf(g),500);assert.equal(answerQuestion(g,true,true,2200),null);assert.equal(openQuestion(g,0,2500),false);openQuestion(g,5,3000);assert.equal(answerQuestion(g,false,true,4000).correct,false);openQuestion(g,10,5000);const expired=answerQuestion(g,true,true,10000);assert.equal(expired.timedOut,true);assert.equal(expired.selection,null);assert.equal(scoreOf(g),500);assert.ok(g.answers[0]&&g.answers[5]&&g.answers[10]);});
test('cannot open another question while one is active',()=>{const g=createGame('A',30);assert.equal(openQuestion(g,1),true);assert.equal(openQuestion(g,2),false);assert.equal(g.active.id,1);});
test('deadline survives save/restore and expires after reload',()=>{const g=createGame('A',5,0,100);openQuestion(g,3,100);const restored=restoreGame(JSON.parse(JSON.stringify(g)));assert.equal(restored.active.deadline,5100);assert.equal(answerQuestion(restored,false,false,6000).timedOut,true);assert.equal(scoreOf(restored),0);});
test('completion freezes finished time and reveals every cell',()=>{const g=createGame('A',5,0,0);for(let id=0;id<25;id++){openQuestion(g,id,id*100);answerQuestion(g,true,true,id*100+1);}assert.equal(completed(g),true);assert.equal(scoreOf(g),MAX_SCORE);assert.equal(g.finishedAt,2401);assert.equal(restoreGame(JSON.parse(JSON.stringify(g))).answers.length,25);});
test('invalid saved state is rejected',()=>{assert.equal(restoreGame({}),null);const g=createGame('A',5);g.active={id:26,deadline:0};assert.equal(restoreGame(g),null);});
test('25 questions have boolean answers, explanations and primary sources',()=>{assert.equal(QUESTIONS.length,25);for(const q of QUESTIONS){assert.equal(typeof q.answer,'boolean');assert.ok(q.text&&q.explanation);assert.match(q.source,/^https:\/\/www\.(nhs\.uk|sja\.org\.uk)\//);}});

