# Starts the Spring Boot API with variables from ..\.env (Windows PowerShell).
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
        $name, $value = $line -split '=', 2
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim().Trim('"'), 'Process')
    }
}
Set-Location (Join-Path $root 'backend')
mvn -q -B spring-boot:run
