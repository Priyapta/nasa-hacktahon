import os
from pathlib import Path
import shutil
import subprocess

import pytest

REPO = Path(__file__).resolve().parents[2]
OLD_IMAGE = "ghcr.io/priyapta/nasa-hacktahon-api@sha256:" + "a" * 64
NEW_IMAGE = "ghcr.io/priyapta/nasa-hacktahon-api@sha256:" + "b" * 64


@pytest.fixture
def deployment(tmp_path):
    shutil.copy(REPO / "deploy/backend/deploy.sh", tmp_path / "deploy.sh")
    (tmp_path / "backend.env").write_text("AI_API_KEY=\n")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    docker = bin_dir / "docker"
    docker.write_text("""#!/usr/bin/env bash
set -eu
printf '%s|%s\\n' "${BACKEND_IMAGE:-}" "$*" >> "$DEPLOY_CALLS"
if [[ $1 == login ]]; then
  cat >/dev/null
  [[ ${FAIL_STAGE:-} != login ]]
elif [[ $* == *' pull api' ]]; then
  [[ ${FAIL_STAGE:-} != pull ]]
elif [[ $* == *' up '* && ${BACKEND_IMAGE:-} == "$FAILED_IMAGE" ]]; then
  [[ ${FAIL_STAGE:-} != health ]]
fi
""")
    docker.chmod(0o755)
    env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "DEPLOY_CALLS": str(tmp_path / "calls"), "FAILED_IMAGE": NEW_IMAGE}

    def run(image=NEW_IMAGE, failure=""):
        return subprocess.run(["bash", str(tmp_path / "deploy.sh"), image, "Priyapta"], input="test-token\n", text=True, capture_output=True, env={**env, "FAIL_STAGE": failure})

    return tmp_path, run


def test_success_records_healthy_release_and_previous_image(deployment):
    root, run = deployment
    (root / ".release.env").write_text(f"BACKEND_IMAGE={OLD_IMAGE}\n")
    result = run()
    assert result.returncode == 0, result.stderr
    assert (root / ".release.env").read_text() == f"BACKEND_IMAGE={NEW_IMAGE}\n"
    assert (root / ".previous.env").read_text() == f"BACKEND_IMAGE={OLD_IMAGE}\n"
    assert "test-token" not in result.stdout + result.stderr


@pytest.mark.parametrize("failure", ["login", "pull", "health"])
def test_failed_release_keeps_saved_release_and_rolls_back_if_started(deployment, failure):
    root, run = deployment
    (root / ".release.env").write_text(f"BACKEND_IMAGE={OLD_IMAGE}\n")
    result = run(failure=failure)
    assert result.returncode != 0
    assert (root / ".release.env").read_text() == f"BACKEND_IMAGE={OLD_IMAGE}\n"
    calls = (root / "calls").read_text()
    assert (f"{OLD_IMAGE}|compose -f compose.yaml up" in calls) == (failure == "health")
    if failure in ("login", "pull"):
        assert " up " not in calls


def test_first_unhealthy_release_stops_without_recording_success(deployment):
    root, run = deployment
    assert run(failure="health").returncode != 0
    assert not (root / ".release.env").exists()
    assert "compose -f compose.yaml stop api" in (root / "calls").read_text()


@pytest.mark.parametrize("image", ["latest", "ghcr.io/priyapta/api:main", NEW_IMAGE + ";echo unsafe"])
def test_invalid_image_never_reaches_docker(deployment, image):
    root, run = deployment
    assert run(image=image).returncode != 0
    assert not (root / "calls").exists()


def test_missing_env_never_reaches_docker(deployment):
    root, run = deployment
    (root / "backend.env").unlink()
    assert run().returncode != 0
    assert not (root / "calls").exists()
