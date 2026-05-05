import json
import re
import uuid
from typing import Any, Dict, Tuple
import time

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from utils.main import send_move_command
from chess_lib import ChessGame
from chess_lib.piece import Piece

# Хранилище партий в памяти (game_id -> ChessGame)
_chess_games: dict[str, ChessGame] = {}

# Хранилище состояния двух физических досок
# Доска 1: для съеденных фигур (пустая по умолчанию)
# Доска 2: для шахматной партии (начальная позиция)
_board1_state: list[dict] = []  # съеденные фигуры
_board2_state: list[dict] = []  # активная партия


def _init_board2_default():
    """Инициализирует доску 2 начальной позицией шахмат."""
    pieces = []
    back_rank = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

    # Белые фигуры (ранг 1 и 2)
    for col, piece_type in enumerate(back_rank):
        pieces.append({'row': 0, 'col': col, 'color': 'white', 'type': piece_type})
    for col in range(8):
        pieces.append({'row': 1, 'col': col, 'color': 'white', 'type': 'pawn'})

    # Чёрные фигуры (ранг 8 и 7)
    for col, piece_type in enumerate(back_rank):
        pieces.append({'row': 7, 'col': col, 'color': 'black', 'type': piece_type})
    for col in range(8):
        pieces.append({'row': 6, 'col': col, 'color': 'black', 'type': 'pawn'})

    return pieces


# Инициализируем доску 2 при запуске
_board2_state = _init_board2_default()

def _sync_physical_board_to_start():
    """Сравнивает текущую доску с начальной и расставляет фигуры манипулятором"""
    global _board1_state, _board2_state
    
    target_state = _init_board2_default()
    
    print("[DEBUG RESET] Начинаем расстановку фигур для новой игры...")
    
    # Простой алгоритм: 
    # 1. Убрать все фигуры, которые стоят неправильно, на Доску 1 (кладбище)
    # 2. Переместить нужные фигуры с Доски 1 на правильные места на Доске 2
    
    # Шаг 1: Очищаем неправильные фигуры
    correct_positions = {(p['row'], p['col']): p for p in target_state}
    pieces_to_remove = []
    
    for piece in _board2_state:
        pos = (piece['row'], piece['col'])
        # Если на этом месте должна стоять другая фигура или пусто - убираем
        if pos not in correct_positions or correct_positions[pos]['type'] != piece['type'] or correct_positions[pos]['color'] != piece['color']:
            pieces_to_remove.append(piece)

    for piece in pieces_to_remove:
        pos_from = piece['row'] * 8 + piece['col'] + 1
        # Ищем свободное место на Доске 1 (просто берем первую свободную клетку от 1 до 64)
        occupied_b1 = {p['row'] * 8 + p['col'] + 1 for p in _board1_state}
        pos_to = next(i for i in range(1, 65) if i not in occupied_b1)
        
        send_move_command(settings.MANIPULATOR_TCP_HOST, settings.MANIPULATOR_TCP_PORT, 2, pos_from, 1, pos_to)
        
        # Обновляем состояние
        _board2_state.remove(piece)
        piece['row'] = (pos_to - 1) // 8
        piece['col'] = (pos_to - 1) % 8
        _board1_state.append(piece)
        time.sleep(1) # Небольшая пауза для манипулятора

    # Шаг 2: Расставляем недостающие фигуры из Доски 1
    current_positions = {(p['row'], p['col']): p for p in _board2_state}
    
    for pos, target_piece in correct_positions.items():
        if pos not in current_positions:
            # Ищем такую фигуру на Доске 1
            found_piece = next((p for p in _board1_state if p['type'] == target_piece['type'] and p['color'] == target_piece['color']), None)
            
            if found_piece:
                pos_from = found_piece['row'] * 8 + found_piece['col'] + 1
                pos_to = target_piece['row'] * 8 + target_piece['col'] + 1
                
                send_move_command(settings.MANIPULATOR_TCP_HOST, settings.MANIPULATOR_TCP_PORT, 1, pos_from, 2, pos_to)
                
                _board1_state.remove(found_piece)
                _board2_state.append(target_piece)
                time.sleep(1)
            else:
                print(f"[DEBUG RESET] ВНИМАНИЕ: Фигура {target_piece['color']} {target_piece['type']} не найдена на кладбище (Доска 1)!")

    print("[DEBUG RESET] Расстановка завершена.")


