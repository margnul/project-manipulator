import GameBase from "../GameBase.js"

const BACKEND = 'http://127.0.0.1:8081'

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const SYMBOLS = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
}

class Chess extends GameBase {

  // ─── GameBase обязательные ────────────────────────────────────────

  initDesks() {
    this.deskCount   = 1
    this.deskColumns = 8
    this.deskRows    = 8
  }

  gameInit() {
    this.gameId        = null
    this.selectedFrom  = null
    this.validMoves    = []
    this.piecesState   = []
    this.turnState     = 'white'
    this.statusState   = 'ongoing'
    this.inCheck       = false
    this.uciHistory    = []
    this.capturedWhite = []
    this.capturedBlack = []
    this._panelEl      = null   // создаётся в _buildUI

    this._injectCSS()
    this._buildUI()
    this._createGame()
  }

  // ─── Активация / деактивация ──────────────────────────────────────

  activateGame() {
    super.activateGame()
    // Включаем chess-layout в .desks только когда шахматы видны
    Object.assign(this.desks.style, {
      display:        'flex',
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '20px',
      padding:        '12px',
      boxSizing:      'border-box',
      overflow:       'hidden',
    })
    if (this._panelEl) this._panelEl.style.display = 'flex'
    // Загружаем состояние доски 2 с бэка
    this._loadBoardStateFromBackend()
  }

  deactivateGame() {
    super.deactivateGame()
    // Сбрасываем ВСЕ inline-стили — CSS файл сам восстановит нужные значения
    this.desks.style.cssText = ''
    if (this._panelEl) this._panelEl.style.display = 'none'
  }

  async gameLogic(row, column) {
    if (this.statusState !== 'ongoing') return

    const piece = this._pieceAt(row, column)

    if (this.selectedFrom) {
      const isValid = this.validMoves.some(m => m.row === row && m.col === column)
      if (isValid) { await this._sendMove(this.selectedFrom.row, this.selectedFrom.col, row, column); return }
      if (piece && piece.color === this.turnState) { await this._selectPiece(row, column); return }
      this._deselect()
      return
    }

    if (piece && piece.color === this.turnState) await this._selectPiece(row, column)
  }

  onCommandSent() {}

  // ─── Сеть ─────────────────────────────────────────────────────────

  async _createGame() {
    try {
      const res  = await fetch(`${BACKEND}/api/chess/new`, { method: 'POST' })
      const data = await res.json()
      this.gameId = data.game_id
      this._applyState(data.state)
    } catch (e) { console.error('Не удалось создать партию:', e) }
  }

  async _loadBoardStateFromBackend() {
    try {
      const res = await fetch(`${BACKEND}/api/chess/boards`)
      const data = await res.json()
      if (data.ok) {
        console.log('Состояние доски 2 загружено с бэка')
      }
    } catch (e) {
      console.error('Ошибка загрузки состояния доски:', e)
    }
  }

  async _selectPiece(row, col) {
    this.selectedFrom = { row, col }
    try {
      const res  = await fetch(`${BACKEND}/api/chess/moves?game_id=${this.gameId}&from_row=${row}&from_col=${col}`)
      const data = await res.json()
      this.validMoves = data.moves || []
    } catch { this.validMoves = [] }
    this._render()
  }

