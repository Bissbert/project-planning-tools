/**
 * Burndown Chart Module - SVG chart generation
 * Handles rendering the burndown chart visualization
 */

// ========== CONFIGURATION ==========

const CHART_CONFIG = {
  margin: { top: 30, right: 30, bottom: 50, left: 60 },
  pointRadius: 4,
  lineWidth: 2.5,
  idealLineWidth: 2,
  gridLines: 5,
  animationDuration: 300
};

// ========== MAIN RENDER FUNCTION ==========

/**
 * Render the burndown chart
 * @param {Object} data - Burndown data from getBurndownData()
 * @param {string} mode - 'points' or 'tasks'
 */
export function renderChart(data, mode) {
  const svg = document.getElementById('burndownChart');
  if (!svg) return;

  // Clear existing content
  svg.innerHTML = '';

  const { ideal, actual, totalPoints, totalTasks, startDate, endDate, daysElapsed, currentRemaining } = data;

  // Check if we have any data
  if (ideal.length === 0) {
    renderNoData(svg);
    return;
  }

  // Get dimensions
  const rect = svg.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const { margin } = CHART_CONFIG;

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Determine max value for Y axis
  const maxValue = mode === 'points' ? totalPoints : totalTasks;
  const yMax = Math.max(maxValue, 1); // Avoid division by zero

  // Create scales
  const xScale = createXScale(ideal, chartWidth);
  const yScale = createYScale(yMax, chartHeight);

  // Prepare actual data with synthetic start point if needed
  const actualWithStart = prepareActualData(actual, startDate, totalPoints, totalTasks, currentRemaining, mode);

  // Create chart group
  const chartGroup = createSVGElement('g', {
    transform: `translate(${margin.left}, ${margin.top})`
  });
  svg.appendChild(chartGroup);

  // Render components in order (back to front)
  renderGrid(chartGroup, chartWidth, chartHeight, yMax);
  renderIdealLine(chartGroup, ideal, xScale, yScale, mode);
  renderActualLine(chartGroup, actualWithStart, xScale, yScale, mode);
  renderTodayMarker(chartGroup, ideal, xScale, chartHeight, daysElapsed);
  renderDataPoints(chartGroup, actualWithStart, xScale, yScale, mode);
  renderAxes(chartGroup, ideal, xScale, yScale, chartWidth, chartHeight, yMax, mode);
}

/**
 * Prepare actual burndown data with synthetic points if needed
 * Ensures there's always a starting point and current point
 */
