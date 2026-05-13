// 网文类型知识库 — 为 AI 功能提供类型特征数据

export interface PacingFormula {
  microClimax: string
  midClimax: string
  arcStructure: string
  cliffhangerTips: string[]
}

export interface SubGenreKnowledge {
  id: string
  name: string
  features: string[]
  rhythmNotes: string
}

export interface GenreKnowledge {
  id: string
  name: string
  subgenres: SubGenreKnowledge[]
  corePatterns: string[]
  pacingFormula: PacingFormula
  taboos: string[]
  hookTechniques: string[]
  characterArchetypes: string[]
}

export const GENRE_KNOWLEDGE_BASE: GenreKnowledge[] = [
  {
    id: 'xuanhuan',
    name: '玄幻',
    subgenres: [
      { id: 'upgrade', name: '升级流', features: ['修炼等级体系清晰', '主角从弱到强不断突破', '地图随等级扩展'], rhythmNotes: '每次升级是一个小高潮，境界跨越是中高潮' },
      { id: 'face-slap', name: '打脸流', features: ['反派轻视主角', '主角实力打脸', '围观群众震惊'], rhythmNotes: '打脸频率3-5章一次，每次打脸后留新悬念' },
      { id: 'map-expand', name: '地图扩展', features: ['从小村庄到大陆到更高位面', '每个地图有新的势力格局', '旧地图角色逐渐退场'], rhythmNotes: '每换一个地图相当于新开一卷' }
    ],
    corePatterns: ['废材逆袭', '退婚打脸', '宗门争斗', '秘境探险', '拍卖会装逼', '天才大会'],
    pacingFormula: {
      microClimax: '3-5章一个小高潮（打脸、突破、获得宝物）',
      midClimax: '20-30章一个中高潮（大战、境界跨越、地图转换）',
      arcStructure: '起（困境）→ 承（修炼/机遇）→ 转（大战/危机）→ 合（突破/打脸）→ 引出下一个循环',
      cliffhangerTips: ['章末出现更强的敌人', '突然获得重要线索', '主角陷入危机', '有人挑战主角']
    },
    taboos: ['实力崩坏（前后设定矛盾）', '节奏拖沓（连续多章无爽点）', '设定堆砌（大段世界观说明）', '配角喧宾夺主'],
    hookTechniques: ['悬念前置（先写结果再倒叙）', '危机开局（第一章就是困境）', '金手指觉醒（获得神秘传承）', '身份反转（废材其实是...）'],
    characterArchetypes: ['废材逆袭主角', '世外高人师父', '傲慢天才反派', '忠心追随者', '神秘美女']
  },
  {
    id: 'dushi',
    name: '都市',
    subgenres: [
      { id: 'rebirth', name: '重生流', features: ['回到过去带着前世记忆', '利用先知优势布局', '弥补前世遗憾'], rhythmNotes: '前期信息差带来的爽感最密集，中后期需要新的冲突点' },
      { id: 'system', name: '系统流', features: ['获得游戏化系统', '任务驱动', '奖励反馈明确'], rhythmNotes: '每次完成任务获得奖励是一个爽点' },
      { id: 'business', name: '商战流', features: ['商业博弈', '资本运作', '人际算计'], rhythmNotes: '商战节奏偏慢，需要穿插情感线调节' }
    ],
    corePatterns: ['装逼打脸', '逆袭翻盘', '身份暴露', '美女总裁', '家族恩怨', '医术/鉴宝展现实力'],
    pacingFormula: {
      microClimax: '2-3章一个小爽点（打脸、赚钱、获认可）',
      midClimax: '15-20章一个中高潮（身份暴露、商战胜利、大事件）',
      arcStructure: '日常铺垫 → 矛盾触发 → 实力展现 → 打脸收场 → 新的挑战',
      cliffhangerTips: ['有人找茬', '突发事件', '感情升温被打断', '新的机遇出现']
    },
    taboos: ['逻辑漏洞（现实题材经不起推敲）', '过度YY（不切实际的爽感）', '感情线混乱', '节奏过慢（日常水文）'],
    hookTechniques: ['第一章就获得金手指', '开局被看不起', '意外获得巨额财富/能力', '与美女的尴尬相遇'],
    characterArchetypes: ['低调隐藏实力的主角', '傲慢富二代反派', '美女总裁/校花', '忠心兄弟', '世外高人']
  },
  {
    id: 'yanqing',
    name: '言情',
    subgenres: [
      { id: 'sweet', name: '甜宠', features: ['高甜互动', '男主宠女主', '少虐多糖'], rhythmNotes: '甜度要持续在线，偶尔小虐调剂' },
      { id: 'angst', name: '虐恋', features: ['误会重重', '分离重逢', '虐心情节'], rhythmNotes: '虐点要控制节奏，不能一直虐，需要甜蜜穿插' },
      { id: 'contract', name: '先婚后爱', features: ['契约关系开始', '日久生情', '从假到真'], rhythmNotes: '暧昧期拉长，确认感情后加速' }
    ],
    corePatterns: ['误会制造冲突', '第三者介入', '身份隐瞒', '家族反对', '失忆重逢', '霸道总裁爱上我'],
    pacingFormula: {
      microClimax: '3-5章一个情感推进（心动瞬间、误会化解、甜蜜互动）',
      midClimax: '15-25章一个大转折（告白、分离、重大误会、身份揭露）',
      arcStructure: '相遇 → 相知 → 心动 → 误会/阻碍 → 确认心意 → 更大考验 → HE/BE',
      cliffhangerTips: ['突然的亲密接触', '误会加深', '第三者出现', '身份暴露']
    },
    taboos: ['甜虐比例失衡（纯虐流失读者）', '感情升温太快（缺乏铺垫）', '人设崩塌（角色前后不一致）', '强行制造误会'],
    hookTechniques: ['男女主前几章必须见面', '第一印象要深刻', '制造化学反应', '留下悬念（他/她是谁？）'],
    characterArchetypes: ['独立坚强女主', '外冷内热男主', '温柔备胎男二', '恶毒女配', '助攻闺蜜']
  },
  {
    id: 'xuanyi',
    name: '悬疑',
    subgenres: [
      { id: 'detective', name: '推理悬疑', features: ['逻辑推理为核心', '线索环环相扣', '真相出人意料'], rhythmNotes: '每个章节都要推进调查进度或揭示新线索' },
      { id: 'horror', name: '恐怖悬疑', features: ['氛围营造', '心理恐怖', '细思极恐'], rhythmNotes: '恐怖感要逐渐升级，不能一开始就高潮' },
      { id: 'suspense', name: '惊悚悬疑', features: ['紧张感持续', '主角身处险境', '步步逼近真相'], rhythmNotes: '紧张感要一直维持，适时释放再拉紧' }
    ],
    corePatterns: ['密室杀人', '连环杀手', '身份反转', '叙述性诡计', '不可能犯罪', '身边人就是凶手'],
    pacingFormula: {
      microClimax: '每章结尾留悬念（新线索、新疑点、新危险）',
      midClimax: '10-15章一个大转折（关键线索、嫌疑人反转、真相揭露）',
      arcStructure: '设谜（25%）→ 调查追踪（50%）→ 揭谜收网（25%）',
      cliffhangerTips: ['发现关键证据', '嫌疑人被排除', '新的受害者出现', '主角陷入危险']
    },
    taboos: ['逻辑链断裂（经不起推敲）', '线索缺失（没有给读者足够信息）', '主角突然开挂式推理', '结局虎头蛇尾'],
    hookTechniques: ['第一章必须有案件/谜团', '死亡开局', '异常现象引入', '主角卷入事件'],
    characterArchetypes: ['天才侦探', '可靠助手', '迷惑性嫌疑人', '隐藏的真凶', '关键证人']
  },
  {
    id: 'xianxia',
    name: '仙侠',
    subgenres: [
      { id: 'cultivation', name: '修仙流', features: ['练气→筑基→金丹→元婴→化神', '渡劫飞升', '寿命与实力挂钩'], rhythmNotes: '每次境界突破是一个里程碑，渡劫是大高潮' },
      { id: 'sword', name: '剑修流', features: ['以剑入道', '剑意境界', '一剑破万法'], rhythmNotes: '剑道突破比一般修炼更有仪式感' },
      { id: 'alchemy', name: '丹修/器修', features: ['炼丹炼器', '辅助类修炼', '以丹入道'], rhythmNotes: '炼丹成功是爽点，但节奏偏慢需要穿插战斗' }
    ],
    corePatterns: ['宗门考核', '秘境历练', '渡劫', '飞升', '仙凡之恋', '道心考验'],
    pacingFormula: {
      microClimax: '5-8章一个小突破（领悟功法、击败对手、获得机缘）',
      midClimax: '30-50章一个大境界突破（金丹、元婴、渡劫）',
      arcStructure: '入道 → 修炼 → 历练 → 突破 → 新的天地 → 更高的追求',
      cliffhangerTips: ['天地异象预示突破', '强敌来袭', '秘境开启', '道心考验降临']
    },
    taboos: ['境界体系混乱', '战力数值崩坏', '修仙描写缺乏意境', '渡劫写得太随意'],
    hookTechniques: ['仙缘偶遇', '废材灵根觉醒', '上古传承', '穿越重生到修仙世界'],
    characterArchetypes: ['逆天资质主角', '隐世老怪', '仙子道侣', '宗门天骄', '魔道对手']
  },
  {
    id: 'kehuan',
    name: '科幻',
    subgenres: [
      { id: 'hard', name: '硬科幻', features: ['基于真实科学理论', '技术细节丰富', '逻辑自洽'], rhythmNotes: '技术描写要适度，不能淹没故事' },
      { id: 'soft', name: '软科幻', features: ['侧重社会/人性探讨', '科技为背景', '思想实验'], rhythmNotes: '节奏取决于人物冲突而非技术细节' },
      { id: 'space', name: '星际科幻', features: ['星际文明', '太空战争', '多物种交流'], rhythmNotes: '世界观宏大，需要控制信息量' }
    ],
    corePatterns: ['文明碰撞', '技术突破', '星际探索', 'AI觉醒', '时间悖论', '末日生存'],
    pacingFormula: {
      microClimax: '5-8章一个技术突破或危机化解',
      midClimax: '20-30章一个大事件（文明接触、星际战争、技术革命）',
      arcStructure: '发现 → 探索 → 理解 → 冲突 → 解决 → 新的未知',
      cliffhangerTips: ['发现异常信号', '技术出现突破/危机', '外星文明接触', '时间线变化']
    },
    taboos: ['科学常识错误', '技术设定前后矛盾', '过度解释技术细节', '世界观逻辑不通'],
    hookTechniques: ['未来世界开篇', '异常现象引入', '主角发现惊天秘密', '末日倒计时'],
    characterArchetypes: ['科学家主角', 'AI伙伴', '军方代表', '外星接触者', '普通人在大时代']
  },
  {
    id: 'lishi',
    name: '历史',
    subgenres: [
      { id: 'alternate', name: '架空历史', features: ['虚构朝代', '借鉴真实历史元素', '自由度高'], rhythmNotes: '需要建立完整的历史世界观' },
      { id: 'travel', name: '穿越历史', features: ['穿越到真实朝代', '改变历史走向', '利用现代知识'], rhythmNotes: '历史知识要准确，改编要合理' },
      { id: 'politics', name: '权谋历史', features: ['朝堂争斗', '派系博弈', '帝王心术'], rhythmNotes: '权谋节奏偏慢，需要耐心铺垫' }
    ],
    corePatterns: ['科举入仕', '沙场征战', '朝堂博弈', '改革变法', '家族兴衰', '帝王崛起'],
    pacingFormula: {
      microClimax: '5-8章一个小胜利（打赢一场仗、通过一次考验、挫败一次阴谋）',
      midClimax: '25-40章一个大事件（登基、大战、改革成功、灭国）',
      arcStructure: '起势 → 积蓄力量 → 关键一战 → 获得地位 → 更大的挑战',
      cliffhangerTips: ['战报传来', '朝堂变天', '敌人阴谋曝光', '意外盟友出现']
    },
    taboos: ['历史常识错误', '权谋描写太幼稚', '战争场面不真实', '主角过于全能'],
    hookTechniques: ['穿越到关键历史节点', '开局就是危机', '身份特殊（皇子、将军之后）', '目睹历史大事件'],
    characterArchetypes: ['才华横溢的主角', '忠臣良将', '奸臣反派', '明君/昏君', '红颜知己']
  },
  {
    id: 'xitong',
    name: '系统流',
    subgenres: [
      { id: 'game', name: '游戏系统', features: ['等级、属性、技能面板', '任务系统', '装备掉落'], rhythmNotes: '升级和获得装备是核心爽点' },
      { id: 'sign', name: '签到系统', features: ['每日签到获得奖励', '积累型成长', '躺赢风格'], rhythmNotes: '签到奖励要越来越丰厚' },
      { id: 'lottery', name: '抽奖系统', features: ['随机奖励', '赌运气', '惊喜感'], rhythmNotes: '抽奖结果要出人意料又合理' }
    ],
    corePatterns: ['任务发布与完成', '属性面板展示', '技能升级', '装备获取', '系统商店', '隐藏任务'],
    pacingFormula: {
      microClimax: '2-3章完成一个任务获得奖励',
      midClimax: '15-20章系统升级或解锁新功能',
      arcStructure: '获得系统 → 完成任务 → 升级 → 更难的任务 → 系统进化',
      cliffhangerTips: ['系统发布新任务', '获得稀有奖励', '系统出现异常', '隐藏功能解锁']
    },
    taboos: ['系统设定过于复杂', '数值膨胀太快', '主角沦为系统傀儡', '任务重复无趣'],
    hookTechniques: ['第一章就获得系统', '系统选择宿主', '死亡后觉醒系统', '系统绑定在特殊物品上'],
    characterArchetypes: ['普通主角+系统', '系统精灵/助手', '竞争者（也有系统）', '被系统选中的人', '系统的创造者']
  },
  {
    id: 'wuxian',
    name: '无限流',
    subgenres: [
      { id: 'dungeon', name: '副本流', features: ['进入不同副本完成任务', '副本世界观各异', '团队配合'], rhythmNotes: '每个副本是一个独立故事，副本间有过渡期' },
      { id: 'game-survival', name: '游戏生存', features: ['生存游戏', '淘汰机制', '策略博弈'], rhythmNotes: '紧张感要持续，每轮淘汰是高潮' },
      { id: 'world-hop', name: '世界穿越', features: ['穿越不同作品/世界', '借用原作设定', '改变原作剧情'], rhythmNotes: '每个世界有不同风格，需要快速适应' }
    ],
    corePatterns: ['副本探索', '团队组建', 'BOSS战', '积分兑换', '隐藏剧情', '玩家对抗'],
    pacingFormula: {
      microClimax: '每个副本通关是一个中高潮，副本内每通过一关是小高潮',
      midClimax: '3-5个副本后一个大事件（系统升级、玩家大战、世界真相）',
      arcStructure: '进入副本 → 探索 → 危机 → 通关 → 休整 → 下一个副本',
      cliffhangerTips: ['副本难度突增', '队友背叛', '发现副本隐藏规则', 'BOSS二阶段']
    },
    taboos: ['副本设计无新意', '团队角色脸谱化', '通关方式太简单', '世界观切换生硬'],
    hookTechniques: ['强制拉入游戏', '第一次副本就是生死考验', '发现游戏的真正目的', '主角有特殊身份'],
    characterArchetypes: ['冷静分析型主角', '热血战斗型队友', '智囊型辅助', '叛徒/卧底', '游戏管理员']
  }
]

