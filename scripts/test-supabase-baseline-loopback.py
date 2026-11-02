"""Regression: local resets must retain the dedicated loopback binding."""

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("validator", ROOT / "scripts/validate-supabase-baseline.py")
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
validator.require_loopback()
subprocess.run(["python3", "scripts/validate-supabase-baseline.py"], cwd=ROOT, check=True, timeout=600)
validator.require_loopback()
print("Loopback isolation survives original-boundary and fresh resets.")
