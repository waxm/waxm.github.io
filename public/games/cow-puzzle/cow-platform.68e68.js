(function () {
  'use strict';
  if (!new URLSearchParams(window.location.search).get('ctxId')) return;
  var sdk = window.Sig;
  var raceSeconds = 300, initialScore = 300026;
  var disposed = false, failed = false, loaded = false, lobbySeen = false;
  var epoch = null, captain = '', seats = [], joined = false, readied = null, autoJoin = true, autoReady = true;
  var seq = 0, revision = -1, localScore = initialScore, finished = false, pendingStart = null, resultRequested = false, blocked = false;
  var clockOrigin = Date.now(), clockTick = performance.now(), lastServerNow = 0;
  var lastView = '', lastViewAt = -Infinity;
  var subscriptions = [], listeners = new Set(), inflight = new Map();
  var state = { phase: 'waiting', connected: false, canAct: false, spectator: true,
    canStart: false, matchId: '', startedAt: 0, deadlineAt: 0, score: initialScore, players: [], message: '正在进入房间…', view: null };
  function now() { return clockOrigin + performance.now() - clockTick; }
  function syncClock(value) {
    if (!Number.isSafeInteger(value) || value < lastServerNow) return;
    lastServerNow = value; clockOrigin = value; clockTick = performance.now();
  }
  function send(command, meta) {
    if (disposed || failed) return false;
    try {
      var receipt = sdk.net.send(command);
      if (meta && receipt && receipt.cmdId) inflight.set(receipt.cmdId, meta);
      return true;
    } catch (_) { state.message = '发送暂未完成，请等待连接恢复'; state.canAct = false; return false; }
  }
  function action(type, value, view) {
    if (!state.matchId || state.spectator || state.phase !== 'playing') return;
    var data = { abi: 'pf.score.v1', type: type, matchId: state.matchId, seq: ++seq };
    if (type === 'view') data.data = value;
    else data.score = value;
    if (type === 'finish' && view) data.view = view;
    return send({ t: 'action', data: data }, { type: type, score: value, seq: seq, matchId: state.matchId });
  }
  function publish() {
    if (disposed) return;
    state.connected = !!sdk && sdk.net.state === 'online';
    state.canAct = state.connected && state.phase === 'playing' && !state.spectator && !finished && !blocked && state.deadlineAt > now();
    var mine = seats.find(function (seat) { return seat.uid === sdk.ctx.selfUid; });
    state.canStart = state.connected && loaded && state.phase === 'waiting' && !state.matchId && !state.spectator &&
      captain === sdk.ctx.selfUid && !!mine && !!mine.isReady && seats.every(function (seat) { return seat.isReady; });
    listeners.forEach(function (listener) { listener(state); });
  }
  function advanceLobby() {
    if (!loaded || state.matchId || epoch === null || !state.connected) return;
    var mine = seats.find(function (seat) { return seat.uid === sdk.ctx.selfUid; });
    if (autoJoin && !state.spectator && !mine && !joined) { joined = true; send({ t: 'join', seat: -1 }); }
    if (autoReady && !state.spectator && mine && !mine.isReady && readied !== epoch) {
      readied = epoch; send({ t: 'ready', ready: true, lobbyEpoch: epoch });
    }
    if (pendingStart !== null && state.canStart) {
      if (pendingStart === 0 || pendingStart === epoch) send({ t: 'start', lobbyEpoch: epoch }, { type: 'start' });
      pendingStart = null;
    }
  }
  function requestStart() {
    if (state.matchId || (captain && captain !== sdk.ctx.selfUid)) return;
    pendingStart = epoch === null ? 0 : epoch;
    publish(); advanceLobby();
  }
  function finish(value, view) {
    if (!Number.isSafeInteger(value) || value < 1 || value > initialScore || (view && !validView(view))) return;
    if (finished || state.spectator || state.phase !== 'playing') return;
    finished = true;
    action('finish', value, view);
    publish();
  }
  function end(payload, aborted) {
    if (payload && payload.matchId && state.matchId && payload.matchId !== state.matchId) return;
    if (payload && typeof payload.matchId === 'string' && !state.matchId) state.matchId = payload.matchId;
    state.phase = 'finished'; finished = true; state.canAct = false;
    state.message = aborted ? '本局已作废' : '本局已结束';
    if (payload && Array.isArray(payload.results)) {
      state.players = payload.results.filter(function (p) { return p && typeof p.uid === 'string' && Number.isSafeInteger(p.score) && p.score >= 1 && p.score <= initialScore; }).slice(0, 6)
        .map(function (p) { var seat = seats.find(function (s) { return s.uid === p.uid; });
          return { uid: p.uid, nick: seat && seat.nick || p.uid, score: p.score, rank: p.rank }; });
      var me = state.players.find(function (p) { return p.uid === sdk.ctx.selfUid; });
      if (me) state.score = me.score;
    }
    sdk.notify(sdk.GAME_STATES.STATE, { state: 'settling' }); publish();
  }
  function validView(value) {
    return value && Number.isInteger(value.levelIndex) && value.levelIndex >= 0 && value.levelIndex < 5 &&
      value.hearts === 3 && Number.isSafeInteger(value.levelId) && value.levelId > 0 &&
      Number.isSafeInteger(value.elapsedMs) && value.elapsedMs >= 0 && value.elapsedMs <= raceSeconds * 1000 &&
      Number.isSafeInteger(value.blockedUntil) && value.blockedUntil >= 0 && value.blockedUntil <= state.deadlineAt &&
      Number.isSafeInteger(value.score) && value.score >= 1 && value.score <= initialScore &&
      Array.isArray(value.cells) && value.cells.length === 36 &&
      value.cells.every(function (cell) { return ['empty', 'mark', 'question', 'cow', 'wrong'].indexOf(cell) >= 0; });
  }
  function receiveCustom(value) {
    if (!value || value.abi !== 'pf.score.v1' || value.matchId !== state.matchId) return;
    if (value.type === 'scene') {
      if (state.spectator && validView(value.scene)) { state.view = value.scene; publish(); }
      return;
    }
    if (['board', 'snapshot'].indexOf(value.type) < 0 || !Number.isSafeInteger(value.revision) || value.revision < revision ||
      !Number.isSafeInteger(value.endsAt) || !Array.isArray(value.board) || value.board.length > 6 || value.endsAt < 0 || value.endsAt - now() > 600000 ||
      value.board.some(function (p) { return !p || typeof p.uid !== 'string' || !Number.isSafeInteger(p.score) || p.score < 1 || p.score > initialScore; })) return;
    if (value.scoreOrder !== 'asc' || Math.abs(value.endsAt - state.startedAt - raceSeconds * 1000) > 1000) {
      blocked = true; state.message = '比赛配置不匹配，请使用五关竞速配置'; publish(); return;
    }
    revision = value.revision;
    syncClock(value.now);
    state.startedAt = value.endsAt - raceSeconds * 1000;
    state.deadlineAt = value.endsAt;
    state.players = value.board.map(function (p) { var seat = seats.find(function (s) { return s.uid === p.uid; });
      return { uid: p.uid, nick: seat && seat.nick || p.uid, score: p.score }; });
    var me = value.board.find(function (p) { return p.uid === sdk.ctx.selfUid; });
    if (me) state.score = me.score;
    if (value.self && Number.isSafeInteger(value.self.lastSeq)) {
      seq = Math.max(seq, value.self.lastSeq);
      // 刷新没有完整棋盘可恢复，按服务端已确认分结束，不能从首题再刷一次。
      if (!lobbySeen && me && !value.self.finished && !value.ended) {
        localScore = me.score; state.message = '页面已重新载入，按已确认进度结束本局'; finish(me.score);
      }
      if (value.self.finished) finished = true;
    }
    if (state.spectator && validView(value.scene)) state.view = value.scene;
    if (value.ended) { blocked = true; if (!resultRequested) { resultRequested = true; send({ t: 'snapshot', matchId: state.matchId }); } }
    publish();
  }
  function bindRoom() {
    var frames = sdk.ROOM_FRAMES;
    subscriptions.push(sdk.net.on(frames.ROLE, function (value) {
      if (!value || ['player', 'spectator'].indexOf(value.role) < 0) return;
      state.spectator = value.role === 'spectator'; publish(); advanceLobby();
    }));
    subscriptions.push(sdk.net.on(frames.SEAT_LIST, function (value) {
      seats = Array.isArray(value) ? value.filter(function (s) { return s && typeof s.uid === 'string' && s.uid.length > 0; }).slice(0, 6) : [];
      if (!state.matchId) state.players = seats.map(function (s) { return { uid: s.uid, nick: s.nick || s.uid, score: initialScore }; });
      publish(); advanceLobby();
    }));
    subscriptions.push(sdk.net.on(frames.CAPTAIN, function (value) { captain = value && value.uid || ''; publish(); advanceLobby(); }));
    subscriptions.push(sdk.net.on('game_state', function (value) {
      if (!value) return;
      if (value.state === 'idle' && Number.isSafeInteger(value.lobbyEpoch)) {
        if (state.matchId) { send({ t: 'snapshot', matchId: state.matchId }); return; }
        if (epoch !== null && epoch !== value.lobbyEpoch) pendingStart = null;
        epoch = value.lobbyEpoch; lobbySeen = true; state.message = '随机相同5关，比较完成用时';
        publish(); advanceLobby();
      } else if (value.state === 'settling' && state.matchId) { blocked = true; if (!resultRequested) { resultRequested = true; send({ t: 'snapshot', matchId: state.matchId }); } }
    }));
    subscriptions.push(sdk.net.on(frames.MATCH, function (value) {
      if (!value || typeof value.matchId !== 'string' || !value.matchId) return;
      if (state.matchId && state.matchId !== value.matchId) return;
      if (!Number.isSafeInteger(value.startedAt) || value.startedAt < 0) return;
      state.matchId = value.matchId; state.startedAt = value.startedAt;
      if (state.phase !== 'finished') state.phase = 'playing';
      syncClock(value.serverNow);
      pendingStart = null;
      sdk.notify(sdk.GAME_STATES.STATE, { state: 'playing' }); publish();
    }));
    subscriptions.push(sdk.net.on(frames.CUSTOM, receiveCustom));
    subscriptions.push(sdk.net.on(frames.SETTLE, function (value) { end(value, false); }));
    subscriptions.push(sdk.net.on(frames.ABORTED, function (value) { end(value, true); }));
    subscriptions.push(sdk.net.on(frames.RESULT, function (value) {
      if (!value || value.matchId !== state.matchId) return;
      if (value.view) receiveCustom(value.view);
      end(value.settlement, false);
    }));
    function answer(accepted) { return function (_, frame) {
      if (!frame || !frame.cmdId) return;
      var meta = inflight.get(frame.cmdId); inflight.delete(frame.cmdId);
      if (!meta) { if (!accepted && frame.err) { state.message = frame.err; publish(); } return; }
      if (meta.matchId && meta.matchId !== state.matchId) return;
      if (!accepted && meta.type !== 'view' && meta.type !== 'finish') {
        state.message = frame.err || '操作未被平台受理';
        if (meta.type === 'score') { blocked = true; send({ t: 'snapshot', matchId: state.matchId }); }
      }
      publish();
    }; }
    subscriptions.push(sdk.net.on(frames.ACK, answer(true)), sdk.net.on(frames.ERROR, answer(false)));
    subscriptions.push(sdk.on(sdk.HOST_STATES.GAME_START, requestStart));
    subscriptions.push(sdk.on(sdk.HOST_STATES.SELF_IN, function (value) {
      if (!value || typeof value.isIn !== 'boolean' || state.matchId) return;
      autoJoin = value.isIn;
      if (!value.isIn) { joined = true; send({ t: 'leave' }); }
      else if (epoch !== null) { joined = true; send({ t: 'join', seat: Number.isInteger(value.seatIndex) ? value.seatIndex : -1 }); }
    }));
    subscriptions.push(sdk.on(sdk.HOST_STATES.SELF_READY, function (value) {
      if (!value || typeof value.isReady !== 'boolean' || state.matchId) return;
      autoReady = value.isReady;
      if (loaded && epoch !== null && !state.spectator) { readied = epoch; send({ t: 'ready', ready: value.isReady, lobbyEpoch: epoch }); }
    }));
    subscriptions.push(sdk.on(sdk.HOST_STATES.UI_CONFIG, publish));
  }
  window.cowPlatform = {
    state: state, now: now,
    subscribe: function (listener) { listeners.add(listener); listener(state); return function () { listeners.delete(listener); }; },
    ready: function () { loaded = true; sdk.notify(sdk.GAME_STATES.LOAD_PROGRESS, { percent: 100 }); publish(); advanceLobby(); },
    start: function () { if (sdk.ui.resolveClick('lobby.startBtn').handled === 'game') requestStart(); },
    score: function (value) {
      if (!state.canAct || !Number.isSafeInteger(value) || value < 1 || value > initialScore) return;
      if (value !== localScore) { localScore = value; action('score', value); }
    },
    finish: finish,
    publishView: function (value) {
      if (!state.canAct || !validView(value) || now() - lastViewAt < 100) return;
      var key = JSON.stringify(value); if (key === lastView) return;
      lastView = key; lastViewAt = now(); action('view', value);
    },
    close: function () { if (sdk.ui.resolveClick('settle.closeBtn').handled === 'game') sdk.notify(sdk.GAME_STATES.UI_CLICK, { slot: 'settle.closeBtn' }); }
  };
  function report(event) {
    if (disposed || failed || !event.detail) return;
    if (event.detail.stage === 'home-loading') sdk.notify(sdk.GAME_STATES.LOAD_PROGRESS, { percent: 55 });
  }
  function retry(event) {
    if (!failed || disposed) return;
    event.preventDefault(); event.stopImmediatePropagation(); window.location.reload();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; subscriptions.forEach(function (off) { off(); }); listeners.clear(); inflight.clear();
    window.removeEventListener('cow-startup', report); window.removeEventListener('cow-startup-retry', retry, true);
    window.removeEventListener('pagehide', dispose); window.removeEventListener('cow-competition-tick', tick);
    if (sdk) sdk.destroy();
  }
  window.addEventListener('cow-startup-retry', retry, true);
  window.addEventListener('cow-startup', report);
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', function (event) { if (event.persisted && disposed) window.location.reload(); });
  function tick() { if (!disposed && !failed && sdk) { publish(); advanceLobby(); } }
  window.addEventListener('cow-competition-tick', tick);
  window.cowPlatformReady = Promise.resolve().then(async function () {
    if (disposed) return;
    if (!sdk) throw new Error('SIG Game Kit 未加载');
    await sdk.init({ gameKey: 'contest', gameVersion: '0.3.0' });
    if (disposed) return;
    await sdk.loadConfig();
    if (disposed) return;
    var query = new URLSearchParams(window.location.search);
    var roomId = query.get('roomId'), roomUrl = query.get('roomUrl');
    if (!roomId || !roomUrl) throw new Error('SIG宿主未提供房间和游戏服地址');
    bindRoom();
    sdk.connectRoom({ roomId: roomId, url: roomUrl, gameKey: 'contest' });
  });
  window.cowPlatformReady.catch(function () { failed = true; });
}());