def index(request):
    return render(request, 'mainapp/index.html')


def _parse_payload(request) -> Dict[str, Any]:
    if request.content_type and "application/json" in request.content_type:
        try:
            body = request.body.decode("utf-8") if request.body else "{}"
            return json.loads(body) if body else {}
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON payload: {exc}") from exc

    return request.POST.dict()


def _parse_position(value: Any) -> int:
    if isinstance(value, int):
        pos = value
    elif isinstance(value, str):
        normalized = value.strip().upper()
        if normalized.isdigit():
            pos = int(normalized)
        else:
            match = re.fullmatch(r"([A-H])([1-8])", normalized)
            if not match:
                raise ValueError("Position must be integer 1..64 or chess notation A1..H8")
            file_name, rank_text = match.groups()
            file_idx = ord(file_name) - ord("A") + 1
            rank = int(rank_text)
            pos = (rank - 1) * 8 + file_idx
    else:
        raise ValueError("Position must be integer 1..64 or chess notation A1..H8")

    if not 1 <= pos <= 64:
        raise ValueError("Position must be in range 1..64")
    return pos


def _validate_move(board_from: int, board_to: int) -> Tuple[bool, str]:
    if board_from not in (1, 2) or board_to not in (1, 2):
        return False, "board_from and board_to must be 1 or 2"
    if board_from == board_to:
        return False, "board_from and board_to must be different"
    return True, ""


@csrf_exempt
@require_http_methods(["POST"])
def move_piece(request):
    try:
        payload = _parse_payload(request)
    except ValueError as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    try:
        board_from = int(payload.get("board_from", 2))
        board_to = int(payload.get("board_to", 1))
        pos_from = _parse_position(payload.get("pos_from"))
        pos_to = _parse_position(payload.get("pos_to"))
    except (TypeError, ValueError) as exc:
        return JsonResponse({"ok": False, "error": str(exc)}, status=400)

    is_valid, validation_error = _validate_move(board_from, board_to)
    if not is_valid:
        return JsonResponse({"ok": False, "error": validation_error}, status=400)

    result = send_move_command(
        settings.MANIPULATOR_TCP_HOST,
        settings.MANIPULATOR_TCP_PORT,
        board_from,
        pos_from,
        board_to,
        pos_to,
    )

    status = 200 if result.ok else 502
    return JsonResponse(
        {
            "ok": result.ok,
            "command": result.command,
            "response": result.response,
            "error": result.error,
            "board_from": board_from,
            "pos_from": pos_from,
            "board_to": board_to,
            "pos_to": pos_to,
        },
        status=status,
    )


# ------------------------------------------------------------------
# Chess endpoints
# ------------------------------------------------------------------

def _cors(response):
    """Добавляет CORS-заголовки (для локальной разработки)."""
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def chess_new(request):
    """POST /api/chess/new — создать новую партию."""
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}))

    # ДОБАВЛЕНО: Расставляем фигуры физически
    _sync_physical_board_to_start()

    game = ChessGame()

    # Инициализируем виртуальную доску из нового состояния физической доски
    if _board2_state:
        game.board._squares = [[None] * 8 for _ in range(8)]
        for piece_data in _board2_state:
            piece = Piece(piece_data['color'], piece_data['type'])
            game.board.set(piece_data['row'], piece_data['col'], piece)

    game_id = str(uuid.uuid4())[:8]
    _chess_games[game_id] = game

    return _cors(JsonResponse({
        'game_id': game_id,
        'state': game.to_dict(),
    }))


