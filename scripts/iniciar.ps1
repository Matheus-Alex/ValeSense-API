$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "..\backend"
Push-Location $project
try {
    $required = @(
        "node_modules/typescript/bin/tsc",
        "node_modules/prisma/build/index.js",
        "node_modules/express-rate-limit/package.json",
        "node_modules/otplib/package.json",
        "node_modules/qrcode/package.json"
    )
    if ($required | Where-Object { -not (Test-Path -LiteralPath $_) }) {
        & npm.cmd ci --ignore-scripts
        if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependências da API." }
    }
    & npm.cmd run local
    if ($LASTEXITCODE -ne 0) { throw "Falha ao iniciar a API ValeSense." }
} finally {
    Pop-Location
}
