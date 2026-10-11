function petDimensions(percent) {
  return { width: Math.round(120 * percent / 100), height: Math.round(72 * percent / 100) };
}
function petWindowDimensions(percent) {
  const { width, height } = petDimensions(percent);
  // 为 Windows 小窗口保留 64px 透明外框余量；鼠标区域仍只覆盖实际图案。
  return { width: Math.max(64, width), height: Math.max(64, height) };
}
function scaledShape(rects, percent) {
  const { width, height } = petDimensions(percent);
  return rects.map(r => {
    const x = Math.round(r.x * width / 40), y = Math.round(r.y * height / 24);
    return { x, y, width: Math.round((r.x + r.width) * width / 40) - x, height: Math.round((r.y + r.height) * height / 24) - y };
  }).filter(r => r.width > 0 && r.height > 0);
}
module.exports = { petDimensions, petWindowDimensions, scaledShape };
