#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID first}"
REGION="${REGION:-asia-southeast1}"
SERVICE_ACCOUNT="carelink-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create carelink-runtime \
  --project "${PROJECT_ID}" \
  --display-name "CareLink runtime service account" || true

for role in \
  roles/aiplatform.user \
  roles/cloudsql.client \
  roles/cloudsql.instanceUser \
  roles/enterpriseknowledgegraph.admin \
  roles/run.invoker \
  roles/cloudtrace.agent \
  roles/logging.logWriter \
  roles/monitoring.metricWriter
do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "serviceAccount:${SERVICE_ACCOUNT}" \
    --role "${role}" \
    --condition=None
done

gcloud artifacts repositories create carelink-images \
  --project "${PROJECT_ID}" \
  --repository-format docker \
  --location "${REGION}" || true
