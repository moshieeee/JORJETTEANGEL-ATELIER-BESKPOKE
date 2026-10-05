const overviewCards = [
  {
    label: 'Active Selling Items',
    items: [
      { name: 'Classic Polo', tag: 'Top 1' },
      { name: 'Cotton Tee', tag: 'Top 2' },
      { name: 'Denim Jacket', tag: 'Top 3' },
    ],
    accent: '#1d4ed8',
    renderType: 'list'
  },
  {
    label: 'Important Calendar Dates',
    items: [
      { name: 'Bulk Order Deadline', tag: 'May 08' },
      { name: 'Bulk Order Deadline', tag: 'May 12' },
      { name: 'Bulk Order Deadline', tag: 'May 18' },
    ],
    accent: '#b45309',
    renderType: 'list'
  },
  {
    label: 'Pending Production Queues',
    items: [
      { name: 'Custom Barong Orders', tag: '12 jobs' },
      { name: 'Custom Uniforms Orders', tag: '18 jobs' },
      { name: 'Finishing', tag: '7 jobs' },
    ],
    accent: '#15803d',
    renderType: 'list'
  }
];

const kpis = [
  { label: 'Total Sales', value: '₱184,250', delta: '+12.4%', tone: 'positive' },
  { label: 'Pending Orders', value: '86', delta: '+9 new', tone: 'warning' },
  { label: 'Low Stock', value: '14 Items', delta: 'Needs reorder', tone: 'critical' },
  { label: 'Completed Today', value: '42', delta: '+6.1%', tone: 'positive' },
];

const salesTrend = [58, 64, 74, 70, 82, 90, 96];

const alerts = [
  { title: 'Low stock: Cotton Twill', detail: 'Reorder expected within 2 days', level: 'critical' },
  { title: 'Supplier delay', detail: 'Buttons & Zippers delivery pushed to May 14', level: 'warning' },
  { title: 'Payment pending', detail: '3 customer balances are overdue by 5+ days', level: 'warning' },
  { title: 'Bulk order deadline', detail: '2 high-priority orders due this week', level: 'neutral' },
];

const orderStatus = [
  { label: 'Production Ongoing', count: 36, percentage: 58, color: 'blue' },
  { label: 'Awaiting Materials', count: 24, percentage: 36, color: 'amber' },
  { label: 'Ready for Dispatch', count: 18, percentage: 28, color: 'green' },
];

const activity = [
  { time: '09:42', text: 'Payment received for order #JG-2048', type: 'payment' },
  { time: '10:15', text: 'New bulk order assigned to sewing team', type: 'order' },
  { time: '11:05', text: 'Fabric stock updated from supplier restock', type: 'inventory' },
  { time: '12:20', text: 'Delivery release approved for 12 completed pieces', type: 'delivery' },
];

const cardsContainer = document.getElementById('overview-cards');
const kpiGrid = document.getElementById('kpi-grid');
const salesChart = document.getElementById('sales-chart');
const alertsList = document.getElementById('alerts-list');
const orderStatusList = document.getElementById('order-status');
const activityList = document.getElementById('activity-list');
const moduleFrame = document.getElementById('module-content');
const dashboardHome = document.getElementById('dashboard-home');
const workspace = document.getElementsByClassName('workspace')[0];
const appShell = document.getElementsByClassName('app-shell')[0];

var moduleLinks = [];
var allLinks = document.getElementsByTagName('a');

for (var i = 0; i < allLinks.length; i += 1) {
  if (allLinks[i].getAttribute('data-module-link') !== null) {
    moduleLinks[moduleLinks.length] = allLinks[i];
  }
}

function renderKpis() {
  if (!kpiGrid) return;

  for (let i = 0; i < kpis.length; i += 1) {
    const item = kpis[i];
    const card = document.createElement('article');
    card.className = 'kpi-card tone-' + item.tone;

    const meta = document.createElement('div');
    meta.className = 'kpi-meta';
    meta.textContent = item.label;

    const value = document.createElement('div');
    value.className = 'kpi-value';
    value.textContent = item.value;

    const delta = document.createElement('div');
    delta.className = 'kpi-delta';
    delta.textContent = item.delta;

    card.appendChild(meta);
    card.appendChild(value);
    card.appendChild(delta);
    kpiGrid.appendChild(card);
  }
}

function renderSalesChart() {
  if (!salesChart) return;

  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  for (let i = 0; i < salesTrend.length; i += 1) {
    const value = salesTrend[i];
    const barWrap = document.createElement('div');
    barWrap.className = 'bar-group';

    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = value + '%';

    const label = document.createElement('span');
    label.className = 'chart-label';
    label.textContent = labels[i];

    barWrap.appendChild(bar);
    barWrap.appendChild(label);
    salesChart.appendChild(barWrap);
  }
}

