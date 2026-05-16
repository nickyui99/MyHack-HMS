# CareLink GCP Terraform

Terraform setup for Member 2. It enables the required Google Cloud APIs and creates the core runtime infrastructure used by the backend.

## What it creates

- Required Google Cloud services/APIs
- Runtime service account: `carelink-runtime`
- IAM roles for Cloud Run runtime access
- Artifact Registry Docker repository: `carelink-images`

## Usage

```powershell
cd infra/terraform
terraform init
terraform plan -var="project_id=YOUR_GCP_PROJECT_ID"
terraform apply -var="project_id=YOUR_GCP_PROJECT_ID"
```

Default region is `asia-southeast1`.

## Notes

- Billing must already be enabled on the project.
- You must be logged in with `gcloud auth application-default login`.
- This does not create Cloud SQL yet; it only enables the required services and base IAM/runtime resources.
- No service-account keys are created.
