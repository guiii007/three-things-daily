# Companion Pack v1

一个 UTF-8 JSON 文件，建议后缀 `.companion.json`，最大 64 KB。无脚本、无图片文件、无外部依赖。

| 字段 | 规则 |
| --- | --- |
| format | 固定字符串 `three-things-companion` |
| version | 数字 `1` |
| id | 2～48 位小写字母、数字、连字符；不要使用内置 id `capsule`、`chick` |
| name | 1～40 字的显示名称 |
| description | 最多 300 字 |
| width / height | 16～128 的整数，建议 96×96；小尺寸也可用 40×24 |
| palette | 单个英文字母或数字作为键，对应 `#RRGGBB` 颜色，或 `$primary`、`$shade`、`$shine` 主题颜色标记 |
| frames.idle | height 个字符串，每个恰好 width 个字符；每个字符代表一个像素 |

`.` 表示透明，其余字符必须在 palette 中声明；角色不能完全透明。角色可全部使用固定颜色。为兼容旧伙伴文件，$primary、$shade、$shine 仍受支持，分别固定为 #eec669、#cca249、#ffe7ae，不随任务序号改变。小鸡保持青绿色，不再有环带。固定颜色适合轮廓、眼睛、嘴巴等细节。

完整可运行的示例见 example.companion.json。应用按 JSON 像素网格绘制 SVG 方块，支持 20%～200% 缩放，并按不透明像素裁切鼠标区域。文件不控制窗口位置、任务记录或自动启动。

导入不会覆盖已有 id；重名时请更换 id 后重新导入。像素尺寸与任务名额无关，新增形象不会额外创建任务。

为保证点击区域处理效率，每帧的不透明横向连续片段最多 2048 个。角色比例会保持，正方形角色不会被拉扁。
