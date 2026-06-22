"""Transparent at-rest encryption for PHI columns.

EncryptedText encrypts on write / decrypts on read with Fernet (authenticated
symmetric crypto) when settings.phi_encryption_key is set. It is deliberately
backward-compatible:

  • no key configured  -> values stored as plaintext (dev / tests work unchanged)
  • legacy plaintext   -> returned as-is (rows written before encryption was on)
  • encrypted values   -> carry an "enc::" marker so reads know to decrypt

The underlying SQL type stays TEXT, so turning encryption on/off needs no schema
migration. Don't filter/sort SQL on these columns — ciphertext isn't searchable.
"""
from sqlalchemy.types import TypeDecorator, Text

from settings import settings

_PREFIX = "enc::"


def _fernet():
    key = (settings.phi_encryption_key or "").strip()
    if not key:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(key.encode())
    except Exception:
        return None


class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        f = _fernet()
        if f is None:
            return value
        return _PREFIX + f.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None or not isinstance(value, str):
            return value
        if value.startswith(_PREFIX):
            f = _fernet()
            if f is None:
                return value  # can't decrypt without the key — surface raw
            try:
                return f.decrypt(value[len(_PREFIX):].encode()).decode()
            except Exception:
                return value
        return value
