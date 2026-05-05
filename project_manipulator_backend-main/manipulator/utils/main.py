import socket
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class MoveCommandResult:
    ok: bool
    command: str
    response: Optional[str] = None
    error: Optional[str] = None


def send_move_command(
    ip: str,
    port: int,
    board_from: int,
    pos_from: int,
    board_to: int,
    pos_to: int,
    timeout: float = 5.0,
) -> MoveCommandResult:
    command = f"Move,{board_from},{pos_from},{board_to},{pos_to}\r\n"

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client_socket:
            client_socket.settimeout(timeout)
            client_socket.connect((ip, port))
            client_socket.sendall(command.encode("ascii"))

            response_data = b""
            while True:
                chunk = client_socket.recv(1)
                if not chunk or chunk == b"\n":
                    break
                if chunk != b"\r":
                    response_data += chunk

        response = response_data.decode("ascii") if response_data else None
        return MoveCommandResult(ok=True, command=command.strip(), response=response)
    except (ConnectionRefusedError, TimeoutError, socket.timeout) as exc:
        return MoveCommandResult(
            ok=False,
            command=command.strip(),
            error=f"connection_error: {exc}",
        )
    except Exception as exc:
        return MoveCommandResult(
            ok=False,
            command=command.strip(),
            error=f"unexpected_error: {exc}",
        )


if __name__ == "__main__":
    print("=== TCP клиент для отправки команд ===")
    for move in ((2, 1, 1, 1), (1, 1, 2, 1)):
        result = send_move_command("10.16.0.23", 10003, *move)
        print(result)
