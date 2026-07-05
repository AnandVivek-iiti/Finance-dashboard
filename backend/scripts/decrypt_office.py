#!/usr/bin/env python
"""
Check whether an Excel file (.xls or .xlsx) is password-protected, and if so,
decrypt it to a sibling file using msoffcrypto-tool.

Usage: python decrypt_office.py <path-to-file> [password]

Prints JSON to stdout:
  {"encrypted": false}                          — file wasn't encrypted, read it as-is
  {"encrypted": true, "decryptedPath": "..."}    — decrypted successfully, read THIS path instead
  {"error": "PASSWORD_REQUIRED"}                 — encrypted, no password given
  {"error": "INVALID_PASSWORD"}                  — encrypted, given password is wrong
  {"error": "MISSING_DEPENDENCY", ...}           — msoffcrypto-tool not installed
  {"error": "UNREADABLE_FILE", ...}              — genuine read failure

Always exits 0 on a well-formed JSON result (even for expected "error" cases) so
the Node caller can rely on parsing stdout as JSON rather than distinguishing exit codes.

Requires: pip install msoffcrypto-tool --break-system-packages
"""
import sys
import json


def emit(payload):
    print(json.dumps(payload))
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        emit({"error": "USAGE_ERROR", "detail": "Usage: decrypt_office.py <path> [password]"})

    path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        import msoffcrypto
    except ImportError:
        emit({
            "error": "MISSING_DEPENDENCY",
            "detail": "msoffcrypto-tool is not installed. Run: pip install msoffcrypto-tool --break-system-packages",
        })

    try:
        with open(path, "rb") as f:
            office_file = msoffcrypto.OfficeFile(f)

            if not office_file.is_encrypted():
                emit({"encrypted": False})

            if not password:
                emit({"error": "PASSWORD_REQUIRED"})

            try:
                office_file.load_key(password=password)
            except Exception:
                emit({"error": "INVALID_PASSWORD"})

            out_path = path + ".decrypted"
            with open(out_path, "wb") as out:
                try:
                    office_file.decrypt(out)
                except Exception:
                    emit({"error": "INVALID_PASSWORD"})

            emit({"encrypted": True, "decryptedPath": out_path})
    except Exception as e:
        emit({"error": "UNREADABLE_FILE", "detail": str(e)})


if __name__ == "__main__":
    main()