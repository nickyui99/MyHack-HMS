output "enabled_services" {
  description = "Google Cloud APIs managed by this Terraform configuration."
  value       = sort(keys(google_project_service.required))
}

output "runtime_service_account_email" {
  description = "Email of the CareLink runtime service account."
  value       = google_service_account.runtime.email
}

output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository resource."
  value       = google_artifact_registry_repository.images.name
}

output "identity_platform_config_name" {
  description = "Identity Platform project config name, when enabled."
  value       = var.enable_identity_platform ? google_identity_platform_config.default[0].name : null
}
