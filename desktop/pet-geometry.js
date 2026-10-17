function petDimensions(percent, sourceWidth=40, sourceHeight=24) {
  return { width: Math.round(120 * percent / 100), height: Math.round(120 * sourceHeight / sourceWidth * percent / 100) };
}
function petWindowDimensions(percent, sourceWidth=40, sourceHeight=24) {
  const { width, height } = petDimensions(percent, sourceWidth, sourceHeight);
  // 为 Windows 小窗口保留 64px 透明外框余量；鼠标区域仍只覆盖实际图案。
  return { width: Math.max(64, width), height: Math.max(64, height) };
}
function scaledShape(rects, percent, sourceWidth=40, sourceHeight=24) {
  const { width, height } = petDimensions(percent, sourceWidth, sourceHeight);
  return rects.map(r => {
    const x = Math.round(r.x * width / sourceWidth), y = Math.round(r.y * height / sourceHeight);
    return { x, y, width: Math.round((r.x + r.width) * width / sourceWidth) - x, height: Math.round((r.y + r.height) * height / sourceHeight) - y };
  }).filter(r => r.width > 0 && r.height > 0);
}
module.exports = { petDimensions, petWindowDimensions, scaledShape };
