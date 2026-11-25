(function () {
'use strict';
const { TEAM_IDS, pointsFor, createGame, teamScores, ended, remainingGameSeconds,
  expireGame, openQuestion, revealAnswer, awardQuestion, restoreGame } = globalThis.RICEGame;
const questions = globalThis.RICE_QUESTIONS;
const $ = id => document.getElementById(id);
const SAVE = 'RICE RALLY.rice.teams.v2';
const PREFS = SAVE + '.names';
const HISTORY = SAVE + '.history';
const feedback = $('feedback-dialog');
const finish = $('finish-dialog');
const race = $('race-dialog');
let raceTimer;
let game = null;
let screen = 'setup';
function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { $('storage-notice').hidden = false; }
}
function persist() { save(SAVE, game); }
function show(name) {
  screen = name;
  for (const section of ['setup', 'board', 'question']) $(section + '-screen').hidden = section !== name;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
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

const fields = [];
const prefs = read(PREFS);
document.querySelectorAll('.start-doctor').forEach(doctor => {
  doctor.append($('runner-art').content.cloneNode(true));
});
TEAM_IDS.forEach((id, i) => {
  const label = element('label', 'team-field', '');
  label.dataset.team = id;
  const input = document.createElement('input');
  input.placeholder = 'กลุ่ม ' + id;
  input.maxLength = 24;
  input.setAttribute('aria-label', 'ชื่อกลุ่ม ' + id);
  input.value = typeof prefs?.[i] === 'string' ? prefs[i] : '';
  label.append(element('span', 'letter', id), input);
  $('team-fields').append(label);
  fields.push(input);
});
function updateResume() {
  const saved = restoreGame(read(SAVE)) || game;
  $('resume-game').hidden = !saved;
  if (saved) $('resume-game').textContent = ended(saved) || !remainingGameSeconds(saved)
    ? 'ดูผลเกมล่าสุด' : 'เล่นต่อ · เปิดแล้ว ' + saved.answers.filter(Boolean).length + ' / 25 ช่อง';
}
function teamRow(tag, className, id, name, amount) {
  const row = element(tag, className, '');
  row.dataset.team = id;
  row.title = name + ' · ' + amount + ' คะแนน';
  row.append(element('b', 'letter', id), element('span', 'score-name-full', name), element('strong', 'score-number-full', amount));
  return row;
}
function renderBoard() {
  const scores = teamScores(game);
  $('scores').replaceChildren(...TEAM_IDS.map((id, i) => {
    const row = teamRow('div', 'score-chip', id, game.teams[i], scores[id].toLocaleString('th-TH'));
    row.children[1].className = 'score-name';
    row.lastChild.className = 'score-number';
    return row;
  }));
  tiles.forEach((tile, id) => {
    const opened = !!game.answers[id];
    tile.classList.toggle('opened', opened);
    tile.disabled = opened || ended(game);
    tile.setAttribute('aria-label', 'ช่อง ' + (id % 5 + 1) + ' แถว ' + pointsFor(id) + ' คะแนน' + (opened ? ' เปิดแล้ว' : ''));
  });
  $('view-result').hidden = !ended(game);
  show('board');
  updateClock();
}
function updateClock() {
  const seconds = remainingGameSeconds(game);
  const time = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  $('elapsed').textContent = time;
  $('question-time').textContent = time;
}
function recordHistory() {
  const history = read(HISTORY);
  const entries = Array.isArray(history) ? history.filter(row => row.startedAt !== game.startedAt) : [];
  entries.unshift({teams: game.teams, scores: teamScores(game), startedAt: game.startedAt, finishedAt: game.finishedAt});
  save(HISTORY, entries.slice(0, 20));
}
function renderPodium(standings) {
  const winners = standings.filter(team => team.rank <= 3);
  const stage = $('awards-stage');
  stage.hidden = standings[0].score === 0;
  if (stage.hidden) { $('podium').replaceChildren(); return; }

  // Put the champion in the middle. Shared places have identical steps and cups.
  const gold = winners.filter(team => team.rank === 1);
  const others = winners.filter(team => team.rank !== 1);
  const middle = Math.ceil(others.length / 2);
  const positions = [...others.slice(0, middle), ...gold, ...others.slice(middle)];
  $('podium').replaceChildren(...positions.map(({id, name, rank, score}) => {
    const step = element('div', 'podium-step', '');
    step.dataset.team = id;
    step.dataset.place = rank;
    const cup = ['ทอง', 'เงิน', 'ทองแดง'][rank - 1];
    step.setAttribute('role', 'img');
    step.setAttribute('aria-label', name + ' อันดับ ' + rank + ' ถ้วย' + cup + ' ' + score + ' คะแนน');
    step.title = step.getAttribute('aria-label');
    const platform = element('div', 'platform', '');
    const label = element('div', 'podium-team', '');
    label.append(element('b', 'letter', id), element('span', 'podium-name', name));
    platform.append(element('strong', 'place-number', rank), label);
    step.append($('runner-art').content.cloneNode(true), platform);
    return step;
  }));
  if (!$('celebration').childElementCount) {
    for (let i = 0; i < 24; i++) {
      const piece = document.createElement('i');
      piece.style.left = ((i * 37 + 4) % 100) + '%';
      piece.style.setProperty('--delay', (i % 7) * .075 + 's');
      piece.style.setProperty('--tilt', (i % 2 ? 1 : -1) * (16 + i * 3) + 'deg');
      $('celebration').append(piece);
    }
  }
}
function showFinish() {
  const scores = teamScores(game);
  $('finish-reason').textContent = game.endReason === 'time-limit' ? 'หมดเวลา 15 นาที' : 'เปิดครบทั้ง 25 ช่องแล้ว';
  const order = TEAM_IDS.map((id, i) => ({id, name: game.teams[i], score: scores[id]}))
    .sort((a, b) => b.score - a.score);
  for (const entry of order) entry.rank = order.findIndex(other => other.score === entry.score) + 1;
  renderPodium(order);
  $('ranking').replaceChildren(...order.map(({id, name, rank, score}) => {
    const row = teamRow('li', 'rank-row', id, name, score.toLocaleString('th-TH') + ' คะแนน');
    const place = element('span', 'rank-position', rank);
    place.setAttribute('aria-label', 'อันดับ ' + rank);
    row.prepend(place);
    return row;
  }));
  if (!finish.open) finish.showModal();
}
function checkDeadline(now = Date.now()) {
  if (expireGame(game, now)) {
    persist();
    recordHistory();
    feedback.close();
    closeRace();
    if (screen === 'setup') updateResume();
    else { renderBoard(); showFinish(); }
  }
  return ended(game);
}
function choose(id) {
  const now = Date.now();
  if (!game || checkDeadline(now) || !openQuestion(game, id, now)) return;
  persist();
  showQuestion();
}
function showQuestion() {
  const {id} = game.active;
  const q = questions[id];
  $('question-points').textContent = pointsFor(id) + ' คะแนน · ช่อง ' + (id % 5 + 1);
  $('question-text').textContent = q.text;
  $('question-options').hidden = !q.options;
  $('question-options').replaceChildren(...(q.options || []).map(option => {
    const row = document.createElement('li');
    const split = option.indexOf(' ');
    row.append(element('b', '', option.slice(0, split)), element('span', '', option.slice(split + 1)));
    return row;
  }));
  const photo = $('question-photo');
  photo.hidden = !q.image;
  if (q.image) { photo.src = q.image; photo.alt = q.alt; }
  else { photo.removeAttribute('src'); photo.alt = ''; }
  $('question-content').classList.toggle('has-photo', !!q.image);
  $('question-content').classList.toggle('has-options', !!q.options);
  show('question');
  updateClock();
  $('question-text').focus({preventScroll: true});
  if (game.active.revealed) showAnswer();
}
function showAnswer() {
  const id = game.active.id;
  const q = questions[id];
  $('feedback-points').textContent = pointsFor(id) + ' คะแนน · ช่อง ' + (id % 5 + 1);
  $('feedback-answer').textContent = q.answer;
  $('feedback-source').hidden = !q.source;
  if (q.source) $('feedback-source').href = q.source;
  $('award-teams').replaceChildren(...TEAM_IDS.map((team, i) => {
    const button = teamRow('button', 'team-action', team, game.teams[i], '+' + pointsFor(id));
    button.onclick = () => award(team);
    return button;
  }));
  if (!feedback.open) feedback.showModal();
}
function award(team) {
  const now = Date.now();
  if (!game?.active || checkDeadline(now)) return;
  const points = pointsFor(game.active.id);
  if (!awardQuestion(game, team, now)) return;
  persist();
  feedback.close();
  renderBoard();
  if (ended(game)) recordHistory();
  if (team) showRace(team, points);
  else afterAward();
}
function afterAward() {
  if (ended(game)) showFinish();
  else tiles.find(tile => !tile.disabled)?.focus({preventScroll: true});
}
function closeRace() {
  clearTimeout(raceTimer);
  if (race.open) race.close();
}
function leaveRace() {
  if (!race.open) return;
  closeRace();
  if (checkDeadline() && finish.open) return;
  afterAward();
}
function showRace(team, points) {
  const scores = teamScores(game);
  const maxPoints = game.answers.reduce((sum, _, cell) => sum + pointsFor(cell), 0);
  const finishScore = ended(game) ? Math.max(...Object.values(scores)) : maxPoints;
  // A square-root scale makes the first few awards visible, even on a narrow track.
  const progress = (score, limit) => (100 * Math.sqrt(score / limit)).toFixed(3) + '%';
  const lanes = TEAM_IDS.map((id, i) => {
    const lane = element('li', 'race-lane', '');
    lane.dataset.team = id;
    const name = game.teams[i];
    const label = element('div', 'race-label', '');
    label.title = name;
    label.append(element('b', 'letter', id), element('span', 'race-name', name));
    const rail = element('div', 'race-rail', '');
    const position = element('div', 'race-position', '');
    const previous = id === team ? scores[id] - points : scores[id];
    const start = progress(previous, maxPoints);
    const end = progress(scores[id], finishScore);
    position.style.setProperty('--from', start);
    position.style.setProperty('--to', end);
    position.classList.toggle('moving', start !== end);
    position.append($('runner-art').content.cloneNode(true));
    rail.append(position);
    lane.classList.toggle('awarded', id === team);
    lane.append(label, rail, element('strong', 'lane-score', scores[id].toLocaleString('th-TH')));
    return lane;
  });
  $('race-lanes').replaceChildren(...lanes);
  $('race-title').textContent = game.teams[TEAM_IDS.indexOf(team)] + ' ได้คะแนน!';
  $('race-gain').textContent = '+' + points;
  $('race-next').textContent = ended(game) ? 'ดูผลคะแนน' : 'กลับสู่กระดาน';
  race.showModal();
  raceTimer = setTimeout(leaveRace, 3500);
}
$('race-next').onclick = leaveRace;
race.addEventListener('cancel', event => { event.preventDefault(); leaveRace(); });
$('setup-form').onsubmit = event => {
  event.preventDefault();
  const previous = restoreGame(read(SAVE)) || game;
  if (previous && !ended(previous) && remainingGameSeconds(previous) > 0 &&
      !window.confirm('เริ่มรอบใหม่แทนรอบที่กำลังเล่นอยู่หรือไม่?')) return;
  const names = fields.map(input => input.value.trim());
  save(PREFS, names);
  game = createGame(names);
  persist();
  renderBoard();
};
$('reveal').onclick = () => {
  const now = Date.now();
  if (checkDeadline(now) || !revealAnswer(game, now)) return;
  persist();
  showAnswer();
};
feedback.addEventListener('cancel', event => event.preventDefault());
$('skip').onclick = () => award(null);
function goToSetup() {
  updateResume();
  show('setup');
  fields[0].focus({preventScroll: true});
}
$('exit-game').onclick = goToSetup;
$('view-result').onclick = showFinish;
$('finish-view').onclick = () => finish.close();
$('finish-new').onclick = () => { finish.close(); goToSetup(); };
$('resume-game').onclick = () => {
  game = restoreGame(read(SAVE)) || game;
  if (!game) return;
  if (expireGame(game)) { persist(); recordHistory(); }
  renderBoard();
  if (ended(game)) showFinish();
  else if (game.active) showQuestion();
};
function tick() {
  if (!game || ended(game)) return;
  if (!checkDeadline() && screen !== 'setup') updateClock();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('storage', event => {
  if (event.key !== SAVE) return;
  const latest = restoreGame(read(SAVE));
  if (!latest) return;
  game = latest;
  if (screen === 'setup') { updateResume(); return; }
  feedback.close();
  finish.close();
  closeRace();
  renderBoard();
  if (checkDeadline()) showFinish();
  else if (game.active) showQuestion();
});
setInterval(tick, 250);
updateResume();
})();
