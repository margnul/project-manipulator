from django.urls import re_path

from .consumers import MoveConsumer

websocket_urlpatterns = [
    re_path(r'^ws/move/$', MoveConsumer.as_asgi()),
]
