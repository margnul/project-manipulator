import GameBase from "../GameBase.js"

class Mover extends GameBase {
  columnLetter(n) {
    return String.fromCharCode('A'.charCodeAt(0) + n);
  }

  findEntity(row, column, deskNum) {
    for (let i = 0; i < this.deskColumns * 4; i++) {
      if (this.entities[i].row === row && this.entities[i].column === column && this.entities[i].desk === deskNum) {
        return i
      }
    }
    return -1
  }

  moveEntity(row1, column1, deskNum1, row2, column2, deskNum2) {
    const entityIndex = this.findEntity(row1, column1, deskNum1)

    if (entityIndex === -1) return

    this.entities[entityIndex].row = row2
    this.entities[entityIndex].column = column2
    this.entities[entityIndex].desk = deskNum2

    this.updateColors()
  }

  deleteEntity(row, column, deskNum) {
    const entityIndex = this.findEntity(row, column, deskNum)

    if (entityIndex === -1) return

    this.entities[entityIndex].isActive = false

    const entity = this.entities[entityIndex]

    this.desk[entity.desk].items[entityIndex].classList.add(this.stateClasses.inactive)
    this.desk[1 - entity.desk].items[entityIndex].classList.add(this.stateClasses.inactive)
  }

  updateColors() {
    this.desk.forEach(d => {
      d.cells.forEach(cell => {
        cell.style.setProperty('background-color', this.colors.creamDarker)
        cell.classList.remove(this.stateClasses.image)
      })
    })
    this.entities.forEach((e, index) => {
      if (e.isActive) {
        const row = e.row
        const column = e.column
        const deskNum = e.desk
        const element = this.desk[deskNum].cells[(this.deskRows - 1 - row) * this.deskColumns + column]
        if (index < this.deskColumns * 2) {
          element.style.setProperty('background-color', this.colors.white)
          this.setImage(this.setImage(row, column, deskNum, this.imageLinks.ilyaWhite))
        } else {
          element.style.setProperty('background-color', this.colors.black)
          this.setImage(this.setImage(row, column, deskNum, this.imageLinks.ilyaBlack))
        }
      }
    })
  }

  clearDecorations() {
    this.desk.forEach(d => {
      d.cells.forEach(cell => {
        Object.values(this.decorations).forEach(decor => {
          cell.classList.remove(decor)
        })
      })
    })
  }


  initDesks() {
    this.deskCount = 2
    this.deskColumns = 8
    this.deskRows = 8
  }

  gameInit() {
    this.chosenEntity = [-1, -1, -1] // pos, board
    this.chosenCell = [-1, -1, -1] // pos, board
    //this.chessAlphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

    this.imageLinks = {
      ilyaBlack: "../icons/Mover/Ilya-black.png",
      ilyaWhite: "../icons/Mover/dick.png",
    }

    this.entities = [];

    const deskToPlace = 1
    for (let i = 0; i < this.deskColumns * 2; i++) {
      const row = Math.floor(i / this.deskColumns)
      const column = i % this.deskColumns
      this.entities[i] = {
        row: row,
        column: column,
        desk: deskToPlace,
        isActive: true,
      };
      this.setColor(row, column, deskToPlace, this.colors.white)
      this.setImage(this.setImage(row, column, deskToPlace, this.imageLinks.ilyaWhite))
    }
    for (let i = this.deskColumns * 2; i < this.deskColumns * 4; i++) {
      const row = Math.floor(i / this.deskColumns) + this.deskRows - 4
      const column = i % this.deskColumns
      this.entities[i] = {
        row: row,
        column: column,
        desk: deskToPlace,
        isActive: true,
      };
      this.setColor(row, column, deskToPlace, this.colors.black)
      this.setImage(this.setImage(row, column, deskToPlace, this.imageLinks.ilyaBlack))
    }
  }

  gameLogic(row, column, deskNum) {
    const entityIndex = this.findEntity(row, column, deskNum)
    //console.log(row, column, deskNum, entityIndex)

    if (entityIndex != -1) {
      if (this.chosenEntity[0] === row && this.chosenEntity[1] === column && this.chosenEntity[2] === deskNum) {
        this.chosenEntity = [-1, -1, -1]
      } else {
        this.chosenEntity = [row, column, deskNum]
      }
    } else {
      if (this.chosenCell[0] === row && this.chosenCell[1] === column && this.chosenCell[2] === deskNum) {
        this.chosenCell = [-1, -1, -1]
      } else {
        this.chosenCell = [row, column, deskNum]
      }
    }

    this.clearDecorations()
    this.setDecoration(this.chosenEntity[0], this.chosenEntity[1], this.chosenEntity[2], this.decorations.borderAccent)
    this.updateColors(deskNum)
    this.setColor(this.chosenCell[0], this.chosenCell[1], this.chosenCell[2], this.colors.accent)


    if (
      this.chosenEntity[0] !== -1 && this.chosenEntity[1] !== -1 && this.chosenEntity[2] !== -1 &&
      this.chosenCell[0] !== -1 && this.chosenCell[1] !== -1 && this.chosenCell[2] !== -1
    ) {
      this.setCanSend(true)
      const data = {
        board_from: this.chosenEntity[2] + 1,
        pos_from: this.columnLetter(this.chosenEntity[1]) + (this.chosenEntity[0] + 1),
        board_to: this.chosenCell[2] + 1,     // например, 1
        pos_to: this.columnLetter(this.chosenCell[1]) + (this.chosenCell[0] + 1)
      };
      this.stringToSend = JSON.stringify(data)
    } else {
      this.setCanSend(false)
      this.stringToSend = ''
    }
  }

  onCommandSent(params) {
    //console.log(params)
    const [resultCode, result] = params

    if (resultCode === 0) {
      this.moveEntity(
        this.chosenEntity[0],
        this.chosenEntity[1],
        this.chosenEntity[2],
        this.chosenCell[0],
        this.chosenCell[1],
        this.chosenCell[2]
      )

      this.clearDecorations()
      this.updateColors()

      this.chosenEntity = [-1, -1, -1]
      this.chosenCell = [-1, -1, -1]
      this.setCanSend(false)
    } else {
      console.log(result)
    }
  }
}

export default Mover