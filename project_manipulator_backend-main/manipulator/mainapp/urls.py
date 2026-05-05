from django.urls import path

from .views import (
    index,
    move_piece,
    chess_new,
    chess_moves,
    chess_move,
    get_boards_state,
    update_boards_state,
    reset_boards,
)

urlpatterns = [
    path('', index, name='index'),
    path('api/move/', move_piece, name='move-piece'),
    # Chess
    path('api/chess/new', chess_new, name='chess-new'),
    path('api/chess/moves', chess_moves, name='chess-moves'),
    path('api/chess/move', chess_move, name='chess-move'),
    path('api/chess/boards', get_boards_state, name='get-boards'),
    path('api/chess/boards-update', update_boards_state, name='update-boards'),
    path('api/chess/reset-boards', reset_boards, name='reset-boards'),
]
