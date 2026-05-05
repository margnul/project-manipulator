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
    this.board1 = []  
    this.board2 = []  
    this.selectedPiece = null
    this.selectedCell = null
    this.isDirty = false

    this._injectCSS()
    this._buildUI()
  }

  activateGame() {
    super.activateGame()
    const ctrl = document.querySelector('.controls')
    if (ctrl) ctrl.style.display = 'flex'
    
    this._loadBoardsFromBackend()
  }

  deactivateGame() {
    super.deactivateGame()
  }

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
    
    this.selectedPiece = null
    this.selectedCell = null
    this.setCanSend(false)
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
        console.log('Бэкенд успешно обновлен (без движения манипулятора).')
      } else {
        alert('Ошибка обновления на бэкенде: ' + data.error)
      }
    } catch (e) {
      console.error('Ошибка сохранения досок:', e)
    }
  }

  gameLogic(row, column, deskNum) {
    const pieces = deskNum === 0 ? this.board1 : this.board2
    const piece = pieces.find(p => p.row === row && p.col === column)

    if (piece) {
      if (this.selectedPiece && this.selectedPiece.deskNum === deskNum &&
          this.selectedPiece.row === row && this.selectedPiece.col === column) {
        this.selectedPiece = null
      } else {
        this.selectedPiece = { row, col: column, deskNum, data: piece }
      }
      this.selectedCell = null
    } else {
      if (this.selectedPiece) {
        this.selectedCell = { row, col: column, deskNum }
      } else {
        this.selectedCell = null
      }
    }

    if (this.selectedPiece && this.selectedCell) {
      this.setCanSend(true)
    } else {
      this.setCanSend(false)
    }

    this._render()
  }

  async makeMove() {
    if (!this.canSend) return;

    this._movePieceLocal(
      this.selectedPiece.deskNum, this.selectedPiece.row, this.selectedPiece.col,
      this.selectedCell.deskNum, this.selectedCell.row, this.selectedCell.col
    );

    await this._saveBoardsToBackend();

    this.selectedPiece = null;
    this.selectedCell = null;
    this.setCanSend(false);
    this._render();
  }

  _movePieceLocal(fromBoard, fromRow, fromCol, toBoard, toRow, toCol) {
    const pieces = fromBoard === 0 ? this.board1 : this.board2
    const pieceFinder = pieces.findIndex(p => p.row === fromRow && p.col === fromCol)

    if (pieceFinder === -1) return

    const piece = pieces[pieceFinder]
    pieces.splice(pieceFinder, 1)

    const targetPieces = toBoard === 0 ? this.board1 : this.board2
    const targetIdx = targetPieces.findIndex(p => p.row === toRow && p.col === toCol)
    if (targetIdx !== -1) {
      targetPieces.splice(targetIdx, 1)
    }

    targetPieces.push({ row: toRow, col: toCol, color: piece.color, type: piece.type })
  }

  onCommandSent() {}

  _render() {
    for (let deskNum = 0; deskNum < 2; deskNum++) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const cell = this._cell(row, col, deskNum)
          cell.style.backgroundColor = (row + col) % 2 === 0 ? '#f0d9b5' : '#b58863'
          cell.classList.remove('mover-selected', 'mover-target')
          cell.textContent = ''
          cell.style.cursor = 'pointer'

          if (this.selectedPiece && this.selectedPiece.deskNum === deskNum &&
              this.selectedPiece.row === row && this.selectedPiece.col === col) {
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#cdd26a' : '#aaa23a'
            cell.classList.add('mover-selected')
          }

          if (this.selectedCell && this.selectedCell.deskNum === deskNum &&
              this.selectedCell.row === row && this.selectedCell.col === col) {
            cell.style.backgroundColor = (row + col) % 2 === 0 ? '#b5cde8' : '#8bb8e8'
            cell.classList.add('mover-target')
          }
        }
      }

      const pieces = deskNum === 0 ? this.board1 : this.board2
      pieces.forEach(piece => {
        const cell = this._cell(piece.row, piece.col, deskNum)
        cell.textContent = SYMBOLS[piece.color][piece.type]
      })
    }
    this._updatePanelInfo()
  }

  _cell(row, col, deskNum) {
    return this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + col]
  }

  _buildUI() {
    this.gameScreen.classList.add('mover-mode')

    const panel = document.createElement('div')
    this._panelEl = panel
    panel.className = 'mover-panel'
    panel.innerHTML = `
      <div class="mover-panel-header">
        <h2>Массивы Бэкенда</h2>
      </div>
      <div class="mover-panel-content">
        <div class="mover-board-info">
          <div class="mover-board-title">Доска 2 (Игровая)</div>
          <div class="mover-board-count" id="mover-board2-count">Фигур: 32</div>
        </div>
        <div class="mover-board-info" style="border-left-color: #8bb8e8;">
          <div class="mover-board-title">Доска 1 (Съеденные)</div>
          <div class="mover-board-count" id="mover-board1-count">Фигур: 0</div>
        </div>
      </div>
      <div class="mover-panel-help">
        <p style="font-size: 12px; color: #666; margin: 10px 0;">
          <b>Синхронизация:</b> Выделите фигуру, затем клетку и нажмите <b>MOVE</b> внизу экрана.
        </p>
      </div>
      <div class="mover-panel-footer">
        <button class="mover-btn mover-btn-reload" id="mover-reload-btn">🔄 Обновить с бэкенда</button>
      </div>
    `
    this.gameScreen.appendChild(panel)
    document.getElementById('mover-reload-btn').addEventListener('click', () => this._loadBoardsFromBackend())
  }

  _updatePanelInfo() {
    const b1 = document.getElementById('mover-board1-count')
    const b2 = document.getElementById('mover-board2-count')
    if (b1) b1.textContent = `Фигур: ${this.board1.length}`
    if (b2) b2.textContent = `Фигур: ${this.board2.length}`
  }

  _injectCSS() {
    if (document.getElementById('mover-styles')) return
    const s = document.createElement('style')
    s.id = 'mover-styles'
    s.textContent = `
      .mover-mode {
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 3vw !important;
        width: 100% !important;
        height: 100% !important;
      }

      /* Математически выверенные квадратные доски */
      .mover-mode .desk__wrapper {
        /* Ширина вычисляется как минимум между (половина свободного места без панели) и (60% высоты экрана) */
        width: min(calc((100% - 320px) / 2), 60vh) !important;
        height: auto !important; 
        aspect-ratio: 1 / 1 !important; /* Строгий квадрат */
        flex: 0 0 auto !important;
        position: relative;
        overflow: visible !important;
        container-type: inline-size; /* Позволяет шрифту внутри доски зависеть от её ширины */
        margin-top: 30px; /* Место под заголовки */
        min-width: 220px;
      }

      /* Выстраиваем элементы: Доска 2 -> Доска 1 -> Панель */
      .mover-mode .desk__wrapper[data-index="2"] { order: 1; }
      .mover-mode .desk__wrapper[data-index="1"] { order: 2; }
      .mover-panel { order: 3; }

      /* Заголовки досок */
      .mover-mode .desk__wrapper[data-index="2"]::before {
        content: "Доска 2 (Игровая)";
        position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
        font-weight: 800; font-size: clamp(14px, 5cqw, 18px); color: #3d2410; white-space: nowrap;
      }
      .mover-mode .desk__wrapper[data-index="1"]::before {
        content: "Доска 1 (Съеденные фигуры)";
        position: absolute; top: -30px; left: 50%; transform: translateX(-50%);
        font-weight: 800; font-size: clamp(14px, 5cqw, 18px); color: #3d2410; white-space: nowrap;
      }

      .mover-mode .desk__cells {
        gap: 0 !important;
        padding: 6px !important;
        background: #3d2410 !important;
        border-radius: 6px !important;
        box-shadow: 0 0 0 2px #5c3a20, 0 10px 36px rgba(0,0,0,.45) !important;
      }

      .desk__cell {
        display: flex !important; align-items: center !important;
        justify-content: center !important; overflow: hidden;
        transition: filter .1s !important; border-radius: 3px !important;
        font-size: 10cqw !important; /* Размер шахматных фигурок идеально вписывается в ячейку */
      }
      .desk__cell:hover { filter: brightness(1.15) !important; }

      .mover-panel {
        width: 260px; flex-shrink: 0;
        display: flex; flex-direction: column; gap: 12px;
        align-self: center;
      }
      .mover-panel-header, .mover-panel-content, .mover-panel-help, .mover-panel-footer {
        background: #fff; border-radius: 12px;
        padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,.08);
      }
      .mover-panel-header h2 { margin: 0; font-size: 16px; color: #222; text-align: center; }
      .mover-panel-content { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
      
      .mover-board-info {
        padding: 10px; background: #f5f5f5;
        border-radius: 8px; border-left: 3px solid #5c7a5c;
      }
      .mover-board-title { font-weight: 700; font-size: 12px; color: #333; margin-bottom: 4px; }
      .mover-board-count { font-size: 13px; color: #666; }

      .mover-btn {
        width: 100%; border: none; border-radius: 8px;
        padding: 12px; font-size: 13px; font-weight: 700;
        cursor: pointer; transition: background .15s;
        color: #fff; background: #5c6a7a;
      }
      .mover-btn:hover { background: #4a5a6a; }

      .mover-selected { box-shadow: inset 0 0 0 3px #7bc67e !important; }
      .mover-target { box-shadow: inset 0 0 0 3px #4a90e2 !important; }
    `
    document.head.appendChild(s)
  }
}

export default Mover