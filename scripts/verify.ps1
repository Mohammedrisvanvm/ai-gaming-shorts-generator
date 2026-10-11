$ErrorActionPreference = "Stop"

Write-Host "Checking required commands..."
foreach ($cmd in @("git", "node", "pnpm", "python", "ffmpeg")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Error "Missing command: $cmd. Install it, reopen PowerShell, and retry."
  }
  Write-Host "OK: $cmd"
}

Write-Host "`nNode:"
node --version
Write-Host "`nPython:"
python --version
Write-Host "`nFFmpeg:"
ffmpeg -version | Select-Object -First 1

Write-Host "`nOptional NVIDIA checks:"
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
  nvidia-smi
} else {
  Write-Host "nvidia-smi not found; GPU-specific features are not required for Milestone 1."
}
Write-Host "`nEnvironment checks passed."
