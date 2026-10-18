#!/usr/bin/env bash
# v8.2 書房照片級貼圖產製（一次性，需要 ImageMagick 6）
#
#   bash scripts/make-room-textures.sh <來源圖目錄> [輸出目錄]
#   例：bash scripts/make-room-textures.sh ~/study-room-refs public/textures/study-room
#
# 來源（AI 生成的 1024² 材質圖，見 docs/v8.2-room-texture-prompts.md §7）：
#   tex-walnut.png    → walnut.jpg        書牆胡桃木
#   tex-oak-floor.png → oak-floor.jpg     暖橡木拼板地板
#   tex-marble.png    → marble.jpg        淺灰大理石（桌板／可選地坪）
#   tex-plaster.png   → plaster.jpg       米白細顆粒牆面
#   tex-garden-view.png → garden-view.jpg 窗外庭園（依窗景平面 15:7 裁切，不平貼）
#   tex-book-spines.png → book-spines.jpg 書脊色票（書架背板「塞滿書」深景）
#
# 平貼做法（seamless）：把原圖鏡像拼成 2W×2H，再取中央 W×H —— 邊界值必然相等，
# 平貼無接縫；代價是紋理內含一次鏡像對稱，低對比材質（木紋／大理石／顆粒牆）可忽略。
# 產生後請用 2×2 平貼圖人工確認一次（腳本會順手輸出 tile-check-*.jpg）。
set -euo pipefail

SRC="${1:?需要來源圖目錄}"
OUT="${2:-public/textures/study-room}"
TILE="${TILE:-1024}"   # 平貼圖輸出邊長
CHK="${CHK:-$SRC}"    # 2×2 平貼檢查圖輸出目錄（預設放來源目錄，不進 repo）
QUAL="${QUAL:-88}"

command -v convert >/dev/null || { echo "需要 ImageMagick 的 convert"; exit 1; }
mkdir -p "$OUT"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

seamless() { # $1=來源 $2=輸出
  local w h
  w="$(identify -format %w "$1")"; h="$(identify -format %h "$1")"
  convert "$1" -colorspace sRGB "$tmp/a.png"
  convert "$tmp/a.png" \( +clone -flop \) +append "$tmp/b.png"          # 左右鏡像
  convert "$tmp/b.png" \( "$tmp/b.png" -flip \) -append "$tmp/c.png"     # 上下鏡像
  convert "$tmp/c.png" -gravity center -crop "${w}x${h}+0+0" +repage "$tmp/d.png"
  # 牆面這種低對比材質：加一點細噪訊打破鏡像對稱即可（不要動 -level，
  # 米白牆平均亮度約 82%，level 視窗一夾就整張斷成純白）。
  # 註：噪訊讓邊界差 ±3 級灰階，肉眼與引擎都看不出來，不影響「無接縫」判定。
  local extra=""
  case "$(basename "$2")" in
    plaster.jpg) extra="-attenuate 0.10 +noise Gaussian -blur 0x0.4" ;;
  esac
  convert "$tmp/d.png" -resize "${TILE}x${TILE}" $extra -strip -quality "$QUAL" "$2"
  # 2×2 平貼檢查圖（看十字處有沒有接縫）
  convert "$2" "$2" +append "$tmp/r2.png"
  convert "$tmp/r2.png" "$tmp/r2.png" -append -resize 620x -strip -quality 82 \
    "$CHK/tile-check-$(basename "$2" .jpg).jpg"
}

for pair in "tex-walnut.png:walnut.jpg" "tex-oak-floor.png:oak-floor.jpg" \
            "tex-marble.png:marble.jpg" "tex-plaster.png:plaster.jpg"; do
  src="${pair%%:*}"; dst="${pair##*:}"
  [ -f "$SRC/$src" ] || { echo "缺少 $SRC/$src，跳過"; continue; }
  seamless "$SRC/$src" "$OUT/$dst"
done

# 窗外庭園：對應 sky 平面 15×7（2.143:1），不平貼、隨平面裁切
if [ -f "$SRC/tex-garden-view.png" ]; then
  convert "$SRC/tex-garden-view.png" -resize 1536x717^ -gravity center -extent 1536x717 \
    -colorspace sRGB -strip -quality "$QUAL" "$OUT/garden-view.jpg"
fi
# 書脊色票：書架背板用，保留原始寬幅、不平貼
if [ -f "$SRC/tex-book-spines.png" ]; then
  convert "$SRC/tex-book-spines.png" -resize 1376x -colorspace sRGB -strip \
    -quality "$QUAL" "$OUT/book-spines.jpg"
fi

echo "--- 產出 ---"
identify -format "%f %wx%h %b\n" "$OUT"/*.jpg
echo "$CHK/tile-check-*.jpg 為 2×2 平貼檢查圖，請目視確認無十字接縫。"
