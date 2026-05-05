import GameBase from "../GameBase.js"

const BACKEND = 'http://127.0.0.1:8081'

const SYMBOLS = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
}

class Mover extends GameBase {
  initDesks() {
    this.deskCount = 2
    this.deskColumns = 8
    this.deskRows = 8
  }

  gameInit() {
    this.board1 = []  // съеденные фигуры
    this.board2 = []  // активная партия
    this.selectedPiece = null
    this.selectedCell = null
    this.isDirty = false

    this._injectCSS()
    this._loadBoardsFromBackend()
    this._buildUI()
  }

  activateGame() {
    super.activateGame()
    Object.assign(this.desks.style, {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '20px',
      padding: '12px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      flexWrap: 'wrap',
      width: '100%',
      maxWidth: '100%',
    })
    if (this._panelEl) this._panelEl.style.display = 'flex'
    this._render()
  }

  deactivateGame() {
    super.deactivateGame()
    this.desks.style.cssText = ''
    if (this._panelEl) this._panelEl.style.display = 'none'
  }

  // ─── Загрузка и сохранение ────────────────────────────────────────

  async _loadBoardsFromBackend() {
    try {
      const res = await fetch(`${BACKEND}/api/chess/boards`)
      const data = await res.json()
      if (data.ok) {
        this.board1 = data.board1
        this.board2 = data.board2
        this.isDirty = false
      }
    } catch (e) {
      console.error('Ошибка загрузки досок:', e)
    }
    this._render()
  }

