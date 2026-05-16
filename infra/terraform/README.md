# CareLink GCP Terraform

Terraform setup for Member 2. It enables the required Google Cloud APIs and creates the core runtime infrastructure used by the backend.

## What it creates

- Required Google Cloud services/APIs
- Runtime service account: `carelink-runtime`
- IAM roles for Cloud Run runtime access
- Artifact Registry Docker repository: `carelink-images`
- Identity Platform project config with email/password sign-in enabled

## Usage

If this is a brand-new project, bootstrap the APIs Terraform itself needs first:

```powershell
..\\bootstrap-services.ps1 -ProjectId YOUR_GCP_PROJECT_ID
```

Or with bash:

```bash
../bootstrap-services.sh YOUR_GCP_PROJECT_ID
```

Wait 1-3 minutes for API enablement to propagate, then run Terraform:

```powershell
cd infra/terraform
terraform init
terraform plan -var="project_id=YOUR_GCP_PROJECT_ID"
terraform apply -var="project_id=YOUR_GCP_PROJECT_ID"
```

Default region is `asia-southeast1`.

If Identity Platform fails with an ADC quota project error, set your local Application Default Credentials quota project:

```powershell
gcloud auth application-default set-quota-project YOUR_GCP_PROJECT_ID
```

The Terraform provider also sets `user_project_override = true` and uses `quota_project_id` so Google APIs charge quota to the CareLink project instead of an unset local default.

## Notes

- Billing must already be enabled on the project.
- You must be logged in with `gcloud auth application-default login`.
- This does not create Cloud SQL yet; it only enables the required services and base IAM/runtime resources.
- Identity Platform is initialized with email/password auth enabled, anonymous auth disabled, and phone auth disabled.
- Add frontend domains to `identity_platform_authorized_domains` when the Cloud Run frontend URL or custom domain is ready.
- No service-account keys are created.
