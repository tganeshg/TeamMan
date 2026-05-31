import os
import base64
from cryptography.fernet import Fernet

_KEY_FILE = os.path.join(os.path.dirname(__file__), "..", ".fernet.key")


def _get_or_create_key() -> bytes:
    key_path = os.path.abspath(_KEY_FILE)
    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            return f.read()
    key = Fernet.generate_key()
    with open(key_path, "wb") as f:
        f.write(key)
    return key


def encrypt(plain: str) -> str:
    f = Fernet(_get_or_create_key())
    return f.encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    f = Fernet(_get_or_create_key())
    return f.decrypt(token.encode()).decode()
