from __future__ import annotations
from typing import Optional
from .piece import Piece


# Начальная расстановка (индекс = col 0..7, то есть a..h)
_BACK_RANK = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']


class Board:
    """
    Шахматная доска 8x8.

    Система координат:
      row 0 = ранг 1 (нижний, белые фигуры)
      row 7 = ранг 8 (верхний, чёрные фигуры)
      col 0 = вертикаль a (левая)
      col 7 = вертикаль h (правая)
    """

    def __init__(self) -> None:
        # _squares[row][col] -> Optional[Piece]
        self._squares: list[list[Optional[Piece]]] = [
            [None] * 8 for _ in range(8)
        ]

    # ------------------------------------------------------------------
    # Базовые операции
    # ------------------------------------------------------------------

    def get(self, row: int, col: int) -> Optional[Piece]:
        return self._squares[row][col]

    def set(self, row: int, col: int, piece: Optional[Piece]) -> None:
        self._squares[row][col] = piece

    def remove(self, row: int, col: int) -> Optional[Piece]:
        piece = self._squares[row][col]
        self._squares[row][col] = None
        return piece

    @staticmethod
    def in_bounds(row: int, col: int) -> bool:
        return 0 <= row <= 7 and 0 <= col <= 7

    # ------------------------------------------------------------------
    # Поиск
    # ------------------------------------------------------------------

    def find_king(self, color: str) -> Optional[tuple[int, int]]:
        for row in range(8):
            for col in range(8):
                p = self._squares[row][col]
                if p and p.color == color and p.type == 'king':
                    return (row, col)
        return None

    def all_pieces(self, color: str) -> list[tuple[int, int, Piece]]:
        """Возвращает [(row, col, piece)] для всех фигур указанного цвета."""
        result = []
        for row in range(8):
            for col in range(8):
                p = self._squares[row][col]
                if p and p.color == color:
                    result.append((row, col, p))
        return result

    # ------------------------------------------------------------------
    # Копирование
    # ------------------------------------------------------------------

    def copy(self) -> Board:
        new = Board()
        for row in range(8):
            new._squares[row] = list(self._squares[row])
        return new

    # ------------------------------------------------------------------
    # Стартовая позиция
    # ------------------------------------------------------------------

    def setup_initial_position(self) -> None:
        for col, piece_type in enumerate(_BACK_RANK):
            self._squares[0][col] = Piece('white', piece_type)
            self._squares[7][col] = Piece('black', piece_type)
        for col in range(8):
            self._squares[1][col] = Piece('white', 'pawn')
            self._squares[6][col] = Piece('black', 'pawn')

    # ------------------------------------------------------------------
    # Сериализация
    # ------------------------------------------------------------------

    def to_list(self) -> list[dict]:
        result = []
        for row in range(8):
            for col in range(8):
                p = self._squares[row][col]
                if p:
                    result.append({
                        'row': row,
                        'col': col,
                        'color': p.color,
                        'type': p.type,
                    })
        return result
