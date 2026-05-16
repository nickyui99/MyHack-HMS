param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId
)

gcloud config set project $ProjectId
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com --project $ProjectId
gcloud auth application-default set-quota-project $ProjectId

Write-Host "Bootstrap complete. Wait 1-3 minutes, then rerun terraform apply."
