import { Chess } from './vendor/chess.mjs';

const example = `[Event "Partida de exemplo"]
[White "Brancas"]
[Black "Pretas"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Bc5 4. c3 a6 5. Ba4 Nf6 6. d3 h6
7. O-O d6 8. Re1 Ng4 9. d4 exd4 10. cxd4 Ba7 11. e5 dxe5 12. dxe5 O-O
13. Qxd8 Rxd8 14. Re2 Rd1+ 15. Bxd1 Nb4 16. Nc3 Nd3 17. Be3 Ndxe5
18. Bxa7 Nxf3+ 19. gxf3 Nxf2 20. Bxf2 Bg4 21. fxg4 1-0`;

const byId = id => document.getElementById(id);
const engineURL = new URL('./vendor/stockfish-17.1-lite-single-03e3232.js', import.meta.url);
const board = byId('board');
const chart = byId('chart');
const detail = byId('detail');
const importer = byId('importer');
const moveMark = byId('move-mark');
const nav = [...document.querySelectorAll('[data-nav]')];
let game, moves, positions, moveButtons;
let selected = 0;
let flipped = false;
let alternate = false;
let worker;
let cancelSearch;
let cancelPause;
let run = 0;
let evaluations = [];
let reviews = [];
let analysisFrame = 0;
const searchNodes = 10000;
const searchDepth = 13;
const categories = {
  best: { label: 'Melhor lance', symbol: '★' },
  excellent: { label: 'Excelente', symbol: '!' },
  good: { label: 'Bom lance', symbol: '' },
  inaccuracy: { label: 'Imprecisão', symbol: '?!' },
  mistake: { label: 'Erro', symbol: '?' },
  blunder: { label: 'Erro grave', symbol: '??' },
};
const pieceNames = { k: 'Rei', q: 'Dama', r: 'Torre', b: 'Bispo', n: 'Cavalo', p: 'Peão' };
const tiles = Array.from({ length: 64 }, (_, index) => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const tile = node('div', '', (file + rank) % 2 ? 'square dark' : 'square');
  const rankLabel = file === 0 ? node('span', '', 'rank') : null;
  const fileLabel = rank === 7 ? node('span', '', 'file') : null;
  const image = document.createElement('img');
  if (rankLabel) tile.append(rankLabel);
  if (fileLabel) tile.append(fileLabel);
  tile.append(image);
  board.append(tile);
  return { tile, image, rankLabel, fileLabel, file, rank, pieceKey: undefined };
});

