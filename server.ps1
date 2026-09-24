param(
  [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDirectory = Join-Path $Root 'data'
$DataFile = Join-Path $DataDirectory 'ballot.json'
$AllowedPositions = @('President', 'Vice President', 'Secretary', 'Treasurer')
$Palette = @('maya', 'jonah', 'alina', 'sam')
$Sessions = @{}

if (-not (Test-Path $DataDirectory)) {
  New-Item -ItemType Directory -Path $DataDirectory | Out-Null
}

if (-not (Test-Path $DataFile)) {
  $initialState = [ordered]@{
    candidates = @(
      [ordered]@{ id = 'maya'; name = 'Maya Chen'; position = 'President'; bio = 'Product designer - Austin'; votes = 488; color = 'maya' },
      [ordered]@{ id = 'jonah'; name = 'Jonah Reed'; position = 'President'; bio = 'Documentary maker - Detroit'; votes = 402; color = 'jonah' },
      [ordered]@{ id = 'alina'; name = 'Alina Petrov'; position = 'Vice President'; bio = 'Creative technologist - Lisbon'; votes = 244; color = 'alina' },
      [ordered]@{ id = 'sam'; name = 'Sam Williams'; position = 'Treasurer'; bio = 'Community builder - Oakland'; votes = 150; color = 'sam' }
    )
    votedTokens = @()
  }
  $initialState | ConvertTo-Json -Depth 8 | Set-Content -Path $DataFile -Encoding UTF8
}

$adminUsername = $env:VOICEBOARD_ADMIN_USER
$adminPassword = $env:VOICEBOARD_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminUsername)) { $adminUsername = 'admin' }
if ([string]::IsNullOrWhiteSpace($adminPassword)) {
  $adminPassword = [Guid]::NewGuid().ToString('N').Substring(0, 16)
  Write-Host "Generated admin password for this server run: $adminPassword" -ForegroundColor Yellow
  Write-Host 'Set VOICEBOARD_ADMIN_PASSWORD before deployment to use a permanent secret.' -ForegroundColor Yellow
}

function Read-State {
  return (Get-Content -Path $DataFile -Raw | ConvertFrom-Json)
}

function Save-State($state) {
  $state | ConvertTo-Json -Depth 8 | Set-Content -Path $DataFile -Encoding UTF8
}

function Send-Json($context, [int]$status, $payload) {
  $bytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Depth 8 -Compress))
  $context.Response.StatusCode = $status
  $context.Response.ContentType = 'application/json; charset=utf-8'
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.Close()
}

function Read-Body($context) {
  $reader = New-Object IO.StreamReader($context.Request.InputStream, $context.Request.ContentEncoding)
  try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
}

function Get-Session($context) {
  $cookie = $context.Request.Cookies['voiceboard_session']
  if ($null -eq $cookie) { return $null }
  return $Sessions[$cookie.Value]
}

function Test-AdminSession($context) {
  $session = Get-Session $context
  if ($null -eq $session) {
    Send-Json $context 401 @{ error = 'Admin sign-in required.' }
    return $false
  }
  return $true
}

function New-Id {
  return "candidate-$([Guid]::NewGuid().ToString('N').Substring(0, 12))"
}

function Get-MimeType($path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js' { return 'text/javascript; charset=utf-8' }
    '.css' { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    default { return 'application/octet-stream' }
  }
}

