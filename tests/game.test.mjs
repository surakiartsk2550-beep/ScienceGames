import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {game, questions} from './load-game.mjs';
const {createGame, openQuestion, revealAnswer, awardQuestion, teamScores, restoreGame,
       remainingGameSeconds, expireGame, GAME_DURATION_MS} = game;
const round = () => createGame(['ดิน', '', 'น้ำ', 'ลม', 'ไฟ'], 0);
test('all five editable team slots have a usable default', () => {
  assert.deepEqual([...round().teams], ['ดิน', 'กลุ่ม B', 'น้ำ', 'ลม', 'ไฟ']);
});
test('revealing and assigning are distinct, persistent steps; a tile scores once', () => {
  const g = round();
  assert.ok(openQuestion(g, 20, 100));
  assert.equal(awardQuestion(g, 'A', 200), false);
  assert.equal(openQuestion(g, 21, 300), false);
  assert.ok(revealAnswer(g, 120000));
  const resumed = restoreGame(JSON.parse(JSON.stringify(g)));
  assert.deepEqual({...resumed.active}, {id: 20, revealed: true});
  assert.equal(awardQuestion(resumed, 'F', 121000), false);
  assert.ok(awardQuestion(resumed, 'B', 121000));
  assert.equal(awardQuestion(resumed, 'A', 121000), false);
  assert.equal(openQuestion(resumed, 20, 121000), false);
  assert.deepEqual({...teamScores(resumed)}, {A:0, B:100, C:0, D:0, E:0});
});
test('skip opens the tile without awarding points', () => {
  const g = round();
  openQuestion(g, 4, 0); revealAnswer(g, 1);
  assert.ok(awardQuestion(g, null, 2));
  assert.ok(g.answers[4]);
  assert.equal(Object.values(teamScores(g)).reduce((a,b) => a+b), 0);
});
test('15-minute deadline takes priority on board, in question and in award dialog', () => {
  for (const phase of ['board','question','award']) {
    const g = round();
    openQuestion(g, 0, 0); revealAnswer(g, 1); awardQuestion(g, 'E', 2);
    if (phase !== 'board') openQuestion(g, 1, 300);
    if (phase === 'award') revealAnswer(g, 301);
    assert.equal(remainingGameSeconds(g, 0), 900);
    assert.equal(remainingGameSeconds(g, GAME_DURATION_MS - 1), 1);
    assert.ok(expireGame(g, GAME_DURATION_MS));
    assert.equal(remainingGameSeconds(g, GAME_DURATION_MS + 999), 0);
    assert.equal(awardQuestion(g, 'E', GAME_DURATION_MS), false);
    assert.equal(openQuestion(g, 2, GAME_DURATION_MS), false);
    assert.equal(g.active, null);
    assert.equal(teamScores(g).E, 500);
    assert.equal(restoreGame(JSON.parse(JSON.stringify(g))).endReason, 'time-limit');
  }
});
test('all cells reveal, aggregate across five teams is 7500, clock freezes', () => {
  const g = round();
  for (let id = 0; id < 25; id++) {
    openQuestion(g, id, 500); revealAnswer(g, 510);
    assert.ok(awardQuestion(g, game.TEAM_IDS[id % 5], 520));
  }
  assert.equal(g.endReason, 'completed');
  assert.deepEqual(Object.values(teamScores(g)), [1500,1500,1500,1500,1500]);
  assert.equal(g.finishedAt, 520);
  assert.ok(!expireGame(g, GAME_DURATION_MS));
});
test('all learning content present in board order, correct letters and four bundled images', () => {
  assert.equal(questions.length, 25);
  for (const q of questions) assert.ok(q.text && q.answer);
  const expected = {7:'C',10:'ข',11:'ก',13:'ค',15:'ข',16:'ค',17:'ข',18:'ข',19:'ก',24:'ก'};
  for (const [id, letter] of Object.entries(expected)) {
    assert.equal(questions[id].options.length, 4);
    assert.ok(questions[id].options.includes(questions[id].answer));
    assert.ok(questions[id].answer.startsWith(letter + '.'));
  }
  for (let i = 0; i < 4; i++) {
    const q = questions[i+20];
    assert.equal(q.image, 'assets/question-100-' + (i+1) + '.jpg');
    assert.equal(q.text, 'ภาพนี้เป็นขั้นตอนใดในหลักการ R.I.C.E');
    assert.equal(q.answer.split(' ')[0], ['Rest','Compression','Elevation','Ice'][i]);
    assert.ok(q.alt && existsSync(new URL('../' + q.image, import.meta.url)));
  }
});
test('invalid, legacy and corrupt records cannot become active team games', () => {
  assert.equal(restoreGame({version: 1}), null);
  const g = round(); g.answers[0] = {team: 'unknown'};
  assert.equal(restoreGame(g), null);
});