function node(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function importGame(text, sample = false) {
  const next = new Chess();
  const clean = text.replace(/^\uFEFF/, '').replace(/\\(?=[.:/])/g, '').replace(/\\(?=\r?$)/gm, '');
  next.loadPgn(clean.trim());
  const history = next.history({ verbose: true });
  if (!history.length) throw new Error('PGN sem lances');
  stop();
  game = next;
  moves = history;
  positions = [moves[0].before, ...moves.map(move => move.after)];
  evaluations = [];
  reviews = [];
  byId('report').hidden = true;
  flipped = false;
  byId('game').textContent = sample ? 'Partida de exemplo · 1–0' :
    `${player('White')} × ${player('Black')} · ${game.getHeaders().Result || '*'}`;
  byId('status').textContent = 'Analise a partida para encontrar os lances decisivos.';
  renderMoves();
  go(0);
}

function player(color) {
  const headers = game.getHeaders();
  const name = headers[color] || (color === 'White' ? 'Brancas' : 'Pretas');
  return headers[color + 'Elo'] ? `${name} · ${headers[color + 'Elo']}` : name;
}

function renderMoves() {
  const rows = [];
  moveButtons = moves.map((move, index) => {
    const number = move.before.split(' ')[5];
    if (index === 0 || move.color === 'w') {
      const row = node('div', '', 'row');
      row.append(node('span', number + '.'));
      if (move.color === 'b') row.append(node('span', '…'));
      rows.push(row);
    }
    const review = reviews[index + 1];
    const button = node('button', move.san + (review?.symbol ? ' ' + review.symbol : ''), review?.style);
    if (review) button.title = review.label;
    button.onclick = () => go(index + 1);
    rows.at(-1).append(button);
    return button;
  });
  byId('moves').replaceChildren(...rows);
}

function squareCoordinates(square) {
  const x = square.charCodeAt(0) - 97;
  const y = 8 - Number(square[1]);
  return flipped ? [7 - x, 7 - y] : [x, y];
}

function showMoveMark(square, review) {
  moveMark.replaceChildren();
  if (!square || !review || alternate) return;
  const [file, rank] = squareCoordinates(square);
  const icons = { excellent: '👍', good: '✓' };
  const icon = node('span', icons[review.style] || review.symbol);
  const badge = node('span', '', 'move-mark ' + review.style);
  badge.append(icon);
  moveMark.style.left = `${(file + .8) * 12.5}%`;
  moveMark.style.top = `${(rank + .21) * 12.5}%`;
  moveMark.append(badge);
}

function drawBoard() {
  const review = reviews[selected];
  const position = new Chess(positions[alternate ? selected - 1 : selected]);
  let last = moves[selected - 1];
  if (alternate) last = playUci(position, review.best);
  let layout = position.board().flat();
  if (flipped) layout = layout.reverse();
  layout.forEach((piece, index) => {
    const cell = tiles[index];
    const { file, rank, tile, image, rankLabel, fileLabel } = cell;
    const square = `${'abcdefgh'[flipped ? 7 - file : file]}${flipped ? rank + 1 : 8 - rank}`;
    tile.classList.toggle('last', square === last?.from || square === last?.to);
    if (rankLabel && rankLabel.textContent !== square[1]) rankLabel.textContent = square[1];
    if (fileLabel && fileLabel.textContent !== square[0]) fileLabel.textContent = square[0];
    const pieceKey = piece ? piece.color + piece.type.toUpperCase() : '';
    if (pieceKey === cell.pieceKey && cell.square === square) return;
    image.hidden = !piece;
    if (piece) {
      if (pieceKey !== cell.pieceKey) image.src = `pieces/${pieceKey}.svg`;
      image.alt = `${pieceNames[piece.type]} (${piece.color === 'w' ? 'brancas' : 'pretas'}), ${square}`;
    }
    cell.pieceKey = pieceKey;
    cell.square = square;
  });
  const arrows = byId('arrows');
  showMoveMark(last?.to, review);
  arrows.replaceChildren();
  if (alternate && last) {
    const [x, y] = squareCoordinates(last.from);
    const [tx, ty] = squareCoordinates(last.to);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const length = Math.hypot(tx - x, ty - y);
    const dx = (tx - x) / length, dy = (ty - y) / length;
    const ex = tx + .5, ey = ty + .5;
    path.setAttribute('d', `M${x + .5} ${y + .5} L${ex} ${ey} m${-.45 * dx + .25 * dy} ${-.45 * dy - .25 * dx} L${ex} ${ey} l${-.45 * dx - .25 * dy} ${-.45 * dy + .25 * dx}`);
    path.setAttribute('stroke', '#e7ff80');
    path.setAttribute('stroke-width', '.14');
    path.setAttribute('fill', 'none');
    arrows.append(path);
  }
  byId('top').textContent = player(flipped ? 'White' : 'Black');
  byId('bottom').textContent = player(flipped ? 'Black' : 'White');
  const evaluation = alternate ? evaluations[selected - 1] : evaluations[selected];
  byId('score').textContent = alternate ? '—' : formatScore(evaluation);
  const ratio = 50 + 50 * Math.tanh((alternate ? 0 : (evaluation?.value ?? 0)) / 400);
  byId('balance').style.height = `${flipped ? 100 - ratio : ratio}%`;
  byId('balance').style.background = flipped ? '#161b18' : '';
  byId('balance').parentElement.style.background = flipped ? '#eeefe5' : '';
}

function formatScore(evaluation) {
  if (!evaluation) return '—';
  if (evaluation.type === 'mate') return evaluation.value < 0 ? '−M' + Math.abs(evaluation.raw) : 'M' + Math.abs(evaluation.raw);
  return `${evaluation.value > 0 ? '+' : ''}${(evaluation.value / 100).toFixed(1)}`;
}

function playUci(position, uci) {
  return position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

function suggestedLine(review) {
  const position = new Chess(positions[selected - 1]);
  const continuation = review.pv?.[0] === review.best ? review.pv.slice(0, 5) : [review.best];
  return continuation.map(uci => playUci(position, uci).san).join(' ');
}

function explainError(move, reply) {
  const continuation = reply?.pv?.[0] === reply?.best ? reply?.pv : [reply?.best].filter(Boolean);
  if (!continuation?.length) return null;
  const position = new Chess(move.after);
  const line = continuation.slice(0, 6).map(uci => playUci(position, uci));
  const [first, recapture, followUp] = line;
  const opponent = move.color === 'w' ? 'As pretas' : 'As brancas';
  let explanation = `${opponent} podem responder com ${first.san}`;
  const trade = first.captured && recapture?.to === first.to && recapture.captured === first.captured;
  if (trade && first.captured === 'q') explanation += ', propondo a troca de damas';
  else if (first.captured) explanation += `, capturando ${pieceNames[first.captured].toLowerCase()} em ${first.to}`;
  if (first.san.endsWith('#')) explanation += ' e dando mate';
  else if (first.san.endsWith('+')) explanation += ' com xeque';

  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const balance = line.reduce((total, step) => {
    const gain = (values[step.captured] || 0) + (step.promotion ? values[step.promotion] - 1 : 0);
    return total + (step.color === move.color ? -gain : gain);
  }, 0);
  explanation += '.';
  if (trade && followUp?.captured) {
    explanation += ` Após ${recapture.san}, ${followUp.san} captura ${pieceNames[followUp.captured].toLowerCase()} em ${followUp.to}.`;
  }
  if (line.length > 1 && position.isCheckmate()) {
    explanation += ` Nessa sequência, ${position.turn() === 'w' ? 'as brancas' : 'as pretas'} levam mate.`;
  } else if (balance > 0 && !position.isCheckmate()) {
    explanation += ` Nessa sequência, quem jogou perde material líquido equivalente a ${balance} ${balance === 1 ? 'peão' : 'peões'}.`;
  }
  return { explanation, line: line.map(step => `${step.before.split(' ')[5]}${step.color === 'w' ? '.' : '...'} ${step.san}`).join(' ') };
}

function renderDetail() {
  const move = moves[selected - 1];
  const review = reviews[selected];
  const title = move ? `${move.before.split(' ')[5]}${move.color === 'b' ? '...' : '.'} ${move.san}` : 'Posição inicial';
  const head = node('strong', title);
  detail.replaceChildren(head);
  if (!review) {
    detail.append(node('p', selected ? 'A avaliação deste lance aparece após a análise.' : 'Selecione um lance no gráfico ou na lista.'));
    return;
  }
  head.append(node('span', ' · ' + review.label, 'tag ' + review.style));
  detail.append(node('p', `Avaliação das brancas: ${formatScore(evaluations[selected - 1])} → ${formatScore(evaluations[selected])}`));
  if (review.style === 'mistake' || review.style === 'blunder') {
    const reason = explainError(move, evaluations[selected]);
    if (reason) {
      detail.append(node('p', reason.explanation), node('p', `Linha após o erro: ${reason.line}`));
    }
  }
  if (review.best && review.style !== 'best') {
    const line = node('p', '');
    line.hidden = true;
    const button = node('button', alternate ? 'Voltar ao lance jogado' : 'Mostrar melhor lance');
    button.onclick = () => {
      alternate = !alternate;
      drawBoard();
      if (alternate && !line.textContent) line.textContent = `Linha sugerida: ${suggestedLine(review)}`;
      line.hidden = !alternate;
      button.textContent = alternate ? 'Voltar ao lance jogado' : 'Mostrar melhor lance';
    };
    detail.append(line, button);
  }
}

function drawChart() {
  const scale = window.devicePixelRatio || 1;
  const pixelWidth = Math.round(chart.clientWidth * scale);
  const pixelHeight = Math.round(chart.clientHeight * scale);
  if (chart.width !== pixelWidth) chart.width = pixelWidth;
  if (chart.height !== pixelHeight) chart.height = pixelHeight;
  const ctx = chart.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  ctx.clearRect(0, 0, width, height);
  const x = index => 4 + index * (width - 8) / moves.length;
  const y = value => height / 2 - Math.tanh(value / 400) * (height / 2 - 5);
  ctx.strokeStyle = '#66756a';
  ctx.beginPath();
  ctx.moveTo(4, y(0));
  ctx.lineTo(width - 4, y(0));
  ctx.stroke();
  if (evaluations.length) {
    ctx.beginPath();
    evaluations.forEach(({ value }, index) => {
      if (index === 0) ctx.moveTo(x(index), y(value));
      else ctx.lineTo(x(index), y(value));
    });
    ctx.strokeStyle = '#d2ea91';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x(selected), 4);
  ctx.lineTo(x(selected), height - 4);
  ctx.strokeStyle = '#e8eee8aa';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function go(index) {
  moveButtons[selected - 1]?.removeAttribute('aria-current');
  selected = Math.max(0, Math.min(index, moves.length));
  alternate = false;
  moveButtons[selected - 1]?.setAttribute('aria-current', 'true');
  moveButtons[selected - 1]?.scrollIntoView({ block: 'nearest', container: 'nearest' });
  nav.forEach((button, i) => button.disabled = i < 2 ? selected === 0 : selected === moves.length);
  drawBoard();
  renderDetail();
  drawChart();
}

function stop() {
  run++;
  cancelAnimationFrame(analysisFrame);
  analysisFrame = 0;
  cancelSearch?.();
  cancelPause?.();
  worker?.terminate();
  worker = undefined;
  byId('analyze').textContent = 'Analisar partida';
  byId('progress').hidden = true;
  byId('critical').disabled = !reviews.some(review => review.loss >= 100);
}

function pauseBetweenSearches(elapsed) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      cancelPause = undefined;
      resolve();
    }, Math.max(40, elapsed * 1.5));
    cancelPause = () => {
      clearTimeout(timer);
      cancelPause = undefined;
      resolve();
    };
  });
}

