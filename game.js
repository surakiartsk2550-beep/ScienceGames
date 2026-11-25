(function () {
  'use strict';
  const TEAM_IDS = ['A', 'B', 'C', 'D', 'E'];
  const GAME_DURATION_MS = 15 * 60 * 1000;
  const pointsFor = id => (5 - Math.floor(id / 5)) * 100;
  const isCell = id => Number.isInteger(id) && id >= 0 && id < 25;
  const ended = game => game.finishedAt !== null;
  function createGame(names, now = Date.now()) {
    return {
      version: 2,
      teams: TEAM_IDS.map((id, i) => names[i]?.trim().slice(0, 24) || 'กลุ่ม ' + id),
      startedAt: now, finishedAt: null, active: null, answers: Array(25).fill(null)
    };
  }
  function teamScores(game) {
    const scores = Object.fromEntries(TEAM_IDS.map(id => [id, 0]));
    game.answers.forEach((answer, i) => {
      if (answer?.team) scores[answer.team] += pointsFor(i);
    });
    return scores;
  }
  function remainingGameSeconds(game, now = Date.now()) {
    return Math.max(0, Math.ceil((game.startedAt + GAME_DURATION_MS - (game.finishedAt ?? now)) / 1000));
  }
  function expireGame(game, now = Date.now()) {
    const deadline = game.startedAt + GAME_DURATION_MS;
    if (ended(game) || now < deadline) return false;
    if (game.active) game.answers[game.active.id] = {team: null};
    game.active = null;
    game.finishedAt = deadline;
    game.endReason = 'time-limit';
    return true;
  }
  function openQuestion(game, id, now = Date.now()) {
    if (expireGame(game, now) || ended(game) || game.active || !isCell(id) || game.answers[id]) return false;
    game.active = {id, revealed: false};
    return true;
  }
  function revealAnswer(game, now = Date.now()) {
    if (expireGame(game, now) || ended(game) || !game.active || game.active.revealed) return false;
    game.active.revealed = true;
    return true;
  }
  function awardQuestion(game, team, now = Date.now()) {
    if (expireGame(game, now) || ended(game) || !game.active?.revealed) return false;
    if (team !== null && !TEAM_IDS.includes(team)) return false;
    game.answers[game.active.id] = {team};
    game.active = null;
    if (game.answers.every(Boolean)) {
      game.finishedAt = now;
      game.endReason = 'completed';
    }
    return true;
  }
  function restoreGame(value) {
    if (value?.version !== 2 || !Number.isFinite(value.startedAt)) return null;
    if (!Array.isArray(value.teams) || value.teams.length !== 5 ||
        !value.teams.every(name => typeof name === 'string' && name.trim() && name.length <= 24)) return null;
    if (!Array.isArray(value.answers) || value.answers.length !== 25 ||
        !value.answers.every(item => item === null || (item && (item.team === null || TEAM_IDS.includes(item.team))))) return null;
    if (value.finishedAt !== null && !Number.isFinite(value.finishedAt)) return null;
    if (value.active !== null && (!isCell(value.active?.id) || typeof value.active.revealed !== 'boolean' ||
        value.answers[value.active.id] || ended(value))) return null;
    return value;
  }
  globalThis.RICEGame = Object.freeze({
    TEAM_IDS, GAME_DURATION_MS, pointsFor, createGame, teamScores, ended, remainingGameSeconds,
    expireGame, openQuestion, revealAnswer, awardQuestion, restoreGame
  });
})();
