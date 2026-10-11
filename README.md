# 三件事 · 像素伙伴

**简体中文** | [English](README.en.md)

每天专心做好三件事，让可爱的像素胶囊在桌面上陪你一起完成。轻点伙伴记录心得，完成任务后收获暖心笑脸，并自动生成纯文字 TXT。

[下载 Windows v0.1.6](https://github.com/guiii007/three-things-daily/releases/download/v0.1.6/ThreeThings-0.1.6-Windows.exe) · [查看发布版本](https://github.com/guiii007/three-things-daily/releases) · [网页版在线使用](https://guiii007.github.io/three-things-daily/)

## 桌面版功能

- **每天三件事**：每天最多创建三个伙伴，依次为红、黄、绿像素胶囊。完成后不释放当天名额，新的一天重新计算。
- **桌面陪伴**：切换其他软件时伙伴仍在上方显示；关闭管理窗口后仍可陪伴，系统托盘可重新打开管理窗口或隐藏伙伴。
- **自由摆放**：轻点角色打开任务与心得，按住约半秒后捏起拖动，松手放下并保存位置。
- **可调大小**：通过滑块或数字框设置 20%～200%，实时同步、自动保存，可恢复 100%。角色使用 SVG 像素方块绘制，点击区域随大小变化。
- **纯文字记录**：修改任务、记录心得与灵感，内容自动保存。
- **完成反馈**：角色带着动画消失，暖心像素笑脸和彩色鼓励文字出现，再慢慢淡去。
- **桌面 TXT**：完成时自动将任务内容、时间与心得保存为桌面 TXT；已完成的任务可“补存 TXT”。
- **历史记录**：保留过去的任务与心得，未完成的伙伴继续陪伴；任务可重新开启。

## 开始使用

1. 下载 Windows EXE，双击运行，无需安装 Node.js。
2. 输入今天想完成的一件事，点击“召唤伙伴”。
3. 轻点伙伴写心得；按住约半秒捏起并拖动，松手放下。
4. 拖动“伙伴大小”滑块，或输入 20～200 的整数，调整桌面伙伴大小。
5. 完成后点击“这件事完成啦 √”，TXT 会直接保存在 Windows 桌面。

升级前请通过管理窗口或系统托盘退出旧版，再打开新版。已有任务、心得和大小设置会继续读取。

## 数据与记录

桌面版数据保存在 `%APPDATA%/three-things-companion/tasks.json`，包括任务、心得、位置与大小设置，不上传服务器。完成记录是保存当时内容的纯文字快照，直接放在 Windows 桌面，不创建日期子文件夹。

旧版生成的 TXT 保留在原位置；使用“补存 TXT”可以将记录重新保存到桌面。重新开启并再次完成任务会生成新的 TXT，保留上一次完成记录。备份时建议同时保存任务数据文件和 TXT 文件。

当前桌面版为 Windows 试用版，暂未提供自动更新或其他角色。

## 网页版

原单文件网页版仍可独立使用：[在线打开](https://guiii007.github.io/three-things-daily/)，或下载 `index.html` 后用浏览器打开。

网页版提供任务管理、心得记录与 TXT 导出，使用深色主题和响应式布局。数据保存在当前浏览器的 LocalStorage 中。桌面版和网页版分别保存数据，不会自动同步或迁移。

## 开发

桌面版使用 Electron、原生 JavaScript、SVG 和离线像素字体；Windows 鼠标状态由 Koffi 调用原生 API 读取。网页版使用 HTML、原生 JavaScript、Tailwind CSS CDN 和 LocalStorage。

```powershell
git clone https://github.com/guiii007/three-things-daily.git
cd three-things-daily
npm.cmd ci
npm.cmd test
npm.cmd start
npm.cmd run build
```

Windows 构建输出在 `dist` 目录。更多运行、测试与字体授权说明见[桌面版说明](desktop/README.md)。

```text
three-things-daily/
├── README.md          # 中文介绍
├── README.en.md       # English introduction
├── index.html         # 原单文件网页版
├── capsule-local.html # 浏览器伙伴原型
├── desktop/           # Electron 桌面版源码、资源与测试
├── package.json       # 依赖与开发命令
└── package-lock.json  # 依赖版本锁定
```

## License

MIT © [guiii007](https://github.com/guiii007)。离线像素字体的授权文件随软件分发，详见 `desktop/assets/font/LICENSE`。