function send(engine, commands, complete, parse = () => {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('Tempo limite do motor')), 20000);
    const finish = error => {
      clearTimeout(timeout);
      cancelSearch = undefined;
      engine.onmessage = null;
      engine.onerror = null;
      if (error) reject(error);
    };
    cancelSearch = () => finish(new Error('Análise interrompida'));
    engine.onerror = () => finish(new Error('Falha ao carregar Stockfish'));
    engine.onmessage = ({ data }) => {
      const line = String(data);
      parse(line);
      if (line.startsWith(complete)) {
        finish();
        resolve(line);
      }
    };
    commands.forEach(command => engine.postMessage(command));
  });
}

async function evaluate(engine, index) {
  const fen = positions[index];
  const side = fen.split(' ')[1] === 'w' ? 1 : -1;
  const position = new Chess(fen);
  if (position.isCheckmate()) return { type: 'mate', raw: 0, value: -side * 10000 };
  if (position.isDraw()) return { type: 'cp', raw: 0, value: 0 };
  let evaluation;
  // Include the played move history so the engine can reason about repetitions.
  const played = moves.slice(0, index).map(move => move.lan).join(' ');
  const command = `position fen ${positions[0]}${played ? ' moves ' + played : ''}`;
  const best = await send(engine, [command, `go depth ${searchDepth} nodes ${searchNodes}`], 'bestmove', line => {
    const score = line.match(/\bscore (cp|mate) (-?\d+)/);
    if (!score || /\b(?:upperbound|lowerbound)\b/.test(line)) return;
    const raw = Number(score[2]) * side;
    const pv = line.split(' pv ')[1]?.trim().split(/\s+/) || [];
    const value = score[1] === 'mate' ? Math.sign(raw) * (10000 - Math.abs(raw)) : raw;
    evaluation = { type: score[1], raw, value, pv };
  });
  if (!evaluation) throw new Error('Avaliação indisponível');
  evaluation.best = best.split(' ')[1];
  return evaluation;
}

