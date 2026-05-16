terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project               = var.project_id
  region                = var.region
  billing_project       = coalesce(var.quota_project_id, var.project_id)
  user_project_override = true
}

resource "google_project_service" "required" {
  for_each = toset(var.required_services)

  project = var.project_id
  service = each.value

  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = var.runtime_service_account_id
  display_name = "CareLink runtime service account"

  depends_on = [
    google_project_service.required
  ]
}

resource "google_project_iam_member" "runtime_roles" {
  for_each = toset(var.runtime_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_artifact_registry_repository" "images" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_registry_repository
  description   = "Docker images for CareLink services"
  format        = "DOCKER"

  depends_on = [
    google_project_service.required
  ]
}

resource "google_identity_platform_config" "default" {
  count = var.enable_identity_platform ? 1 : 0

  project                    = var.project_id
  authorized_domains         = var.identity_platform_authorized_domains
  autodelete_anonymous_users = true

  sign_in {
    email {
      enabled           = true
      password_required = true
    }

    anonymous {
      enabled = false
    }

    phone_number {
      enabled = false
    }
  }

  client {
    permissions {
      disabled_user_signup   = var.identity_platform_disable_user_signup
      disabled_user_deletion = true
    }
  }

  depends_on = [
    google_project_service.required
  ]
}
