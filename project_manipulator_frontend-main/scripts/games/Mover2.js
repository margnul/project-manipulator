import GameBase from "../GameBase.js"

const BACKEND = 'http://127.0.0.1:8081'

const SYMBOLS = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
}

class Mover2 extends GameBase {
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
        console.log('Бэкенд успешно обновлен.')
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

  // ─── ГЛАВНОЕ ОТЛИЧИЕ ОТ MOVER 1 ────────────────────────────────────

  async makeMove() {
    if (!this.canSend) return;

    // 1. Считаем координаты 1..64 для манипулятора
    const fromBoard = this.selectedPiece.deskNum + 1; // 1 (Съеденные) или 2 (Игровая)
    const toBoard = this.selectedCell.deskNum + 1;
    const posFrom = this.selectedPiece.row * 8 + this.selectedPiece.col + 1;
    const posTo = this.selectedCell.row * 8 + this.selectedCell.col + 1;

    console.log(`[Mover2] Отправка на манипулятор: Доска ${fromBoard} Поз ${posFrom} -> Доска ${toBoard} Поз ${posTo}`);

    try {
      // 2. Делаем физический ход манипулятором
      const res = await fetch(`${BACKEND}/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board_from: fromBoard,
          pos_from: posFrom,
          board_to: toBoard,
          pos_to: posTo
        })
      });

      const data = await res.json();
      if (!data.ok) {
        alert('Ошибка манипулятора: ' + data.error);
        return; // Если физически не удалось переместить — прерываемся и ничего не сохраняем
      }
    } catch (e) {
      console.error('Сетевая ошибка при перемещении:', e);
      alert('Сетевая ошибка при обращении к манипулятору');
      return;
    }

    // 3. Манипулятор походил! Теперь двигаем фишку локально в массивах
    this._movePieceLocal(
      this.selectedPiece.deskNum, this.selectedPiece.row, this.selectedPiece.col,
      this.selectedCell.deskNum, this.selectedCell.row, this.selectedCell.col
    );

    // 4. Обновляем память бэкенда
    await this._saveBoardsToBackend();

    // 5. Сбрасываем состояния
    this.selectedPiece = null;
    this.selectedCell = null;
    this.setCanSend(false);
    this._render();
  }

  // ───────────────────────────────────────────────────────────────────

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
    this.gameScreen.classList.add('mover-mode') // Используем те же стили, что и в Mover 1

    const panel = document.createElement('div')
    this._panelEl = panel
    panel.className = 'mover-panel'
    // Обновили заголовок и описание, чтобы было понятно, где мы находимся
    panel.innerHTML = `
      <div class="mover-panel-header">
        <h2>Mover 2 (С манипулятором)</h2>
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
        <p style="font-size: 12px; color: #ff4a4a; margin: 10px 0; font-weight: bold;">
          ОСТОРОЖНО: Нажатие кнопки MOVE приведёт к физическому движению манипулятора!
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
    // Не инжектим CSS повторно, если он уже был добавлен Mover.js
    if (document.getElementById('mover2-styles')) return
    const s = document.createElement('style')
    s.id = 'mover2-styles'
    // Стили наследуются от Mover 1, так как используется тот же класс .mover-mode
    document.head.appendChild(s)
  }
}

export default Mover2