function classify(index) {
  const before = evaluations[index - 1];
  const after = evaluations[index];
  const move = moves[index - 1];
  const side = move.color === 'w' ? 1 : -1;
  const loss = move.lan === before.best ? 0 : Math.max(0, (before.value - after.value) * side);
  let style = 'good';
  if (move.lan === before.best) style = 'best';
  else if (loss >= 200) style = 'blunder';
  else if (loss >= 100) style = 'mistake';
  else if (loss >= 50) style = 'inaccuracy';
  else if (loss < 20) style = 'excellent';
  return { loss, style, ...categories[style], best: before.best, pv: before.pv };
}

function renderReport() {
  const counts = Object.fromEntries(Object.keys(categories).map(style => [style, { w: 0, b: 0 }]));
  reviews.forEach((review, index) => counts[review.style][moves[index - 1].color]++);
  const rows = Object.entries(categories).map(([style, { label, symbol }]) => {
    const row = node('tr', '');
    const title = node('th', [symbol, label].filter(Boolean).join(' '), style);
    title.scope = 'row';
    row.append(title, node('td', counts[style].w), node('td', counts[style].b));
    return row;
  });
  byId('report-counts').replaceChildren(...rows);
  byId('report').hidden = false;
}

async function analyze() {
  if (worker) {
    stop();
    renderMoves();
    go(selected);
    byId('status').textContent = 'Análise interrompida.';
    return;
  }
  const current = ++run;
  evaluations = [];
  reviews = [];
  byId('report').hidden = true;
  renderMoves();
  go(selected);
  const progress = byId('progress');
  progress.max = positions.length;
  progress.value = 0;
  progress.hidden = false;
  byId('critical').disabled = true;
  byId('analyze').textContent = 'Interromper análise';
  byId('status').textContent = 'Carregando Stockfish…';
  try {
    const engine = worker = new Worker(engineURL);
    await send(engine, ['uci'], 'uciok');
    let lastUpdate = 0;
    for (let index = 0; index < positions.length && current === run; index++) {
      const started = performance.now();
      const result = await evaluate(engine, index);
      if (current !== run) return;
      evaluations.push(result);
      if (index) reviews[index] = classify(index);
      const now = performance.now();
      if (!analysisFrame && now - lastUpdate >= 200) {
        lastUpdate = now;
        analysisFrame = requestAnimationFrame(() => {
          analysisFrame = 0;
          progress.value = evaluations.length;
          byId('status').textContent = `Analisando posições · ${evaluations.length}/${positions.length}`;
          drawChart();
        });
      }
      // Slow searches leave a proportionally longer interval for the browser.
      if (index + 1 < positions.length) await pauseBetweenSearches(now - started);
    }
    if (current !== run) return;
    byId('status').textContent = 'Análise rápida concluída';
    renderReport();
    const firstError = reviews.findIndex(review => review?.loss >= 100);
    if (firstError > 0 && selected === 0) selected = firstError;
  } catch (error) {
    if (current !== run) return;
    console.error(error);
    byId('status').textContent = 'Não foi possível concluir a análise. Tente novamente.';
  } finally {
    if (current === run) {
      stop();
      renderMoves();
      go(selected);
    }
  }
}

