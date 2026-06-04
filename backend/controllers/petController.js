const db = require('../db');
const { v4: uuidv4 } = require('uuid');

function calculateAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years === 0) {
    if (months === 0) {
      return `${days}天`;
    }
    return `${months}个月`;
  }
  return `${years}岁${months > 0 ? months + '个月' : ''}`;
}

function calculateGrowthStage(birthDate, petType) {
  if (!birthDate) return '未设置';

  const birth = new Date(birthDate);
  const today = new Date();
  const totalMonths = (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());

  if (petType === 'cat' || petType === '猫咪') {
    if (totalMonths < 12) return '幼猫';
    if (totalMonths >= 12 && totalMonths < 84) return '成猫';
    return '老年猫';
  }

  if (petType === 'dog' || petType === '狗狗' || petType === '小型犬') {
    if (totalMonths < 120) return '成年';
    return '老年';
  }

  if (petType === '大型犬') {
    if (totalMonths < 84) return '成年';
    return '老年';
  }

  if (totalMonths < 12) return '幼年期';
  if (totalMonths < 84) return '成年期';
  return '老年期';
}

exports.getPets = (req, res) => {
  const { userId } = req.user;

  db.all('SELECT * FROM pets WHERE user_id = ?', [userId], (err, pets) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }

    const petsWithAge = pets.map(pet => {
      const age = calculateAge(pet.birth_date);
      const growthStage = calculateGrowthStage(pet.birth_date, pet.breed);
      return { ...pet, age, growth_stage: growthStage };
    });

    res.json(petsWithAge);
  });
};

exports.getPet = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }
    const age = calculateAge(pet.birth_date);
    const growthStage = calculateGrowthStage(pet.birth_date, pet.pet_type);
    res.json({ ...pet, age, growth_stage: growthStage });
  });
};

exports.createPet = (req, res) => {
  const { userId } = req.user;
  const { name, breed, birth_date, gender, weight, sterilized, pet_type } = req.body;

  if (!name) {
    return res.status(400).json({ message: '宠物名称不能为空' });
  }

  if (birth_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthDate = new Date(birth_date);
    birthDate.setHours(0, 0, 0, 0);
    if (birthDate > today) {
      return res.status(400).json({ message: '出生日期不能晚于今天' });
    }
  }

  const id = uuidv4();
  db.run(
    'INSERT INTO pets (id, user_id, name, breed, birth_date, gender, weight, sterilized, pet_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, userId, name, breed, birth_date, gender, weight, sterilized ? 1 : 0, pet_type],
    function(err) {
      if (err) {
        console.error('createPet error:', err);
        return res.status(500).json({ message: '服务器内部错误' });
      }

      db.get('SELECT * FROM pets WHERE id = ?', [id], (err, pet) => {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }
        const age = calculateAge(pet.birth_date);
        const growthStage = calculateGrowthStage(pet.birth_date, pet.pet_type);
        res.status(201).json({ ...pet, age, growth_stage: growthStage });
      });
    }
  );
};

