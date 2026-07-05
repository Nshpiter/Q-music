param(
  [string] $Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $Root 'resources/icons'
$sizes = @(16, 32, 48, 64, 128, 256, 512)

function New-RoundedRectPath {
  param(
    [System.Drawing.RectangleF] $Rect,
    [float] $Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-QMusicBitmap {
  param([int] $Size)

  $s = $Size / 512.0
  $bmp = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $pad = 20 * $s
  $rect = [System.Drawing.RectangleF]::new($pad, $pad, $Size - $pad * 2, $Size - $pad * 2)
  $radius = 112 * $s
  $bgPath = New-RoundedRectPath $rect $radius
  $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 36, 181, 132),
    [System.Drawing.Color]::FromArgb(255, 45, 112, 205),
    135
  )
  $g.FillPath($bgBrush, $bgPath)

  function Draw-MusicNote {
    param(
      [int] $Alpha,
      [int] $Red,
      [int] $Green,
      [int] $Blue,
      [float] $OffsetX,
      [float] $OffsetY,
      [float] $StrokeWidth
    )

    $color = [System.Drawing.Color]::FromArgb($Alpha, $Red, $Green, $Blue)
    $brush = [System.Drawing.SolidBrush]::new($color)
    $stemPen = [System.Drawing.Pen]::new($color, [Math]::Max(2, $StrokeWidth * $s))
    $flagPen = [System.Drawing.Pen]::new($color, [Math]::Max(2, ($StrokeWidth - 4) * $s))
    $stemPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $stemPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $flagPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $flagPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $headPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $headPath.AddEllipse([System.Drawing.RectangleF]::new((174 + $OffsetX) * $s, (314 + $OffsetY) * $s, 144 * $s, 88 * $s))
    $headMatrix = [System.Drawing.Drawing2D.Matrix]::new()
    $headMatrix.RotateAt(-17, [System.Drawing.PointF]::new((246 + $OffsetX) * $s, (358 + $OffsetY) * $s))
    $headPath.Transform($headMatrix)
    $g.FillPath($brush, $headPath)

    $g.DrawLine($stemPen, (294 + $OffsetX) * $s, (146 + $OffsetY) * $s, (294 + $OffsetX) * $s, (344 + $OffsetY) * $s)

    $flagPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $flagPath.AddBezier(
      (306 + $OffsetX) * $s,
      (146 + $OffsetY) * $s,
      (356 + $OffsetX) * $s,
      (146 + $OffsetY) * $s,
      (395 + $OffsetX) * $s,
      (176 + $OffsetY) * $s,
      (406 + $OffsetX) * $s,
      (226 + $OffsetY) * $s
    )
    $g.DrawPath($flagPen, $flagPath)

    $flagPath.Dispose()
    $headMatrix.Dispose()
    $headPath.Dispose()
    $flagPen.Dispose()
    $stemPen.Dispose()
    $brush.Dispose()
  }

  $softCircleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(34, 255, 255, 255))
  $g.FillEllipse($softCircleBrush, 108 * $s, 90 * $s, 304 * $s, 304 * $s)
  $softCircleBrush.Dispose()

  Draw-MusicNote 250 255 255 250 0 0 38

  $shinePath = New-RoundedRectPath ([System.Drawing.RectangleF]::new(46 * $s, 46 * $s, 420 * $s, 420 * $s)) (92 * $s)
  $shinePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(56, 255, 255, 255), [Math]::Max(1, 4 * $s))
  $g.DrawPath($shinePen, $shinePath)

  $shinePen.Dispose()
  $shinePath.Dispose()
  $bgBrush.Dispose()
  $bgPath.Dispose()
  $g.Dispose()

  return $bmp
}

function Write-UInt16LE {
  param([System.IO.Stream] $Stream, [int] $Value)
  $Stream.WriteByte($Value -band 0xff)
  $Stream.WriteByte(($Value -shr 8) -band 0xff)
}

function Write-UInt32LE {
  param([System.IO.Stream] $Stream, [int64] $Value)
  for ($i = 0; $i -lt 4; $i++) {
    $Stream.WriteByte(($Value -shr ($i * 8)) -band 0xff)
  }
}

function Write-UInt32BE {
  param([System.IO.Stream] $Stream, [int64] $Value)
  for ($i = 3; $i -ge 0; $i--) {
    $Stream.WriteByte(($Value -shr ($i * 8)) -band 0xff)
  }
}

function Write-IcoFile {
  param(
    [string] $Path,
    [array] $Entries
  )

  $stream = [System.IO.File]::Create($Path)
  try {
    Write-UInt16LE $stream 0
    Write-UInt16LE $stream 1
    Write-UInt16LE $stream $Entries.Count

    $offset = 6 + $Entries.Count * 16
    foreach ($entry in $Entries) {
      $widthByte = if ($entry.Size -ge 256) { 0 } else { $entry.Size }
      $stream.WriteByte($widthByte)
      $stream.WriteByte($widthByte)
      $stream.WriteByte(0)
      $stream.WriteByte(0)
      Write-UInt16LE $stream 1
      Write-UInt16LE $stream 32
      Write-UInt32LE $stream $entry.Bytes.Length
      Write-UInt32LE $stream $offset
      $offset += $entry.Bytes.Length
    }

    foreach ($entry in $Entries) {
      $stream.Write($entry.Bytes, 0, $entry.Bytes.Length)
    }
  } finally {
    $stream.Dispose()
  }
}

function Write-IcnsFile {
  param(
    [string] $Path,
    [array] $Entries
  )

  $types = @{
    16 = 'icp4'
    32 = 'icp5'
    64 = 'icp6'
    128 = 'ic07'
    256 = 'ic08'
    512 = 'ic09'
  }

  $blocks = @()
  $totalLength = 8
  foreach ($entry in $Entries) {
    if (!$types.ContainsKey($entry.Size)) { continue }
    $blockLength = 8 + $entry.Bytes.Length
    $blocks += [PSCustomObject]@{
      Type = $types[$entry.Size]
      Length = $blockLength
      Bytes = $entry.Bytes
    }
    $totalLength += $blockLength
  }

  $stream = [System.IO.File]::Create($Path)
  try {
    $header = [System.Text.Encoding]::ASCII.GetBytes('icns')
    $stream.Write($header, 0, $header.Length)
    Write-UInt32BE $stream $totalLength
    foreach ($block in $blocks) {
      $typeBytes = [System.Text.Encoding]::ASCII.GetBytes($block.Type)
      $stream.Write($typeBytes, 0, $typeBytes.Length)
      Write-UInt32BE $stream $block.Length
      $stream.Write($block.Bytes, 0, $block.Bytes.Length)
    }
  } finally {
    $stream.Dispose()
  }
}

New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

$entries = @()
foreach ($size in $sizes) {
  $bitmap = New-QMusicBitmap $size
  $path = Join-Path $iconDir "$($size)x$($size).png"
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  $entries += [PSCustomObject]@{
    Size = $size
    Bytes = [System.IO.File]::ReadAllBytes($path)
  }
}

Copy-Item -LiteralPath (Join-Path $iconDir '512x512.png') -Destination (Join-Path $iconDir 'icon.png') -Force
Write-IcoFile (Join-Path $iconDir 'icon.ico') ($entries | Where-Object { $_.Size -le 256 })
Write-IcnsFile (Join-Path $iconDir 'icon.icns') $entries

Write-Host "Generated Q-music icons in $iconDir"
