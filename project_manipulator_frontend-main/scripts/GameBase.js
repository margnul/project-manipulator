class GameBase {
  selectors = {
    desk: '[data-js-desk]',
    cell: '[data-js-cell]',
    item: '[data-js-item]',
    moveButton: '[data-js-move-button]',
    desks: '[data-js-desks]',
  }

  stateClasses = {
    inactive: 'inactive',
    image: 'image',
  }

  colors = {
    accent: 'var(--color-accent)',
    accentDarker: 'var(--color-accent-darker)',
    creamDarker: 'var(--color-cream-darker)',
    black: 'var(--color-black)',
    white: 'var(--color-white)',
  }

  decorations = {
    cross: 'cross',
    grayPoint: 'gray-point',
    borderAccent: 'border-accent',
    borderCreamDarker: 'border-cream-darker',
  }

  constructor() {
    this.url = 'http://127.0.0.1:8000/api/move/';

    this.desks = document.querySelector(this.selectors.desks)

    this.deskCount = 2
    this.deskColumns = 8
    this.deskRows = 8

    this.initDesks()

    this.gameScreen = null
    this.desk = []
    this.generateDesks()

    this.gameInit()

    this.moveButtonElement = document.querySelector(this.selectors.moveButton);


    this.canSend = false
    this.stringToSend = ''

    this.updateSizes()
    this.bindEvents()

    this.moveButtonElement.classList.toggle(this.stateClasses.inactive, !this.canSend)
  }

  generateDesks() {
    document.documentElement.style.setProperty('--cell-rows', this.deskRows);
    document.documentElement.style.setProperty('--cell-colunms', this.deskColumns);

    //this.desks.innerHTML = "";

    const cellsCount = this.deskColumns * this.deskRows;

    this.gameScreen = document.createElement("div");
    this.gameScreen.className = "desk__game";

    for (let deskIndex = 0; deskIndex < this.deskCount; deskIndex++) {
      const wrapper = document.createElement("div");
      wrapper.className = "desk__wrapper";
      wrapper.dataset.index = deskIndex + 1;

      const desk = document.createElement("div");

      desk.className = "desk";
      desk.dataset.index = deskIndex + 1;
      desk.dataset.jsDesk = "";

      const cellsContainer = document.createElement("div");
      cellsContainer.className = "desk__cells";
      cellsContainer.dataset.jsCells = "";

      for (let cellIndex = 0; cellIndex < cellsCount; cellIndex++) {
        const cell = document.createElement("div");
        cell.className = "desk__cell";
        cell.dataset.jsCell = "";
        cell.dataset.index = cellIndex;

        cellsContainer.append(cell);
      }

      desk.append(cellsContainer);
      wrapper.append(desk);
      this.gameScreen.append(wrapper)


      this.desk[deskIndex] = {
        deskElement: desk,
        cells: desk.querySelectorAll(this.selectors.cell),
      }
    }

    this.desks.append(this.gameScreen);
  }

  activateGame() {
    this.gameScreen.classList.remove(this.stateClasses.inactive)
  }

  deactivateGame() {
    this.gameScreen.classList.add(this.stateClasses.inactive)
  }

  updateSizes() {
    if (this.desk) {
      this.deskRect = this.desk[0].deskElement.getBoundingClientRect()
      this.cellHeight = this.deskRect.height / (this.deskRows + 1)
      this.cellWidth = this.deskRect.width / (this.deskColumns + 1)
      this.rowGap = this.cellHeight / (this.deskRows + 1)
      this.columnGap = this.cellWidth / (this.deskColumns + 1)
    }
  }

  handleClickCell(e) {
    const index = e.target.getAttribute('data-index')

    const row = this.deskRows - 1 - Math.floor(index / this.deskColumns)
    const column = index % this.deskColumns
    const deskNum = e.target.closest(this.selectors.desk).getAttribute('data-index') - 1

    //console.log(row, column, deskNum)

    this.gameLogic(row, column, deskNum)
    this.moveButtonElement.classList.toggle(this.stateClasses.inactive, !this.canSend)
  }

  processLogic(row, column, deskNum) {
    if (this.chosenEntity[0] === -1) {
      // начальная точка не выбрана
      // выбор точки отправки
      const entityNum = this.findEntity(row, column, deskNum)
      if (entityNum !== -1) {
        // есть что отправлять
        this.chosenEntity = [entityNum, deskNum]
      } else {
        // иначе нечего отправлять
        const cellNum = this.findCell(row, column)
        this.chosenCell = [cellNum, deskNum]
      }

    } else {
      // начальная точка выбрана
      // выбор точки назначения
      const entityNum = this.findEntity(row, column, deskNum)
      if (entityNum !== -1) {
        // поле уже занято
        this.chosenEntity = [entityNum, deskNum]
      } else {
        // есть куда отправить
        const cellNum = this.findCell(row, column)
        this.chosenCell = [cellNum, deskNum]
      }
    }

    if (this.chosenEntity[0] != -1 && this.chosenEntity[1] != -1 && this.chosenCell[0] != -1 && this.chosenCell[1] != -1) {
      this.canSend = true
    } else {
      this.canSend = false
    }

    //console.log(this.chosenEntity, this.chosenCell)

    this.updateDesk()
  }

  bindEvents() {
    // this.deskElement2.addEventListener('click', (e) => {
    //   this.handleClickDesk(e, this.deskElement2)
    // })

    // this.deskElement1.addEventListener('click', (e) => {
    //   this.handleClickDesk(e, this.deskElement1)
    // })

    this.desk.forEach(desk => {
      desk.cells.forEach(cell => {
        cell.addEventListener('click', (e) => {
          this.handleClickCell(e)
        })
      })
    })

    this.moveButtonElement.addEventListener('click', () => {
      this.makeMove()
    })

    window.addEventListener('resize', () => {
      this.updateSizes()
    })
  }



  async sendComand() {
    // 0 - успешная отправка команды
    // 1 - ошибка бэкенда
    // 2 - ошибка связи с бэкендом

    try {
      console.log(this.stringToSend)
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: this.stringToSend
      });

      // Получаем тело ответа
      const result = await response.json();

      if (response.ok && result.ok) {
        console.log('Ход выполнен успешно:', result.command);
        return [0, result];
      } else {
        // Тут обрабатываем ошибки 400, 502 и логику "ok: false"
        console.error('Ошибка бекенда:', result.error);
        alert(`Ошибка: ${result.error}`);
        return [1, result];
      }

    } catch (error) {
      // Если сервер упал или нет интернета
      console.error('Сетевая ошибка или сервер недоступен:', error);
      return [2, error]
    }
  }

  async makeMove() {
    if (!this.canSend) return

    const result = await this.sendComand()

    this.onCommandSent(result)
  }


  // by engine
  setColor(row, column, deskNum, color = this.colors.creamDarker) {
    if (deskNum < this.deskCount && deskNum >= 0) {
      if (row < this.deskRows && row >= 0) {
        if (column < this.deskColumns && column >= 0) {
          this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column].style.setProperty('background-color', color)
        }
      }
    }
  }

  setDecoration(row, column, deskNum, decoration = this.decorations.grayPoint) {
    if (deskNum < this.deskCount && deskNum >= 0) {
      if (row < this.deskRows && row >= 0) {
        if (column < this.deskColumns && column >= 0) {
          Object.values(this.decorations).forEach(decor => {
            this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column].classList.remove(decor)
          })
          this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column].classList.add(decoration)
        }
      }
    }
  }

  setCanSend(flag) {
    this.canSend = flag
    this.moveButtonElement.classList.toggle(this.stateClasses.inactive, !this.canSend)
  }

  setImage(row, column, deskNum, imageLink = '') {
    const link = `url("${imageLink}")`
    if (deskNum < this.deskCount && deskNum >= 0) {
      if (row < this.deskRows && row >= 0) {
        if (column < this.deskColumns && column >= 0) {
          if (imageLink === '') {
            this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column].classList.remove('image')
          } else {
            this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column].classList.add('image')
            this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column].style.setProperty('--background-image', link)
          }
        }
      }
    }
  }



  initDesks() {
    console.error('initDesks has to be initialised!')
  }

  gameInit() {
    console.error('gameInit has to be initialised!')
  }

  gameLogic(row, column, deskNum) {
    console.error('gameLogic has to be initialised!')
  }

  onCommandSent(params) {
    console.error('onCommandSent has to be initialised!')
  }
}

export default GameBase