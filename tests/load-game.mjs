import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context = vm.createContext({});
for (const file of ['game.js', 'questions.js']) {
  vm.runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context, {filename: file});
}
export const game = context.RICEGame;
export const questions = context.RICE_QUESTIONS;
