#!/usr/bin/env bash
set -euo pipefail
export PYTHONPATH=backend
export DJANGO_SETTINGS_MODULE=shrine_project.settings
python -m django "$@"
