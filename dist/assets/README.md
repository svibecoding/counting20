# 視覺素材

本資料夾的四個 PNG 均由 OpenAI 內建 ImageGen 為本遊戲原創生成，採透明背景、粗深藍輪廓、簡單平面形狀和一致的黃／藍／橙配色。網站只透過 CSS 路徑引用素材；日後可用同名檔案直接替換，不需改動遊戲邏輯。

- `bus.png`：側面黃色巴士
- `bus-stop.png`：巴士站牌
- `passengers.png`：8 位一致比例的高小學生角色 sprite sheet
- `faces/face-1.png` 至 `face-8.png`：由原創角色合圖逐一裁出的獨立面部；遊戲實際使用這些檔案，避免顯示相鄰角色殘影
- `footprints.png`：乘客上車後的空位／腳印標記

生成提示的共同要求為：透明背景、clean flat 2D vector-like game illustration、very thick dark navy outlines、no text、no logos、no watermark、no gradients、minimal detail、high contrast、suitable for students with moderate visual impairment。個別素材再分別指定黃色側面巴士、巴士站牌、8 位同視角同基線學生，以及框內腳印。