byId('open').onclick = () => {
  byId('import-error').textContent = '';
  importer.showModal();
};
byId('close').onclick = () => importer.close();
byId('import-form').onsubmit = async event => {
  event.preventDefault();
  try {
    const file = byId('file').files[0];
    const pasted = byId('pgn').value.trim();
    importGame(pasted || (file ? await file.text() : ''));
    event.target.reset();
    importer.close();
  } catch {
    byId('import-error').textContent = 'PGN inválido. Copie o texto completo da aba PGN ou selecione o arquivo exportado.';
  }
};
byId('analyze').onclick = analyze;
byId('flip').onclick = () => { flipped = !flipped; drawBoard(); };
byId('critical').onclick = () => {
  const next = reviews.findIndex((review, index) => index > selected && review?.loss >= 100);
  go(next > 0 ? next : reviews.findIndex(review => review?.loss >= 100));
};
nav.forEach((button, i) => button.onclick = () => go([0, selected - 1, selected + 1, moves.length][i]));
document.addEventListener('keydown', event => {
  if (importer.open || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  go(selected + (event.key === 'ArrowLeft' ? -1 : 1));
});
chart.onclick = event => go(Math.round((event.offsetX - 4) / (chart.clientWidth - 8) * moves.length));
new ResizeObserver(drawChart).observe(chart);
importGame(example, true);