function Send-StaticFile($context, $relativePath) {
  $safePath = $relativePath.TrimStart('/') -replace '/', [IO.Path]::DirectorySeparatorChar
  if ([string]::IsNullOrWhiteSpace($safePath)) { $safePath = 'index.html' }
  $fullPath = [IO.Path]::GetFullPath((Join-Path $Root $safePath))
  if (-not $fullPath.StartsWith([IO.Path]::GetFullPath($Root), [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $fullPath -PathType Leaf)) {
    Send-Json $context 404 @{ error = 'Not found.' }
    return
  }
  $bytes = [IO.File]::ReadAllBytes($fullPath)
  $context.Response.StatusCode = 200
  $context.Response.ContentType = Get-MimeType $fullPath
  $context.Response.ContentLength64 = $bytes.Length
  $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $context.Response.Close()
}

$listener = New-Object Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Voiceboard live server running at http://localhost:$Port/" -ForegroundColor Green
Write-Host "Admin workspace: http://localhost:$Port/admin.html" -ForegroundColor Green
Write-Host "Admin username: $adminUsername" -ForegroundColor Yellow

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $path = $context.Request.Url.AbsolutePath
      $method = $context.Request.HttpMethod

      if ($path -eq '/api/candidates' -and $method -eq 'GET') {
        $state = Read-State
        Send-Json $context 200 @{ candidates = @($state.candidates) }
      } elseif ($path -eq '/api/vote' -and $method -eq 'POST') {
        $body = Read-Body $context
        if ([string]::IsNullOrWhiteSpace($body.candidateId) -or [string]::IsNullOrWhiteSpace($body.voterToken)) {
          Send-Json $context 400 @{ error = 'Candidate and voter token are required.' }
          continue
        }
        $state = Read-State
        if (@($state.votedTokens) -contains $body.voterToken) {
          Send-Json $context 409 @{ error = 'This browser has already voted.' }
          continue
        }
        $candidate = @($state.candidates) | Where-Object { $_.id -eq $body.candidateId } | Select-Object -First 1
        if ($null -eq $candidate) {
          Send-Json $context 404 @{ error = 'Candidate not found.' }
          continue
        }
        $candidate.votes = [int]$candidate.votes + 1
        $state.votedTokens = @($state.votedTokens) + $body.voterToken
        Save-State $state
        Send-Json $context 200 @{ message = 'Vote recorded.' }
      } elseif ($path -eq '/api/admin/login' -and $method -eq 'POST') {
        $body = Read-Body $context
        if ($body.username -ne $adminUsername -or $body.password -ne $adminPassword) {
          Send-Json $context 401 @{ error = 'Invalid administrator credentials.' }
          continue
        }
        $token = [Guid]::NewGuid().ToString('N')
        $Sessions[$token] = @{ created = Get-Date }
        $cookie = New-Object Net.Cookie('voiceboard_session', $token, '/')
        $cookie.HttpOnly = $true
        $context.Response.AppendCookie($cookie)
        Send-Json $context 200 @{ message = 'Signed in.' }
      } elseif ($path -eq '/api/admin/candidates' -and $method -eq 'POST') {
        if (-not (Test-AdminSession $context)) { continue }
        $body = Read-Body $context
        if ([string]::IsNullOrWhiteSpace($body.name) -or [string]::IsNullOrWhiteSpace($body.bio) -or $AllowedPositions -notcontains $body.position) {
          Send-Json $context 400 @{ error = 'Name, position, and bio are required.' }
          continue
        }
        $state = Read-State
        $newCandidate = [ordered]@{ id = New-Id; name = $body.name.Trim(); position = $body.position; bio = $body.bio.Trim(); votes = 0; color = $Palette[@($state.candidates).Count % $Palette.Count] }
        $state.candidates = @($state.candidates) + $newCandidate
        Save-State $state
        Send-Json $context 201 @{ message = "$($newCandidate.name) was added under $($newCandidate.position)." }
      } elseif ($path -like '/api/admin/candidates/*' -and $method -eq 'DELETE') {
        if (-not (Test-AdminSession $context)) { continue }
        $candidateId = [Uri]::UnescapeDataString($path.Substring('/api/admin/candidates/'.Length))
        $state = Read-State
        $candidate = @($state.candidates) | Where-Object { $_.id -eq $candidateId } | Select-Object -First 1
        if ($null -eq $candidate) {
          Send-Json $context 404 @{ error = 'Candidate not found.' }
          continue
        }
        $state.candidates = @($state.candidates) | Where-Object { $_.id -ne $candidateId }
        Save-State $state
        Send-Json $context 200 @{ message = "$($candidate.name) was removed from the ballot." }
      } else {
        Send-StaticFile $context $path
      }
    } catch {
      if ($context.Response.OutputStream.CanWrite) { Send-Json $context 500 @{ error = 'The server encountered an error.' } }
      Write-Host $_.Exception.Message -ForegroundColor Red
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
