import GamesManager from "./GamesManager.js";

import Mover from "./games/Mover.js";
import Mover2 from './games/Mover2.js'
import Chess from './games/Chess.js'

const gameList = [
  [Chess, 'Шахматы'],
  [Mover, 'Mover'],
  [Mover2, 'Mover2'],
]

new GamesManager(gameList)