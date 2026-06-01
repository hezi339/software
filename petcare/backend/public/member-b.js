(function memberBModule() {
  const state = {
    pets: [],
    analysisImageData: '',
    analysisImageMeta: null,
    latestAnalysis: null,
    latestReport: null
  };

  const REPORT_MONTH_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long'
  });

  const ANALYSIS_UPLOAD_GUIDE = {
    appearance: '建议拍摄宠物正面或侧面全身照，保证眼睛、耳朵、鼻口和整体精神状态清晰可见。',
    stool: '建议在自然光下拍摄单次粪便照片，尽量包含颜色、成形度和周边参照物。',
    skin: '建议近距离拍摄皮肤或毛发表面问题区域，尽量让红斑、皮屑、破损部位清晰可见。'
  };

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToastSafe(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    window.alert(message);
  }

  function hasToken() {
    return Boolean(localStorage.getItem('token'));
  }

  async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'string' ? payload : payload.message;
      throw new Error(message || '请求失败');
    }

    return payload;
  }

  function clearSelect(select) {
    if (!select) return;
    select.innerHTML = '<option value="">请选择宠物</option>';
  }

  function ensureMonthDefault() {
    const input = $('reportMonth');
    if (input && !input.value) {
      input.value = new Date().toISOString().slice(0, 7);
    }
  }

  function formatMonthText(monthValue) {
    if (!monthValue) return '';
    const [year, month] = monthValue.split('-').map(Number);
    return REPORT_MONTH_FORMATTER.format(new Date(year, month - 1, 1));
  }

  function formatFileSize(bytes) {
    const size = Number(bytes || 0);
    if (!size) return '0 KB';
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  function getAnalysisTypeLabel(analysisType) {
    return ({
      appearance: '外观',
      stool: '粪便',
      skin: '皮肤'
    })[analysisType] || analysisType || '健康';
  }

  function updateUploadHint() {
    const hint = $('aiUploadHint');
    if (!hint) return;
    const analysisType = $('analysisType')?.value || 'appearance';
    hint.textContent = ANALYSIS_UPLOAD_GUIDE[analysisType] || ANALYSIS_UPLOAD_GUIDE.appearance;
  }

  function updateAnalysisButtonState() {
    const button = $('runAiAnalysisBtn');
    if (!button) return;
    button.disabled = !(hasToken() && getSelectedPet('aiPetSelect') && state.analysisImageData);
  }

  function getSelectedPet(selectId) {
    const petId = $(selectId)?.value;
    return state.pets.find(item => item.id === petId) || null;
  }

  function setEmptyState(containerId, message) {
    const target = $(containerId);
    if (!target) return;
    target.innerHTML = `<div class="empty-panel">${escapeHtml(message)}</div>`;
  }

  function buildStatusBadge(riskLevel, labelOverride) {
    const level = riskLevel || 'normal';
    const labelMap = {
      normal: labelOverride || '状态平稳',
      attention: labelOverride || '建议留意',
      warning: labelOverride || '建议尽快处理'
    };
    return `<span class="member-b-status ${escapeHtml(level)}">${escapeHtml(labelMap[level] || labelMap.normal)}</span>`;
  }

  function syncPetSelectOptions() {
    const selectIds = ['aiPetSelect', 'nutritionPetSelect', 'reportPetSelect'];
    const previous = Object.fromEntries(
      selectIds.map(id => [id, $(id)?.value || ''])
    );

    selectIds.forEach(id => clearSelect($(id)));

    if (!state.pets.length) {
      setEmptyState('analysisHistoryList', '登录并添加宠物后，这里会显示 AI 分析记录。');
      setEmptyState('nutritionResult', '选择宠物后可生成个性化营养搭配方案。');
      setEmptyState('reportResult', '选择宠物和月份后可生成月度健康报表。');
      updateAnalysisButtonState();
      return;
    }

    const options = state.pets
      .map(pet => `<option value="${escapeHtml(pet.id)}">${escapeHtml(pet.name)}</option>`)
      .join('');

    selectIds.forEach(id => {
      const select = $(id);
      if (!select) return;
      select.innerHTML = `<option value="">请选择宠物</option>${options}`;
      if (previous[id] && state.pets.some(item => item.id === previous[id])) {
        select.value = previous[id];
      } else if (state.pets.length === 1) {
        select.value = state.pets[0].id;
      }
    });
    updateAnalysisButtonState();
  }

  async function fetchPetsForMemberB() {
    if (!hasToken()) {
      state.pets = [];
      syncPetSelectOptions();
      return [];
    }

    try {
      state.pets = await apiFetch('http://localhost:3000/api/pets');
      syncPetSelectOptions();
      return state.pets;
    } catch (error) {
      console.error('Member B pets load failed:', error);
      return [];
    }
  }

  function resetAnalysisComposer() {
    state.analysisImageData = '';
    state.analysisImageMeta = null;
    const cameraInput = $('aiCameraInput');
    const galleryInput = $('aiGalleryInput');
    const notes = $('aiNotes');
    const preview = $('aiPreviewArea');

    if (cameraInput) cameraInput.value = '';
    if (galleryInput) galleryInput.value = '';
    if (notes) notes.value = '';
    if (preview) {
      preview.innerHTML = `
        <i class="fas fa-camera-retro" style="font-size: 46px; color: var(--primary-dark);"></i>
        <strong>上传宠物照片做健康初筛</strong>
        <p style="margin: 0; color: var(--text-light); line-height: 1.6;">支持宠物外观、粪便和皮肤照片。单张不超过 10MB。</p>
      `;
    }
    updateUploadHint();
    updateAnalysisButtonState();
  }

  function bindUploadArea() {
    const dropzone = $('aiUploadDropzone');
    const cameraInput = $('aiCameraInput');
    const galleryInput = $('aiGalleryInput');

    if (!dropzone || !cameraInput || !galleryInput) return;

    $('aiUploadBtn')?.addEventListener('click', () => cameraInput.click());
    $('aiGalleryBtn')?.addEventListener('click', () => galleryInput.click());

    dropzone.addEventListener('click', event => {
      if (event.target.closest('button')) return;
      galleryInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.add('is-active');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, event => {
        event.preventDefault();
        dropzone.classList.remove('is-active');
      });
    });

    dropzone.addEventListener('drop', event => {
      const [file] = Array.from(event.dataTransfer.files || []);
      if (file) {
        handleSelectedFile(file, 'drop');
      }
    });

    cameraInput.addEventListener('change', event => {
      const [file] = Array.from(event.target.files || []);
      if (file) {
        handleSelectedFile(file, 'camera');
      }
    });

    galleryInput.addEventListener('change', event => {
      const [file] = Array.from(event.target.files || []);
      if (file) {
        handleSelectedFile(file, 'gallery');
      }
    });
  }

  function renderSelectedPreview() {
    const preview = $('aiPreviewArea');
    if (!preview || !state.analysisImageData || !state.analysisImageMeta) return;

    const sourceLabel = state.analysisImageMeta.source === 'camera'
      ? '拍照上传'
      : state.analysisImageMeta.source === 'drop'
        ? '拖拽上传'
        : '相册上传';

    preview.innerHTML = `
      <img src="${escapeHtml(state.analysisImageData)}" alt="上传预览">
      <div class="upload-preview-copy">
        <strong>已选择${escapeHtml(getAnalysisTypeLabel($('analysisType')?.value || state.analysisImageMeta.analysisType))}照片</strong>
        <div class="upload-meta">
          <span class="upload-meta-chip">${escapeHtml(state.analysisImageMeta.name)}</span>
          <span class="upload-meta-chip">${escapeHtml(formatFileSize(state.analysisImageMeta.size))}</span>
          <span class="upload-meta-chip">${escapeHtml(sourceLabel)}</span>
        </div>
      </div>
    `;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function loadImageElement(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片加载失败'));
      image.src = dataUrl;
    });
  }

  async function prepareImageForAnalysis(file) {
    const originalDataUrl = await readFileAsDataUrl(file);

    if (!/^image\/(png|webp|bmp|gif)$/i.test(file.type || '')) {
      return {
        dataUrl: originalDataUrl,
        mimeType: file.type || 'image/jpeg'
      };
    }

    try {
      const image = await loadImageElement(originalDataUrl);
      const maxSide = 1600;
      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;
      const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        return {
          dataUrl: originalDataUrl,
          mimeType: file.type || 'image/jpeg'
        };
      }

      canvas.width = width;
      canvas.height = height;

      // 用白底导出 JPEG，提升远程视觉模型对 PNG 等图片的兼容性。
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      return {
        dataUrl: canvas.toDataURL('image/jpeg', 0.9),
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      return {
        dataUrl: originalDataUrl,
        mimeType: file.type || 'image/jpeg'
      };
    }
  }

  async function handleSelectedFile(file, source = 'gallery') {
    if (!file.type.startsWith('image/')) {
      showToastSafe('请选择图片文件');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToastSafe('图片不能超过 10MB');
      return;
    }

    try {
      const preparedImage = await prepareImageForAnalysis(file);
      state.analysisImageData = preparedImage.dataUrl;
      state.analysisImageMeta = {
        name: file.name,
        size: file.size,
        source,
        mimeType: preparedImage.mimeType,
        analysisType: $('analysisType')?.value || 'appearance'
      };
      renderSelectedPreview();
      updateAnalysisButtonState();
    } catch (error) {
      console.error('Image preparation failed:', error);
      showToastSafe('图片处理失败，请重新选择后再试');
    }
  }

  function renderAnalysisResult(data) {
    const target = $('analysisResult');
    if (!target) return;

    const abnormalItems = (data.abnormal_items || []).map(item => `
      <li><strong>${escapeHtml(item.title)}</strong> · ${escapeHtml(item.detail)}</li>
    `).join('');

    const adviceItems = (data.health_advice || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    const focusTags = (data.nutrition_focus || []).map(item => `<span class="tag-chip">${escapeHtml(item)}</span>`).join('');
    const metrics = data.metrics || {};

    target.innerHTML = `
      <div class="member-b-card">
        <div class="member-b-header" style="margin-bottom: 12px;">
          <div>
            <h4>${escapeHtml(data.summary || '已生成分析结果')}</h4>
            <p>分析场景：${escapeHtml({ appearance: '外观', stool: '粪便', skin: '皮肤' }[data.analysis_type] || data.analysis_type || '')}</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            ${buildStatusBadge(data.risk_level)}
            <span class="member-b-status">${escapeHtml(data.service_source || 'analysis')}</span>
          </div>
        </div>
        <div class="analysis-metrics">
          <div class="metric-pill">
            置信度
            <strong>${Math.round((Number(data.confidence || 0) || 0) * 100)}%</strong>
          </div>
          <div class="metric-pill">
            消化状态
            <strong>${escapeHtml(metrics.digestion ?? '--')}</strong>
          </div>
          <div class="metric-pill">
            皮肤屏障
            <strong>${escapeHtml(metrics.skinBarrier ?? '--')}</strong>
          </div>
          <div class="metric-pill">
            活力评分
            <strong>${escapeHtml(metrics.vitality ?? '--')}</strong>
          </div>
        </div>
        ${focusTags ? `<div class="tag-row">${focusTags}</div>` : ''}
        ${abnormalItems ? `<ul class="bullet-list" style="margin-top:14px;">${abnormalItems}</ul>` : ''}
        ${adviceItems ? `<ul class="bullet-list" style="margin-top:14px;">${adviceItems}</ul>` : ''}
        ${data.raw_result?.disclaimer || data.disclaimer ? `<div class="note-box">${escapeHtml(data.raw_result?.disclaimer || data.disclaimer)}</div>` : ''}
      </div>
    `;
  }

  function renderAnalysisHistory(records) {
    const target = $('analysisHistoryList');
    if (!target) return;

    if (!records.length) {
      setEmptyState('analysisHistoryList', '还没有 AI 分析记录，上传一张照片试试。');
      return;
    }

    target.innerHTML = `
      <div class="history-list">
        ${records.map(item => `
          <div class="history-item">
            <div class="history-item-head">
              <strong>${escapeHtml(item.analysis_date)} · ${escapeHtml({ appearance: '外观', stool: '粪便', skin: '皮肤' }[item.analysis_type] || item.analysis_type)}</strong>
              ${buildStatusBadge(item.risk_level)}
            </div>
            <p>${escapeHtml(item.summary || '')}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function loadAnalysisHistory() {
    const pet = getSelectedPet('aiPetSelect');
    if (!pet || !hasToken()) {
      setEmptyState('analysisHistoryList', '选择宠物后可查看对应的 AI 分析历史。');
      return;
    }

    try {
      const records = await apiFetch(`http://localhost:3000/api/pets/${pet.id}/ai-analysis?limit=8`);
      renderAnalysisHistory(records);
    } catch (error) {
      console.error('Analysis history load failed:', error);
      setEmptyState('analysisHistoryList', '分析历史加载失败，请稍后重试。');
    }
  }

  async function submitAiAnalysis() {
    if (!hasToken()) {
      showToastSafe('请先登录后再使用 AI 分析');
      return;
    }

    const pet = getSelectedPet('aiPetSelect');
    const analysisType = $('analysisType')?.value;
    const notes = $('aiNotes')?.value.trim() || '';

    if (!pet) {
      showToastSafe('请先选择宠物');
      return;
    }
    if (!analysisType) {
      showToastSafe('请选择分析类型');
      return;
    }
    if (!state.analysisImageData) {
      showToastSafe('请先上传一张照片');
      return;
    }

    const button = $('runAiAnalysisBtn');
    if (button) button.disabled = true;

    try {
      const result = await apiFetch(`http://localhost:3000/api/pets/${pet.id}/ai-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          analysis_type: analysisType,
          image_data: state.analysisImageData,
          image_name: `${analysisType}-${Date.now()}.jpg`,
          notes,
          analysis_date: new Date().toISOString().slice(0, 10)
        })
      });

      state.latestAnalysis = result;
      renderAnalysisResult(result);
      await loadAnalysisHistory();
      if ($('nutritionPetSelect')?.value === pet.id) {
        await loadNutritionPlan();
      }
      if ($('reportPetSelect')?.value === pet.id) {
        await loadMonthlyReport();
      }
      showToastSafe('AI 分析已生成');
    } catch (error) {
      console.error('AI analysis failed:', error);
      showToastSafe(error.message || 'AI 分析失败');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderNutritionPlan(plan) {
    const target = $('nutritionResult');
    if (!target) return;

    target.innerHTML = `
      <div class="member-b-card">
        <div class="member-b-header" style="margin-bottom: 10px;">
          <div>
            <h4>${escapeHtml(plan.pet.name)} 的营养搭配建议</h4>
            <p>${escapeHtml(plan.summary)}</p>
          </div>
          <div class="member-b-status normal">${escapeHtml(plan.pet.lifeStage)}</div>
        </div>
        <div class="nutrition-stats">
          <div class="stat-tile">目标热量<strong>${escapeHtml(plan.targets.calories)} kcal</strong></div>
          <div class="stat-tile">主粮建议<strong>${escapeHtml(plan.targets.dailyFoodGrams)} g</strong></div>
          <div class="stat-tile">饮水建议<strong>${escapeHtml(plan.targets.waterTargetMl)} ml</strong></div>
          <div class="stat-tile">分餐次数<strong>${escapeHtml(plan.targets.mealCount)} 次</strong></div>
        </div>
        <div class="report-panels">
          <div class="member-b-card">
            <h4>餐次方案</h4>
            <ul class="bullet-list">${plan.mealPlan.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="member-b-card">
            <h4>营养搭配</h4>
            <ul class="bullet-list">${plan.recommendedPairing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="member-b-card">
            <h4>补充建议</h4>
            <ul class="bullet-list">${plan.supplements.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div class="member-b-card">
            <h4>避免事项</h4>
            <ul class="bullet-list">${plan.avoidList.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="note-box">${plan.signals.map(item => escapeHtml(item)).join(' ')}</div>
      </div>
    `;
  }

  async function loadNutritionPlan() {
    const pet = getSelectedPet('nutritionPetSelect');
    if (!pet || !hasToken()) {
      setEmptyState('nutritionResult', '选择宠物后可生成个性化营养搭配方案。');
      return;
    }

    try {
      const plan = await apiFetch(`http://localhost:3000/api/pets/${pet.id}/nutrition-plan`);
      renderNutritionPlan(plan);
    } catch (error) {
      console.error('Nutrition plan load failed:', error);
      setEmptyState('nutritionResult', '营养方案生成失败，请稍后重试。');
    }
  }

  function createLineChartSvg(points, color, label) {
    if (!points.length) {
      return `
        <svg class="chart-svg" viewBox="0 0 320 190" role="img" aria-label="${escapeHtml(label)}">
          <text x="160" y="95" text-anchor="middle" fill="#999" font-size="14">本月暂无足够数据</text>
        </svg>
      `;
    }

    const width = 320;
    const height = 190;
    const padding = 24;
    const values = points.map(item => Number(item.value));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const coords = points.map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(1, points.length - 1);
      const y = height - padding - ((Number(point.value) - min) / range) * (height - padding * 2);
      return { ...point, x, y };
    });

    const path = coords.map((item, index) => `${index === 0 ? 'M' : 'L'}${item.x.toFixed(1)},${item.y.toFixed(1)}`).join(' ');

    return `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#e6edf2" stroke-width="1" />
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#e6edf2" stroke-width="1" />
        <path d="${path}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        ${coords.map(item => `
          <circle cx="${item.x.toFixed(1)}" cy="${item.y.toFixed(1)}" r="4.5" fill="${color}" />
          <text x="${item.x.toFixed(1)}" y="${(item.y - 10).toFixed(1)}" text-anchor="middle" fill="#666" font-size="11">${escapeHtml(item.value)}</text>
        `).join('')}
        <text x="${padding}" y="${padding - 6}" fill="#888" font-size="12">${escapeHtml(String(max))}</text>
        <text x="${padding}" y="${height - 6}" fill="#888" font-size="12">${escapeHtml(String(min))}</text>
      </svg>
    `;
  }

  function renderMonthlyReport(report) {
    const target = $('reportResult');
    if (!target) return;

    const monthText = formatMonthText(report.month);
    target.innerHTML = `
      <div class="member-b-card" id="printableReportCard">
        <div class="member-b-header">
          <div>
            <h4>${escapeHtml(report.pet.name)} · ${escapeHtml(monthText)}健康报表</h4>
            <p>生成时间：${escapeHtml(new Date(report.generatedAt).toLocaleString())}</p>
          </div>
          <div class="member-b-status normal">自动汇总</div>
        </div>
        <div class="report-summary">
          <div class="score-card">
            健康评分
            <strong>${escapeHtml(report.score)}</strong>
            <span>基于体重、饮食、饮水、行为和 AI 初筛结果综合计算</span>
          </div>
          <div class="member-b-card">
            <div class="report-kpis">
              <div class="kpi-tile">平均摄食<strong>${escapeHtml(report.kpis.avgDailyFood || '--')}g</strong></div>
              <div class="kpi-tile">平均饮水<strong>${escapeHtml(report.kpis.avgWater || '--')}ml</strong></div>
              <div class="kpi-tile">排便频率<strong>${escapeHtml(report.kpis.avgPotty || '--')}</strong></div>
              <div class="kpi-tile">异常提醒<strong>${escapeHtml(report.kpis.warningCount)}</strong></div>
            </div>
            <ul class="bullet-list" style="margin-top:16px;">
              ${report.highlights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        </div>
        <div class="chart-grid">
          <div class="chart-card">
            <h4>体重趋势</h4>
            ${createLineChartSvg(report.trends.weight, '#ff8c94', '体重趋势')}
          </div>
          <div class="chart-card">
            <h4>每日摄食</h4>
            ${createLineChartSvg(report.trends.food, '#ffb347', '每日摄食')}
          </div>
          <div class="chart-card">
            <h4>饮水记录</h4>
            ${createLineChartSvg(report.trends.water, '#7bc6e5', '饮水记录')}
          </div>
          <div class="chart-card">
            <h4>AI 风险波动</h4>
            ${createLineChartSvg(report.trends.analysisRisk, '#88d8b0', 'AI 风险波动')}
          </div>
        </div>
        <div class="report-panels">
          <div class="member-b-card">
            <h4>本月提醒</h4>
            <ul class="bullet-list">
              ${report.alerts.length
                ? report.alerts.map(item => `<li>${escapeHtml(item.date)} · ${escapeHtml(item.text)}</li>`).join('')
                : '<li>本月未记录到显著异常提醒。</li>'}
            </ul>
          </div>
          <div class="member-b-card">
            <h4>下月跟进清单</h4>
            <ul class="bullet-list">${report.checklist.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
        </div>
      </div>
    `;

    const exportButton = $('exportReportBtn');
    if (exportButton) exportButton.disabled = false;
  }

  async function loadMonthlyReport() {
    const pet = getSelectedPet('reportPetSelect');
    const month = $('reportMonth')?.value;

    if (!pet || !hasToken()) {
      setEmptyState('reportResult', '选择宠物和月份后可生成月度健康报表。');
      return;
    }
    if (!month) {
      showToastSafe('请先选择月份');
      return;
    }

    try {
      const report = await apiFetch(`http://localhost:3000/api/pets/${pet.id}/monthly-report?month=${encodeURIComponent(month)}`);
      state.latestReport = report;
      renderMonthlyReport(report);
    } catch (error) {
      console.error('Monthly report load failed:', error);
      setEmptyState('reportResult', '月度报表生成失败，请稍后重试。');
    }
  }

  function exportReportPdf() {
    if (!state.latestReport) {
      showToastSafe('请先生成月度健康报表');
      return;
    }

    const reportCard = $('printableReportCard');
    if (!reportCard) {
      showToastSafe('报表内容尚未生成');
      return;
    }

    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) {
      showToastSafe('浏览器拦截了新窗口，请允许弹窗后重试');
      return;
    }

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(state.latestReport.pet.name)}-${escapeHtml(state.latestReport.month)}-健康报表</title>
        <style>
          body { font-family: "Segoe UI", "PingFang SC", sans-serif; padding: 24px; color: #333; background: #fffaf6; }
          .member-b-card, .chart-card { background:#fff; border:1px solid #eee; border-radius:18px; padding:18px; margin-bottom:16px; }
          .member-b-header, .report-summary, .report-panels, .chart-grid, .report-kpis { display:grid; gap:16px; }
          .report-summary, .report-panels { grid-template-columns: 1fr 1fr; }
          .chart-grid { grid-template-columns: 1fr 1fr; }
          .report-kpis { grid-template-columns: repeat(4, 1fr); }
          .score-card { background: linear-gradient(160deg, #ff8c94, #ffc36b); color: white; border-radius: 20px; padding: 24px; }
          .score-card strong { display:block; font-size:52px; margin-top:12px; }
          .kpi-tile { border:1px solid #f0f0f0; border-radius:16px; padding:14px; }
          .kpi-tile strong { display:block; font-size:24px; color:#e85a6a; margin-top:4px; }
          .bullet-list { padding-left: 18px; }
          .bullet-list li { margin-bottom: 10px; line-height: 1.6; }
          .chart-svg { width:100%; height:auto; }
          @media print {
            body { background: white; }
          }
        </style>
      </head>
      <body>
        ${reportCard.outerHTML}
        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 300);
          };
        <\/script>
      </body>
      </html>
    `);
    popup.document.close();
  }

  function bindEvents() {
    bindUploadArea();

    $('runAiAnalysisBtn')?.addEventListener('click', submitAiAnalysis);
    $('aiPetSelect')?.addEventListener('change', () => {
      updateAnalysisButtonState();
      loadAnalysisHistory();
    });
    $('analysisType')?.addEventListener('change', () => {
      updateUploadHint();
      renderSelectedPreview();
    });
    $('resetAiComposerBtn')?.addEventListener('click', resetAnalysisComposer);

    $('loadNutritionBtn')?.addEventListener('click', loadNutritionPlan);
    $('nutritionPetSelect')?.addEventListener('change', loadNutritionPlan);

    $('loadReportBtn')?.addEventListener('click', loadMonthlyReport);
    $('reportPetSelect')?.addEventListener('change', loadMonthlyReport);
    $('reportMonth')?.addEventListener('change', loadMonthlyReport);
    $('exportReportBtn')?.addEventListener('click', exportReportPdf);
  }

  function patchGlobalHooks() {
    if (typeof window.loadPets === 'function' && !window.loadPets.__memberBWrapped) {
      const originalLoadPets = window.loadPets;
      const wrappedLoadPets = async function wrappedLoadPets(...args) {
        const result = await originalLoadPets.apply(this, args);
        await fetchPetsForMemberB();
        return result;
      };
      wrappedLoadPets.__memberBWrapped = true;
      window.loadPets = wrappedLoadPets;
    }

    if (typeof window.logout === 'function' && !window.logout.__memberBWrapped) {
      const originalLogout = window.logout;
      const wrappedLogout = function wrappedLogout(...args) {
        const result = originalLogout.apply(this, args);
        state.pets = [];
        state.latestAnalysis = null;
        state.latestReport = null;
        syncPetSelectOptions();
        resetAnalysisComposer();
        return result;
      };
      wrappedLogout.__memberBWrapped = true;
      window.logout = wrappedLogout;
    }
  }

  async function init() {
    ensureMonthDefault();
    bindEvents();
    patchGlobalHooks();
    resetAnalysisComposer();

    if (hasToken()) {
      await fetchPetsForMemberB();
      await Promise.all([loadAnalysisHistory(), loadNutritionPlan(), loadMonthlyReport()]);
    } else {
      syncPetSelectOptions();
    }

    updateUploadHint();
    updateAnalysisButtonState();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