export function getGenreKnowledge(genreId: string): GenreKnowledge | undefined {
  return GENRE_KNOWLEDGE_BASE.find(g => g.id === genreId)
}

export function getGenreList(): { id: string; name: string }[] {
  return GENRE_KNOWLEDGE_BASE.map(g => ({ id: g.id, name: g.name }))
}

export function formatKnowledgeForPrompt(genreId: string): string {
  const genre = getGenreKnowledge(genreId)
  if (!genre) return ''

  const lines: string[] = [`【${genre.name} - 写作知识库】`]

  if (genre.subgenres.length > 0) {
    lines.push(`子类型: ${genre.subgenres.map(s => s.name).join('、')}`)
  }

  lines.push(`核心套路: ${genre.corePatterns.join('、')}`)
  lines.push(`节奏公式: ${genre.pacingFormula.microClimax}`)
  lines.push(`中高潮: ${genre.pacingFormula.midClimax}`)
  lines.push(`叙事结构: ${genre.pacingFormula.arcStructure}`)
  lines.push(`章末钩子: ${genre.pacingFormula.cliffhangerTips.join('；')}`)
  lines.push(`禁忌: ${genre.taboos.join('、')}`)
  lines.push(`常见角色: ${genre.characterArchetypes.join('、')}`)

  return lines.join('\n')
}
