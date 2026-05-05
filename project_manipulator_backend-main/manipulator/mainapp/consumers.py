import asyncio
import json

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

from utils.main import send_move_command


class MoveConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        await self._send(
            {
                'type': 'connection',
                'ok': True,
                'message': 'WebSocket connected',
            }
        )

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            await self._send_error('empty_payload', 'Received empty payload')
            return

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error('invalid_json', 'Payload must be a valid JSON object')
            return

        action = payload.get('action')
        if action != 'move':
            await self._send_error('unsupported_action', 'Supported action: move')
            return

        try:
            board_from = int(payload.get('board_from'))
            board_to = int(payload.get('board_to'))
            pos_from = int(payload.get('pos_from'))
            pos_to = int(payload.get('pos_to'))
        except (TypeError, ValueError):
            await self._send_error('invalid_params', 'board_* and pos_* must be integers')
            return

        validation_error = self._validate_move(board_from, board_to, pos_from, pos_to)
        if validation_error:
            await self._send_error('validation_error', validation_error)
            return

        result = await asyncio.to_thread(
            send_move_command,
            settings.MANIPULATOR_TCP_HOST,
            settings.MANIPULATOR_TCP_PORT,
            board_from,
            pos_from,
            board_to,
            pos_to,
        )

        await self._send(
            {
                'type': 'move_result',
                'ok': result.ok,
                'command': result.command,
                'response': result.response,
                'error': result.error,
            }
        )

    @staticmethod
    def _validate_move(board_from, board_to, pos_from, pos_to):
        if board_from not in (1, 2) or board_to not in (1, 2):
            return 'board_from and board_to must be either 1 or 2'

        if board_from == board_to:
            return 'board_from and board_to must be different'

        if not 1 <= pos_from <= 64 or not 1 <= pos_to <= 64:
            return 'pos_from and pos_to must be in range 1..64'

        return None

    async def _send(self, payload):
        await self.send(text_data=json.dumps(payload, ensure_ascii=False))

    async def _send_error(self, code, message):
        await self._send(
            {
                'type': 'error',
                'ok': False,
                'code': code,
                'message': message,
            }
        )