  async _saveBoardsToBackend() {
    try {
      const res = await fetch(`${BACKEND}/api/chess/boards-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board1: this.board1, board2: this.board2 }),
      })
      const data = await res.json()
      if (data.ok) {
        this.isDirty = false
        alert('Состояние досок сохранено')
      } else {
        alert('Ошибка: ' + data.error)
      }
    } catch (e) {
      console.error('Ошибка сохранения досок:', e)
      alert('Ошибка сохранения')
    }
  }

  // ─── Логика игры ──────────────────────────────────────────────────

  gameLogic(row, column, deskNum) {
    const pieces = deskNum === 0 ? this.board1 : this.board2
    const piece = pieces.find(p => p.row === row && p.col === column)

    // Выбираем фигуру
    if (piece) {
      if (this.selectedPiece && this.selectedPiece.deskNum === deskNum &&
          this.selectedPiece.row === row && this.selectedPiece.col === column) {
        this.selectedPiece = null
      } else {
        this.selectedPiece = { row, col: column, deskNum, data: piece }
      }
      this.selectedCell = null
    } else {
      // Выбираем пустую клетку для перемещения
      if (this.selectedPiece) {
        this.selectedCell = { row, col: column, deskNum }
      } else {
        this.selectedCell = null
      }
    }

    this._render()
  }

  // ─── Перемещение фигур (локальное) ─────────────────────────────────

  _movePieceLocal(fromBoard, fromRow, fromCol, toBoard, toRow, toCol) {
    const pieces = fromBoard === 0 ? this.board1 : this.board2
    const pieceFinder = pieces.findIndex(p => p.row === fromRow && p.col === fromCol)

    if (pieceFinder === -1) return

    const piece = pieces[pieceFinder]
    pieces.splice(pieceFinder, 1)

    const targetPieces = toBoard === 0 ? this.board1 : this.board2
    // Убираем фигуру на целевой клетке если она есть
    const targetIdx = targetPieces.findIndex(p => p.row === toRow && p.col === toCol)
    if (targetIdx !== -1) {
      targetPieces.splice(targetIdx, 1)
    }

    targetPieces.push({ row: toRow, col: toCol, color: piece.color, type: piece.type })

    // Не отправляем на бэкенд - только локальное перемещение
    this.selectedPiece = null
    this.selectedCell = null
    this._render()
  }

  onCommandSent() {}

  // ─── Отрисовка ────────────────────────────────────────────────────

  _render() {
    for (let deskNum = 0; deskNum < 2; deskNum++) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const cell = this._cell(row, col, deskNum)
          cell.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863'
          cell.classList.remove('mover-selected', 'mover-target')
          cell.textContent = ''

          // Подсвечиваем выбранную фигуру
          if (this.selectedPiece && this.selectedPiece.deskNum === deskNum &&
              this.selectedPiece.row === row && this.selectedPiece.col === col) {
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#cdd26a' : '#aaa23a'
            cell.classList.add('mover-selected')
          }

          // Подсвечиваем целевую клетку
          if (this.selectedCell && this.selectedCell.deskNum === deskNum &&
              this.selectedCell.row === row && this.selectedCell.col === col) {
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#b5cde8' : '#8bb8e8'
            cell.classList.add('mover-target')
          }
        }
      }

      // Отрисовываем фигуры
      const pieces = deskNum === 0 ? this.board1 : this.board2
      pieces.forEach(piece => {
        const cell = this._cell(piece.row, piece.col, deskNum)
        cell.textContent = SYMBOLS[piece.color][piece.type]
        cell.style.fontSize = '32px'
        cell.style.cursor = 'pointer'
      })
    }
  }

  _cell(row, col, deskNum) {
    return this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + col]
  }

  // ─── UI-сборка ────────────────────────────────────────────────────

  _buildUI() {
    const panel = document.createElement('div')
    this._panelEl = panel
    panel.className = 'mover-panel'
    panel.innerHTML = `
      <div class="mover-panel-header">
        <h2>Синхронизация досок</h2>
      </div>
      <div class="mover-panel-content">
        <div class="mover-board-info">
          <div class="mover-board-title">Доска 1 (съеденные)</div>
          <div class="mover-board-count" id="mover-board1-count">Фигур: 0</div>
        </div>
        <div class="mover-board-info">
          <div class="mover-board-title">Доска 2 (активная партия)</div>
          <div class="mover-board-count" id="mover-board2-count">Фигур: 32</div>
        </div>
      </div>
      <div class="mover-panel-help">
        <p style="font-size: 12px; color: #666; margin: 10px 0;">
          Выберите фигуру на одной доске и нажмите на клетку чтобы её переместить
        </p>
      </div>
      <div class="mover-panel-footer">
        <button class="mover-btn mover-btn-sync" id="mover-sync-btn">💾 Сохранить</button>
        <button class="mover-btn mover-btn-reload" id="mover-reload-btn">🔄 Перезагрузить</button>
      </div>
    `
    this.desks.appendChild(panel)

    document.getElementById('mover-sync-btn').addEventListener('click', () => this._saveBoardsToBackend())
    document.getElementById('mover-reload-btn').addEventListener('click', () => this._loadBoardsFromBackend())
  }

  _updatePanelInfo() {
    const b1 = document.getElementById('mover-board1-count')
    const b2 = document.getElementById('mover-board2-count')
    if (b1) b1.textContent = `Фигур: ${this.board1.length}`
    if (b2) b2.textContent = `Фигур: ${this.board2.length}`
  }

  _render() {
    for (let deskNum = 0; deskNum < 2; deskNum++) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const cell = this._cell(row, col, deskNum)
          cell.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863'
          cell.classList.remove('mover-selected', 'mover-target')
          cell.textContent = ''
          cell.style.fontSize = ''
          cell.style.cursor = 'pointer'
          cell.style.display = 'flex'
          cell.style.alignItems = 'center'
          cell.style.justifyContent = 'center'

          if (this.selectedPiece && this.selectedPiece.deskNum === deskNum &&
              this.selectedPiece.row === row && this.selectedPiece.col === col) {
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#cdd26a' : '#aaa23a'
            cell.classList.add('mover-selected')
          }

          if (this.selectedCell && this.selectedCell.deskNum === deskNum &&
              this.selectedCell.row === row && this.selectedCell.col === col) {
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#b5cde8' : '#8bb8e8'
            cell.classList.add('mover-target')
            if (this.selectedPiece) {
              cell.style.cursor = 'pointer'
              cell.title = 'Нажмите для перемещения'
              cell.onclick = () => {
                // Перемещение только локально, без отправки на бэкенд
                this._movePieceLocal(
                  this.selectedPiece.deskNum,
                  this.selectedPiece.row,
                  this.selectedPiece.col,
                  this.selectedCell.deskNum,
                  this.selectedCell.row,
                  this.selectedCell.col
                )
              }
            }
          }
        }
      }

      const pieces = deskNum === 0 ? this.board1 : this.board2
      pieces.forEach(piece => {
        const cell = this._cell(piece.row, piece.col, deskNum)
        cell.textContent = SYMBOLS[piece.color][piece.type]
        cell.style.fontSize = 'min(2.5cqw, 2.5cqh)'
      })
    }

    this._updatePanelInfo()
  }

  // ─── CSS ───────────────────────────────────────────────────────────

  _injectCSS() {
    if (document.getElementById('mover-styles')) return
    const s = document.createElement('style')
    s.id = 'mover-styles'
    s.textContent = `
      .desk__cell {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: hidden;
      }

      .mover-panel {
        width: 200px; flex-shrink: 0;
        display: flex; flex-direction: column; gap: 12px;
        align-self: flex-start;
      }

      .mover-panel-header {
        background: #fff; border-radius: 12px;
        padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
      }

      .mover-panel-header h2 {
        margin: 0; font-size: 16px; color: #222;
      }

      .mover-panel-content {
        background: #fff; border-radius: 12px;
        padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
        display: flex; flex-direction: column; gap: 10px;
      }

      .mover-board-info {
        padding: 10px; background: #f5f5f5;
        border-radius: 8px; border-left: 3px solid #5c7a5c;
      }

      .mover-board-title {
        font-weight: 700; font-size: 12px; color: #333;
        margin-bottom: 4px;
      }

      .mover-board-count {
        font-size: 13px; color: #666;
      }

      .mover-panel-help {
        background: #fff; border-radius: 12px;
        padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
      }

      .mover-panel-footer {
        background: #fff; border-radius: 12px;
        padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,.08);
        display: flex; gap: 8px;
      }

      .mover-btn {
        flex: 1; border: none; border-radius: 8px;
        padding: 10px; font-size: 12px; font-weight: 700;
        cursor: pointer; transition: background .15s;
        color: #fff;
      }

      .mover-btn-sync {
        background: #5c7a5c;
      }

      .mover-btn-sync:hover {
        background: #4a6a4a;
      }

      .mover-btn-reload {
        background: #5c6a7a;
      }

      .mover-btn-reload:hover {
        background: #4a5a6a;
      }

      .mover-selected {
        box-shadow: inset 0 0 0 3px #7bc67e !important;
      }

      .mover-target {
        box-shadow: inset 0 0 0 3px #4a90e2 !important;
      }
    `
    document.head.appendChild(s)
  }
}

export default Mover
