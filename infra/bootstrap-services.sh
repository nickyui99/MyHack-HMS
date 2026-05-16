#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:?Usage: ./bootstrap-services.sh PROJECT_ID}"

gcloud config set project "${PROJECT_ID}"
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com --project "${PROJECT_ID}"
gcloud auth application-default set-quota-project "${PROJECT_ID}"

echo "Bootstrap complete. Wait 1-3 minutes, then rerun terraform apply."
