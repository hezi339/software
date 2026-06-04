const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { analyzePetImage } = require('../services/aiAnalysisService');

const ANALYSIS_TYPE_LABELS = {
  appearance: '外观',
  stool: '粪便',
  skin: '皮肤'
};

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function estimateBase64Bytes(dataUrl) {
  const base64 = (dataUrl || '').split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function computeLifeStage(birthDate) {
  if (!birthDate) return 'adult';
  const birth = new Date(birthDate);
  const today = new Date();
  const months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());

  if (months < 12) return 'junior';
  if (months >= 84) return 'senior';
  return 'adult';
}

function getRecentWeightChange(weightRecords, fallbackWeight) {
  const sorted = [...weightRecords].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length >= 2) {
    const first = Number(sorted[0].weight);
    const last = Number(sorted[sorted.length - 1].weight);
    const delta = Number((last - first).toFixed(2));
    const pct = first ? Number(((delta / first) * 100).toFixed(1)) : 0;
    return { delta, pct, latest: last };
  }

  return {
    delta: 0,
    pct: 0,
    latest: Number(fallbackWeight || 0)
  };
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function deriveNutritionPlan({ pet, weightRecords, dietRecords, behaviorRecords, medicalRecords, aiRecords }) {
  const petType = pet.pet_type === 'dog' || pet.pet_type === 'large_dog' ? 'dog' : 'cat';
  const lifeStage = computeLifeStage(pet.birth_date);
  const latestWeight = Number(
    getRecentWeightChange(weightRecords, pet.weight).latest || pet.weight || 0
  );
  const safeWeight = latestWeight > 0 ? latestWeight : petType === 'cat' ? 4.5 : 12;

  const rerBase = petType === 'cat' ? 70 : 75;
  const rer = rerBase * Math.pow(safeWeight, 0.75);

  let factor = 1.25;
  if (lifeStage === 'junior') factor = petType === 'cat' ? 2.1 : 2.3;
  if (lifeStage === 'senior') factor = petType === 'cat' ? 1.1 : 1.25;
  if (!pet.sterilized && lifeStage === 'adult') factor += 0.1;

  const recentActivity = behaviorRecords[0]?.activity_level || '';
  if (recentActivity.includes('高') || recentActivity.includes('活跃')) factor += 0.15;
  if (recentActivity.includes('低') || recentActivity.includes('少')) factor -= 0.08;

  const weightTrend = getRecentWeightChange(weightRecords, pet.weight);
  if (weightTrend.pct >= 5) factor -= 0.08;
  if (weightTrend.pct <= -5) factor += 0.08;

  const targetCalories = Math.max(120, Math.round(rer * factor));
  const calorieDensity = petType === 'cat' ? 3.8 : 3.6;
  const dailyFoodGrams = Math.round(targetCalories / calorieDensity);
  const waterTargetMl = Math.round(safeWeight * (petType === 'cat' ? 55 : 60));

  const notePool = [
    ...behaviorRecords.map(item => [item.symptoms, item.notes, item.appetite].filter(Boolean).join(' ')),
    ...medicalRecords.map(item => [item.diagnosis, item.notes].filter(Boolean).join(' ')),
    ...aiRecords.flatMap(item => item.nutrition_focus || []),
    ...aiRecords.map(item => item.summary || '')
  ]
    .join(' ')
    .toLowerCase();

  const supplements = [];
  if (notePool.includes('稀') || notePool.includes('腹泻') || notePool.includes('digest')) {
    supplements.push('益生菌：连用 7-14 天，优先帮助肠道稳定。');
  }
  if (notePool.includes('皮肤') || notePool.includes('掉毛') || notePool.includes('红斑')) {
    supplements.push('鱼油 / Omega-3：支持皮肤屏障和被毛状态。');
  }
  if ((petType === 'dog' && safeWeight > 20) || lifeStage === 'senior') {
    supplements.push('关节支持：氨糖或软骨素可作为中长期保养选项。');
  }
  if (!supplements.length) {
    supplements.push('基础复合营养支持：优先从完整主粮与规律饮水开始。');
  }

  const avoidList = [
    '高油高盐的人类食物',
    '频繁更换主粮或同时叠加多种零食'
  ];
  if (notePool.includes('腹泻') || notePool.includes('稀')) {
    avoidList.push('高脂零食、奶制品、一次性喂食过量');
  }
  if (notePool.includes('皮肤') || notePool.includes('过敏')) {
    avoidList.push('成分复杂的新零食，优先控制单一蛋白来源');
  }

  const mealCount = lifeStage === 'junior' ? 3 : 2;
  const mainProtein = notePool.includes('皮肤') ? '低敏鱼肉/鸭肉' : '鸡肉 / 火鸡 / 鱼肉';

  return {
    generatedAt: new Date().toISOString(),
    pet: {
      id: pet.id,
      name: pet.name,
      petType,
      lifeStage,
      weight: safeWeight
    },
    summary: `根据 ${pet.name} 最近的体重、饮食、行为和 AI 初筛记录，当前建议以 ${dailyFoodGrams}g 左右主粮和 ${waterTargetMl}ml 饮水为日常基线。`,
    targets: {
      calories: targetCalories,
      dailyFoodGrams,
      waterTargetMl,
      mealCount
    },
    mealPlan: [
      `早餐：日粮的 ${mealCount === 3 ? '35%' : '45%'}，搭配高适口湿粮或温水泡粮。`,
      `晚餐：日粮的 ${mealCount === 3 ? '35%' : '55%'}，保持主粮稳定不频繁换口味。`,
      ...(mealCount === 3 ? ['加餐：日粮的 30%，可放在午间或运动后少量补充。'] : [])
    ],
    recommendedPairing: [
      `主蛋白建议：${mainProtein}，优先完整配方粮。`,
      '零食总量控制在全天热量的 10% 以内。',
      '可把一部分主粮放入益智喂食器，提升进食节奏和满足感。'
    ],
    supplements,
    avoidList,
    signals: [
      weightTrend.pct >= 5
        ? '近月体重偏上行，建议控制零食与额外加餐。'
        : weightTrend.pct <= -5
          ? '近月体重有下降，建议复核食欲和热量摄入。'
          : '近月体重总体稳定，可维持现有喂食框架。',
      behaviorRecords[0]?.appetite
        ? `最近一次食欲记录：${behaviorRecords[0].appetite}。`
        : '最近暂无食欲异常记录。'
    ]
  };
}

