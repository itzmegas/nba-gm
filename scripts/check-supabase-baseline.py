"""Compare metadata snapshots without hiding definition or permission differences."""

import json
import sys
from pathlib import Path


def canonical(value):
    # ACL order depends on role OIDs. Column order and all SQL strings stay exact.
    if isinstance(value, dict):
        return {k: (sorted((canonical(a) for a in v), key=lambda a: json.dumps(a, sort_keys=True))
                    if k == "acl" and v else canonical(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [canonical(v) for v in value]
    return value


def differences(expected, actual):
    result = {}
    for section, value in expected.items():
        if section == "history":
            continue  # The local chain intentionally adds the catch-up version.
        other = actual.get(section)
        if isinstance(value, list):
            encode = lambda v: json.dumps(canonical(v), sort_keys=True)
            left, right = set(map(encode, value)), set(map(encode, other or []))
            if left != right:
                result[section] = {"missing": [json.loads(x) for x in sorted(left - right)],
                                   "extra": [json.loads(x) for x in sorted(right - left)]}
        elif value != other:
            result[section] = {"expected": value, "actual": other}
    return result


if __name__ == "__main__":
    expected, actual = (json.loads(Path(p).read_text()) for p in sys.argv[1:3])
    drift = differences(expected, actual)
    print(json.dumps(drift, indent=2))
    # The local platform installs pg_net. It is an explicit environment difference,
    # not public-application parity and not silently normalized away.
    acceptable = {"extensions": {"missing": [], "extra": [
        {"name": "pg_net", "schema": "extensions", "version": "0.20.0"}]}}
    if drift and drift != acceptable:
        raise SystemExit(1)
    print("Application catalog parity passed; environment drift is listed above.")
