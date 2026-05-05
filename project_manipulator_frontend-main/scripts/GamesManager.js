class GamesManager {
  selectors = {
    menuList: '[data-js-menu-list]',
    desks: '[data-js-desks]',
  }

  stateClasses = {
    isActive: 'is-active',
    isChosen: 'is-chosen',
  }

  constructor(gameList) {
    this.menuListElement = document.querySelector(this.selectors.menuList)

    this.gameObjects = []

    gameList.forEach((game, index) => {
      this.injectGame(game, index)
    });

    this.gameObjects[0].object.activateGame()


    this.buttonList = document.querySelectorAll('[data-game-name]')
  }

  injectGame(game, index) {
    const gameName = game[1]
    const gameObject = game[0]

    this.gameObjects[index] = {
      object: new gameObject(),
      name: gameName
    }
    this.gameObjects[index].object.deactivateGame()

    this.addGameButton(gameName)

    console.log('Game "' + gameName + '" injected')
  }

  setGameActive(gameName) {
    this.gameObjects.forEach(game => {
      game.name === gameName ? game.object.activateGame() : game.object.deactivateGame()
    })
  }

  addGameButton(gameName) {
    const menuItem = document.createElement('li')
    menuItem.className = 'left-panel__menu-item'

    const menuButton = document.createElement('button')
    menuButton.className = 'left-panel__menu-button'
    menuButton.innerHTML = gameName
    menuButton.setAttribute('data-game-name', gameName)

    menuItem.append(menuButton)
    this.menuListElement.append(menuItem)

    menuButton.addEventListener('click', (e) => {
      const gameName = e.target.getAttribute('data-game-name')
      this.buttonList.forEach(el => {
        el.classList.remove(this.stateClasses.isChosen)
      })
      e.target.classList.add(this.stateClasses.isChosen)
      this.setGameActive(gameName)
    })
  }
}

export default GamesManager