function prepareActualData(actual, startDate, totalPoints, totalTasks, currentRemaining, mode) {
  const today = new Date().toISOString().split('T')[0];
  let result = [...actual];

  // Add synthetic start point if no data exists for start date
  const hasStartPoint = result.some(d => d.date === startDate);
  if (!hasStartPoint) {
    result.unshift({
      date: startDate,
      remainingPoints: totalPoints,
      remainingTasks: totalTasks,
      synthetic: true
    });
  }

  // Add current state as today's point if not already present
  const hasTodayPoint = result.some(d => d.date === today);
  if (!hasTodayPoint && today >= startDate) {
    result.push({
      date: today,
      remainingPoints: currentRemaining.points,
      remainingTasks: currentRemaining.tasks,
      synthetic: true
    });
  }

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

// ========== SCALE FUNCTIONS ==========

/**
 * Create X scale (date-based)
 * @param {Array} ideal - Ideal burndown data points
 * @param {number} width - Chart width
 * @returns {Function} - Scale function
 */
function createXScale(ideal, width) {
  const dates = ideal.map(d => d.date);
  return (date) => {
    const index = dates.indexOf(date);
    if (index === -1) {
      // Interpolate for dates not in ideal
      const dateObj = new Date(date);
      const startObj = new Date(dates[0]);
      const endObj = new Date(dates[dates.length - 1]);
      const totalMs = endObj - startObj;
      const elapsedMs = dateObj - startObj;
      return (elapsedMs / totalMs) * width;
    }
    return (index / (dates.length - 1)) * width;
  };
}

/**
 * Create Y scale (linear)
 * @param {number} max - Maximum Y value
 * @param {number} height - Chart height
 * @returns {Function} - Scale function
 */
function createYScale(max, height) {
  return (value) => {
    return height - (value / max) * height;
  };
}

// ========== RENDER COMPONENTS ==========

/**
 * Render grid lines
 */
function renderGrid(parent, width, height, yMax) {
  const gridGroup = createSVGElement('g', { class: 'chart-grid-group' });

  // Horizontal grid lines
  const ySteps = CHART_CONFIG.gridLines;
  for (let i = 0; i <= ySteps; i++) {
    const y = (i / ySteps) * height;
    const line = createSVGElement('line', {
      x1: 0,
      y1: y,
      x2: width,
      y2: y,
      class: i === ySteps ? 'chart-axis' : 'chart-grid'
    });
    gridGroup.appendChild(line);
  }

  parent.appendChild(gridGroup);
}

/**
 * Render the ideal burndown line
 */
function renderIdealLine(parent, ideal, xScale, yScale, mode) {
  if (ideal.length < 2) return;

  const points = ideal.map(d => {
    const value = mode === 'points' ? d.points : d.tasks;
    return `${xScale(d.date)},${yScale(value)}`;
  }).join(' ');

  const line = createSVGElement('polyline', {
    points,
    class: 'chart-line-ideal'
  });

  parent.appendChild(line);
}

/**
 * Render the actual burndown line
 */
function renderActualLine(parent, actual, xScale, yScale, mode) {
  if (actual.length < 1) return;

  // Sort by date
  const sorted = [...actual].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 1) {
    // Just one point, render only the point (handled in renderDataPoints)
    return;
  }

  const points = sorted.map(d => {
    const value = mode === 'points' ? d.remainingPoints : d.remainingTasks;
    return `${xScale(d.date)},${yScale(value)}`;
  }).join(' ');

  const line = createSVGElement('polyline', {
    points,
    class: 'chart-line-actual'
  });

  parent.appendChild(line);
}

/**
 * Render data points on actual line
 */
function renderDataPoints(parent, actual, xScale, yScale, mode) {
  if (actual.length === 0) return;

  const sorted = [...actual].sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().split('T')[0];

  const pointsGroup = createSVGElement('g', { class: 'chart-points-group' });

  sorted.forEach(d => {
    const value = mode === 'points' ? d.remainingPoints : d.remainingTasks;
    const x = xScale(d.date);
    const y = yScale(value);
    const isToday = d.date === today;
    const isSynthetic = d.synthetic === true;

    // Build class list
    let pointClass = 'chart-point';
    if (isToday) pointClass += ' chart-point--today';
    if (isSynthetic) pointClass += ' chart-point--synthetic';

    const circle = createSVGElement('circle', {
      cx: x,
      cy: y,
      r: CHART_CONFIG.pointRadius,
      class: pointClass
    });

    // Add tooltip data
    circle.dataset.date = d.date;
    circle.dataset.value = value;
    if (isSynthetic) circle.dataset.synthetic = 'true';

    // Add hover effect
    circle.addEventListener('mouseenter', (e) => showTooltip(e, d, mode));
    circle.addEventListener('mouseleave', hideTooltip);

    pointsGroup.appendChild(circle);
  });

  parent.appendChild(pointsGroup);
}

/**
 * Render today marker (vertical line)
 */
function renderTodayMarker(parent, ideal, xScale, height, daysElapsed) {
  const today = new Date().toISOString().split('T')[0];
  const dates = ideal.map(d => d.date);

  // Only show if today is within sprint range
  if (today < dates[0] || today > dates[dates.length - 1]) return;

  const x = xScale(today);

  // Vertical line
  const line = createSVGElement('line', {
    x1: x,
    y1: 0,
    x2: x,
    y2: height,
    class: 'chart-today-line'
  });
  parent.appendChild(line);

  // "Today" label
  const label = createSVGElement('text', {
    x: x,
    y: -8,
    class: 'chart-today-label'
  });
  label.textContent = 'Today';
  parent.appendChild(label);
}

