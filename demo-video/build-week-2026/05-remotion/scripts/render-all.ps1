param(
  [switch]$Full
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
Push-Location $project
try {
  npm run typecheck
  npm run qa
  npm run still
  npm run contact-sheet
  if ($Full) {
    npm run render
  } else {
    npm run render:fast
  }
}
finally {
  Pop-Location
}
