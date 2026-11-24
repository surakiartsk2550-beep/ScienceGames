import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({});
for(const file of ['game.js','questions.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context,{filename:file});
export const {VERSION,MAX_SCORE,GAME_DURATION_MS,clampTime,pointsFor,createGame,scoreOf,completed,ended,remainingGameSeconds,expireGame,openQuestion,answerQuestion,restoreGame}=context.RICEGame;
export const QUESTIONS=context.RICE_QUESTIONS;