/**
 * Render X and Y axes with labels
 */
function renderAxes(parent, ideal, xScale, yScale, width, height, yMax, mode) {
  // Y-axis labels
  const ySteps = CHART_CONFIG.gridLines;
  for (let i = 0; i <= ySteps; i++) {
    const value = Math.round((yMax * (ySteps - i)) / ySteps);
    const y = (i / ySteps) * height;

    const label = createSVGElement('text', {
      x: -10,
      y: y + 4,
      class: 'chart-axis-label chart-axis-label--y'
    });
    label.textContent = value;
    parent.appendChild(label);
  }

  // Y-axis title
  const yTitle = createSVGElement('text', {
    x: -height / 2,
    y: -45,
    transform: 'rotate(-90)',
    class: 'chart-axis-title'
  });
  yTitle.textContent = mode === 'points' ? 'Story Points' : 'Tasks';
  parent.appendChild(yTitle);

  // X-axis labels (dates)
  const dates = ideal.map(d => d.date);
  const labelInterval = Math.max(1, Math.ceil(dates.length / 7)); // Show ~7 labels max

  dates.forEach((date, i) => {
    if (i % labelInterval !== 0 && i !== dates.length - 1) return;

    const x = xScale(date);
    const dateObj = new Date(date);
    const label = createSVGElement('text', {
      x: x,
      y: height + 20,
      class: 'chart-axis-label chart-axis-label--x'
    });
    label.textContent = formatDate(dateObj);
    parent.appendChild(label);
  });

  // X-axis title
  const xTitle = createSVGElement('text', {
    x: width / 2,
    y: height + 40,
    class: 'chart-axis-title'
  });
  xTitle.textContent = 'Date';
  parent.appendChild(xTitle);
}

/**
 * Render no data message
 */
function renderNoData(svg) {
  const rect = svg.getBoundingClientRect();
  const text = createSVGElement('text', {
    x: rect.width / 2,
    y: rect.height / 2,
    class: 'chart-no-data'
  });
  text.textContent = 'No burndown data available';
  svg.appendChild(text);
}

// ========== TOOLTIP ==========

let tooltipEl = null;

function showTooltip(event, data, mode) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'chart-tooltip';
    document.body.appendChild(tooltipEl);
  }

  const value = mode === 'points' ? data.remainingPoints : data.remainingTasks;
  const unit = mode === 'points' ? 'pts' : 'tasks';
  const dateStr = formatDateLong(new Date(data.date));

  tooltipEl.innerHTML = `
    <div class="chart-tooltip__date">${dateStr}</div>
    <div class="chart-tooltip__row">
      <span class="chart-tooltip__label">Remaining:</span>
      <span class="chart-tooltip__value chart-tooltip__value--actual">${value} ${unit}</span>
    </div>
  `;

  // Position tooltip
  const x = event.clientX + 10;
  const y = event.clientY - 10;
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
  tooltipEl.classList.add('visible');
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove('visible');
  }
}

// ========== EXPORT FUNCTION ==========

/**
 * Export the chart as a PNG image
 * @param {string} filename - Filename without extension
 */
export function exportChartAsImage(filename) {
  const svg = document.getElementById('burndownChart');
  if (!svg) return;

  // Get SVG dimensions
  const rect = svg.getBoundingClientRect();

  // Create canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const scale = 2; // Higher resolution
  canvas.width = rect.width * scale;
  canvas.height = rect.height * scale;

  // Fill background
  ctx.fillStyle = '#18181f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get SVG data
  const svgData = new XMLSerializer().serializeToString(svg);

  // Create blob and image
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    // Download
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = url;
}

// ========== HELPER FUNCTIONS ==========

/**
 * Create an SVG element with attributes
 * @param {string} tag - Element tag name
 * @param {Object} attrs - Attributes to set
 * @returns {SVGElement} - Created element
 */
function createSVGElement(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/**
 * Format date for axis labels (short format)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Format date for tooltip (long format)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date
 */
function formatDateLong(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}