@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def chess_moves(request):
    """GET /api/chess/moves?game_id=...&from_row=...&from_col=... — легальные ходы фигуры."""
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}))

    game_id = request.GET.get('game_id', '')
    game = _chess_games.get(game_id)
    if game is None:
        return _cors(JsonResponse({'ok': False, 'error': 'Партия не найдена'}, status=404))

    try:
        from_row = int(request.GET.get('from_row', ''))
        from_col = int(request.GET.get('from_col', ''))
    except (TypeError, ValueError):
        return _cors(JsonResponse({'ok': False, 'error': 'from_row и from_col обязательны'}, status=400))

    moves = game.legal_moves(from_row, from_col)
    return _cors(JsonResponse({
        'ok': True,
        'moves': [{'row': r, 'col': c} for r, c in moves],
    }))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def chess_move(request):
    """POST /api/chess/move — совершить ход."""
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}))

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return _cors(JsonResponse({'ok': False, 'error': str(exc)}, status=400))

    game_id = payload.get('game_id', '')
    game = _chess_games.get(game_id)
    if game is None:
        return _cors(JsonResponse({'ok': False, 'error': 'Партия не найдена'}, status=404))

    try:
        from_row = int(payload['from_row'])
        from_col = int(payload['from_col'])
        to_row   = int(payload['to_row'])
        to_col   = int(payload['to_col'])
    except (KeyError, TypeError, ValueError) as exc:
        return _cors(JsonResponse({'ok': False, 'error': f'Неверные параметры: {exc}'}, status=400))

    promotion = payload.get('promotion')

    result = game.make_move(from_row, from_col, to_row, to_col, promotion)
    status_code = 200 if result['ok'] else 400
    return _cors(JsonResponse(result, status=status_code))


# ------------------------------------------------------------------
# Board state endpoints (две доски)
# ------------------------------------------------------------------

@csrf_exempt
@require_http_methods(["GET", "OPTIONS"])
def get_boards_state(request):
    """GET /api/chess/boards — получить состояние обеих досок."""
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}))

    return _cors(JsonResponse({
        'ok': True,
        'board1': _board1_state,  # съеденные фигуры
        'board2': _board2_state,  # активная партия
    }))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def update_boards_state(request):
    """POST /api/chess/boards — обновить состояние обеих досок."""
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}))

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return _cors(JsonResponse({'ok': False, 'error': str(exc)}, status=400))

    board1 = payload.get('board1', [])
    board2 = payload.get('board2', [])

    # Валидируем доски
    for pieces in [board1, board2]:
        for piece in pieces:
            if not isinstance(piece, dict):
                return _cors(JsonResponse({'ok': False, 'error': 'Каждая фигура должна быть объектом'}, status=400))
            if 'row' not in piece or 'col' not in piece or 'color' not in piece or 'type' not in piece:
                return _cors(JsonResponse({'ok': False, 'error': 'Обязательны поля: row, col, color, type'}, status=400))

            row, col = piece['row'], piece['col']
            if not (0 <= row <= 7 and 0 <= col <= 7):
                return _cors(JsonResponse({'ok': False, 'error': f'Позиция ({row}, {col}) вне границ доски'}, status=400))

            if piece['color'] not in ('white', 'black'):
                return _cors(JsonResponse({'ok': False, 'error': 'color должна быть white или black'}, status=400))

            if piece['type'] not in ('pawn', 'knight', 'bishop', 'rook', 'queen', 'king'):
                return _cors(JsonResponse({'ok': False, 'error': 'type должна быть одной из: pawn, knight, bishop, rook, queen, king'}, status=400))

    # Сохраняем состояние
    global _board1_state, _board2_state
    _board1_state = board1
    _board2_state = board2

    return _cors(JsonResponse({
        'ok': True,
        'message': 'Состояние досок обновлено',
        'board1': _board1_state,
        'board2': _board2_state,
    }))


@csrf_exempt
@require_http_methods(["POST", "OPTIONS"])
def reset_boards(request):
    """POST /api/chess/reset-boards — вернуть доски в начальное состояние."""
    if request.method == 'OPTIONS':
        return _cors(JsonResponse({}))

    global _board1_state, _board2_state
    _board1_state = []
    _board2_state = _init_board2_default()

    return _cors(JsonResponse({
        'ok': True,
        'message': 'Доски сброшены в начальное состояние',
        'board1': _board1_state,
        'board2': _board2_state,
    }))
