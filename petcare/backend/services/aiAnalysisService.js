require('../loadEnv');

const ANALYSIS_TYPES = {
  appearance: {
    label: '外观',
    normalSummary: '外观状态整体稳定，未见需要立即处理的高风险信号。',
    focus: ['毛发光泽', '精神状态', '体态与步态']
  },
  stool: {
    label: '粪便',
    normalSummary: '排泄表现基本平稳，消化状态暂未见明显异常。',
    focus: ['成形度', '颜色变化', '排便频率']
  },
  skin: {
    label: '皮肤',
    normalSummary: '皮肤与被毛情况较平稳，暂未发现明显炎症风险。',
    focus: ['红肿热感', '皮屑与结痂', '抓挠频率']
  }
};

const KEYWORD_RULES = {
  stool: [
    {
      keywords: ['稀便', '腹泻', '软便', '水样', '拉稀'],
      riskLevel: 'warning',
      score: 26,
      title: '消化道刺激迹象',
      detail: '便便偏稀或不成形，近期可能存在肠胃敏感、换粮刺激或感染风险。',
      advice: [
        '先回看近 3 天是否有换粮、零食增多或误食情况。',
        '补充清水，主食先尽量简单稳定，避免高脂零食。',
        '若连续 24-48 小时未缓解，建议尽快就医。'
      ],
      nutritionFocus: ['益生菌', '低敏主粮', '补水']
    },
    {
      keywords: ['血', '便血', '黑便', '柏油样'],
      riskLevel: 'high',
      score: 38,
      title: '高风险排泄异常',
      detail: '描述中出现血色或黑便，需要优先排查消化道出血、寄生虫或急性炎症。',
      advice: [
        '建议尽快线下就医，并保留近一次排泄物样本。',
        '暂停新的零食、保健品和人类食物。',
        '同步观察精神、食欲与呕吐情况。'
      ],
      nutritionFocus: ['肠胃修复', '补液']
    },
    {
      keywords: ['虫', '寄生虫', '白色颗粒'],
      riskLevel: 'warning',
      score: 24,
      title: '寄生虫可疑信号',
      detail: '排泄描述中出现虫体或白色颗粒，建议结合驱虫史复核。',
      advice: [
        '检查最近一次体内驱虫日期是否超过建议周期。',
        '避免宠物舔舐排泄区或共用食碗。',
        '如为幼宠或体重下降明显，请尽快就医。'
      ],
      nutritionFocus: ['肠道支持', '易消化主食']
    }
  ],
  skin: [
    {
      keywords: ['红', '红点', '红斑', '发炎', '红肿'],
      riskLevel: 'warning',
      score: 24,
      title: '皮肤炎症风险',
      detail: '存在红斑或红肿描述，可能与过敏、真菌、细菌刺激有关。',
      advice: [
        '先保持患处干燥，减少舔咬和抓挠。',
        '暂时避免频繁洗澡和刺激性清洁用品。',
        '若范围扩大或伴渗出异味，建议就医检查。'
      ],
      nutritionFocus: ['Omega-3', '皮肤屏障支持']
    },
    {
      keywords: ['皮屑', '掉毛', '脱毛', '秃', '粗糙'],
      riskLevel: 'attention',
      score: 18,
      title: '被毛屏障下降',
      detail: '描述中有皮屑或掉毛增多，需要结合季节、营养与寄生虫情况综合判断。',
      advice: [
        '回看最近是否换季、换粮或洗护频率过高。',
        '可逐步加强优质蛋白和脂肪酸摄入。',
        '若出现成片脱毛或持续 1 周以上，建议复诊。'
      ],
      nutritionFocus: ['鱼油', '锌', '优质蛋白']
    },
    {
      keywords: ['结痂', '破皮', '渗出', '脓', '异味'],
      riskLevel: 'high',
      score: 34,
      title: '感染或创面风险',
      detail: '存在结痂、渗出或异味描述，应优先排查感染和外伤继发问题。',
      advice: [
        '避免自行涂抹人用药膏。',
        '佩戴伊丽莎白圈，减少抓咬造成二次损伤。',
        '建议尽快就医明确病因后再处理。'
      ],
      nutritionFocus: ['创面修复', '高蛋白支持']
    }
  ],
  appearance: [
    {
      keywords: ['无精打采', '嗜睡', '没精神', '精神差'],
      riskLevel: 'attention',
      score: 18,
      title: '精神状态下降',
      detail: '精神反应偏弱，建议结合食欲、体温和饮水量继续观察。',
      advice: [
        '记录今天的食欲、活动量与排泄情况。',
        '确保环境安静、补足清水。',
        '若精神差持续超过 24 小时，请安排就医。'
      ],
      nutritionFocus: ['补水', '高适口主食']
    },
    {
      keywords: ['眼屎', '流泪', '鼻涕', '咳嗽', '张口呼吸'],
      riskLevel: 'warning',
      score: 28,
      title: '呼吸或眼鼻道异常',
      detail: '外观描述提示眼鼻分泌物或呼吸异常，建议尽快复核。',
      advice: [
        '观察呼吸频率是否明显加快，是否存在张口呼吸。',
        '保持环境通风，避免香薰和粉尘刺激。',
        '如出现呼吸费力，请尽快就医。'
      ],
      nutritionFocus: ['补液', '高适口能量支持']
    },
    {
      keywords: ['瘦', '消瘦', '肚子大', '腹胀', '跛行'],
      riskLevel: 'warning',
      score: 24,
      title: '体态或步态异常',
      detail: '描述涉及体态变化或步态受限，建议结合体重记录和就医史判断。',
      advice: [
        '回看近 1 个月体重变化是否明显。',
        '限制剧烈活动，避免关节进一步负担。',
        '若腹胀、跛行明显，请尽快线下检查。'
      ],
      nutritionFocus: ['体重管理', '关节支持']
    }
  ]
};

