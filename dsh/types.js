/** 22 种公文文种元数据 */

export const DOCUMENT_TYPES = [
  { id: 'notice', name: '通知', category: '政府机关', description: '发布、传达要求下级机关执行和有关单位周知或执行的事项。' },
  { id: 'report', name: '报告', category: '政府机关', description: '向上级机关汇报工作、反映情况、回复上级询问。' },
  { id: 'request', name: '请示', category: '政府机关', description: '向上级机关请求指示、批准。' },
  { id: 'letter', name: '函', category: '政府机关', description: '不相隶属机关之间商洽工作、询问和答复问题。' },
  { id: 'minutes', name: '纪要', category: '政府机关', description: '记载会议主要情况和议定事项。' },
  { id: 'meeting', name: '会议纪要', category: '政府机关', description: '会议情况与议定事项的纪要写法。' },
  { id: 'decision', name: '决定', category: '政府机关', description: '对重要事项作出决策和部署。' },
  { id: 'resolution', name: '决议', category: '政府机关', description: '会议讨论通过的重大决策事项。' },
  { id: 'opinion', name: '意见', category: '政府机关', description: '对重要问题提出见解和处理办法。' },
  { id: 'bulletin', name: '通报', category: '政府机关', description: '表彰先进、批评错误、传达重要精神或情况。' },
  { id: 'announcement', name: '通告', category: '政府机关', description: '在一定范围内公布应当遵守或周知的事项。' },
  { id: 'notice_public', name: '公告', category: '政府机关', description: '向国内外宣布重要事项或法定事项。' },
  { id: 'communique', name: '公报', category: '政府机关', description: '公布重要决定或重大事项。' },
  { id: 'command', name: '命令', category: '政府机关', description: '公布行政法规和规章、宣布施行重大强制性措施。' },
  { id: 'reply', name: '批复', category: '政府机关', description: '答复下级机关请示事项。' },
  { id: 'instruction', name: '指示', category: '其他常用', description: '对下级机关布置工作、阐明工作活动指导原则。' },
  { id: 'bill', name: '议案', category: '其他常用', description: '各级人民政府按法律程序向同级人大提请审议事项。' },
  { id: 'regulation', name: '制度', category: '其他常用', description: '规范性管理制度类文稿。' },
  { id: 'summary', name: '总结', category: '其他常用', description: '对一定时期工作进行回顾和分析。' },
  { id: 'work_plan', name: '工作方案', category: '其他常用', description: '对专项工作作出安排部署。' },
  { id: 'technical_proposal', name: '技术方案', category: '其他常用', description: '技术路线与实施方案说明。' },
  { id: 'table_sign', name: '桌签', category: '其他常用', description: '会议桌签样式文稿。' }
]

export const TYPE_ALIASES = [
  ['会议纪要', 'meeting'],
  ['技术方案', 'technical_proposal'],
  ['工作方案', 'work_plan'],
  ['通知', 'notice'],
  ['报告', 'report'],
  ['请示', 'request'],
  ['批复', 'reply'],
  ['函', 'letter'],
  ['纪要', 'minutes'],
  ['决定', 'decision'],
  ['决议', 'resolution'],
  ['意见', 'opinion'],
  ['通报', 'bulletin'],
  ['通告', 'announcement'],
  ['公告', 'notice_public'],
  ['公报', 'communique'],
  ['命令', 'command'],
  ['指示', 'instruction'],
  ['议案', 'bill'],
  ['制度', 'regulation'],
  ['总结', 'summary'],
  ['桌签', 'table_sign']
]

export function listTypes() {
  return DOCUMENT_TYPES.map(item => ({ ...item, enabled: true }))
}

export function typeMeta(id) {
  return DOCUMENT_TYPES.find(item => item.id === id) ?? DOCUMENT_TYPES[0]
}
