# 三件事 · AI 伙伴创作包

把整个文件夹交给你电脑上的 AI agent。无需软件源码，无需 API 密钥，也无需连接在线市场。创作工具只需 Node.js，不依赖第三方包。

可以直接复制这句话给 agent：

> 请先阅读这个文件夹的 AGENTS.md 和 SPEC.md，为“三件事·像素伙伴”创建我喜欢的像素伙伴。先问我想要的角色外观，再用模板制作一个新的 .companion.json 文件，运行校验并生成预览给我看。不要修改软件源码，不要改变我已有的伙伴。完成后告诉我如何从“伙伴广场 → 导入伙伴”导入。

## 制作流程

1. 确定角色外观，按 `SPEC.md` 编辑像素网格。
2. 创建模板：`node cli.js init my-pet.companion.json --id my-pet --name 我的伙伴`。
3. 校验：`node cli.js validate my-pet.companion.json`。
4. 生成预览：`node cli.js preview my-pet.companion.json`，用浏览器打开生成的 HTML。预览会显示三种任务配色。
5. 在软件的“伙伴广场”里选择“导入伙伴”，打开 JSON 文件，再点“使用这个伙伴”。

最终只需要交付 `.companion.json` 文件。没有 Node.js 时，agent 也可以直接按规范生成 JSON，再由软件导入时校验。请保留唯一 id，避免与已有伙伴重名。

这些文件只描述像素与颜色，不包含脚本或网络链接。捏起、拖动、完成消失和每日三件事的交互由软件统一提供。当前版本是单帧像素伙伴格式，不是动画精灵表格式。