  async _sendMove(fr, fc, tr, tc) {
    const piece     = this._pieceAt(fr, fc)
    const isPromo   = piece?.type === 'pawn' && (tr === 7 || tr === 0)
    const promotion = isPromo ? await this._askPromotion() : null

    try {
      const res  = await fetch(`${BACKEND}/api/chess/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: this.gameId, from_row: fr, from_col: fc, to_row: tr, to_col: tc, promotion }),
      })
      const data = await res.json()
      if (data.ok) {
        this._trackCapture(fr, fc, tr, tc)
        this._applyState(data.state)
        if (data.state.status !== 'ongoing') this._showModal(data.state)
      }
    } catch (e) { console.error('Сетевая ошибка:', e) }

    this.selectedFrom = null
    this.validMoves   = []
  }

  _deselect() {
    this.selectedFrom = null
    this.validMoves   = []
    this._render()
  }

  // ─── Состояние ────────────────────────────────────────────────────

  _applyState(state) {
    this.piecesState  = state.pieces
    this.turnState    = state.turn
    this.statusState  = state.status
    this.inCheck      = state.in_check
    this.uciHistory   = state.history || []
    this.selectedFrom = null
    this.validMoves   = []
    this._render()
    this._updatePanel()
  }

  _pieceAt(row, col) {
    return this.piecesState.find(p => p.row === row && p.col === col) ?? null
  }

  _trackCapture(fr, fc, tr, tc) {
    const captured = this._pieceAt(tr, tc)
    if (captured) {
      (captured.color === 'black' ? this.capturedWhite : this.capturedBlack).push(captured.type)
    }
    const moving = this._pieceAt(fr, fc)
    if (moving?.type === 'pawn' && fc !== tc && !captured) {
      (moving.color === 'white' ? this.capturedWhite : this.capturedBlack).push('pawn')
    }
  }

  // ─── Отрисовка доски ──────────────────────────────────────────────

  _render() {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = this._cell(row, col)
        cell.style.setProperty('background-color', (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863')
        cell.style.setProperty('--background-image', '')
        cell.classList.remove('image', 'chess-dot', 'chess-ring', 'chess-check')
      }
    }

    this.validMoves.forEach(({ row, col }) => {
      this._cell(row, col).classList.add(this._pieceAt(row, col) ? 'chess-ring' : 'chess-dot')
    })

    if (this.selectedFrom) {
      const { row, col } = this.selectedFrom
      this._cell(row, col).style.setProperty('background-color', (row + col) % 2 === 0 ? '#cdd26a' : '#aaa23a')
    }

    if (this.inCheck) {
      const king = this.piecesState.find(p => p.color === this.turnState && p.type === 'king')
      if (king) this._cell(king.row, king.col).classList.add('chess-check')
    }

    this.piecesState.forEach(({ row, col, color, type }) => {
      const cell = this._cell(row, col)
      cell.classList.add('image')
      cell.style.setProperty('--background-image', `url("${this._pieceSvg(color, type)}")`)
    })
  }

  _cell(row, col) {
    return this.desk[0].cells[(this.deskRows - 1 - row) * this.deskColumns + col]
  }

  // ─── Панель ───────────────────────────────────────────────────────

  _updatePanel() {
    const isWhite = this.turnState === 'white'
    const ongoing = this.statusState === 'ongoing'

    document.getElementById('cp-white')?.classList.toggle('cp-active', isWhite && ongoing)
    document.getElementById('cp-black')?.classList.toggle('cp-active', !isWhite && ongoing)

    const ws = document.getElementById('cp-white-status')
    const bs = document.getElementById('cp-black-status')
    if (ws) ws.textContent = ongoing ? (isWhite  ? '● ход' : '') : ''
    if (bs) bs.textContent = ongoing ? (!isWhite ? '● ход' : '') : ''

    const wc = document.getElementById('cp-white-cap')
    const bc = document.getElementById('cp-black-cap')
    if (wc) wc.textContent = this._formatCap(this.capturedWhite)
    if (bc) bc.textContent = this._formatCap(this.capturedBlack)

    const list = document.getElementById('cp-history')
    if (!list) return
    list.innerHTML = ''
    for (let i = 0; i < this.uciHistory.length; i += 2) {
      const row = document.createElement('div')
      row.className = 'cp-hist-row'
      row.innerHTML = `
        <span class="cp-hist-num">${Math.floor(i / 2) + 1}.</span>
        <span>${this.uciHistory[i] ?? ''}</span>
        <span>${this.uciHistory[i + 1] ?? ''}</span>`
      list.appendChild(row)
    }
    list.scrollTop = list.scrollHeight
  }

  _formatCap(list) {
    const map = { queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    return ['queen','rook','bishop','knight','pawn']
      .flatMap(t => { const n = list.filter(x => x === t).length; return n ? [map[t].repeat(n)] : [] })
      .join(' ')
  }

  // ─── Промоушн-диалог ──────────────────────────────────────────────

  _askPromotion() {
    return new Promise(resolve => {
      const overlay = document.createElement('div')
      overlay.className = 'chess-modal-overlay'
      overlay.innerHTML = `
        <div class="chess-modal-box">
          <div class="chess-modal-title" style="margin-bottom:20px">Превращение пешки</div>
          <div style="display:flex;gap:12px;justify-content:center">
            ${['queen','rook','bishop','knight'].map(t =>
              `<button class="chess-promo-btn" data-type="${t}">${SYMBOLS.white[t]}</button>`
            ).join('')}
          </div>
        </div>`
      document.body.appendChild(overlay)
      overlay.querySelectorAll('.chess-promo-btn').forEach(btn =>
        btn.addEventListener('click', () => { document.body.removeChild(overlay); resolve(btn.dataset.type) })
      )
    })
  }

  // ─── Финальный модал ──────────────────────────────────────────────

  _showModal(state) {
    const isCheckmate = state.status === 'checkmate'
    const winner      = state.winner === 'white' ? 'Белые' : 'Чёрные'
    const overlay = document.createElement('div')
    overlay.className = 'chess-modal-overlay'
    overlay.innerHTML = `
      <div class="chess-modal-box">
        <div class="chess-modal-icon">${isCheckmate ? (state.winner === 'white' ? '♔' : '♚') : '🤝'}</div>
        <div class="chess-modal-title">${isCheckmate ? `Мат! Победили ${winner}` : 'Пат — ничья'}</div>
        <div class="chess-modal-sub">${isCheckmate ? `${winner} поставили мат` : 'Нет допустимых ходов'}</div>
        <button class="chess-modal-btn" id="chess-modal-restart">Новая партия</button>
      </div>`
    document.body.appendChild(overlay)
    document.getElementById('chess-modal-restart').addEventListener('click', () => {
      document.body.removeChild(overlay)
      this._newGame()
    })
  }

  async _newGame() {
    this.capturedWhite = []
    this.capturedBlack = []
    this.uciHistory    = []
    await this._createGame()
  }

  // ─── Физическая доска ────────────────────────────────────────────

  async _loadPhysicalBoard() {
    try {
      const res = await fetch(`${BACKEND}/api/chess/physical-board`)
      const data = await res.json()
      return data.pieces || []
    } catch (e) {
      console.error('Ошибка загрузки физической доски:', e)
      return []
    }
  }

  async _savePhysicalBoard(pieces) {
    try {
      const res = await fetch(`${BACKEND}/api/chess/update-physical-board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieces }),
      })
      const data = await res.json()
      return data.ok
    } catch (e) {
      console.error('Ошибка сохранения физической доски:', e)
      return false
    }
  }

  _showPhysicalBoardEditor() {
    const overlay = document.createElement('div')
    overlay.className = 'chess-editor-overlay'
    const self = this

    let editingPieces = []

    const buildEditor = () => {
      const board = document.createElement('div')
      board.className = 'chess-editor-board'

      for (let row = 7; row >= 0; row--) {
        for (let col = 0; col < 8; col++) {
          const cell = document.createElement('div')
          cell.className = 'chess-editor-cell'
          cell.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863'

          const piece = editingPieces.find(p => p.row === row && p.col === col)
          if (piece) {
            cell.textContent = SYMBOLS[piece.color][piece.type]
            cell.classList.add('chess-editor-piece')
          }

          cell.addEventListener('click', () => _showPieceMenu(row, col, piece, cell))
          board.appendChild(cell)
        }
      }

      return board
    }

    const _showPieceMenu = (row, col, currentPiece, cell) => {
      const menu = document.createElement('div')
      menu.className = 'chess-editor-menu'
      menu.innerHTML = `
        <div class="chess-editor-menu-title">Клетка ${String.fromCharCode(65 + col)}${row + 1}</div>
        <button class="chess-editor-menu-btn" data-action="remove">Убрать фигуру</button>
        <div style="margin: 8px 0; border-top: 1px solid #ddd;"></div>
        <div class="chess-editor-menu-pieces">
          ${['white', 'black'].map(color => `
            <div class="chess-editor-color-group">
              <div class="chess-editor-color-label">${color === 'white' ? 'Белые' : 'Чёрные'}</div>
              ${['king','queen','rook','bishop','knight','pawn'].map(type => `
                <button class="chess-editor-piece-btn" data-row="${row}" data-col="${col}" data-color="${color}" data-type="${type}">
                  ${SYMBOLS[color][type]}
                </button>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `

      menu.querySelector('[data-action="remove"]').addEventListener('click', () => {
        editingPieces = editingPieces.filter(p => !(p.row === row && p.col === col))
        boardContainer.innerHTML = ''
        boardContainer.appendChild(buildEditor())
        document.body.removeChild(menu)
      })

      menu.querySelectorAll('.chess-editor-piece-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const r = parseInt(e.target.dataset.row)
          const c = parseInt(e.target.dataset.col)
          const color = e.target.dataset.color
          const type = e.target.dataset.type

          editingPieces = editingPieces.filter(p => !(p.row === r && p.col === c))
          editingPieces.push({ row: r, col: c, color, type })

          boardContainer.innerHTML = ''
          boardContainer.appendChild(buildEditor())
          document.body.removeChild(menu)
        })
      })

      document.body.appendChild(menu)
    }

    const boardContainer = document.createElement('div')
    boardContainer.appendChild(buildEditor())

    overlay.innerHTML = `
      <div class="chess-editor-modal">
        <div class="chess-editor-modal-header">
          <h2>Редактирование физической доски</h2>
          <button class="chess-editor-close" id="chess-editor-close">✕</button>
        </div>
        <div class="chess-editor-modal-body" id="chess-editor-body"></div>
        <div class="chess-editor-modal-footer">
          <button class="chess-editor-btn chess-editor-cancel" id="chess-editor-cancel">Отмена</button>
          <button class="chess-editor-btn chess-editor-save" id="chess-editor-save">Сохранить</button>
        </div>
      </div>
    `

    const body = overlay.querySelector('#chess-editor-body')
    body.appendChild(boardContainer)

    overlay.querySelector('#chess-editor-close').addEventListener('click', () => document.body.removeChild(overlay))
    overlay.querySelector('#chess-editor-cancel').addEventListener('click', () => document.body.removeChild(overlay))
    overlay.querySelector('#chess-editor-save').addEventListener('click', async () => {
      const saved = await self._savePhysicalBoard(editingPieces)
      if (saved) {
        document.body.removeChild(overlay)
      } else {
        alert('Ошибка сохранения')
      }
    })

    document.body.appendChild(overlay)
  }

  _pieceSvg(color, type) {
    const sym  = SYMBOLS[color][type]
    const fill = color === 'white' ? 'white' : '%23222'
    const strk = color === 'white' ? '%23555' : 'white'
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><text x='22' y='36' font-size='32' text-anchor='middle' fill='${fill}' stroke='${strk}' stroke-width='1.2' paint-order='stroke' font-family='serif'>${sym}</text></svg>`
  }

  // ─── UI-сборка ────────────────────────────────────────────────────

  _buildUI() {
    // Скрываем кнопку MOVE
    setTimeout(() => {
      const ctrl = document.querySelector('.controls')
      if (ctrl) ctrl.style.display = 'none'
    }, 0)

    // Класс для переопределения стилей доски
    this.gameScreen.classList.add('chess-mode')

    // Файловая нотация под доской
    const filesBar = document.createElement('div')
    filesBar.className = 'cp-files'
    FILES.forEach(f => {
      const s = document.createElement('span'); s.textContent = f; filesBar.appendChild(s)
    })
    this.gameScreen.appendChild(filesBar)

    // Боковая панель
    const panel = document.createElement('div')
    this._panelEl = panel
    panel.className = 'cp-panel'
    panel.innerHTML = `
      <div class="cp-player" id="cp-black">
        <span class="cp-piece">♚</span>
        <div class="cp-info">
          <div class="cp-name">Чёрные</div>
          <div class="cp-cap" id="cp-black-cap"></div>
        </div>
        <div class="cp-indicator" id="cp-black-status"></div>
      </div>
      <div class="cp-history-wrap">
        <div class="cp-hist-header">История ходов</div>
        <div class="cp-history" id="cp-history"></div>
      </div>
      <div class="cp-player" id="cp-white">
        <span class="cp-piece">♔</span>
        <div class="cp-info">
          <div class="cp-name">Белые</div>
          <div class="cp-cap" id="cp-white-cap"></div>
        </div>
        <div class="cp-indicator" id="cp-white-status"></div>
      </div>
      <button class="cp-new-btn" id="cp-new-btn">↺ Новая партия</button>
      <button class="cp-new-btn" id="cp-edit-board-btn" style="background: #5c5c7a;">⚙ Редакт. доску</button>
    `
    this.desks.appendChild(panel)
    document.getElementById('cp-new-btn').addEventListener('click', () => this._newGame())
    document.getElementById('cp-edit-board-btn').addEventListener('click', () => this._showPhysicalBoardEditor())
  }

  // ─── CSS ──────────────────────────────────────────────────────────

  _injectCSS() {
    if (document.getElementById('chess-styles')) return
    const s = document.createElement('style')
    s.id = 'chess-styles'
    s.textContent = `
      /* ── Board overrides ─────────────────── */
      .chess-mode {
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px !important;
        flex: 0 0 auto !important;
        width: auto !important;
      }
      .chess-mode .desk__wrapper {
        width: min(100%, min(65vh, 520px)) !important;
        height: min(100%, min(65vh, 520px)) !important;
      }
      .chess-mode .desk__cells {
        gap: 0 !important;
        padding: 6px !important;
        background: #3d2410 !important;
        border-radius: 6px !important;
        box-shadow: 0 0 0 2px #5c3a20, 0 10px 36px rgba(0,0,0,.45) !important;
      }
      .chess-mode .desk__cell {
        border-radius: 3px !important;
        cursor: pointer !important;
        transition: filter .1s !important;
      }
      .chess-mode .desk__cell:hover { filter: brightness(1.18) !important; }
      .chess-mode .desk__cell.image {
        background-size: 86% 86% !important;
        background-repeat: no-repeat !important;
        background-position: center !important;
      }

      /* ── Move indicators ─────────────────── */
      .chess-dot::after {
        content: ''; position: absolute;
        width: 30%; height: 30%;
        background: rgba(0,0,0,.22); border-radius: 50%;
        top: 50%; left: 50%; transform: translate(-50%,-50%);
        z-index: 10; pointer-events: none;
      }
      .chess-ring::after {
        content: ''; position: absolute; inset: 3px;
        border: 4px solid rgba(0,0,0,.28); border-radius: 3px;
        z-index: 10; pointer-events: none;
      }
      .chess-check {
        background: radial-gradient(circle, #ff6b6b 0%, #c00 80%) !important;
      }

      /* ── Files ───────────────────────────── */
      .cp-files {
        display: flex;
        width: min(100%, min(65vh, 520px));
        padding: 0 6px; box-sizing: border-box;
      }
      .cp-files span {
        flex: 1; text-align: center;
        font-size: 11px; font-weight: 700;
        color: #8b7355; letter-spacing: .05em; user-select: none;
      }

      /* ── Side panel ──────────────────────── */
      .cp-panel {
        width: 185px; flex-shrink: 0;
        display: flex; flex-direction: column; gap: 10px;
        align-self: stretch;
      }

      .cp-player {
        background: #fff; border-radius: 12px;
        padding: 11px 14px;
        display: flex; align-items: center; gap: 10px;
        border: 2px solid transparent;
        box-shadow: 0 2px 8px rgba(0,0,0,.08);
        transition: border-color .2s, box-shadow .2s;
      }
      .cp-player.cp-active {
        border-color: #7bc67e;
        box-shadow: 0 2px 14px rgba(123,198,126,.35);
      }
      .cp-piece { font-size: 26px; line-height: 1; user-select: none; }
      .cp-info  { flex: 1; overflow: hidden; }
      .cp-name  { font-weight: 700; font-size: 13px; color: #2c2c2c; }
      .cp-cap   { font-size: 11px; color: #888; margin-top: 2px; min-height: 14px; }
      .cp-indicator { font-size: 11px; font-weight: 700; color: #7bc67e; white-space: nowrap; }

      .cp-history-wrap {
        flex: 1; background: #fff; border-radius: 12px;
        padding: 11px 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,.08);
        display: flex; flex-direction: column;
        min-height: 80px; overflow: hidden;
      }
      .cp-hist-header {
        font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
        color: #bbb; margin-bottom: 8px;
      }
      .cp-history {
        flex: 1; overflow-y: auto;
        display: flex; flex-direction: column; gap: 2px;
        scrollbar-width: thin;
      }
      .cp-hist-row {
        display: grid; grid-template-columns: 22px 1fr 1fr;
        gap: 4px; font-size: 12px; font-family: monospace; align-items: baseline;
      }
      .cp-hist-num { color: #ccc; }
      .cp-hist-row span { color: #555; }
      .cp-hist-row:last-child span { font-weight: 700; color: #222; }

      .cp-new-btn {
        background: #5c7a5c; color: #fff; border: none;
        border-radius: 10px; padding: 10px;
        font-size: 13px; font-weight: 700; cursor: pointer;
        transition: background .15s; width: 100%;
      }
      .cp-new-btn:hover { background: #4a6a4a; }

      /* ── Modals ──────────────────────────── */
      .chess-modal-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 3000; backdrop-filter: blur(4px);
      }
      .chess-modal-box {
        background: #fff; border-radius: 20px; padding: 44px 52px;
        text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,.35);
        animation: chess-pop .3s cubic-bezier(.34,1.56,.64,1);
      }
      @keyframes chess-pop { from { transform: scale(.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      .chess-modal-icon  { font-size: 60px; margin-bottom: 12px; }
      .chess-modal-title { font-size: 26px; font-weight: 800; color: #222; margin-bottom: 6px; }
      .chess-modal-sub   { font-size: 15px; color: #888; margin-bottom: 28px; }
      .chess-modal-btn {
        background: #5c7a5c; color: #fff; border: none;
        border-radius: 12px; padding: 13px 30px;
        font-size: 15px; font-weight: 700; cursor: pointer;
        transition: background .15s;
      }
      .chess-modal-btn:hover { background: #4a6a4a; }

      .chess-promo-btn {
        font-size: 40px; background: #f5f5f5;
        border: 2px solid #ddd; border-radius: 10px;
        padding: 10px 14px; cursor: pointer; transition: all .12s;
      }
      .chess-promo-btn:hover { background: #e8f5e9; border-color: #7bc67e; transform: scale(1.1); }

      /* ── Editor ──────────────────────────── */
      .chess-editor-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,.6);
        display: flex; align-items: center; justify-content: center;
        z-index: 3000; backdrop-filter: blur(4px);
      }
      .chess-editor-modal {
        background: #fff; border-radius: 20px;
        width: 90%; max-width: 600px;
        display: flex; flex-direction: column;
        max-height: 90vh; overflow: hidden;
        box-shadow: 0 24px 64px rgba(0,0,0,.35);
      }
      .chess-editor-modal-header {
        padding: 20px; border-bottom: 1px solid #eee;
        display: flex; justify-content: space-between; align-items: center;
      }
      .chess-editor-modal-header h2 { margin: 0; font-size: 20px; }
      .chess-editor-close {
        background: none; border: none; font-size: 28px;
        cursor: pointer; color: #999; transition: color .2s;
      }
      .chess-editor-close:hover { color: #333; }
      .chess-editor-modal-body {
        padding: 20px; overflow-y: auto; flex: 1;
        display: flex; justify-content: center;
      }
      .chess-editor-board {
        display: grid; grid-template-columns: repeat(8, 1fr);
        gap: 0; background: #3d2410; padding: 6px; border-radius: 6px;
        box-shadow: 0 0 0 2px #5c3a20;
      }
      .chess-editor-cell {
        aspect-ratio: 1; display: flex; align-items: center;
        justify-content: center; position: relative;
        border-radius: 3px; cursor: pointer;
        font-size: 32px; user-select: none;
        transition: filter .1s;
      }
      .chess-editor-cell:hover { filter: brightness(1.18); }
      .chess-editor-menu {
        position: fixed; background: #fff; border-radius: 12px;
        padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,.3);
        z-index: 3001; min-width: 250px;
        animation: chess-pop .2s cubic-bezier(.34,1.56,.64,1);
      }
      .chess-editor-menu-title {
        font-weight: 700; margin-bottom: 8px; padding-bottom: 8px;
        border-bottom: 1px solid #eee; font-size: 12px;
      }
      .chess-editor-menu-btn {
        display: block; width: 100%; background: #f5f5f5;
        border: 1px solid #ddd; border-radius: 6px; padding: 8px;
        cursor: pointer; font-size: 12px; margin-bottom: 8px;
        transition: background .15s;
      }
      .chess-editor-menu-btn:hover { background: #efefef; }
      .chess-editor-color-group {
        margin-bottom: 10px;
      }
      .chess-editor-color-label {
        font-size: 11px; font-weight: 700; color: #888;
        text-transform: uppercase; letter-spacing: .05em;
        margin-bottom: 6px;
      }
      .chess-editor-piece-btn {
        background: #f5f5f5; border: 1px solid #ddd;
        border-radius: 6px; padding: 6px; cursor: pointer;
        font-size: 20px; margin-right: 4px; margin-bottom: 4px;
        transition: all .12s; display: inline-block;
      }
      .chess-editor-piece-btn:hover {
        background: #e8f5e9; border-color: #7bc67e; transform: scale(1.15);
      }
      .chess-editor-modal-footer {
        padding: 16px; border-top: 1px solid #eee;
        display: flex; gap: 12px; justify-content: flex-end;
      }
      .chess-editor-btn {
        border: none; border-radius: 8px; padding: 10px 20px;
        font-size: 14px; font-weight: 700; cursor: pointer;
        transition: background .15s;
      }
      .chess-editor-cancel {
        background: #f5f5f5; color: #333;
      }
      .chess-editor-cancel:hover { background: #efefef; }
      .chess-editor-save {
        background: #5c7a5c; color: #fff;
      }
      .chess-editor-save:hover { background: #4a6a4a; }
    `
    document.head.appendChild(s)
  }
}

export default Chess