function normalizeRiskLevel(level) {
  if (['low', 'normal'].includes(level)) return 'normal';
  if (['medium', 'attention'].includes(level)) return 'attention';
  if (['high', 'warning'].includes(level)) return 'warning';
  return 'normal';
}

function mergeUnique(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function buildLocalAnalysis({ analysisType, notes, pet, fallbackReason }) {
  const ruleSet = KEYWORD_RULES[analysisType] || [];
  const noteText = (notes || '').toLowerCase();
  const hits = [];
  let score = 8;

  for (const rule of ruleSet) {
    const matched = rule.keywords.some(keyword => noteText.includes(keyword.toLowerCase()));
    if (matched) {
      hits.push(rule);
      score += rule.score;
    }
  }

  const dominantLevel = hits.some(item => item.riskLevel === 'high')
    ? 'warning'
    : hits.some(item => item.riskLevel === 'warning')
      ? 'warning'
      : hits.some(item => item.riskLevel === 'attention')
        ? 'attention'
        : 'normal';

  const summary = hits.length
    ? `已完成${ANALYSIS_TYPES[analysisType]?.label || '健康'}场景初筛，当前更需要关注：${hits
        .map(item => item.title)
        .slice(0, 2)
        .join('、')}。`
    : ANALYSIS_TYPES[analysisType]?.normalSummary || '整体状态平稳。';

  const abnormalItems = hits.map(item => ({
    title: item.title,
    severity: normalizeRiskLevel(item.riskLevel),
    detail: item.detail
  }));

  const advice = mergeUnique([
    ...hits.flatMap(item => item.advice),
    '本结果仅作日常筛查参考，持续异常请联系专业兽医。'
  ]);

  const nutritionFocus = mergeUnique([
    ...hits.flatMap(item => item.nutritionFocus),
    ...(analysisType === 'stool' ? ['清淡饮食'] : []),
    ...(analysisType === 'skin' ? ['皮肤屏障支持'] : []),
    ...(analysisType === 'appearance' ? ['基础补水'] : [])
  ]);

  const metrics = {
    digestion: analysisType === 'stool' ? Math.max(48, 88 - score) : 80,
    skinBarrier: analysisType === 'skin' ? Math.max(46, 90 - score) : 78,
    vitality: analysisType === 'appearance' ? Math.max(50, 90 - score) : 82,
    hydration: noteText.includes('喝水少') || noteText.includes('脱水') ? 56 : 80
  };

  return {
    serviceSource: fallbackReason ? 'fallback-local' : 'local-rule-engine',
    summary,
    riskLevel: dominantLevel,
    confidence: hits.length ? 0.73 : 0.64,
    abnormalItems,
    healthAdvice: advice,
    nutritionFocus,
    metrics,
    tags: mergeUnique([
      analysisType,
      pet?.pet_type,
      ...nutritionFocus
    ]),
    disclaimer: fallbackReason
      ? `远程 AI 服务不可用，已切换为本地规则分析。原因：${fallbackReason}`
      : '当前为本地规则引擎分析，适合日常初筛与记录整理。'
  };
}

function mapRemoteResult(result, fallbackReason) {
  return {
    serviceSource:
      result.serviceSource ||
      (fallbackReason ? 'remote-with-fallback-note' : 'remote-ai-service'),
    summary: result.summary || result.result?.summary || 'AI 服务已返回分析结果。',
    riskLevel: normalizeRiskLevel(result.riskLevel || result.risk_level || result.status),
    confidence: Number(result.confidence ?? result.result?.confidence ?? 0.82),
    abnormalItems: result.abnormalItems || result.abnormal_items || result.result?.abnormalItems || [],
    healthAdvice: result.healthAdvice || result.health_advice || result.advice || result.result?.advice || [],
    nutritionFocus: result.nutritionFocus || result.nutrition_focus || result.result?.nutritionFocus || [],
    metrics: result.metrics || result.result?.metrics || {},
    tags: result.tags || result.result?.tags || [],
    disclaimer: fallbackReason || result.disclaimer || '结果由远程 AI 服务返回，请结合临床表现判断。'
  };
}

async function requestRemoteAnalysis(payload) {
  const remoteUrl = process.env.AI_SERVICE_URL;
  if (!remoteUrl) {
    throw new Error('AI_SERVICE_URL is not configured');
  }

  const response = await fetch(remoteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.AI_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}` } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Remote AI service failed: ${response.status} ${text}`.slice(0, 300));
  }

  return response.json();
}

