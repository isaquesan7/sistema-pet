# PointVet 17.1 - local, isolated recovery drill. Never transfers private key to Railway.
param(
  [Parameter(Mandatory=$true)][string]$EncryptedBackup,
  [Parameter(Mandatory=$true)][string]$PrivateKey,
  [string]$AgeExe = "age.exe"
)
$ErrorActionPreference = "Stop"
$container = "pointvet-drill-" + [Guid]::NewGuid().ToString("N").Substring(0,12)
$temp = Join-Path ([IO.Path]::GetTempPath()) ("pointvet-drill-" + [Guid]::NewGuid().ToString("N"))
$started = $false
try {
  if (-not (Test-Path -LiteralPath $EncryptedBackup -PathType Leaf)) { throw "Backup encrypted file not found" }
  if (-not (Test-Path -LiteralPath $PrivateKey -PathType Leaf)) { throw "Private key file not found" }
  $age = Get-Command $AgeExe -ErrorAction SilentlyContinue
  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $age) { throw "age.exe not found. Pass -AgeExe 'C:\path\age.exe'." }
  if (-not $docker) { throw "Docker is required for isolated local PostgreSQL 18 restore." }
  New-Item -ItemType Directory -Force -Path $temp | Out-Null
  $dump = Join-Path $temp "restore.dump"
  & $age.Source -d -i $PrivateKey -o $dump $EncryptedBackup
  if ($LASTEXITCODE -ne 0) { throw "Failed to decrypt archive; check private key" }
  if ((Get-Item $dump).Length -lt 20) { throw "Decrypted backup unexpectedly small" }
  & docker run --detach --name $container -e POSTGRES_PASSWORD=temporary-drill-only -e POSTGRES_DB=railway postgres:18-bookworm | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Cannot start isolated PostgreSQL 18 container" }
  $started = $true
  $ready = $false
  for ($i=0; $i -lt 45; $i++) {
    & docker exec $container pg_isready -U postgres -d railway 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ready) { throw "Temporary Postgres did not become ready" }
  & docker cp $dump ("${container}:/tmp/restore.dump") | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Cannot copy backup to temporary container" }
  & docker exec $container pg_restore --exit-on-error --no-owner --no-acl -U postgres -d railway /tmp/restore.dump
  if ($LASTEXITCODE -ne 0) { throw "Restore failed. Do not enable automatic backup until investigated." }
  $tableCount = (& docker exec $container psql -X -qAt -U postgres -d railway -c "SELECT count(*) FROM pg_tables WHERE schemaname='public'").Trim()
  if ($LASTEXITCODE -ne 0 -or [int]$tableCount -eq 0) { throw "No restored public tables" }
  Write-Host "RESTORE VALIDATED: $tableCount public tables in isolated local PostgreSQL 18."
  Write-Host "Next: compare critical counts and migration state with the original database."
}
finally {
  if ($started) { & docker rm -f $container 2>&1 | Out-Null }
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
