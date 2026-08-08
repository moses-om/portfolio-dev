# Auto-sync script: Checks git status every 5 minutes (300 seconds) and pushes new changes to GitHub
$projectPath = "c:\Users\moses\Desktop\WEBproject"

Write-Host "Starting 5-minute Auto-Sync process for $projectPath..." -ForegroundColor Green

while ($true) {
    Set-Location $projectPath
    $status = git status --porcelain
    if ($status) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] Changes detected! Staging and committing..." -ForegroundColor Yellow
        git add .
        git commit -m "Auto-sync update: $timestamp"
        git push origin master
        Write-Host "[$timestamp] Successfully pushed to GitHub!" -ForegroundColor Green
    } else {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "[$timestamp] No changes detected. Sleeping for 5 minutes..." -ForegroundColor Cyan
    }
    Start-Sleep -Seconds 300
}
