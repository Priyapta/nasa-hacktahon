import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

import pytest


@pytest.mark.skipif(sys.platform == "win32", reason="Fixture uses a Unix venv executable symlink")
@pytest.mark.parametrize("file_env,shell_key,expected_key", [
    ('AI_API_KEY="file-test-key"\nAI_MODEL=gpt-6-luna\n', None, "file-test-key"),
    ('AI_API_KEY=file-test-key\n', "shell-test-key", "shell-test-key"),
    (None, "shell-test-key", "shell-test-key"),
])
def test_launcher_passes_backend_env_to_python(tmp_path, file_env, shell_key, expected_key):
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    launcher = scripts / "run-backend.mjs"
    shutil.copyfile(Path(__file__).parents[2] / "scripts/run-backend.mjs", launcher)
    backend = tmp_path / "backend"
    executable = backend / ".venv/bin/python"
    executable.parent.mkdir(parents=True)
    executable.symlink_to(sys.executable)
    (backend / "uvicorn.py").write_text(
        'import json, os\nprint(json.dumps({"key": os.getenv("AI_API_KEY"), "model": os.getenv("AI_MODEL")}))\n'
    )
    if file_env is not None:
        (backend / ".env").write_text(file_env)
    env = {key: value for key, value in os.environ.items() if key not in {"AI_API_KEY", "AI_MODEL"}}
    if shell_key is not None:
        env["AI_API_KEY"] = shell_key
    result = subprocess.run(
        ["node", str(launcher), "dev"], cwd=tmp_path, env=env,
        capture_output=True, text=True, timeout=10,
    )
    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)
    assert output["key"] == expected_key
    if file_env and "AI_MODEL" in file_env:
        assert output["model"] == "gpt-6-luna"