function extractBase64Image(dataUrl) {
  return String(dataUrl || '');
}

function buildZhipuPrompt({ analysisType, notes, pet }) {
  const typeLabel = ANALYSIS_TYPES[analysisType]?.label || analysisType;
  return [
    `你是一名宠物健康初筛助手，需要分析一张宠物${typeLabel}照片。`,
    '请根据图像内容和补充描述，输出一个 JSON 对象，不要输出 Markdown 代码块，不要输出额外说明。',
    'JSON 字段必须包含：summary, riskLevel, confidence, abnormalItems, healthAdvice, nutritionFocus, metrics, tags, disclaimer。',
    '约束：',
    '1. riskLevel 只能是 normal、attention、warning 之一。',
    '2. confidence 返回 0 到 1 的数字。',
    '3. abnormalItems 为数组，每项包含 title、severity、detail。',
    '4. healthAdvice 和 nutritionFocus 都是字符串数组。',
    '5. metrics 是对象，至少包含 digestion、skinBarrier、vitality、hydration 四个数值字段，范围 0 到 100。',
    '6. disclaimer 请明确写“仅供日常筛查参考，不能替代兽医诊断”。',
    `宠物信息：姓名=${pet?.name || '未知'}；类型=${pet?.pet_type || '未知'}；品种=${pet?.breed || '未知'}；性别=${pet?.gender || '未知'}；体重=${pet?.weight || '未知'}kg。`,
    `补充描述：${notes || '无'}。`
  ].join('\n');
}

function safeJsonFromText(text) {
  if (!text) return null;
  const cleaned = String(text).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw error;
  }
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeMetrics(metrics) {
  const raw = metrics && typeof metrics === 'object' ? metrics : {};
  const pick = key => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  };

  return {
    digestion: pick('digestion'),
    skinBarrier: pick('skinBarrier'),
    vitality: pick('vitality'),
    hydration: pick('hydration')
  };
}

async function requestZhipuAnalysis({ analysisType, imageData, notes, pet }) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY is not configured');
  }

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash',
      temperature: 0.2,
      stream: false,
      messages: [
        {
          role: 'system',
          content: '你是严谨的宠物健康视觉分析助手，回答必须是 JSON。'
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: extractBase64Image(imageData)
              }
            },
            {
              type: 'text',
              text: buildZhipuPrompt({ analysisType, notes, pet })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zhipu API failed: ${response.status} ${text}`.slice(0, 320));
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Zhipu API returned empty content');
  }

  const parsed = safeJsonFromText(content);
  return {
    ...parsed,
    healthAdvice: toArray(parsed?.healthAdvice),
    nutritionFocus: toArray(parsed?.nutritionFocus),
    tags: toArray(parsed?.tags),
    abnormalItems: Array.isArray(parsed?.abnormalItems) ? parsed.abnormalItems : [],
    metrics: normalizeMetrics(parsed?.metrics),
    serviceSource: `zhipu-${process.env.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash'}`,
    rawResponse: payload
  };
}

async function analyzePetImage({ analysisType, imageData, notes, pet }) {
  const zhipuEnabled = process.env.AI_SERVICE_MODE === 'zhipu' || !!process.env.ZHIPU_API_KEY;
  const remoteEnabled = process.env.AI_SERVICE_MODE === 'remote' || !!process.env.AI_SERVICE_URL;

  if (zhipuEnabled) {
    try {
      const zhipuResult = await requestZhipuAnalysis({
        analysisType,
        imageData,
        notes,
        pet
      });

      return mapRemoteResult({
        summary: zhipuResult.summary,
        riskLevel: zhipuResult.riskLevel,
        confidence: zhipuResult.confidence,
        abnormalItems: zhipuResult.abnormalItems,
        healthAdvice: zhipuResult.healthAdvice,
        nutritionFocus: zhipuResult.nutritionFocus,
        metrics: zhipuResult.metrics,
        tags: zhipuResult.tags,
        disclaimer: zhipuResult.disclaimer,
        serviceSource: zhipuResult.serviceSource
      });
    } catch (error) {
      return buildLocalAnalysis({
        analysisType,
        notes,
        pet,
        fallbackReason: error.message
      });
    }
  }

  if (remoteEnabled) {
    try {
      const remoteResult = await requestRemoteAnalysis({
        analysisType,
        imageData,
        notes,
        pet
      });

      return mapRemoteResult(remoteResult);
    } catch (error) {
      return buildLocalAnalysis({
        analysisType,
        notes,
        pet,
        fallbackReason: error.message
      });
    }
  }

  return buildLocalAnalysis({ analysisType, notes, pet });
}

module.exports = {
  ANALYSIS_TYPES,
  analyzePetImage
};
