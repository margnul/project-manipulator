from __future__ import annotations
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from .board import Board


def get_pseudo_legal_moves(
    board: Board,
    row: int,
    col: int,
    en_passant: Optional[tuple[int, int]],
) -> list[tuple[int, int]]:
    """
    Возвращает псевдо-легальные ходы (без проверки шаха королю).
    en_passant — клетка взятия на проходе, либо None.
    """
    piece = board.get(row, col)
    if not piece:
        return []

    if piece.type == 'pawn':
        return _pawn_moves(board, row, col, piece.color, en_passant)
    if piece.type == 'knight':
        return _knight_moves(board, row, col, piece.color)
    if piece.type == 'bishop':
        return _bishop_moves(board, row, col, piece.color)
    if piece.type == 'rook':
        return _rook_moves(board, row, col, piece.color)
    if piece.type == 'queen':
        return _queen_moves(board, row, col, piece.color)
    if piece.type == 'king':
        return _king_moves(board, row, col, piece.color)
    return []


# ------------------------------------------------------------------
# Пешка
# ------------------------------------------------------------------

def _pawn_moves(
    board: Board,
    row: int,
    col: int,
    color: str,
    en_passant: Optional[tuple[int, int]],
) -> list[tuple[int, int]]:
    moves = []
    direction = 1 if color == 'white' else -1
    start_row = 1 if color == 'white' else 6

    # Ход вперёд на 1
    nr = row + direction
    if board.in_bounds(nr, col) and board.get(nr, col) is None:
        moves.append((nr, col))
        # Ход вперёд на 2 с начальной позиции
        if row == start_row:
            nr2 = row + 2 * direction
            if board.get(nr2, col) is None:
                moves.append((nr2, col))

    # Взятие по диагонали
    for dc in (-1, 1):
        nc = col + dc
        nr = row + direction
        if not board.in_bounds(nr, nc):
            continue
        target = board.get(nr, nc)
        if target is not None and target.color != color:
            moves.append((nr, nc))
        # Взятие на проходе
        elif en_passant == (nr, nc):
            moves.append((nr, nc))

    return moves


# ------------------------------------------------------------------
# Конь
# ------------------------------------------------------------------

def _knight_moves(board: Board, row: int, col: int, color: str) -> list[tuple[int, int]]:
    moves = []
    for dr, dc in ((-2, -1), (-2, 1), (-1, -2), (-1, 2),
                   (1, -2), (1, 2), (2, -1), (2, 1)):
        nr, nc = row + dr, col + dc
        if board.in_bounds(nr, nc):
            target = board.get(nr, nc)
            if target is None or target.color != color:
                moves.append((nr, nc))
    return moves


# ------------------------------------------------------------------
# Скользящие фигуры (слон, ладья, ферзь)
# ------------------------------------------------------------------

def _sliding_moves(
    board: Board,
    row: int,
    col: int,
    color: str,
    directions: tuple,
) -> list[tuple[int, int]]:
    moves = []
    for dr, dc in directions:
        nr, nc = row + dr, col + dc
        while board.in_bounds(nr, nc):
            target = board.get(nr, nc)
            if target is None:
                moves.append((nr, nc))
            elif target.color != color:
                moves.append((nr, nc))
                break
            else:
                break
            nr += dr
            nc += dc
    return moves


def _bishop_moves(board: Board, row: int, col: int, color: str) -> list[tuple[int, int]]:
    return _sliding_moves(board, row, col, color, ((-1, -1), (-1, 1), (1, -1), (1, 1)))


def _rook_moves(board: Board, row: int, col: int, color: str) -> list[tuple[int, int]]:
    return _sliding_moves(board, row, col, color, ((-1, 0), (1, 0), (0, -1), (0, 1)))


def _queen_moves(board: Board, row: int, col: int, color: str) -> list[tuple[int, int]]:
    return _bishop_moves(board, row, col, color) + _rook_moves(board, row, col, color)


# ------------------------------------------------------------------
# Король (без рокировки — она добавляется в ChessGame)
# ------------------------------------------------------------------

def _king_moves(board: Board, row: int, col: int, color: str) -> list[tuple[int, int]]:
    moves = []
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            nr, nc = row + dr, col + dc
            if board.in_bounds(nr, nc):
                target = board.get(nr, nc)
                if target is None or target.color != color:
                    moves.append((nr, nc))
    return moves
