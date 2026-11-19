param([switch]$Install, [ValidateSet("OpenAI", "DeepSeek")][string]$Provider = "OpenAI")
$ErrorActionPreference = "Stop"
$repoPath = Split-Path $PSScriptRoot -Parent
Set-Location $repoPath
if (-not (Test-Path -LiteralPath "$PSScriptRoot/.venv/Scripts/python.exe")) {
    python -m venv "$PSScriptRoot/.venv"
    if ($LASTEXITCODE -ne 0) { throw "Python venv creation failed" }
    $Install = $true
}
$voicePython = "$PSScriptRoot/.venv/Scripts/python.exe"
if ($Install) {
    & $voicePython -m pip install -r "$PSScriptRoot/requirements.txt"
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
}
if (-not $env:OPENAI_API_KEY) {
    $voiceSecret = Read-Host "LLM API key (hidden; session environment only)" -AsSecureString
    $voicePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($voiceSecret)
    try { $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($voicePointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($voicePointer) }
}
if ($Provider -eq "DeepSeek") {
    $env:OPENAI_BASE_URL = "https://api.deepseek.com"
    $env:LLM_MODEL = "deepseek-chat"
} else {
    $env:OPENAI_BASE_URL = "https://api.openai.com/v1"
    $env:LLM_MODEL = "gpt-4o-mini"
}
Write-Host "First run downloads the Whisper model. LLM may incur provider charges; TTS needs internet."
Write-Host "Frontend (separate terminal): python -B scripts/dfplan/serve-demo.py --port 8086"
Write-Host "Open http://localhost:8086/dfplan/?demo=1 then Interview beta > Settings > Live WS"
& $voicePython -m uvicorn backend.server:app --host 127.0.0.1 --port 8765
if ($LASTEXITCODE -ne 0) { throw "Voice backend exited with an error" }
