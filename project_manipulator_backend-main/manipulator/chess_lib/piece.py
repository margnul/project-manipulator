from dataclasses import dataclass


@dataclass(frozen=True)
class Piece:
    color: str  # 'white' | 'black'
    type: str   # 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'

    def __repr__(self):
        return f"{self.color[0]}{self.type[0].upper()}"
