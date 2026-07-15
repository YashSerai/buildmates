param(
  [string]$BaseUrl = "",
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
  $listener.Stop()
  # Use the IPv4 loopback explicitly. Windows PowerShell can resolve localhost
  # to ::1 while vinext's production server is listening on IPv4 only.
  $BaseUrl = "http://127.0.0.1:$port"
}
$origin = $BaseUrl.TrimEnd("/")
$targetPort = ([Uri]$origin).Port
$started = $null
$stdout = Join-Path $env:TEMP "buildmates-substrate-stdout.log"
$stderr = Join-Path $env:TEMP "buildmates-substrate-stderr.log"

function Get-StatusCode {
  param([string]$Uri, [string]$Method = "Get", [string]$Body = $null)
  $arguments = @("--silent", "--show-error", "--output", "NUL", "--write-out", "%{http_code}", "--max-time", "5", "--request", $Method.ToUpperInvariant())
  if ($null -ne $Body) { $arguments += @("--header", "Content-Type: application/json", "--data", $Body) }
  $arguments += @("--url", "$Uri")
  $status = & curl.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "curl.exe could not reach $Uri (exit $LASTEXITCODE)." }
  return [int]$status
}

function Assert-Status {
  param([string]$Name, [string]$Uri, [string]$Method, [int[]]$Expected, [string]$Body = $null)
  $status = Get-StatusCode -Uri $Uri -Method $Method -Body $Body
  if ($Expected -notcontains $status) { throw "$Name returned HTTP $status; expected $($Expected -join ', ')." }
  Write-Output "PASS $Name HTTP $status"
}

function Stop-StartedTree {
  param([int]$RootPid)
  $all = Get-CimInstance Win32_Process
  $children = @($all | Where-Object { $_.ParentProcessId -eq $RootPid })
  foreach ($child in $children) { Stop-StartedTree -RootPid $child.ProcessId }
  Stop-Process -Id $RootPid -Force -ErrorAction SilentlyContinue
}

try {
  $reachable = $false
  try { $reachable = (Get-StatusCode -Uri "$origin/capability-check" 2>$null) -eq 200 } catch { $reachable = $false }
  if (-not $reachable -and -not $NoStart) {
    $root = Split-Path -Parent $PSScriptRoot
    $started = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "start", "--workspace", "@buildmates/web", "--", "--host", "127.0.0.1", "--port", "$targetPort") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
      Start-Sleep -Milliseconds 500
      try { if ((Get-StatusCode -Uri "$origin/capability-check" 2>$null) -eq 200) { $reachable = $true; break } } catch {}
    }
  }
  if (-not $reachable) { throw "No Buildmates web server became reachable at $origin. See $stdout and $stderr." }

  Assert-Status "public capability page" "$origin/capability-check" "Get" @(200)
  Assert-Status "D1 authentication boundary" "$origin/api/capability/d1" "Post" @(401)
  Assert-Status "R2 authentication boundary" "$origin/api/capability/r2" "Post" @(401)
  Assert-Status "truthful Sites MCP boundary" "$origin/api/mcp" "Post" @(501)
  Assert-Status "external MCP data route disabled by default" "$origin/api/internal/mcp-data" "Post" @(404) "{}"
  Write-Output "Local unauthenticated substrate smoke passed. Live platform identity and provisioned production bindings remain separate deployment gates."
} finally {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $targetPort -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $listener) { Stop-StartedTree -RootPid $listener.OwningProcess }
  if ($null -ne $started -and -not $started.HasExited) { Stop-StartedTree -RootPid $started.Id }
}
