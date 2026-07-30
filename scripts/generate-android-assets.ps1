param(
    [string]$Source = (Join-Path $PSScriptRoot "../doc/images/icon.png")
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$sourcePath = Resolve-Path -LiteralPath $Source
$resourceRoot = Join-Path $projectRoot "android/app/src/main/res"
$backgroundColor = [System.Drawing.ColorTranslator]::FromHtml("#F7F5F0")

function New-Canvas {
    param(
        [int]$Width,
        [int]$Height,
        [bool]$Transparent
    )

    $bitmap = [System.Drawing.Bitmap]::new(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.Clear($(if ($Transparent) { [System.Drawing.Color]::Transparent } else { $backgroundColor }))

    return @{
        Bitmap = $bitmap
        Graphics = $graphics
    }
}

function Save-LogoCanvas {
    param(
        [System.Drawing.Image]$Logo,
        [string]$Destination,
        [int]$Width,
        [int]$Height,
        [int]$LogoSize,
        [bool]$Transparent
    )

    $directory = Split-Path -Parent $Destination
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null

    $canvas = New-Canvas -Width $Width -Height $Height -Transparent $Transparent
    try {
        $x = [int](($Width - $LogoSize) / 2)
        $y = [int](($Height - $LogoSize) / 2)
        $canvas.Graphics.DrawImage($Logo, $x, $y, $LogoSize, $LogoSize)
        $canvas.Bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $canvas.Graphics.Dispose()
        $canvas.Bitmap.Dispose()
    }
}

$logo = [System.Drawing.Image]::FromFile($sourcePath)
try {
    $iconSizes = [ordered]@{
        "mdpi" = 48
        "hdpi" = 72
        "xhdpi" = 96
        "xxhdpi" = 144
        "xxxhdpi" = 192
    }

    foreach ($density in $iconSizes.Keys) {
        $size = $iconSizes[$density]
        $directory = Join-Path $resourceRoot "mipmap-$density"
        Save-LogoCanvas -Logo $logo -Destination (Join-Path $directory "ic_launcher.png") -Width $size -Height $size -LogoSize $size -Transparent $true
        Save-LogoCanvas -Logo $logo -Destination (Join-Path $directory "ic_launcher_round.png") -Width $size -Height $size -LogoSize $size -Transparent $true
    }

    Save-LogoCanvas `
        -Logo $logo `
        -Destination (Join-Path $resourceRoot "drawable-nodpi/q_music_icon_foreground.png") `
        -Width 432 `
        -Height 432 `
        -LogoSize 300 `
        -Transparent $true

    $splashSizes = [ordered]@{
        "mdpi" = @(270, 480)
        "hdpi" = @(356, 634)
        "xhdpi" = @(540, 960)
        "xxhdpi" = @(810, 1440)
        "xxxhdpi" = @(1080, 1920)
    }

    foreach ($density in $splashSizes.Keys) {
        $portraitWidth, $portraitHeight = $splashSizes[$density]
        $logoSize = [int]([Math]::Round($portraitWidth * 0.36))

        Save-LogoCanvas `
            -Logo $logo `
            -Destination (Join-Path $resourceRoot "drawable-$density/launch_screen.png") `
            -Width $portraitWidth `
            -Height $portraitHeight `
            -LogoSize $logoSize `
            -Transparent $false

        Save-LogoCanvas `
            -Logo $logo `
            -Destination (Join-Path $resourceRoot "drawable-land-$density/launch_screen.png") `
            -Width $portraitHeight `
            -Height $portraitWidth `
            -LogoSize $logoSize `
            -Transparent $false
    }
}
finally {
    $logo.Dispose()
}

Write-Output "Android icons and launch screens generated from $sourcePath"
