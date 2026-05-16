variable "project_id" {
  description = "Google Cloud project ID for CareLink."
  type        = string
}

variable "quota_project_id" {
  description = "Quota/billing project used by local Application Default Credentials. Defaults to project_id."
  type        = string
  default     = null
}

variable "region" {
  description = "Default Google Cloud region."
  type        = string
  default     = "asia-southeast1"
}

variable "runtime_service_account_id" {
  description = "Service account ID used by Cloud Run services."
  type        = string
  default     = "carelink-runtime"
}

variable "artifact_registry_repository" {
  description = "Artifact Registry Docker repository name."
  type        = string
  default     = "carelink-images"
}

variable "enable_identity_platform" {
  description = "Whether to initialize Identity Platform project-level auth config."
  type        = bool
  default     = true
}

variable "identity_platform_authorized_domains" {
  description = "Domains authorized for Identity Platform OAuth redirects. Add frontend custom domains here when available."
  type        = list(string)
  default     = []
}

variable "identity_platform_disable_user_signup" {
  description = "Whether end users are blocked from self-signing up through Identity Platform APIs."
  type        = bool
  default     = false
}

variable "required_services" {
  description = "Google Cloud APIs required by CareLink."
  type        = list(string)
  default = [
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "aiplatform.googleapis.com",
    "sqladmin.googleapis.com",
    "enterpriseknowledgegraph.googleapis.com",
    "run.googleapis.com",
    "iap.googleapis.com",
    "identitytoolkit.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudtrace.googleapis.com",
    "cloudtasks.googleapis.com"
  ]
}

variable "runtime_roles" {
  description = "IAM roles granted to the CareLink runtime service account."
  type        = list(string)
  default = [
    "roles/aiplatform.user",
    "roles/cloudsql.client",
    "roles/cloudsql.instanceUser",
    "roles/enterpriseknowledgegraph.admin",
    "roles/run.invoker",
    "roles/cloudtrace.agent",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter"
  ]
}