exports.updatePet = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const { name, breed, birth_date, gender, weight, sterilized, pet_type } = req.body;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, existingPet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!existingPet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    if (birth_date !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birthDate = new Date(birth_date);
      birthDate.setHours(0, 0, 0, 0);
      if (birthDate > today) {
        return res.status(400).json({ message: '出生日期不能晚于今天' });
      }
    }

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (breed !== undefined) {
      updateFields.push('breed = ?');
      updateValues.push(breed);
    }
    if (birth_date !== undefined) {
      updateFields.push('birth_date = ?');
      updateValues.push(birth_date);
    }
    if (gender !== undefined) {
      updateFields.push('gender = ?');
      updateValues.push(gender);
    }
    if (weight !== undefined) {
      updateFields.push('weight = ?');
      updateValues.push(weight);
    }
    if (sterilized !== undefined) {
      updateFields.push('sterilized = ?');
      updateValues.push(sterilized ? 1 : 0);
    }
    if (pet_type !== undefined) {
      updateFields.push('pet_type = ?');
      updateValues.push(pet_type);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    updateValues.push(petId);
    updateValues.push(userId);

    db.run(
      `UPDATE pets SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
      updateValues,
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }

        db.get('SELECT * FROM pets WHERE id = ?', [petId], (err, pet) => {
          if (err) {
            return res.status(500).json({ message: '服务器内部错误' });
          }
          const age = calculateAge(pet.birth_date);
          const growthStage = calculateGrowthStage(pet.birth_date, pet.pet_type);
          res.json({ ...pet, age, growth_stage: growthStage });
        });
      }
    );
  });
};

exports.deletePet = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.run('DELETE FROM pets WHERE id = ? AND user_id = ?', [petId, userId], function(err) {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: '宠物不存在' });
    }
    res.json({ message: '删除成功' });
  });
};

// 食物禁忌列表（对猫狗有毒的食物）
const dangerousFoods = [
  '巧克力', '巧克力蛋糕', '巧克力饼干',
  '洋葱', '洋葱圈', '洋葱汤',
  '大蒜', '蒜头', '蒜片',
  '韭菜', '韭菜盒子',
  '葡萄', '葡萄干', '葡萄汁',
  '葡萄干', '提子',
  '酒精', '白酒', '啤酒', '红酒',
  '咖啡因', '咖啡', '茶',
  '木糖醇', '口香糖',
  '牛油果', '鳄梨',
  '樱桃', '樱桃核',
  '夏威夷果', '澳洲坚果'
];

// 喂食量计算公式（基于宠物体重、年龄、活动水平）
function calculateFeedingSuggestion(pet) {
  if (!pet.weight) return { suggestion: null, status: null };
  
  const weight = parseFloat(pet.weight);
  const ageMonths = calculateAgeMonths(pet.birth_date);
  const petType = pet.pet_type || 'cat';
  
  // 根据年龄调整系数
  let ageFactor = 1.0;
  if (ageMonths < 4) ageFactor = 2.0;      // 幼年期
  else if (ageMonths < 12) ageFactor = 1.5; // 青年期
  else if (ageMonths > 84) ageFactor = 0.8; // 老年期
  
  // 根据宠物类型调整基础代谢率
  let baseRate = petType === 'cat' ? 70 : 80; // 猫: 70kcal/kg^0.75, 狗: 80kcal/kg^0.75
  let maintenanceCalories = baseRate * Math.pow(weight, 0.75) * ageFactor;
  
  // 干粮平均热量密度约为 350-400 kcal/100g，取中间值 375
  const caloriesPer100g = 375;
  const suggestedGrams = Math.round((maintenanceCalories / caloriesPer100g) * 100);
  
  return {
    suggestion: `${suggestedGrams}g`,
    status: null
  };
}

function calculateAgeMonths(birthDate) {
  if (!birthDate) return 0;
  const birth = new Date(birthDate);
  const today = new Date();
  return (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
}

// 检查食物是否在黑名单中
function checkDangerousFood(foodType, foodProduct) {
  const foodText = (foodType + ' ' + (foodProduct || '')).toLowerCase();
  for (const dangerous of dangerousFoods) {
    if (foodText.includes(dangerous.toLowerCase())) {
      return dangerous;
    }
  }
  return null;
}

exports.getDietRecords = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.all('SELECT * FROM diet_records WHERE pet_id = ? ORDER BY date DESC, time DESC', [petId], (err, records) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      
      // 获取每日建议喂食量
      const feedingSuggestion = calculateFeedingSuggestion(pet);
      
      res.json({ 
        records, 
        dailySuggestion: feedingSuggestion.suggestion,
        petWeight: pet.weight,
        petType: pet.pet_type
      });
    });
  });
};

exports.createDietRecord = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const { date, time, food_type, food_brand, food_product, grams, preference, notes, supplement_name, supplement_dosage, supplement_timing, supplement_frequency } = req.body;

  if (!date || !time || !food_type || grams === undefined) {
    return res.status(400).json({ message: '日期、时间、食物类型和克数不能为空' });
  }

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    // 检查食物是否在黑名单中
    const dangerousFood = checkDangerousFood(food_type, food_product);
    if (dangerousFood) {
      return res.status(400).json({ 
        message: `警告：${dangerousFood} 对宠物有毒，请勿喂食！`,
        dangerousFood 
      });
    }

    // 检查营养品是否需要随餐
    if (supplement_timing === '随餐' && (!food_type || !grams || grams === 0)) {
      return res.status(400).json({ 
        message: '提示：该营养品需要随餐喂食，请先记录主食'
      });
    }

    // 计算喂食量建议和状态
    const { suggestion, status } = calculateFeedingSuggestion(pet);
    let feedingStatus = '合适';
    if (pet.weight && grams) {
      const suggestedGrams = parseInt(suggestion);
      if (suggestedGrams) {
        const ratio = grams / suggestedGrams;
        if (ratio < 0.8) feedingStatus = '偏少';
        else if (ratio > 1.2) feedingStatus = '偏多';
      }
    }

    const id = uuidv4();
    db.run(
      'INSERT INTO diet_records (id, pet_id, date, time, food_type, food_brand, food_product, grams, preference, notes, feeding_suggestion, feeding_status, supplement_name, supplement_dosage, supplement_timing, supplement_frequency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, petId, date, time, food_type, food_brand, food_product, grams, preference || 3, notes, suggestion, feedingStatus, supplement_name || null, supplement_dosage || null, supplement_timing || null, supplement_frequency || null],
      function(err) {
        if (err) {
          console.error('createDietRecord error:', err);
          return res.status(500).json({ message: '服务器内部错误' });
        }

        db.get('SELECT * FROM diet_records WHERE id = ?', [id], (err, record) => {
          res.status(201).json({ 
            ...record, 
            dailySuggestion: suggestion,
            feedingStatus 
          });
        });
      }
    );
  });
};

exports.updateDietRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;
  const { date, time, food_type, food_brand, food_product, grams, preference, notes, supplement_name, supplement_dosage, supplement_timing, supplement_frequency } = req.body;

  // 调试日志
  console.log('Update diet record request:', {
    recordId,
    date,
    time,
    food_type,
    food_brand,
    food_product,
    grams,
    preference,
    supplement_name,
    supplement_dosage,
    supplement_timing,
    supplement_frequency
  });

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    // 检查食物是否在黑名单中
    if (food_type || food_product) {
      const dangerousFood = checkDangerousFood(food_type || '', food_product || '');
      if (dangerousFood) {
        return res.status(400).json({ 
          message: `警告：${dangerousFood} 对宠物有毒，请勿喂食！`,
          dangerousFood 
        });
      }
    }

    const updateFields = [];
    const updateValues = [];

    // 检查字段是否存在且不为空（允许0和false）
    const addField = (field, value) => {
      if (value !== undefined && value !== null && value !== '') {
        updateFields.push(`${field} = ?`);
        updateValues.push(value);
      } else if (value === null || value === '') {
        // 允许清空字段
        updateFields.push(`${field} = ?`);
        updateValues.push(null);
      }
    };

    addField('date', date);
    addField('time', time);
    addField('food_type', food_type);
    addField('food_brand', food_brand);
    addField('food_product', food_product);
    if (grams !== undefined && grams !== null && !isNaN(grams)) {
      updateFields.push('grams = ?');
      updateValues.push(parseInt(grams));
      
      // 更新喂食状态
      const { suggestion } = calculateFeedingSuggestion(pet);
      let feedingStatus = '合适';
      if (pet.weight && grams) {
        const suggestedGrams = parseInt(suggestion);
        if (suggestedGrams) {
          const ratio = grams / suggestedGrams;
          if (ratio < 0.8) feedingStatus = '偏少';
          else if (ratio > 1.2) feedingStatus = '偏多';
        }
      }
      updateFields.push('feeding_status = ?');
      updateValues.push(feedingStatus);
      updateFields.push('feeding_suggestion = ?');
      updateValues.push(suggestion);
    }
    if (preference !== undefined && preference !== null && !isNaN(preference)) {
      updateFields.push('preference = ?');
      updateValues.push(parseInt(preference));
    }
    addField('notes', notes);
    addField('supplement_name', supplement_name);
    addField('supplement_dosage', supplement_dosage);
    addField('supplement_timing', supplement_timing);
    addField('supplement_frequency', supplement_frequency);

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    updateValues.push(recordId);
    updateValues.push(petId);

    db.run(
      `UPDATE diet_records SET ${updateFields.join(', ')} WHERE id = ? AND pet_id = ?`,
      updateValues,
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: '记录不存在' });
        }

        db.get('SELECT * FROM diet_records WHERE id = ?', [recordId], (err, record) => {
          res.json(record);
        });
      }
    );
  });
};

exports.deleteDietRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.run('DELETE FROM diet_records WHERE id = ? AND pet_id = ?', [recordId, petId], function(err) {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: '记录不存在' });
      }
      res.json({ message: '删除成功' });
    });
  });
};

exports.getBehaviorRecords = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.all('SELECT * FROM behavior_records WHERE pet_id = ? ORDER BY date DESC', [petId], (err, records) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      
      // 检查异常情况
      const alerts = checkBehaviorAlerts(records);
      
      res.json({ records, alerts });
    });
  });
};

// 检查行为异常
function checkBehaviorAlerts(records) {
  const alerts = [];
  
  if (records.length < 3) return alerts;
  
  // 获取最近3天的记录
  const recentRecords = records.slice(0, 3);
  
  // 检查连续3天软便
  const softPottyCount = recentRecords.filter(r => r.potty_character === '软便' || r.potty_character === '腹泻').length;
  if (softPottyCount >= 3) {
    alerts.push({
      type: 'warning',
      message: '连续3天出现软便/腹泻，建议关注宠物健康状况',
      possibleReasons: ['天气变化', '换粮', '应激反应', '肠道感染']
    });
  }
  
  // 检查饮水量异常
  const avgWater = recentRecords.reduce((sum, r) => sum + (r.water_ml || 0), 0) / recentRecords.length;
  const petWeight = 4; // 假设平均体重，实际应从宠物信息获取
  
  // 正常每日饮水量约为 40-60ml/kg
  const minNormal = petWeight * 40;
  const maxNormal = petWeight * 60;
  
  if (avgWater < minNormal * 0.5) {
    alerts.push({
      type: 'warning',
      message: '饮水量异常偏低，建议检查水源和宠物状态',
      possibleReasons: ['天气寒冷', '口腔问题', '肾脏问题']
    });
  } else if (avgWater > maxNormal * 2) {
    alerts.push({
      type: 'warning',
      message: '饮水量异常偏高，建议关注是否有糖尿病等问题',
      possibleReasons: ['天气炎热', '糖尿病', '肾脏问题']
    });
  }
  
  // 检查精神状态
  const poorMoodCount = recentRecords.filter(r => 
    r.mood === '紧张' || r.mood === '暴躁' || r.mood === '焦虑' || r.mood === '异常安静'
  ).length;
  if (poorMoodCount >= 2) {
    alerts.push({
      type: 'info',
      message: '宠物情绪不稳定，建议多陪伴观察',
      possibleReasons: ['环境变化', '应激反应', '身体不适']
    });
  }
  
  return alerts;
}

exports.createBehaviorRecord = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const { date, potty_count, potty_character, potty_color, potty_location, water_ml, water_frequency, water_type, activity_level, appetite, mood, symptoms, notes, in_heat, heat_start_date, heat_end_date, heat_severity, heat_symptoms } = req.body;

  if (!date) {
    return res.status(400).json({ message: '日期不能为空' });
  }

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const id = uuidv4();
    // 处理 in_heat 字段，确保正确转换为整数
    const inHeatInt = (in_heat === true || in_heat === 'true' || in_heat === 1 || in_heat === '1') ? 1 : 0;
    db.run(
      'INSERT INTO behavior_records (id, pet_id, date, potty_count, potty_character, potty_color, potty_location, water_ml, water_frequency, water_type, activity_level, appetite, mood, symptoms, notes, in_heat, heat_start_date, heat_end_date, heat_severity, heat_symptoms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, petId, date, potty_count || 0, potty_character, potty_color, potty_location, water_ml || 0, water_frequency, water_type, activity_level, appetite, mood, symptoms, notes, inHeatInt, heat_start_date, heat_end_date, heat_severity, heat_symptoms],
      function(err) {
        if (err) {
          console.error('createBehaviorRecord error:', err);
          return res.status(500).json({ message: '服务器内部错误' });
        }

        db.get('SELECT * FROM behavior_records WHERE id = ?', [id], (err, record) => {
          res.status(201).json(record);
        });
      }
    );
  });
};

exports.updateBehaviorRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;
  const { date, potty_count, potty_character, potty_color, potty_location, water_ml, water_frequency, water_type, activity_level, appetite, mood, symptoms, notes, in_heat, heat_start_date, heat_end_date, heat_severity, heat_symptoms } = req.body;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (date !== undefined) {
      updateFields.push('date = ?');
      updateValues.push(date);
    }
    if (potty_count !== undefined) {
      updateFields.push('potty_count = ?');
      updateValues.push(potty_count);
    }
    if (potty_character !== undefined) {
      updateFields.push('potty_character = ?');
      updateValues.push(potty_character);
    }
    if (potty_color !== undefined) {
      updateFields.push('potty_color = ?');
      updateValues.push(potty_color);
    }
    if (potty_location !== undefined) {
      updateFields.push('potty_location = ?');
      updateValues.push(potty_location);
    }
    if (water_ml !== undefined) {
      updateFields.push('water_ml = ?');
      updateValues.push(water_ml);
    }
    if (water_frequency !== undefined) {
      updateFields.push('water_frequency = ?');
      updateValues.push(water_frequency);
    }
    if (water_type !== undefined) {
      updateFields.push('water_type = ?');
      updateValues.push(water_type);
    }
    if (activity_level !== undefined) {
      updateFields.push('activity_level = ?');
      updateValues.push(activity_level);
    }
    if (appetite !== undefined) {
      updateFields.push('appetite = ?');
      updateValues.push(appetite);
    }
    if (mood !== undefined) {
      updateFields.push('mood = ?');
      updateValues.push(mood);
    }
    if (symptoms !== undefined) {
      updateFields.push('symptoms = ?');
      updateValues.push(symptoms);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    if (in_heat !== undefined) {
      updateFields.push('in_heat = ?');
      updateValues.push((in_heat === true || in_heat === 'true' || in_heat === 1 || in_heat === '1') ? 1 : 0);
    }
    if (heat_start_date !== undefined) {
      updateFields.push('heat_start_date = ?');
      updateValues.push(heat_start_date);
    }
    if (heat_end_date !== undefined) {
      updateFields.push('heat_end_date = ?');
      updateValues.push(heat_end_date);
    }
    if (heat_severity !== undefined) {
      updateFields.push('heat_severity = ?');
      updateValues.push(heat_severity);
    }
    if (heat_symptoms !== undefined) {
      updateFields.push('heat_symptoms = ?');
      updateValues.push(heat_symptoms);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    updateValues.push(recordId);
    updateValues.push(petId);

    db.run(
      `UPDATE behavior_records SET ${updateFields.join(', ')} WHERE id = ? AND pet_id = ?`,
      updateValues,
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: '记录不存在' });
        }

        db.get('SELECT * FROM behavior_records WHERE id = ?', [recordId], (err, record) => {
          res.json(record);
        });
      }
    );
  });
};

exports.deleteBehaviorRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.run('DELETE FROM behavior_records WHERE id = ? AND pet_id = ?', [recordId, petId], function(err) {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: '记录不存在' });
      }
      res.json({ message: '删除成功' });
    });
  });
};

exports.getWeightRecords = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.all('SELECT * FROM weight_records WHERE pet_id = ? ORDER BY date DESC', [petId], (err, records) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      res.json(records);
    });
  });
};

exports.createWeightRecord = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const { date, weight, notes } = req.body;

  if (!date || weight === undefined) {
    return res.status(400).json({ message: '日期和体重不能为空' });
  }

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const id = uuidv4();
    db.run(
      'INSERT INTO weight_records (id, pet_id, date, weight, notes) VALUES (?, ?, ?, ?, ?)',
      [id, petId, date, weight, notes],
      function(err) {
        if (err) {
          console.error('Create weight record error:', err);
          return res.status(500).json({ message: '服务器内部错误' });
        }

        db.run('UPDATE pets SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [weight, petId], (err) => {
          if (err) {
            console.error('Update pet weight error:', err);
          }
        });

        db.get('SELECT * FROM weight_records WHERE id = ?', [id], (err, record) => {
          res.status(201).json(record);
        });
      }
    );
  });
};

exports.updateWeightRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;
  const { date, weight, notes } = req.body;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (date !== undefined) {
      updateFields.push('date = ?');
      updateValues.push(date);
    }
    if (weight !== undefined) {
      updateFields.push('weight = ?');
      updateValues.push(weight);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    updateValues.push(recordId);
    updateValues.push(petId);

    db.run(
      `UPDATE weight_records SET ${updateFields.join(', ')} WHERE id = ? AND pet_id = ?`,
      updateValues,
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: '记录不存在' });
        }

        if (weight !== undefined) {
          db.run('UPDATE pets SET weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [weight, petId], (err) => {
            if (err) {
              console.error('Update pet weight error:', err);
            }
          });
        }

        db.get('SELECT * FROM weight_records WHERE id = ?', [recordId], (err, record) => {
          res.json(record);
        });
      }
    );
  });
};

exports.deleteWeightRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.run('DELETE FROM weight_records WHERE id = ? AND pet_id = ?', [recordId, petId], function(err) {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: '记录不存在' });
      }
      res.json({ message: '删除成功' });
    });
  });
};

exports.getVaccineRecords = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.all('SELECT * FROM vaccine_records WHERE pet_id = ? ORDER BY vaccine_date DESC', [petId], (err, records) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      res.json(records);
    });
  });
};

exports.createVaccineRecord = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const { vaccine_name, vaccine_date, next_date, hospital, notes } = req.body;

  if (!vaccine_name || !vaccine_date) {
    return res.status(400).json({ message: '疫苗名称和接种日期不能为空' });
  }

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const id = uuidv4();
    db.run(
      'INSERT INTO vaccine_records (id, pet_id, vaccine_name, vaccine_date, next_date, hospital, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, petId, vaccine_name, vaccine_date, next_date, hospital, notes],
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }

        db.get('SELECT * FROM vaccine_records WHERE id = ?', [id], (err, record) => {
          res.status(201).json(record);
        });
      }
    );
  });
};

exports.updateVaccineRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;
  const { vaccine_name, vaccine_date, next_date, hospital, notes } = req.body;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (vaccine_name !== undefined) {
      updateFields.push('vaccine_name = ?');
      updateValues.push(vaccine_name);
    }
    if (vaccine_date !== undefined) {
      updateFields.push('vaccine_date = ?');
      updateValues.push(vaccine_date);
    }
    if (next_date !== undefined) {
      updateFields.push('next_date = ?');
      updateValues.push(next_date);
    }
    if (hospital !== undefined) {
      updateFields.push('hospital = ?');
      updateValues.push(hospital);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    updateValues.push(recordId);
    updateValues.push(petId);

    db.run(
      `UPDATE vaccine_records SET ${updateFields.join(', ')} WHERE id = ? AND pet_id = ?`,
      updateValues,
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: '记录不存在' });
        }

        db.get('SELECT * FROM vaccine_records WHERE id = ?', [recordId], (err, record) => {
          res.json(record);
        });
      }
    );
  });
};

exports.deleteVaccineRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.run('DELETE FROM vaccine_records WHERE id = ? AND pet_id = ?', [recordId, petId], function(err) {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: '记录不存在' });
      }
      res.json({ message: '删除成功' });
    });
  });
};

exports.getMedicalRecords = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.all('SELECT * FROM medical_records WHERE pet_id = ? ORDER BY visit_date DESC', [petId], (err, records) => {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      res.json(records);
    });
  });
};

exports.createMedicalRecord = (req, res) => {
  const { userId } = req.user;
  const { petId } = req.params;
  const { visit_date, hospital, diagnosis, medication, notes } = req.body;

  if (!visit_date) {
    return res.status(400).json({ message: '就诊日期不能为空' });
  }

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const id = uuidv4();
    db.run(
      'INSERT INTO medical_records (id, pet_id, visit_date, hospital, diagnosis, medication, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, petId, visit_date, hospital, diagnosis, medication, notes],
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }

        db.get('SELECT * FROM medical_records WHERE id = ?', [id], (err, record) => {
          res.status(201).json(record);
        });
      }
    );
  });
};

exports.updateMedicalRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;
  const { visit_date, hospital, diagnosis, medication, notes } = req.body;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (visit_date !== undefined) {
      updateFields.push('visit_date = ?');
      updateValues.push(visit_date);
    }
    if (hospital !== undefined) {
      updateFields.push('hospital = ?');
      updateValues.push(hospital);
    }
    if (diagnosis !== undefined) {
      updateFields.push('diagnosis = ?');
      updateValues.push(diagnosis);
    }
    if (medication !== undefined) {
      updateFields.push('medication = ?');
      updateValues.push(medication);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: '没有任何信息需要修改' });
    }

    updateValues.push(recordId);
    updateValues.push(petId);

    db.run(
      `UPDATE medical_records SET ${updateFields.join(', ')} WHERE id = ? AND pet_id = ?`,
      updateValues,
      function(err) {
        if (err) {
          return res.status(500).json({ message: '服务器内部错误' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: '记录不存在' });
        }

        db.get('SELECT * FROM medical_records WHERE id = ?', [recordId], (err, record) => {
          res.json(record);
        });
      }
    );
  });
};

exports.deleteMedicalRecord = (req, res) => {
  const { userId } = req.user;
  const { petId, recordId } = req.params;

  db.get('SELECT * FROM pets WHERE id = ? AND user_id = ?', [petId, userId], (err, pet) => {
    if (err) {
      return res.status(500).json({ message: '服务器内部错误' });
    }
    if (!pet) {
      return res.status(404).json({ message: '宠物不存在' });
    }

    db.run('DELETE FROM medical_records WHERE id = ? AND pet_id = ?', [recordId, petId], function(err) {
      if (err) {
        return res.status(500).json({ message: '服务器内部错误' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: '记录不存在' });
      }
      res.json({ message: '删除成功' });
    });
  });
};
