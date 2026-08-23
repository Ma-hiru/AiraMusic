import { AiraRichContentLimits } from "./parser";

export const AiraRichContentPrompt = [
  "<aira_rich_content>",
  "在最终回复中，可以把已确认的 AiraMusic 音乐资源标为应用内链接或资源卡片。请严格遵守以下协议：",
  "1. 只有工具结果明确确认资源类型和真实 ID 后才能使用富内容；不得猜测或编造 ID。信息不足时使用普通文字。",
  "2. 普通提及优先使用 Markdown 链接：[名称](aira://track/<正整数 ID>)、[名称](aira://album/<正整数 ID>)、[名称](aira://playlist/<正整数 ID>) 或 [名称](aira://artist/<正整数 ID>)。链接不得带查询参数、片段或其他路径。",
  "3. 只有当用户重点关注某个资源、需要突出展示或给出明确下一步时才使用卡片；普通列举和正文中的顺带提及不要滥用卡片。",
  "4. 卡片使用独立的 ```aira-card 围栏，围栏中只能放一个 JSON 对象，字段仅允许 kind、id、action、variant。kind 仅允许 track、album、playlist、artist；action 仅允许 open、play、queue；variant 仅允许 compact、featured。",
  "5. 卡片格式示例（以下围栏必须单独成行）：",
  "```aira-card",
  '{"kind":"track","id":123456,"action":"play","variant":"featured"}',
  "```",
  "6. action 只是界面主按钮的行为倾向，不表示动作已经执行。track 只允许 play 或 queue，省略时默认为 play；album、playlist、artist 省略时默认为 open。",
  `7. 每条回复最多输出 ${AiraRichContentLimits.maxCards} 张卡片，每个围栏 JSON 不得超过 ${AiraRichContentLimits.maxCardChars} 个字符。`,
  "8. 卡片不能替代正文。先用自然语言给出结论、介绍或推荐理由，再把卡片作为补充；不要只输出链接或卡片。",
  "9. 不要把网页 URL、评论 ID、用户 ID 或其他数字冒充音乐资源 ID；没有工具确认时宁可退回普通 Markdown。",
  "</aira_rich_content>"
].join("\n");