function buildMonthlyReport({
  pet,
  month,
  dietRecords,
  behaviorRecords,
  weightRecords,
  medicalRecords,
  vaccineRecords,
  aiRecords
}) {
  const weightTrend = [...weightRecords]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({ date: item.date, value: Number(item.weight) }));

  const foodTrendMap = new Map();
  for (const record of dietRecords) {
    const current = foodTrendMap.get(record.date) || 0;
    foodTrendMap.set(record.date, current + Number(record.grams || 0));
  }
  const foodTrend = Array.from(foodTrendMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));

  const waterTrend = [...behaviorRecords]
    .filter(item => Number(item.water_ml || 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({ date: item.date, value: Number(item.water_ml) }));

  const pottyTrend = [...behaviorRecords]
    .filter(item => Number(item.potty_count || 0) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(item => ({ date: item.date, value: Number(item.potty_count || 0) }));

  const analysisRiskTrend = [...aiRecords]
    .sort((a, b) => a.analysis_date.localeCompare(b.analysis_date))
    .map(item => ({
      date: item.analysis_date,
      value: item.risk_level === 'warning' ? 3 : item.risk_level === 'attention' ? 2 : 1
    }));

  const warningCount =
    aiRecords.filter(item => item.risk_level === 'warning').length +
    behaviorRecords.filter(item => (item.symptoms || '').includes('呕吐')).length;

  const avgDailyFood = foodTrend.length ? Math.round(average(foodTrend.map(item => item.value))) : 0;
  const avgWater = waterTrend.length ? Math.round(average(waterTrend.map(item => item.value))) : 0;
  const avgPotty = pottyTrend.length ? Number(average(pottyTrend.map(item => item.value)).toFixed(1)) : 0;
  const weightChange = getRecentWeightChange(weightRecords, pet.weight);

  let score = 88;
  if (Math.abs(weightChange.pct) <= 5) score += 4;
  else score -= 4;
  score -= Math.min(12, warningCount * 3);
  if (avgWater > 0) score += 2;
  if (medicalRecords.length > 0) score -= Math.min(6, medicalRecords.length * 2);
  score = Math.max(52, Math.min(98, score));

  const highlights = [];
  if (avgDailyFood) highlights.push(`本月平均日摄食约 ${avgDailyFood}g。`);
  if (avgWater) highlights.push(`有记录的平均饮水量约 ${avgWater}ml/天。`);
  if (weightTrend.length) {
    highlights.push(
      Math.abs(weightChange.pct) <= 5
        ? `体重总体稳定，月内变化 ${weightChange.delta >= 0 ? '+' : ''}${weightChange.delta}kg。`
        : `体重波动较明显，月内变化 ${weightChange.delta >= 0 ? '+' : ''}${weightChange.delta}kg。`
    );
  }
  if (aiRecords.length) {
    const latest = aiRecords[0];
    highlights.push(`最近一次 AI 初筛聚焦在${ANALYSIS_TYPE_LABELS[latest.analysis_type] || '健康'}问题。`);
  }

  const alerts = [
    ...aiRecords
      .filter(item => item.risk_level !== 'normal')
      .slice(0, 4)
      .map(item => ({
        type: item.risk_level,
        date: item.analysis_date,
        text: item.summary
      })),
    ...medicalRecords.slice(0, 3).map(item => ({
      type: 'medical',
      date: item.visit_date,
      text: `${item.hospital || '就诊记录'}：${item.diagnosis || '已就医复查'}`
    }))
  ];

  const checklist = [
    avgWater > 0 ? '继续保持饮水记录，便于观察补水变化。' : '建议补充饮水记录，月报趋势会更完整。',
    warningCount > 0
      ? '本月存在异常提醒，建议把症状和照片持续补充到系统。'
      : '本月异常提醒较少，可保持现有作息与喂养节奏。',
    vaccineRecords.length
      ? '同步关注疫苗下一次接种日期，避免错过加强针。'
      : '若近期有疫苗计划，可补录到系统方便统一提醒。'
  ];

  return {
    generatedAt: new Date().toISOString(),
    month,
    pet: {
      id: pet.id,
      name: pet.name,
      weight: Number(pet.weight || 0),
      petType: pet.pet_type || 'cat'
    },
    score,
    kpis: {
      avgDailyFood,
      avgWater,
      avgPotty,
      weightChangeKg: weightChange.delta,
      warningCount
    },
    highlights,
    alerts,
    checklist,
    trends: {
      weight: weightTrend,
      food: foodTrend,
      water: waterTrend,
      potty: pottyTrend,
      analysisRisk: analysisRiskTrend
    }
  };
}

async function getAuthorizedPet(userId, petId) {
  return dbGet('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId]);
}

function mapAnalysisRow(row) {
  return {
    ...row,
    confidence: Number(row.confidence || 0),
    abnormal_items: safeParseJson(row.abnormal_items, []),
    health_advice: safeParseJson(row.health_advice, []),
    nutrition_focus: safeParseJson(row.nutrition_focus, []),
    metrics: safeParseJson(row.metrics, {}),
    tags: safeParseJson(row.tags, []),
    raw_result: safeParseJson(row.raw_result, {})
  };
}

exports.createAiAnalysis = async (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const {
    analysis_type,
    image_data,
    image_name,
    notes,
    analysis_date
  } = req.body;

  if (!analysis_type || !['appearance', 'stool', 'skin'].includes(analysis_type)) {
    return res.status(400).json({ message: '请选择有效的分析类型' });
  }

  if (!image_data || !String(image_data).startsWith('data:image/')) {
    return res.status(400).json({ message: '请上传有效的图片文件' });
  }

  const imageSize = estimateBase64Bytes(image_data);
  if (imageSize > 10 * 1024 * 1024) {
    return res.status(400).json({ message: '图片不能超过 10MB' });
  }

  try {
    const pet = await getAuthorizedPet(userId, petId);
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const analysisResult = await analyzePetImage({
      analysisType: analysis_type,
      imageData: image_data,
      notes,
      pet
    });

    const id = uuidv4();
    const resultPayload = {
      id,
      pet_id: petId,
      analysis_type,
      image_name: image_name || `${analysis_type}-${Date.now()}.jpg`,
      image_data,
      notes: notes || null,
      analysis_date: analysis_date || getTodayDateString(),
      summary: analysisResult.summary,
      risk_level: analysisResult.riskLevel,
      confidence: analysisResult.confidence,
      abnormal_items: JSON.stringify(analysisResult.abnormalItems || []),
      health_advice: JSON.stringify(analysisResult.healthAdvice || []),
      nutrition_focus: JSON.stringify(analysisResult.nutritionFocus || []),
      metrics: JSON.stringify(analysisResult.metrics || {}),
      tags: JSON.stringify(analysisResult.tags || []),
      service_source: analysisResult.serviceSource,
      raw_result: JSON.stringify(analysisResult),
      disclaimer: analysisResult.disclaimer || null
    };

    await dbRun(
      `INSERT INTO ai_analysis_records (
        id, pet_id, analysis_type, image_name, image_data, notes, analysis_date,
        summary, risk_level, confidence, abnormal_items, health_advice,
        nutrition_focus, metrics, tags, service_source, raw_result, disclaimer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultPayload.id,
        resultPayload.pet_id,
        resultPayload.analysis_type,
        resultPayload.image_name,
        resultPayload.image_data,
        resultPayload.notes,
        resultPayload.analysis_date,
        resultPayload.summary,
        resultPayload.risk_level,
        resultPayload.confidence,
        resultPayload.abnormal_items,
        resultPayload.health_advice,
        resultPayload.nutrition_focus,
        resultPayload.metrics,
        resultPayload.tags,
        resultPayload.service_source,
        resultPayload.raw_result,
        resultPayload.disclaimer
      ]
    );

    const savedRow = await dbGet('SELECT * FROM ai_analysis_records WHERE id = ?', [id]);
    res.status(201).json(mapAnalysisRow(savedRow));
  } catch (error) {
    console.error('createAiAnalysis error:', error);
    res.status(500).json({ message: 'AI 分析失败，请稍后重试' });
  }
};

exports.getAiAnalyses = async (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const limit = Math.min(Number(req.query.limit || 12), 30);

  try {
    const pet = await getAuthorizedPet(userId, petId);
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const rows = await dbAll(
      `SELECT * FROM ai_analysis_records
       WHERE pet_id = ?
       ORDER BY analysis_date DESC, created_at DESC
       LIMIT ?`,
      [petId, limit]
    );

    res.json(rows.map(mapAnalysisRow));
  } catch (error) {
    console.error('getAiAnalyses error:', error);
    res.status(500).json({ message: '加载 AI 分析记录失败' });
  }
};

exports.getNutritionPlan = async (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  try {
    const pet = await getAuthorizedPet(userId, petId);
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const [weightRecords, dietRecords, behaviorRecords, medicalRecords, aiRows] = await Promise.all([
      dbAll('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY date DESC LIMIT 30', [petId]),
      dbAll('SELECT * FROM diet_records WHERE pet_id = ? ORDER BY date DESC, time DESC LIMIT 60', [petId]),
      dbAll('SELECT * FROM behavior_records WHERE pet_id = ? ORDER BY date DESC LIMIT 30', [petId]),
      dbAll('SELECT * FROM medical_records WHERE pet_id = ? ORDER BY visit_date DESC LIMIT 20', [petId]),
      dbAll('SELECT * FROM ai_analysis_records WHERE pet_id = ? ORDER BY analysis_date DESC, created_at DESC LIMIT 12', [petId])
    ]);

    const plan = deriveNutritionPlan({
      pet,
      weightRecords,
      dietRecords,
      behaviorRecords,
      medicalRecords,
      aiRecords: aiRows.map(mapAnalysisRow)
    });

    res.json(plan);
  } catch (error) {
    console.error('getNutritionPlan error:', error);
    res.status(500).json({ message: '生成营养建议失败' });
  }
};

exports.getMonthlyReport = async (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const range = getMonthRange(month);

  if (!range) {
    return res.status(400).json({ message: '月份格式应为 YYYY-MM' });
  }

  try {
    const pet = await getAuthorizedPet(userId, petId);
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const [dietRecords, behaviorRecords, weightRecords, medicalRecords, vaccineRecords, aiRows] =
      await Promise.all([
        dbAll(
          'SELECT * FROM diet_records WHERE pet_id = ? AND date >= ? AND date < ? ORDER BY date ASC, time ASC',
          [petId, range.start, range.end]
        ),
        dbAll(
          'SELECT * FROM behavior_records WHERE pet_id = ? AND date >= ? AND date < ? ORDER BY date ASC',
          [petId, range.start, range.end]
        ),
        dbAll(
          'SELECT * FROM weight_records WHERE pet_id = ? AND date >= ? AND date < ? ORDER BY date ASC',
          [petId, range.start, range.end]
        ),
        dbAll(
          'SELECT * FROM medical_records WHERE pet_id = ? AND visit_date >= ? AND visit_date < ? ORDER BY visit_date DESC',
          [petId, range.start, range.end]
        ),
        dbAll(
          'SELECT * FROM vaccine_records WHERE pet_id = ? AND vaccine_date >= ? AND vaccine_date < ? ORDER BY vaccine_date DESC',
          [petId, range.start, range.end]
        ),
        dbAll(
          'SELECT * FROM ai_analysis_records WHERE pet_id = ? AND analysis_date >= ? AND analysis_date < ? ORDER BY analysis_date DESC, created_at DESC',
          [petId, range.start, range.end]
        )
      ]);

    const report = buildMonthlyReport({
      pet,
      month,
      dietRecords,
      behaviorRecords,
      weightRecords,
      medicalRecords,
      vaccineRecords,
      aiRecords: aiRows.map(mapAnalysisRow)
    });

    res.json(report);
  } catch (error) {
    console.error('getMonthlyReport error:', error);
    res.status(500).json({ message: '生成月度健康报表失败' });
  }
};