function renderAlerts() {
  if (!alertsList) return;

  for (let i = 0; i < alerts.length; i += 1) {
    const alert = alerts[i];
    const item = document.createElement('li');
    item.className = 'alert-item ' + alert.level;

    const dot = document.createElement('span');
    dot.className = 'alert-dot';

    const content = document.createElement('div');
    content.className = 'alert-copy';

    const title = document.createElement('strong');
    title.textContent = alert.title;

    const detail = document.createElement('small');
    detail.textContent = alert.detail;

    content.appendChild(title);
    content.appendChild(detail);
    item.appendChild(dot);
    item.appendChild(content);
    alertsList.appendChild(item);
  }
}

function renderOrderStatus() {
  if (!orderStatusList) return;

  for (let i = 0; i < orderStatus.length; i += 1) {
    const entry = orderStatus[i];
    const row = document.createElement('div');
    row.className = 'status-row';

    const info = document.createElement('div');
    info.className = 'status-info';

    const label = document.createElement('span');
    label.className = 'status-label';
    label.textContent = entry.label;

    const count = document.createElement('strong');
    count.className = 'status-count';
    count.textContent = entry.count + ' orders';

    info.appendChild(label);
    info.appendChild(count);

    const meter = document.createElement('div');
    meter.className = 'meter';

    const fill = document.createElement('span');
    fill.className = 'fill ' + entry.color;
    fill.style.width = entry.percentage + '%';

    meter.appendChild(fill);
    row.appendChild(info);
    row.appendChild(meter);
    orderStatusList.appendChild(row);
  }
}

function renderActivity() {
  if (!activityList) return;

  for (let i = 0; i < activity.length; i += 1) {
    const item = activity[i];
    const entry = document.createElement('li');
    entry.className = 'activity-item';

    const time = document.createElement('span');
    time.className = 'activity-time';
    time.textContent = item.time;

    const text = document.createElement('span');
    text.className = 'activity-text';
    text.textContent = item.text;

    const pill = document.createElement('span');
    pill.className = 'activity-pill ' + item.type;
    pill.textContent = item.type;

    entry.appendChild(time);
    entry.appendChild(text);
    entry.appendChild(pill);
    activityList.appendChild(entry);
  }
}

function setActiveModule(activeLink) {
  for (let i = 0; i < moduleLinks.length; i += 1) {
    const link = moduleLinks[i];
    const isActive = link === activeLink;
    link.classList.toggle('is-active', isActive);

    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  }
}

function buildModuleUrl(targetUrl) {
  let hashIndex = -1;
  let scanIndex = 0;
  while (scanIndex < targetUrl.length && hashIndex === -1) {
    if (targetUrl[scanIndex] === '#') {
      hashIndex = scanIndex;
    }
    scanIndex += 1;
  }

  let baseUrl = '';
  let hash = '';
  let characterIndex = 0;

  if (hashIndex === -1) {
    baseUrl = targetUrl;
  } else {
    while (characterIndex < hashIndex) {
      baseUrl += targetUrl[characterIndex];
      characterIndex += 1;
    }
    while (characterIndex < targetUrl.length) {
      hash += targetUrl[characterIndex];
      characterIndex += 1;
    }
  }

  return baseUrl + '?embedded=1' + hash;
}

for (let i = 0; i < moduleLinks.length; i += 1) {
  const link = moduleLinks[i];
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setActiveModule(link);

    if (link.hasAttribute('data-dashboard-home')) {
      moduleFrame.hidden = true;
      dashboardHome.hidden = false;
      workspace.classList.remove('is-module-view');
      appShell.classList.remove('is-module-shell');
      return;
    }

    dashboardHome.hidden = true;
    moduleFrame.hidden = false;
    workspace.classList.add('is-module-view');
    appShell.classList.add('is-module-shell');
    moduleFrame.src = buildModuleUrl(link.href);
  });
}

if (cardsContainer) {
  for (let i = 0; i < overviewCards.length; i += 1) {
    const card = overviewCards[i];
    const cardEl = document.createElement('section');
    cardEl.className = 'info-card';

    const label = document.createElement('div');
    label.className = 'card-label';
    label.textContent = card.label;
    cardEl.appendChild(label);

    const list = document.createElement('ul');
    list.className = 'card-list';

    for (let j = 0; j < card.items.length; j += 1) {
      const item = card.items[j];
      const li = document.createElement('li');

      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name;

      const badge = document.createElement('span');
      if (card.label === 'Active Selling Items') {
        badge.className = 'item-tag';
      } else if (card.label === 'Important Calendar Dates') {
        badge.className = 'date-tag';
      } else {
        badge.className = 'queue-tag';
      }
      badge.textContent = item.tag;

      li.appendChild(name);
      li.appendChild(badge);
      list.appendChild(li);
    }

    cardEl.appendChild(list);
    cardsContainer.appendChild(cardEl);
  }
}

renderKpis();
renderSalesChart();
renderAlerts();
renderOrderStatus();
renderActivity();
