$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot 'dist'
$archivePath = Join-Path $projectRoot 'byethost-deploy.zip'
$imagesPath = Join-Path $distPath 'images'
$stagingPath = Join-Path $projectRoot '.byethost-package'
$maxImagePackBytes = 7MB

$projectFullPath = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd('\') + '\'
$stagingFullPath = [System.IO.Path]::GetFullPath($stagingPath)
if (-not $stagingFullPath.StartsWith($projectFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Unsafe staging path: $stagingFullPath"
}

Push-Location $projectRoot
try {
    npm run build
    # Keep the main archive below ByetHost's web-upload limit. Large, stable
    # media folders are uploaded once and preserved between code deployments.
    $deploymentFiles = Get-ChildItem -LiteralPath $distPath -Force |
        Where-Object { $_.Name -notin @('images', 'uploads') } |
        Select-Object -ExpandProperty FullName
    Compress-Archive -LiteralPath $deploymentFiles -DestinationPath $archivePath -Force
    Write-Host "ByetHost package created: $archivePath"

    # ByetHost's browser uploader has a small per-file limit. Split the static
    # images into archives whose uncompressed contents stay comfortably below it.
    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $stagingPath | Out-Null

    Get-ChildItem -LiteralPath $projectRoot -Filter 'byethost-images-*.zip' -File |
        Remove-Item -Force

    $imageFiles = @(Get-ChildItem -LiteralPath $imagesPath -File -Recurse |
        Sort-Object FullName)
    $imageGroups = [System.Collections.Generic.List[object]]::new()
    $currentGroup = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
    [long]$currentSize = 0

    foreach ($imageFile in $imageFiles) {
        if ($currentGroup.Count -gt 0 -and
            ($currentSize + $imageFile.Length) -gt $maxImagePackBytes) {
            $imageGroups.Add($currentGroup.ToArray())
            $currentGroup = [System.Collections.Generic.List[System.IO.FileInfo]]::new()
            $currentSize = 0
        }

        $currentGroup.Add($imageFile)
        $currentSize += $imageFile.Length
    }

    if ($currentGroup.Count -gt 0) {
        $imageGroups.Add($currentGroup.ToArray())
    }

    $imagesFullPath = [System.IO.Path]::GetFullPath($imagesPath).TrimEnd('\') + '\'
    for ($groupIndex = 0; $groupIndex -lt $imageGroups.Count; $groupIndex++) {
        $packNumber = $groupIndex + 1
        $packStagingPath = Join-Path $stagingPath "images-$packNumber"
        $packImagesPath = Join-Path $packStagingPath 'images'
        New-Item -ItemType Directory -Path $packImagesPath -Force | Out-Null

        foreach ($imageFile in $imageGroups[$groupIndex]) {
            $relativePath = $imageFile.FullName.Substring($imagesFullPath.Length)
            $targetPath = Join-Path $packImagesPath $relativePath
            $targetDirectory = Split-Path -Parent $targetPath
            New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
            Copy-Item -LiteralPath $imageFile.FullName -Destination $targetPath
        }

        $imageArchivePath = Join-Path $projectRoot "byethost-images-$packNumber.zip"
        Compress-Archive -LiteralPath $packImagesPath -DestinationPath $imageArchivePath -Force
        Write-Host "ByetHost image package created: $imageArchivePath"
    }
} finally {
    if (Test-Path -LiteralPath $stagingPath) {
        Remove-Item -LiteralPath $stagingPath -Recurse -Force
    }
    Pop-Location
}
