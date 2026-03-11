// ══════════════════════════════════════════════════════════════
// GLOBALS
// ══════════════════════════════════════════════════════════════
const API = (path, opts={}) => {
  const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sid, ...(opts.headers||{}) }
  }).then(r => r.json());
};

// ══════════════════════════════════════════════════════════════
// 읽지 않음 배지 (unread badge)
// ══════════════════════════════════════════════════════════════
const BADGE_SECTIONS = ['customers', 'members', 'stripe-events', 'payments'];
const BADGE_SEEN_KEY = sec => 'nr_seen_' + sec;

function setBadge(id, count) {
  const el = document.getElementById('badge-' + id);
  if (!el) return;
  if (count > 0) {
    el.textContent = count;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

function markSectionSeen(sec) {
  if (!BADGE_SECTIONS.includes(sec)) return;
  localStorage.setItem(BADGE_SEEN_KEY(sec), new Date().toISOString());
  setBadge(sec, 0);
}

async function refreshBadges() {
  // 각 섹션의 마지막 확인 시각 (없으면 현재 시각을 초기값으로 저장 → 앞으로 들어올 것만 카운트)
  const now = new Date().toISOString();
  BADGE_SECTIONS.forEach(sec => {
    if (!localStorage.getItem(BADGE_SEEN_KEY(sec))) {
      localStorage.setItem(BADGE_SEEN_KEY(sec), now);
    }
  });
  const sc = localStorage.getItem(BADGE_SEEN_KEY('customers'));
  const sm = localStorage.getItem(BADGE_SEEN_KEY('members'));
  const se = localStorage.getItem(BADGE_SEEN_KEY('stripe-events'));
  const sp = localStorage.getItem(BADGE_SEEN_KEY('payments'));
  try {
    const params = new URLSearchParams({ since_customers: sc, since_members: sm, since_stripe_events: se, since_payments: sp });
    const data = await API('/api/admin/new-counts?' + params.toString());
    setBadge('customers',      data.new_customers      ?? 0);
    setBadge('members',        data.new_members        ?? 0);
    setBadge('stripe-events',  data.new_stripe_events  ?? 0);
    setBadge('payments',       data.new_payments       ?? 0);
  } catch {}
}

// ── 시계 ─────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('topbar-time').textContent =
    now.toLocaleDateString('en-GB') + '  ' + now.toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'});
}
setInterval(updateClock, 1000); updateClock();

// ── 사이드바 네비 ─────────────────────────────────────────────
function activateSection(sec, label) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.nav-sub-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  var el = document.getElementById('section-' + sec);
  if (el) el.classList.add('active');
  document.getElementById('topbar-title').textContent = label;
  markSectionSeen(sec);
  loadSection(sec);
  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', () => {
    const sec = item.dataset.section;
    const toggle = item.dataset.toggle;
    // 서브메뉴 토글
    if (toggle) {
      var sub = document.getElementById(toggle);
      if (sub) { sub.classList.toggle('open'); item.classList.toggle('open'); }
    }
    item.classList.add('active');
    activateSection(sec, item.childNodes[2] ? item.childNodes[2].textContent.trim() || item.textContent.trim() : item.textContent.trim());
  });
});

// 서브 아이템 클릭
document.querySelectorAll('.nav-sub-item[data-section]').forEach(item => {
  item.addEventListener('click', () => {
    const sec = item.dataset.section;
    // 부모 nav-item active
    var parent = item.closest('.submenu').previousElementSibling;
    if (parent) parent.classList.add('active');
    item.classList.add('active');
    activateSection(sec, item.textContent.trim());
  });
});
document.querySelectorAll('.nav-sub-item[data-navigate]').forEach(item => {
  item.addEventListener('click', () => {
    window.location.href = item.dataset.navigate;
  });
});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── 반응형 ────────────────────────────────────────────────────
function checkResponsive() {
  const toggle = document.getElementById('sidebar-toggle');
  toggle.style.display = window.innerWidth < 900 ? 'block' : 'none';
}
window.addEventListener('resize', checkResponsive); checkResponsive();

// ── 섹션별 데이터 로드 ────────────────────────────────────────
function loadSection(sec) {
  const loaders = {
    overview:       loadOverview,
    customers:      loadCustomers,
    members:        loadMembers,
    payments:       loadPayments,
    'stripe-events': loadStripeEvents,
    marketing:      loadMarketing,
    'blog-dashboard': loadBlogDashboard,
    'blog-list':      loadBlogList,
    'blog-auto':      loadBlogAuto,
    api:            loadAPISettings,
    admins:         loadAdmins,
    logo:           loadLogoSettings,
    cache:          loadCacheManage,
  };
  if (loaders[sec]) loaders[sec]();
}

// ══════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════
async function loadOverview() {
  try {
    const data = await API('/api/admin/overview');
    document.getElementById('ov-customers').textContent = data.total_customers ?? '0';
    document.getElementById('ov-subs').textContent = data.active_subs ?? '0';
    document.getElementById('ov-revenue').textContent = '$' + (data.revenue_month ?? '0');
    document.getElementById('ov-stripe-events').textContent = data.stripe_events_24h ?? '0';

    // 최근 Stripe 이벤트
    const wRows = (data.recent_events || []).map(w => `
      <tr>
        <td style="font-size:12px;color:var(--focus);">${w.type||'—'}</td>
        <td><span class="badge ${w.processed ? 'badge-green' : w.error_msg ? 'badge-red' : 'badge-yellow'}">${w.processed ? '완료' : w.error_msg ? '오류' : '대기'}</span></td>
        <td>${formatTime(w.created_at)}</td>
      </tr>`).join('') || '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:16px;">이벤트 없음</td></tr>';
    document.getElementById('ov-webhook-rows').innerHTML = wRows;

    // 최근 고객
    const cRows = (data.recent_customers || []).map(c => `
      <tr>
        <td>${c.name||c.email||'—'}</td>
        <td><span class="badge badge-blue">${c.plan_name||'—'}</span></td>
        <td>${formatTime(c.created_at)}</td>
      </tr>`).join('') || '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:16px;">No customers</td></tr>';
    document.getElementById('ov-customer-rows').innerHTML = cRows;
  } catch(e) {
    document.getElementById('ov-customers').textContent = '0';
    document.getElementById('ov-subs').textContent = '0';
    document.getElementById('ov-revenue').textContent = '$0';
    document.getElementById('ov-stripe-events').textContent = '0';
    document.getElementById('ov-webhook-rows').innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:16px;">API 연결 전</td></tr>';
    document.getElementById('ov-customer-rows').innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:16px;">API 연결 전</td></tr>';
  }
}

// ══════════════════════════════════════════════════════════════
// CUSTOMERS — 결제 고객 (Stripe 결제 완료, stripe_customer_id 있음)
// ══════════════════════════════════════════════════════════════
let allCustomers = [];
let custAccData = {}; // rowId → customer 객체

async function loadCustomers() {
  try {
    const data = await API('/api/admin/customers');
    allCustomers = (data.customers || []).filter(c => c.stripe_customer_id || c.last_payment_at || c.payment_status);
    allCustomers.sort((a, b) => {
      const ta = new Date(a.last_payment_at || a.created_at || 0).getTime();
      const tb = new Date(b.last_payment_at || b.created_at || 0).getTime();
      return tb - ta;
    });
    renderCustomers(allCustomers);
  } catch {
    document.getElementById('customers-tbody').innerHTML =
      '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</td></tr>';
  }
}

function renderCustomers(list) {
  const tbody = document.getElementById('customers-tbody');
  custAccData = {};
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:30px;">결제 고객 없음</td></tr>';
    return;
  }
  const flag = cc => (cc && cc.length === 2)
    ? String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 0x1F1E6 - 65 + ch.charCodeAt(0))) + ' '
    : '';
  tbody.innerHTML = list.map((c, i) => {
    const rid = 'cacc-' + i;
    custAccData[rid] = c;
    const stCls = c.payment_status === 'completed' ? 'badge-green' : c.payment_status === 'pending' ? 'badge-yellow' : 'badge-gray';
    const email  = (c.email || '').replace(/'/g, '&#39;');
    return `
      <tr class="cust-row" onclick="toggleCustAcc('${rid}')">
        <td style="color:var(--text-muted);font-size:12px;">${list.length - i}</td>
        <td style="font-weight:600;">${c.name || '—'}</td>
        <td style="font-size:13px;color:var(--text-muted);">${c.email}</td>
        <td><span class="badge badge-blue">${c.plan_name || '—'}</span></td>
        <td><span class="badge ${stCls}">${c.payment_status || '—'}</span></td>
        <td><span class="badge ${c.is_active ? 'badge-green' : 'badge-red'}">${c.is_active ? '활성' : '비활성'}</span></td>
        <td style="width:32px;text-align:right;"><span class="cust-chevron" id="${rid}-chv">▶</span></td>
      </tr>
      <tr class="cust-detail-row" id="${rid}" style="display:none;">
        <td colspan="7" style="padding:0;">
          <div class="cust-acc-body">
            <!-- 고객 정보 가로 카드 테이블 -->
            <div class="cust-info-table">
              <div class="cust-info-cell">
                <div class="cust-info-lbl">이메일</div>
                <div class="cust-info-val sub">${c.email}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">국가</div>
                <div class="cust-info-val">${c.country ? flag(c.country) + c.country : '—'}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">전화</div>
                <div class="cust-info-val">${c.phone || '—'}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">플랜 주기</div>
                <div class="cust-info-val">${c.plan_interval || '—'}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">최근 결제금액</div>
                <div class="cust-info-val">${c.last_amount ? '$' + (Number(c.last_amount)/100).toFixed(2) : '—'}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">최근 결제일시</div>
                <div class="cust-info-val sub">${formatTime(c.last_payment_at || c.created_at)}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">가입일</div>
                <div class="cust-info-val sub">${formatTime(c.created_at)}</div>
              </div>
              <div class="cust-info-cell">
                <div class="cust-info-lbl">최근 로그인</div>
                <div class="cust-info-val sub">${c.last_login ? formatTime(c.last_login) : '—'}</div>
              </div>
              <div class="cust-info-cell span2">
                <div class="cust-info-lbl">Stripe 고객 ID (cus_)</div>
                <div class="cust-info-val muted">${c.stripe_customer_id || '—'}</div>
              </div>
              <div class="cust-info-cell span2">
                <div class="cust-info-lbl">구독 ID (sub_)</div>
                <div class="cust-info-val muted">${c.stripe_subscription_id || '—'}</div>
              </div>
              <div class="cust-info-cell span2">
                <div class="cust-info-lbl">인보이스 ID — 결제 ID (in_)</div>
                <div class="cust-info-val muted">${c.last_invoice_id || '—'}</div>
              </div>
              <div class="cust-info-cell span2">
                <div class="cust-info-lbl">결제 의향 ID (pi_)</div>
                <div class="cust-info-val muted">${c.last_payment_intent_id || '—'}</div>
              </div>
            </div>
            <!-- 관리 액션 버튼 (가로 행) -->
            <div class="cust-acc-actions">
              <button class="cust-act-btn" onclick="event.stopPropagation();showEditCustomer(custAccData['${rid}'])">수정</button>
              <button class="cust-act-btn danger" onclick="event.stopPropagation();deleteCustomer(${c.id || 0},'${email}')">삭제</button>
              <button class="cust-act-btn warn" onclick="event.stopPropagation();resetCustomerPw(${c.id || 0},'${email}')">비밀번호 재설정</button>
              <button class="cust-act-btn ${c.is_active ? 'danger' : 'success'}" onclick="event.stopPropagation();toggleCustomer(${c.id || 0},${c.is_active ? 1 : 0})">${c.is_active ? '비활성화' : '활성화'}</button>
              ${c.stripe_subscription_id ? `<button class="cust-act-btn info" onclick="event.stopPropagation();showChangePlan(custAccData['${rid}'])">플랜 변경</button>` : ''}
            </div>
            <div class="cust-acc-hist">
              <div class="cust-hist-title">결제 히스토리</div>
              <div id="${rid}-hist"><span style="color:var(--text-muted);font-size:13px;">로딩 중…</span></div>
            </div>
          </div>
        </td>
      </tr>`;
  }).join('');
}

async function toggleCustAcc(rid) {
  const row = document.getElementById(rid);
  const chv = document.getElementById(rid + '-chv');
  const summaryRow = row.previousElementSibling;
  const isOpen = row.style.display !== 'none';
  if (isOpen) {
    row.style.display = 'none';
    chv.classList.remove('open');
    summaryRow.classList.remove('open');
    return;
  }
  row.style.display = '';
  chv.classList.add('open');
  summaryRow.classList.add('open');

  // 결제 히스토리 최초 로드
  const histEl = document.getElementById(rid + '-hist');
  if (histEl.dataset.loaded) return;
  histEl.dataset.loaded = '1';
  const c = custAccData[rid];
  try {
    const identifier = c.id ? c.id : encodeURIComponent(c.email);
    const data = await API('/api/admin/customers/' + identifier + '/payments');
    const pays = data.payments || [];
    if (!pays.length) {
      histEl.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">결제 내역 없음</span>';
      return;
    }
    // pays는 DESC(최신순). 각 행에서 이전/이후 레코드와 비교해 비고 생성
    const rows = pays.map((pay, i) => {
      const isUpgraded = pay.status === 'upgraded';
      // 같은 구독ID 내 이웃 레코드 (DESC 순이므로 i+1이 더 오래됨, i-1이 더 최신)
      const newerSub = i > 0 && pays[i-1].stripe_subscription_id === pay.stripe_subscription_id ? pays[i-1] : null;
      const olderSub = i < pays.length-1 && pays[i+1].stripe_subscription_id === pay.stripe_subscription_id ? pays[i+1] : null;

      let note = '';
      let noteColor = 'var(--text-muted)';

      if (isUpgraded && newerSub) {
        // 이 플랜이 몇 일 사용되다가 변경됐는지
        const days = Math.max(0, Math.round((new Date(newerSub.created_at) - new Date(pay.created_at)) / 86400000));
        note = days === 0 ? '당일 플랜 변경됨' : `${days}일 사용 후 플랜 변경됨`;
        noteColor = '#60a5fa';
      } else if (!isUpgraded && olderSub && olderSub.status === 'upgraded') {
        // 업그레이드/다운그레이드 후 발생한 차액 결제
        const days = Math.max(0, Math.round((new Date(pay.created_at) - new Date(olderSub.created_at)) / 86400000));
        const prevAmt = Number(olderSub.amount);
        const currAmt = Number(pay.amount);
        const diff = ((currAmt - prevAmt) / 100).toFixed(2);
        const diffSign = currAmt >= prevAmt ? '+' : '';
        const dayLabel = days === 0 ? '당일' : `${days}일 경과`;
        note = `업그레이드 차액 (${dayLabel}) · ${diffSign}$${diff}`;
        noteColor = currAmt >= prevAmt ? '#22c55e' : '#f97316';
      } else if (pay.type === 'subscription' && i === pays.length - 1) {
        note = '최초 구독 결제';
        noteColor = 'var(--focus)';
      }

      const rawIv = pay.interval
        || (/annual|yearly|year/i.test(pay.plan_name) ? 'year' : /month/i.test(pay.plan_name) ? 'month' : null);
      const ivLabel = rawIv === 'year' ? '연간' : rawIv === 'month' ? '월간' : (rawIv || '—');
      const stCls = pay.status === 'completed' ? 'badge-green' : pay.status === 'pending' ? 'badge-yellow' : pay.status === 'upgraded' ? 'badge-blue' : 'badge-gray';
      const stLabel = pay.status === 'upgraded' ? '이전 플랜' : pay.status || '—';
      const rowOpacity = isUpgraded ? 'opacity:.55;' : '';
      const amtStyle = isUpgraded ? 'text-decoration:line-through;color:var(--text-muted);font-weight:400;' : 'font-weight:700;color:#fff;';
      const amtStr = pay.amount != null ? '$' + (Number(pay.amount)/100).toFixed(2) : '—';
      const orderId = '#' + (pay.stripe_invoice_id || pay.stripe_payment_intent_id || pay.stripe_subscription_id || String(pay.id)).slice(-8).toUpperCase();

      return `
        <tr style="${rowOpacity}">
          <td style="color:var(--text-muted);">${pays.length - i}</td>
          <td style="font-size:13px;color:var(--focus);font-weight:700;font-family:monospace;">${orderId}</td>
          <td>${pay.plan_name || '—'}</td>
          <td style="color:var(--text-muted);">${ivLabel}</td>
          <td style="${amtStyle}">${amtStr}</td>
          <td><span class="badge ${stCls}">${stLabel}</span></td>
          <td style="font-size:13px;color:var(--text-muted);">${formatTime(pay.paid_at || pay.created_at)}</td>
          <td style="font-size:13px;color:${noteColor};">${note || '—'}</td>
        </tr>`;
    }).join('');

    histEl.innerHTML = `
      <table class="cust-hist-table">
        <thead><tr><th>#</th><th>오더 ID</th><th>플랜</th><th>주기</th><th>결제금액</th><th>상태</th><th>결제일시</th><th>비고</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch {
    histEl.innerHTML = '<span style="color:var(--red);font-size:13px;">결제 내역 로드 실패</span>';
  }
}

async function deleteCustomer(id, email) {
  if (!id) return;
  if (!confirm(`[${email}] 고객을 삭제합니다.\n관련 결제 내역도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`)) return;
  const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
  try {
    const res = await fetch('/api/admin/customers/' + id + '/delete', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + sid }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('고객 삭제 완료 ✓', 'success');
      loadCustomers();
      loadOverview();
    } else {
      showToast('오류: ' + (data.error || '삭제 실패'), 'error');
    }
  } catch { showToast('네트워크 오류', 'error'); }
}
function filterCustomers() {
  const q  = document.getElementById('cust-search').value.toLowerCase();
  const st = document.getElementById('cust-status').value;
  renderCustomers(allCustomers.filter(c => {
    const matchQ = !q || (c.email + (c.name||'')).toLowerCase().includes(q);
    const matchS = !st || (st==='active' ? c.is_active : !c.is_active);
    return matchQ && matchS;
  }));
}

// 결제 고객 수정 모달
function showEditCustomer(c) {
  document.getElementById('edit-customer-id').value      = c.id || '';
  document.getElementById('edit-customer-name').value    = c.name    || '';
  document.getElementById('edit-customer-email').value   = c.email   || '';
  document.getElementById('edit-customer-phone').value   = c.phone   || '';
  document.getElementById('edit-customer-country').value = c.country || '';
  document.getElementById('edit-customer-active').value  = c.is_active ? '1' : '0';
  document.getElementById('edit-customer-modal').classList.add('open');
}

async function saveCustomerEdit() {
  const id = document.getElementById('edit-customer-id').value;
  if (!id) return;
  const body = {
    name:      document.getElementById('edit-customer-name').value.trim(),
    email:     document.getElementById('edit-customer-email').value.trim(),
    phone:     document.getElementById('edit-customer-phone').value.trim(),
    country:   document.getElementById('edit-customer-country').value.trim(),
    is_active: document.getElementById('edit-customer-active').value === '1',
  };
  try {
    const res = await API('/api/admin/customers/' + id + '/edit', {
      method: 'POST', body: JSON.stringify(body)
    });
    if (res.error) { alert('오류: ' + res.error); return; }
    document.getElementById('edit-customer-modal').classList.remove('open');
    toast('✅ 고객 정보가 수정되었습니다.');
    loadCustomers();
  } catch { alert('수정에 실패했습니다.'); }
}

// 비밀번호 리셋
async function resetCustomerPw(id, email) {
  if (!id) return;
  if (!confirm(`[${email}] 고객의 비밀번호를 리셋하고 임시 비밀번호를 이메일로 발송하시겠습니까?`)) return;
  try {
    const res = await API('/api/admin/customers/' + id + '/reset-password', { method: 'POST' });
    if (res.success) {
      toast('✅ 임시 비밀번호 발송 완료: ' + email);
    } else {
      alert('오류: ' + (res.error || '알 수 없는 오류'));
    }
  } catch { alert('비밀번호 리셋에 실패했습니다.'); }
}

// 활성/비활성 토글
async function toggleCustomer(id, current) {
  if (!id) return;
  if (!confirm(`해당 고객을 ${current ? '비활성화' : '활성화'} 하시겠습니까?`)) return;
  try {
    const res = await API('/api/admin/customers/' + id + '/edit', {
      method: 'POST', body: JSON.stringify({ is_active: !current })
    });
    if (res.error) { alert('오류: ' + res.error); return; }
    toast(current ? '고객이 비활성화되었습니다.' : '고객이 활성화되었습니다.');
    loadCustomers();
  } catch { alert('처리에 실패했습니다.'); }
}

// ── 플랜 변경 (업그레이드 / 다운그레이드) ─────────────────────
let _planPricesCache = null;

async function showChangePlan(c) {
  if (!c.stripe_subscription_id) {
    alert('구독 ID가 없습니다. 구독 기반 결제 고객만 플랜 변경이 가능합니다.');
    return;
  }

  document.getElementById('change-plan-customer-id').value = c.id || '';
  document.getElementById('change-plan-sub-id').value = c.stripe_subscription_id;
  document.getElementById('change-plan-customer-info').textContent =
    (c.name ? c.name + ' ' : '') + '(' + (c.email || '—') + ')';

  const intervalLabel = c.plan_interval === 'year' ? '연간' : c.plan_interval === 'month' ? '월간' : (c.plan_interval || '');
  document.getElementById('change-plan-current-info').textContent =
    (c.plan_name || '—') + (intervalLabel ? ' / ' + intervalLabel : '');

  // 플랜 목록 로드 (캐시)
  if (!_planPricesCache) {
    try {
      const data = await API('/api/admin/stripe-plan-prices');
      _planPricesCache = data.plans || [];
    } catch { _planPricesCache = []; }
  }

  const planSelect = document.getElementById('change-plan-plan');
  planSelect.innerHTML = '<option value="">플랜 선택...</option>';
  _planPricesCache.forEach(pl => {
    const opt = document.createElement('option');
    opt.value = pl.plan;
    opt.textContent = pl.label;
    opt.dataset.monthlyPriceId = pl.monthly_price_id || '';
    opt.dataset.yearlyPriceId  = pl.yearly_price_id  || '';
    planSelect.appendChild(opt);
  });

  // 현재 결제 주기 선택
  const iv = document.getElementById('change-plan-interval');
  if (c.plan_interval === 'year') iv.value = 'year';
  else iv.value = 'month';

  document.getElementById('change-plan-modal').classList.add('open');
}

async function applyPlanChange() {
  const custId  = document.getElementById('change-plan-customer-id').value;
  const subId   = document.getElementById('change-plan-sub-id').value;
  const planSel = document.getElementById('change-plan-plan');
  const interval = document.getElementById('change-plan-interval').value;

  const opt = planSel.options[planSel.selectedIndex];
  if (!opt || !opt.value) { alert('변경할 플랜을 선택해주세요.'); return; }

  const newPriceId = interval === 'year' ? opt.dataset.yearlyPriceId : opt.dataset.monthlyPriceId;
  if (!newPriceId) {
    alert('선택한 플랜의 Price ID가 없습니다.\nAdmin → API 설정에서 Stripe Price ID를 확인해주세요.');
    return;
  }

  const planLabel    = opt.textContent.trim();
  const intervalLabel = interval === 'year' ? '연간' : '월간';
  if (!confirm(`[${planLabel} / ${intervalLabel}] 플랜으로 변경하시겠습니까?\nStripe에 즉시 반영되며, 일할 계산은 다음 청구에 적용됩니다.`)) return;

  const newPlanName = planLabel + (interval === 'year' ? ' (Yearly)' : ' (Monthly)');
  try {
    const res = await API('/api/admin/customers/' + custId + '/change-plan', {
      method: 'POST',
      body: JSON.stringify({
        stripe_subscription_id: subId,
        new_price_id: newPriceId,
        new_plan_name: newPlanName,
        new_interval: interval,
      }),
    });
    if (res.error) { alert('오류: ' + res.error); return; }
    document.getElementById('change-plan-modal').classList.remove('open');
    toast('✅ 플랜 변경 완료: ' + planLabel + ' / ' + intervalLabel);
    loadCustomers();
  } catch { alert('플랜 변경에 실패했습니다.'); }
}

// ══════════════════════════════════════════════════════════════
// MEMBERS — 회원 가입자 (join.html로 직접 가입, stripe_customer_id 없음)
// ══════════════════════════════════════════════════════════════
let allMembers = [];
async function loadMembers() {
  try {
    const data = await API('/api/admin/customers');
    // 결제 기록 없는 순수 회원가입자
    allMembers = (data.customers || []).filter(c => !c.stripe_customer_id && !c.last_payment_at && !c.payment_status);
    renderMembers(allMembers);
  } catch {
    document.getElementById('members-tbody').innerHTML =
      '<tr><td colspan="9" style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</td></tr>';
  }
}
function renderMembers(list) {
  const tbody = document.getElementById('members-tbody');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="color:var(--text-muted);text-align:center;padding:30px;">회원 가입자 없음</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(c => `
    <tr>
      <td>${c.id}</td>
      <td><strong style="color:#fff;">${c.username||'—'}</strong></td>
      <td>${c.name||'—'}</td>
      <td>${c.email}</td>
      <td><span class="badge ${c.last_payment_at?'badge-green':'badge-gray'}">${c.last_payment_at?'연동됨':'미결제'}</span></td>
      <td>${formatTime(c.last_login)}</td>
      <td>${formatTime(c.created_at)}</td>
      <td><span class="badge ${c.is_active?'badge-green':'badge-red'}">${c.is_active?'활성':'비활성'}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="showEditMember(${JSON.stringify(c).replace(/"/g,'&quot;')})">수정</button></td>
    </tr>`).join('');
}
function filterMembers() {
  const q  = document.getElementById('member-search').value.toLowerCase();
  const st = document.getElementById('member-status').value;
  renderMembers(allMembers.filter(c => {
    const matchQ = !q || (c.email + (c.username||'') + (c.name||'')).toLowerCase().includes(q);
    const matchS = !st || (st==='active' ? c.is_active : !c.is_active);
    return matchQ && matchS;
  }));
}

function showEditMember(c) {
  document.getElementById('edit-member-id').value      = c.id;
  document.getElementById('edit-member-name').value    = c.name    || '';
  document.getElementById('edit-member-username').value= c.username|| '';
  document.getElementById('edit-member-email').value   = c.email   || '';
  document.getElementById('edit-member-phone').value   = c.phone   || '';
  document.getElementById('edit-member-country').value = c.country || '';
  document.getElementById('edit-member-active').value  = c.is_active ? '1' : '0';
  document.getElementById('edit-member-modal').classList.add('open');
}

async function saveMemberEdit() {
  const id = document.getElementById('edit-member-id').value;
  const body = {
    name:      document.getElementById('edit-member-name').value.trim(),
    username:  document.getElementById('edit-member-username').value.trim(),
    email:     document.getElementById('edit-member-email').value.trim(),
    phone:     document.getElementById('edit-member-phone').value.trim(),
    country:   document.getElementById('edit-member-country').value.trim(),
    is_active: document.getElementById('edit-member-active').value === '1',
  };
  try {
    const res = await API('/api/admin/customers/' + id + '/edit', {
      method: 'POST', body: JSON.stringify(body)
    });
    if (res.error) { alert('오류: ' + res.error); return; }
    document.getElementById('edit-member-modal').classList.remove('open');
    alert('✅ 회원 정보가 수정되었습니다.');
    loadMembers();
  } catch { alert('수정에 실패했습니다.'); }
}

function exportCSV(type) {
  const isCustomer = type === 'customers';
  const list = isCustomer ? allCustomers : allMembers;
  let rows, filename;
  if (isCustomer) {
    rows = [['ID','이름','이메일','국가','플랜','결제상태','최근금액','가입일']];
    list.forEach(c => rows.push([c.id, c.name||'', c.email, c.country||'', c.plan_name||'', c.payment_status||'', c.last_amount||'', c.created_at]));
    filename = 'customers_' + new Date().toISOString().slice(0,10) + '.csv';
  } else {
    rows = [['ID','아이디','이름','이메일','결제연동','최근로그인','가입일','상태']];
    list.forEach(c => rows.push([c.id, c.username||'', c.name||'', c.email, c.last_payment_at?'Y':'N', c.last_login||'', c.created_at, c.is_active?'활성':'비활성']));
    filename = 'members_' + new Date().toISOString().slice(0,10) + '.csv';
  }
  const csv = rows.map(r => r.map(v => '"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
  a.download = filename;
  a.click();
}

// ══════════════════════════════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════════════════════════════
async function loadPayments() {
  try {
    const data = await API('/api/admin/payments');
    const list = data.payments || [];
    const tbody = document.getElementById('payments-tbody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:30px;">No payments</td></tr>'; return; }
    tbody.innerHTML = list.map(p => `
      <tr>
        <td style="font-size:12px;color:var(--focus);">PI_${(p.stripe_payment_intent_id||p.stripe_subscription_id||String(p.id)).slice(-8)}</td>
        <td>${p.customer_email||'—'}</td>
        <td>${p.plan_name||'—'}</td>
        <td><span class="badge ${p.type==='subscription'?'badge-blue':'badge-yellow'}">${p.type||'—'}</span></td>
        <td>$${((p.amount||0)/100).toFixed(2)}</td>
        <td><span class="badge ${statusBadge(p.status)}">${p.status}</span></td>
        <td>${formatTime(p.created_at)}</td>
      </tr>`).join('');
  } catch {
    document.getElementById('payments-tbody').innerHTML =
      '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</td></tr>';
  }
}
function statusBadge(s) {
  return {completed:'badge-green',pending:'badge-yellow',cancelled:'badge-red',refunded:'badge-gray',cancelling:'badge-yellow',failed:'badge-red'}[s] || 'badge-gray';
}

// ══════════════════════════════════════════════════════════════
// STRIPE EVENTS
// ══════════════════════════════════════════════════════════════
async function loadStripeEvents() {
  try {
    const data = await API('/api/admin/stripe-events');
    const list = data.events || [];
    const typeFilter = document.getElementById('se-type')?.value || '';
    const procFilter = document.getElementById('se-processed')?.value || '';
    const filtered = list.filter(e => {
      const matchType = !typeFilter || e.type === typeFilter;
      const matchProc = procFilter === '' ? true : String(e.processed) === procFilter;
      return matchType && matchProc;
    });
    const tbody = document.getElementById('stripe-events-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:30px;">Stripe 이벤트 없음 — pricing.html 결제 후 표시됩니다</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(e => `
      <tr>
        <td style="font-size:11px;color:var(--text-muted);">${(e.id||'').slice(-12)}</td>
        <td style="font-size:12px;color:var(--focus);">${e.type||'—'}</td>
        <td><span class="badge ${e.processed ? 'badge-green' : e.error_msg ? 'badge-red' : 'badge-yellow'}">${e.processed ? '완료' : e.error_msg ? '오류' : '대기'}</span></td>
        <td style="font-size:12px;">${formatTime(e.created_at)}</td>
        <td style="font-size:12px;color:var(--text-danger);">${e.error_msg||'—'}</td>
        <td><button class="payload-btn" onclick='showPayload(${JSON.stringify(e.payload||"")})'>JSON</button></td>
      </tr>`).join('');
  } catch {
    document.getElementById('stripe-events-tbody').innerHTML =
      '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</td></tr>';
  }
}
function showPayload(raw) {
  let pretty = raw;
  try { pretty = JSON.stringify(JSON.parse(raw), null, 2); } catch {}
  document.getElementById('payload-content').textContent = pretty;
  document.getElementById('payload-modal').classList.add('open');
}
function closePayloadModal() { document.getElementById('payload-modal').classList.remove('open'); }
function closeModal(e) { if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open'); }

// ══════════════════════════════════════════════════════════════
// MARKETING
// ══════════════════════════════════════════════════════════════
async function loadMarketing() {
  try {
    const data = await API('/api/admin/marketing');
    document.getElementById('mkt-subs').textContent = data.subscriber_count || '0';
    document.getElementById('mkt-camps').textContent = data.campaign_count || '0';
    document.getElementById('mkt-open').textContent = (data.avg_open_rate || 0) + '%';

    const list = data.campaigns || [];
    document.getElementById('campaigns-tbody').innerHTML = list.length
      ? list.map(c => `<tr>
          <td>${c.name}</td>
          <td>${c.sent_count||0}</td>
          <td>${c.open_count||0}</td>
          <td><span class="badge ${c.status==='sent'?'badge-green':c.status==='draft'?'badge-gray':'badge-blue'}">${c.status}</span></td>
        </tr>`).join('')
      : '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:20px;">No campaigns</td></tr>';
  } catch {
    document.getElementById('mkt-subs').textContent = '0';
  }
}
document.querySelectorAll('.camp-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.camp-tab').forEach(b => b.classList.remove('active'));
    t.classList.add('active');
  });
});
async function sendQuickEmail() {
  const subject = document.getElementById('mkt-subject').value.trim();
  const body = document.getElementById('mkt-body').value.trim();
  if (!subject || !body) { alert('제목과 내용을 입력해 주세요.'); return; }
  if (!confirm('선택한 대상에게 이메일을 발송하시겠습니까?')) return;
  try {
    await API('/api/admin/marketing/send', { method: 'POST', body: JSON.stringify({
      segment: document.getElementById('mkt-segment').value, subject, body
    })});
    alert('이메일이 발송되었습니다!');
    document.getElementById('mkt-subject').value = '';
    document.getElementById('mkt-body').value = '';
  } catch { alert('발송 실패. API 설정을 확인해 주세요.'); }
}
function showCampaignForm() { alert('전체 캠페인 에디터 – 곧 추가됩니다!'); }

// ══════════════════════════════════════════════════════════════
// BLOG
// ══════════════════════════════════════════════════════════════
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function goBlogEditor() { window.location.href = '/blog-editor.html'; }
function editPost(id) { window.location.href = '/blog-editor.html?id=' + id; }
async function deletePost(id) {
  if (!confirm('이 포스트를 삭제하시겠습니까?')) return;
  await API('/api/admin/blog/' + id, { method: 'DELETE' });
  toast('포스트가 삭제되었습니다');
  loadBlogList();
}
/* 발행/비공개 토글 */
async function togglePostStatus(id, currentStatus) {
  var newStatus = currentStatus === 'published' ? 'draft' : 'published';
  var label = newStatus === 'published' ? '발행' : '비공개';
  try {
    await API('/api/admin/blog/' + id, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, published_at: newStatus === 'published' ? new Date().toISOString() : null })
    });
    toast('✅ ' + label + ' 처리 완료', 'success');
    loadBlogList();
    loadBlogDashboard();
  } catch (e) { toast('❌ 상태 변경 실패: ' + (e.message||''), 'error'); }
}

// ── 블로그 대시보드 ──
async function loadBlogDashboard() {
  try {
    const data = await API('/api/admin/blog');
    const list = data.posts || [];
    const published = list.filter(p => p.status === 'published').length;
    const draft = list.filter(p => p.status === 'draft').length;
    const scheduled = list.filter(p => p.status === 'scheduled').length;
    document.getElementById('blog-stat-total').textContent = list.length;
    document.getElementById('blog-stat-published').textContent = published;
    document.getElementById('blog-stat-draft').textContent = draft;
    document.getElementById('blog-stat-scheduled').textContent = scheduled;
    var recent = list.slice(0, 8);
    document.getElementById('blog-recent-list').innerHTML = recent.length
      ? recent.map(p => {
          const sc = p.status==='published'?'badge-green':p.status==='draft'?'badge-gray':'badge-yellow';
          return `<div class="blog-recent-item">
            <div>
              <div style="font-weight:600;color:#fff;">${esc(p.title)}</div>
              <div style="font-size:12px;color:var(--text-muted);">/blog/${esc(p.slug)} · ${formatTime(p.created_at)}</div>
            </div>
            <span class="badge ${sc}">${p.status}</span>
          </div>`;
        }).join('')
      : '<div style="color:var(--text-muted);text-align:center;padding:30px;">작성된 글 없음</div>';
  } catch {
    document.getElementById('blog-recent-list').innerHTML =
      '<div style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</div>';
  }
}

// ── 블로그 리스트 ──
async function loadBlogList() {
  try {
    const data = await API('/api/admin/blog');
    const list = data.posts || [];
    document.getElementById('blog-tbody').innerHTML = list.length
      ? list.map(p => {
          const seoScore = p.seo_score || 0;
          const seoClass = seoScore>=90?'badge-green':seoScore>=50?'badge-yellow':'badge-red';
          const statusClass = p.status==='published'?'badge-green':p.status==='draft'?'badge-gray':'badge-yellow';
          const rewriteBtn = seoScore < 90
            ? `<button class="btn btn-sm btn-rewrite-${p.id}" style="background:rgba(137,158,46,.15);color:#899e2e;border:1px solid rgba(137,158,46,.3);" onclick="runSeoRewrite(${p.id},this)" title="SEO ${seoScore}점 — AI 재작성"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 재작성</button>`
            : '';
          return `<tr id="blog-row-${p.id}">
            <td>
              <div class="blog-item-title">${esc(p.title)}</div>
              <div class="blog-item-meta">/blog/${esc(p.slug)}</div>
            </td>
            <td>${esc(p.category||'—')}</td>
            <td><span class="badge ${statusClass}">${p.status}</span></td>
            <td>
              <span class="badge ${seoClass}" id="seo-badge-${p.id}" title="SEO Score">${seoScore}</span>
            </td>
            <td>${formatTime(p.created_at)}</td>
            <td style="white-space:nowrap;">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="editPost(${p.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 편집</button>
                <button class="btn btn-sm" style="background:rgba(59,130,246,.15);color:#3b82f6;border:1px solid rgba(59,130,246,.3);" onclick="openSeoCheck(${p.id})" title="SEO 상세 분석"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> SEO</button>
                ${rewriteBtn}
                <button class="btn btn-sm" style="background:rgba(20,184,166,.12);color:#14b8a6;border:1px solid rgba(20,184,166,.25);" onclick="copyrightCheckPost(${p.id},'${esc(p.title)}')" title="저작권/라이센스 점검"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> 저작권</button>
                <button class="btn btn-danger btn-sm" onclick="deletePost(${p.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> 삭제</button>
              </div>
            </td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:30px;">작성된 글 없음</td></tr>';
  } catch {
    document.getElementById('blog-tbody').innerHTML =
      '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</td></tr>';
  }
}

// ── SEO 재측정 ──
async function rescorePost(id) {
  const badge = document.getElementById('seo-badge-' + id);
  if (badge) { badge.textContent = '⏳'; badge.className = 'badge badge-gray'; }
  try {
    const data = await API('/api/admin/blog/' + id + '/rescore', { method: 'POST' });
    const score = data.seo_score ?? 0;
    if (badge) {
      badge.textContent = score;
      badge.className = 'badge ' + (score>=90?'badge-green':score>=50?'badge-yellow':'badge-red');
    }
    // 90점 미만이면 재작성 버튼 표시
    const row = document.getElementById('blog-row-' + id);
    if (row) {
      const actions = row.querySelector('.blog-actions');
      const existingRewrite = actions?.querySelector('.btn-rewrite-' + id);
      if (score < 90 && actions && !existingRewrite) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-rewrite-' + id;
        btn.style.cssText = 'background:rgba(137,158,46,.15);color:#899e2e;border:1px solid rgba(137,158,46,.3);';
        btn.title = 'SEO ' + score + '점 — AI 재작성';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> 재작성';
        btn.onclick = () => rewritePost(id);
        const copyrightBtn = actions.querySelector('[onclick*="copyrightCheckPost"]');
        if (copyrightBtn) actions.insertBefore(btn, copyrightBtn);
        else actions.appendChild(btn);
      } else if (score >= 90 && existingRewrite) {
        existingRewrite.remove();
      }
    }
    toast('SEO 재측정 완료: ' + score + '점', score>=90?'success':'warning');
  } catch(e) {
    if (badge) { badge.textContent = 'ERR'; badge.className = 'badge badge-red'; }
    toast('SEO 재측정 실패: ' + (e.message||''), 'error');
  }
}

// ── 재작성 ──
async function rewritePost(id) {
  if (!confirm('AI가 이 포스트를 SEO 90+ 목표로 재작성합니다.\n기존 내용이 교체됩니다. 계속하시겠습니까?')) return;
  const row = document.getElementById('blog-row-' + id);
  const badge = document.getElementById('seo-badge-' + id);
  if (badge) { badge.textContent = '⏳'; badge.className = 'badge badge-gray'; }
  toast('AI 재작성 중... (30~60초 소요)', 'info');
  try {
    const data = await API('/api/admin/blog/' + id + '/rewrite', { method: 'POST' });
    if (data.error) throw new Error(data.error);
    const score = data.seo_score ?? 0;
    const prev = data.prev_score ?? 0;
    if (badge) {
      badge.textContent = score;
      badge.className = 'badge ' + (score>=90?'badge-green':score>=50?'badge-yellow':'badge-red');
    }
    if (score >= 90 && row) {
      const rewriteBtn = row.querySelector('.btn-rewrite-' + id);
      if (rewriteBtn) rewriteBtn.remove();
    }
    toast('✅ 재작성 완료! ' + prev + '점 → ' + score + '점', 'success');
  } catch(e) {
    if (badge) { badge.textContent = 'ERR'; badge.className = 'badge badge-red'; }
    toast('재작성 실패: ' + (e.message||''), 'error');
  }
}

// ── 저작권/라이센스 점검 ──
async function copyrightCheckPost(id, title) {
  const panel = document.getElementById('copyright-result-panel');
  if (!panel) { toast('결과 패널을 찾을 수 없습니다', 'error'); return; }
  panel.style.display = 'block';
  panel.innerHTML = `<div class="card" style="padding:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:600;">🔍 저작권/라이센스 점검 — <span style="color:var(--focus);">${esc(title||'Post #'+id)}</span></div>
      <button class="btn btn-secondary btn-sm" onclick="document.getElementById('copyright-result-panel').style.display='none'">✕ 닫기</button>
    </div>
    <div style="text-align:center;padding:24px;color:var(--text-muted);">분석 중...</div>
  </div>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const data = await API('/api/admin/blog/' + id + '/copyright-check', { method: 'POST' });
    if (data.error) throw new Error(data.error);
    const c = data.copyright || {};
    const statusColor = c.status==='clean'?'#22c55e':c.status==='critical'?'#ef4444':'#f59e0b';
    const statusIcon = c.status==='clean'?'✅':c.status==='critical'?'🚨':'⚠️';
    const safeLabel = c.safe_to_publish ? '✅ 발행 가능' : '🚫 발행 전 수정 필요';
    const issuesHtml = (c.issues||[]).length
      ? (c.issues||[]).map(iss => {
          const sevColor = iss.severity==='high'?'#ef4444':iss.severity==='medium'?'#f59e0b':'#6b7280';
          return `<div style="border:1px solid ${sevColor};border-radius:8px;padding:12px;margin-bottom:8px;">
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
              <span style="background:${sevColor};color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;">${(iss.severity||'').toUpperCase()}</span>
              <span style="font-size:12px;color:var(--text-muted);">${esc(iss.type||'')}</span>
            </div>
            <div style="font-size:13px;margin-bottom:5px;">${esc(iss.description||'')}</div>
            <div style="font-size:12px;color:#86efac;">💡 ${esc(iss.suggestion||'')}</div>
          </div>`;
        }).join('')
      : '<div style="color:#22c55e;font-size:13px;padding:8px 0;">발견된 이슈 없음</div>';

    panel.innerHTML = `<div class="card" style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:24px;">${statusIcon}</span>
          <div>
            <div style="font-size:15px;font-weight:700;color:${statusColor};">${(c.status||'').toUpperCase()}</div>
            <div style="font-size:12px;color:var(--text-muted);">${esc(title||'Post #'+id)}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('copyright-result-panel').style.display='none'">✕ 닫기</button>
      </div>
      <div style="background:rgba(255,255,255,.05);border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;line-height:1.6;">${esc(c.summary||c.overall||'')}</div>
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;">발행 여부: <span style="color:${c.safe_to_publish?'#22c55e':'#ef4444'};">${safeLabel}</span></div>
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;">이슈 ${(c.issues||[]).length}건</div>
      ${issuesHtml}
    </div>`;
  } catch(e) {
    panel.innerHTML = `<div class="card" style="padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="color:#ef4444;font-size:13px;">점검 실패: ${esc(e.message||'')}</div>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('copyright-result-panel').style.display='none'">✕ 닫기</button>
      </div>
    </div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// SEO CHECK MODAL (N0005 동일 구현)
// ══════════════════════════════════════════════════════════════
let _seoCheckPostId = null;
let _seoCheckData = null;

function openSeoCheck(postId) {
  _seoCheckPostId = postId;
  _seoCheckData = null;
  const modal = document.getElementById('seo-check-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('seo-modal-title').textContent = 'SEO 분석 중...';
  document.getElementById('seo-modal-meta').textContent = '';
  document.getElementById('seo-score-big').textContent = '-';
  document.getElementById('seo-score-big').style.color = '#9ca3af';
  document.getElementById('seo-score-bar').style.width = '0%';
  document.getElementById('seo-score-label').textContent = '분석 중...';
  document.getElementById('seo-criteria-list').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">로딩 중...</div>';
  document.getElementById('seo-sources-list').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">로딩 중...</div>';
  document.getElementById('seo-similarity-content').innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:24px;">분석 중 (AI 사용)...</div>';
  seoTabSwitch('score');
  API('/api/admin/blog/' + postId + '/seo-check')
    .then(data => { _seoCheckData = data; renderSeoCheck(data); })
    .catch(err => { document.getElementById('seo-modal-title').textContent = '오류: ' + (err.message || '불러오기 실패'); });
}

function closeSeoModal() {
  const modal = document.getElementById('seo-check-modal');
  if (modal) modal.style.display = 'none';
  _seoCheckPostId = null;
  _seoCheckData = null;
}

function seoTabSwitch(tab) {
  ['score','sources','similarity'].forEach(t => {
    document.getElementById('seo-panel-' + t).style.display = t === tab ? '' : 'none';
    const btn = document.getElementById('seo-tab-btn-' + t);
    if (btn) {
      btn.style.borderBottomColor = t === tab ? 'var(--focus)' : 'transparent';
      btn.style.color = t === tab ? 'var(--focus)' : 'var(--text-muted)';
    }
  });
}

function renderSeoCheck(data) {
  const post = data.post || {};
  const breakdown = data.seoBreakdown || {};
  const sources = data.sources || [];
  const similarity = data.similarity || {};
  document.getElementById('seo-modal-title').textContent = post.title || '제목 없음';
  document.getElementById('seo-modal-meta').textContent = 'Focus KW: ' + (data.focusKw || '없음') + ' · 단어수: ' + (breakdown.wordCount || 0).toLocaleString();
  const total = breakdown.total || 0;
  const scoreEl = document.getElementById('seo-score-big');
  scoreEl.textContent = total;
  scoreEl.style.color = total >= 90 ? '#C6F040' : total >= 50 ? '#e6b802' : '#ef4444';
  document.getElementById('seo-score-bar').style.width = total + '%';
  document.getElementById('seo-score-bar').style.background = total >= 90 ? '#C6F040' : total >= 50 ? '#e6b802' : '#ef4444';
  document.getElementById('seo-score-label').textContent = total >= 90 ? '우수 (RankMath 90+ 달성)' : total >= 50 ? '보통 (개선 필요)' : '미흡 (최적화 필요)';
  let rewriteBtnHtml = '';
  if (total < 90 && _seoCheckPostId) {
    rewriteBtnHtml = `<div style="margin-top:14px;padding:14px 16px;background:rgba(230,184,2,.07);border:1px solid rgba(230,184,2,.2);border-radius:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:160px;">
        <div style="font-size:13px;font-weight:700;color:#e6b802;">현재 ${total}점 90점 미달</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">AI가 실패 항목을 자동 수정하여 재작성합니다</div>
      </div>
      <button id="seo-rewrite-btn" onclick="runSeoRewriteFromModal()" style="padding:8px 18px;font-size:13px;font-weight:700;border:none;border-radius:7px;background:#e6b802;color:#1c2228;cursor:pointer;white-space:nowrap;">🔄 SEO 재작성</button>
      <div id="seo-rewrite-result" style="font-size:13px;"></div>
    </div>`;
  }
  const checks = breakdown.checks || [];
  document.getElementById('seo-criteria-list').innerHTML = checks.length
    ? checks.map(c => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <span style="font-size:15px;flex-shrink:0;">${c.pass ? '✅' : '❌'}</span>
        <span style="flex:1;font-size:14px;color:${c.pass?'var(--text-primary)':'var(--text-muted)'};">${esc(c.label)}</span>
        <span style="font-size:13px;font-weight:700;color:${c.pass?'#C6F040':'#ef4444'};flex-shrink:0;">${c.score}/${c.max}</span>
      </div>`).join('') + rewriteBtnHtml
    : '<div style="color:var(--text-muted);text-align:center;padding:20px;">SEO 항목 없음</div>';
  document.getElementById('seo-sources-list').innerHTML = sources.length
    ? sources.map((s, i) => `<div style="background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:10px;">
        <div style="font-size:12px;color:#e6b802;font-weight:700;margin-bottom:6px;">#${i+1} 참고 출처</div>
        <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px;">${esc(s.title||'제목 없음')}</div>
        <a href="${esc(s.url||'#')}" target="_blank" rel="noopener" style="font-size:13px;color:#3b82f6;">${esc(s.url||'링크 없음')}</a>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px;">단어수: ${(s.word_count||0).toLocaleString()}</div>
      </div>`).join('')
    : '<div style="color:var(--text-muted);text-align:center;padding:40px;">참고 출처 없음</div>';
  renderSimilarityPanel(similarity);
}

function renderSimilarityPanel(sim) {
  const container = document.getElementById('seo-similarity-content');
  if (!sim || !Object.keys(sim).length) {
    container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:40px;">유사도 데이터 없음</div>';
    return;
  }
  const riskBadge = level => {
    const map = { high:['🔴','#ef4444','높음'], mid:['🟡','#e6b802','보통'], low:['🟢','#C6F040','낮음'] };
    const [icon, color, label] = map[level] || ['⚪','#9ca3af','없음'];
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;padding:2px 8px;border-radius:20px;background:${color}20;color:${color};">${icon} ${label}</span>`;
  };
  const overallRisk = sim.overall_risk || 'low';
  const overallColor = overallRisk==='high'?'#ef4444':overallRisk==='mid'?'#e6b802':'#C6F040';
  let html = `<div style="background:${overallColor}12;border:1px solid ${overallColor}30;border-radius:8px;padding:14px 16px;margin-bottom:18px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:24px;">${overallRisk==='high'?'⚠️':overallRisk==='mid'?'🟡':'✅'}</span>
    <div>
      <div style="font-size:14px;font-weight:700;color:${overallColor};">전체 위험도: ${overallRisk==='high'?'높음 (저작권 검토 필요)':overallRisk==='mid'?'보통 (일부 유사 표현 확인 권장)':'낮음 (독창적 콘텐츠)'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">${esc(sim.summary||'')}</div>
    </div>
  </div>`;
  const checks6 = [
    { key:'word_similarity', icon:'🔤', label:'단어 유사성' },
    { key:'context_similarity', icon:'📝', label:'문맥 유사성' },
    { key:'proper_nouns', icon:'🏷️', label:'고유명사 (인명·지명·회사)' },
    { key:'topic_similarity', icon:'💡', label:'주제 유사성' },
    { key:'title_similarity', icon:'📌', label:'제목 일치성' },
    { key:'copyright_risk', icon:'©️', label:'저작권/중복 위반 요소' },
  ];
  html += '<div style="display:flex;flex-direction:column;gap:6px;">';
  checks6.forEach(item => {
    const val = sim[item.key] || {};
    const risk = val.risk || 'low';
    const desc = val.detail !== undefined ? val.detail : '—';
    html += `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <span style="font-size:16px;flex-shrink:0;">${item.icon}</span>
      <span style="flex:1;font-size:14px;">${item.label}</span>
      <span style="font-size:13px;color:var(--text-muted);margin-right:8px;">${esc(String(desc))}</span>
      ${riskBadge(risk)}
    </div>`;
  });
  html += '</div>';
  if (sim.by_source && sim.by_source.length) {
    html += '<div style="margin-top:18px;font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">출처별 유사도</div>';
    sim.by_source.forEach((s, i) => {
      html += `<div style="background:rgba(255,255,255,.03);border-radius:7px;padding:10px 14px;margin-bottom:8px;font-size:13px;">
        <div style="font-weight:600;color:#60a5fa;margin-bottom:4px;">${esc(s.title||'출처 '+(i+1))}</div>
        <div style="color:var(--text-muted);">단어유사: <b style="color:#fff;">${s.word_pct||0}%</b> · 공통단어: <b style="color:#fff;">${s.common_words||0}개</b></div>
      </div>`;
    });
  }
  container.innerHTML = html;
}

async function runSeoRewriteFromModal() {
  if (!_seoCheckPostId) return;
  const btn = document.getElementById('seo-rewrite-btn');
  const result = document.getElementById('seo-rewrite-result');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ 재작성 중...';
  if (result) result.textContent = '';
  try {
    const data = await API('/api/admin/blog/' + _seoCheckPostId + '/seo-rewrite', { method: 'POST' });
    if (data.already_good) {
      if (result) result.innerHTML = '<span style="color:#C6F040;font-weight:700;">✅ 이미 ' + data.score + '점 (90점 이상)</span>';
      btn.textContent = '✅ 완료';
      return;
    }
    if (data.success) {
      if (result) result.innerHTML = `<span style="color:#C6F040;font-weight:700;">✅ ${data.old_score}점 → ${data.new_score}점 (${data.fixed_count}개 항목 개선)</span>`;
      btn.textContent = '✅ 완료';
      setTimeout(() => openSeoCheck(_seoCheckPostId), 1200);
      loadBlogList();
    } else {
      if (result) result.innerHTML = '<span style="color:#ef4444;">실패: ' + (data.error||'알 수 없는 오류') + '</span>';
      btn.disabled = false; btn.textContent = '🔄 SEO 재작성';
    }
  } catch(err) {
    if (result) result.innerHTML = '<span style="color:#ef4444;">오류: ' + (err.message||'실패') + '</span>';
    btn.disabled = false; btn.textContent = '🔄 SEO 재작성';
  }
}

async function runSeoRewrite(postId, btnEl) {
  if (!confirm('이 글을 AI가 SEO 90점 기준으로 재작성합니다.\n기존 내용이 덮어씌워집니다. 계속하시겠습니까?')) return;
  const orig = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = '⏳...';
  try {
    const data = await API('/api/admin/blog/' + postId + '/seo-rewrite', { method: 'POST' });
    if (data.already_good) {
      toast('이미 ' + data.score + '점 (90점 이상)');
    } else if (data.success) {
      toast('✅ ' + data.old_score + '점 → ' + data.new_score + '점 재작성 완료!');
      // SEO 뱃지 업데이트
      const badge = document.getElementById('seo-badge-' + postId);
      if (badge) { badge.textContent = data.new_score; badge.className = 'badge ' + (data.new_score>=90?'badge-green':data.new_score>=50?'badge-yellow':'badge-red'); }
      if (data.new_score >= 90) {
        const row = document.getElementById('blog-row-' + postId);
        const rwBtn = row?.querySelector('.btn-rewrite-' + postId);
        if (rwBtn) rwBtn.remove();
      }
    } else {
      toast('재작성 실패: ' + (data.error||'오류'));
    }
  } catch(err) {
    toast('오류: ' + (err.message||'실패'));
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = orig;
  }
}

// ── 블로그 자동생성 ──
async function loadBlogAuto() {
  try {
    /* 통계 로드 */
    const stats = await API('/api/admin/blog-gen/stats').catch(() => ({}));
    document.getElementById('auto-stat-total').textContent = stats.total_published || 0;
    document.getElementById('auto-stat-today').textContent = stats.today || 0;
    document.getElementById('auto-stat-sources').textContent = stats.active_sources || 0;

    /* 소스 로드 */
    try {
      const srcData = await API('/api/admin/blog-gen/sources');
      const sources = srcData.sources || [];
      document.getElementById('source-count').textContent = sources.length + ' / ' + sources.length + '개';
      document.getElementById('source-tbody').innerHTML = sources.length
        ? sources.map(s => `<tr>
            <td>${s.type === 'youtube' ? '▶ youtube' : s.type === 'file' ? '📄 file' : '🌐 website'}</td>
            <td><div style="font-weight:600;">${esc(s.title||s.url||'(제목 없음)')}</div><div style="font-size:12px;color:var(--text-muted);">${esc(s.url||'')}</div></td>
            <td>${esc(s.category||'전체')}</td>
            <td>${esc(s.priority||'normal')}</td>
            <td><div style="font-size:12px;">${esc(s.tags||'—')}</div><div style="font-size:11px;color:var(--text-muted);">${esc(s.notes||'')}</div></td>
            <td>${s.word_count||0}</td>
            <td><span class="badge ${s.status==='active'?'badge-green':'badge-red'}">${s.status||'active'}</span></td>
            <td>${formatTime(s.created_at)}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteSource(${s.id})">삭제</button></td>
          </tr>`).join('')
        : '<tr><td colspan="9" style="color:var(--text-muted);text-align:center;padding:30px;">등록된 소스 없음</td></tr>';
    } catch { /* 소스 API 없으면 무시 */ }

    /* OpenAI 토큰 상태 */
    try {
      const token = await API('/api/admin/blog-gen/token-status');
      var apiEl = document.getElementById('auto-stat-api');
      if (token.valid) { apiEl.textContent = 'OK'; apiEl.style.color = '#22c55e'; }
      else { apiEl.textContent = token.code || 'Error'; apiEl.style.color = '#ef4444'; }
    } catch { document.getElementById('auto-stat-api').textContent = '—'; }

    /* 생성 현황 히스토리 로드 */
    loadAutoHistory();

    /* 생성 규칙 설정 로드 */
    loadBlogSettings();
  } catch {
    document.getElementById('auto-stat-total').textContent = '—';
  }
}

// 자동생성 탭 전환
function switchAutoTab(tab) {
  document.querySelectorAll('.blog-auto-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.blog-auto-panel').forEach(p => p.style.display = 'none');
  document.querySelector('.blog-auto-tab[data-tab="' + tab + '"]').classList.add('active');
  document.getElementById('panel-' + tab).style.display = 'block';
}

// 자동생성 개수 버튼
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('auto-count-btn')) {
    document.querySelectorAll('.auto-count-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  }
});

// 자동생성 실행
async function runAutoGenerate() {
  var countBtn = document.querySelector('.auto-count-btn.active');
  var count = countBtn ? countBtn.dataset.count : 1;
  var cat = document.getElementById('auto-category').value;
  var btn = document.getElementById('btn-auto-gen');
  btn.disabled = true; btn.textContent = '생성 중... (최대 2분 소요)';
  try {
    var result = await API('/api/admin/blog-gen/run', { method: 'POST', body: JSON.stringify({ count: Number(count), category: cat || undefined }) });
    toast('✅ ' + (result.message || '자동생성 완료!'), 'success');
    loadBlogAuto();
  } catch (e) {
    toast('❌ 자동생성 실패: ' + (e.message||''), 'error');
  }
  btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 자동생성 시작';
}

// 소스 추가 (중복 클릭 방지 + 카테고리 명시 전송)
var _addSourceBusy = false;
async function addSource() {
  if (_addSourceBusy) return;
  var type = document.getElementById('source-type').value;
  var url = document.getElementById('source-url').value.trim();
  var cat = document.getElementById('source-category').value;
  var priority = document.getElementById('source-priority').value;
  var tags = document.getElementById('source-tags').value.trim();
  var notes = document.getElementById('source-memo').value.trim();
  if (type !== 'file' && !url) { toast('URL을 입력하세요'); return; }
  var btn = document.querySelector('#panel-sources .btn-primary');
  _addSourceBusy = true;
  if (btn) { btn.disabled = true; btn.textContent = '추가 중... (콘텐츠 수집)'; }
  try {
    await API('/api/admin/blog-gen/sources', { method: 'POST', body: JSON.stringify({ type, url, category: cat, priority, tags, notes }) });
    toast('✅ 소스 추가 완료', 'success');
    document.getElementById('source-url').value = '';
    document.getElementById('source-tags').value = '';
    document.getElementById('source-memo').value = '';
    loadBlogAuto();
  } catch (e) { toast('❌ 소스 추가 실패: ' + (e.message||''), 'error'); }
  _addSourceBusy = false;
  if (btn) { btn.disabled = false; btn.textContent = '소스 추가'; }
}
async function deleteSource(id) {
  if (!confirm('이 소스를 삭제하시겠습니까?')) return;
  try {
    await API('/api/admin/blog-gen/sources/' + id, { method: 'DELETE' });
    toast('소스 삭제 완료'); loadBlogAuto();
  } catch (e) { toast('삭제 실패'); }
}

// 수동 생성
async function runManualGenerate() {
  var count = parseInt(document.getElementById('manual-count')?.value) || 1;
  var cat = document.getElementById('manual-category').value;
  var btn = document.getElementById('btn-manual-gen');
  if (btn) { btn.disabled = true; btn.textContent = '생성 중... (최대 2분 소요)'; }
  try {
    var result = await API('/api/admin/blog-gen/run', { method: 'POST', body: JSON.stringify({ count: Math.min(count, 5), category: cat||undefined }) });
    toast('✅ ' + (result.message || '수동 생성 완료!'), 'success');
    loadBlogAuto();
  } catch (e) { toast('❌ 생성 실패: ' + (e.message||''), 'error'); }
  if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg> 지금 생성 시작'; }
}

// 생성 히스토리 로드
async function loadAutoHistory() {
  try {
    var data = await API('/api/admin/blog-gen/logs');
    var logs = data.logs || [];
    var tbody = document.getElementById('auto-history-tbody');
    if (!tbody) return;
    tbody.innerHTML = logs.length
      ? logs.map(function(l) {
          var seoColor = (l.seo_score||0) >= 80 ? '#22c55e' : (l.seo_score||0) >= 60 ? '#f59e0b' : '#ef4444';
          var statusBadge = l.status === 'success' ? '<span class="badge badge-green">완료</span>'
            : l.status === 'running' ? '<span class="badge badge-blue">진행중</span>'
            : '<span class="badge badge-red">실패</span>';
          var titleLink = l.post_slug ? '<a href="/blog-post.html?slug=' + encodeURIComponent(l.post_slug) + '" target="_blank">' + esc(l.post_title||'—') + '</a>' : esc(l.post_title||'—');
          var durationSec = l.duration_ms ? (l.duration_ms / 1000).toFixed(1) + '초' : '—';
          return '<tr><td>' + formatTime(l.created_at) + '</td><td>' + esc(l.category||'—') + '</td><td>' + titleLink + '</td><td style="font-size:12px;">' + esc(l.focus_kw||'—') + '</td><td>' + statusBadge + '</td><td style="color:' + seoColor + ';font-weight:600;">' + (l.seo_score||'—') + '</td><td>' + durationSec + '</td></tr>';
        }).join('')
      : '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:30px;">생성 기록 없음</td></tr>';
  } catch { /* 히스토리 로드 실패 무시 */ }
}

// 생성 규칙 설정 로드/저장
async function loadBlogSettings() {
  try {
    var styleData = await API('/api/admin/settings/blog_writing_style').catch(() => ({}));
    var toneData = await API('/api/admin/settings/blog_writing_tone').catch(() => ({}));
    var styleEl = document.getElementById('rules-style-current');
    var toneEl = document.getElementById('rules-tone-current');
    if (styleEl && styleData.value) styleEl.textContent = styleData.value;
    if (toneEl && toneData.value) toneEl.textContent = toneData.value;
  } catch {}
}
async function saveBlogStyle() {
  var val = document.getElementById('rules-style-input')?.value?.trim();
  if (!val) { toast('내용을 입력하세요'); return; }
  try {
    await API('/api/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'blog_writing_style', value: val }) });
    toast('✅ 참조 스타일 저장 완료', 'success');
    document.getElementById('rules-style-current').textContent = val;
  } catch (e) { toast('❌ 저장 실패: ' + (e.message||''), 'error'); }
}
async function saveBlogTone() {
  var val = document.getElementById('rules-tone-input')?.value?.trim();
  if (!val) { toast('내용을 입력하세요'); return; }
  try {
    await API('/api/admin/settings', { method: 'POST', body: JSON.stringify({ key: 'blog_writing_tone', value: val }) });
    toast('✅ 어투 설정 저장 완료', 'success');
    document.getElementById('rules-tone-current').textContent = val;
  } catch (e) { toast('❌ 저장 실패: ' + (e.message||''), 'error'); }
}
function setTonePreset(preset) {
  var presets = {
    professional: 'Write with a professional, polished tone. Use industry-standard terminology. Maintain objectivity and authority. Avoid slang or colloquialisms.',
    casual: 'Write in a friendly, relaxed tone. Use everyday language and contractions. Make the reader feel comfortable. Add light humor where appropriate.',
    conversational: 'Write as if speaking directly to the reader. Use "you" and "your" frequently. Ask rhetorical questions. Keep paragraphs short and punchy.',
    authoritative: 'Write with confidence and expertise. Use strong declarative statements. Back up claims with specifics. Establish the writer as a trusted expert in cybersecurity.'
  };
  var el = document.getElementById('rules-tone-input');
  if (el && presets[preset]) el.value = presets[preset];
}
async function improveStyleWithAI() {
  var current = document.getElementById('rules-style-input')?.value?.trim() || document.getElementById('rules-style-current')?.textContent?.trim() || '';
  try {
    var data = await API('/api/admin/blog-gen/improve-rules', { method: 'POST', body: JSON.stringify({ currentRules: current }) });
    if (data.suggested) {
      document.getElementById('rules-style-input').value = data.suggested;
      toast('✅ AI 개선 완료 — 검토 후 저장하세요', 'success');
    }
  } catch (e) { toast('❌ AI 개선 실패: ' + (e.message||''), 'error'); }
}

// ══════════════════════════════════════════════════════════════
// API SETTINGS
// ══════════════════════════════════════════════════════════════
const API_KEYS_AI = [
  { key: 'openai_api_key',       label: 'OpenAI API Key',        desc: 'ChatGPT / GPT-4 API key — SEO 검증 및 블로그 생성' },
  { key: 'youtube_api_key',      label: 'YouTube API Key',       desc: 'YouTube Data API v3 — 유튜브 소스 스크립트 수집' },
  { key: 'unsplash_access_key',  label: 'Unsplash Access Key',   desc: 'Unsplash API — 블로그 이미지 자동 삽입' },
  { key: 'gemini_api_key',       label: 'Gemini API Key',        desc: 'Google Gemini for blog AI review' },
  { key: 'sendgrid_api_key',     label: 'SendGrid API Key',      desc: 'SendGrid 이메일 발송 API 키' },
];

/* 눈깔 클릭 → 키 보이기/숨기기 토글 */
function toggleEye(inputId, btn) {
  var inp = document.getElementById(inputId);
  if (!inp) return;
  if (inp.type === 'password') {
    inp.type = 'text';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  } else {
    inp.type = 'password';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
}
const API_KEYS_PAY = [
  { key: 'stripe_publishable_key',  label: 'Stripe 공개키 (pk_live_...)',    desc: '프론트엔드용 — pricing.html에서 사용' },
  { key: 'stripe_secret_key',       label: 'Stripe 비밀키 (sk_live_...)',    desc: '백엔드 전용 — Workers 환경변수 우선 적용' },
  { key: 'stripe_webhook_secret',   label: 'Webhook Secret (whsec_...)',     desc: 'Stripe Dashboard → Webhooks에서 발급' },
  { key: 'r2_public_url',           label: 'R2 Public URL',                  desc: 'Cloudflare R2 버킷 공개 URL' },
];

// Stripe 상품별 Price ID (3개 상품 × 2개 주기)
const STRIPE_PRODUCT_PRICES = [
  {
    product: 'Basic',
    monthly_key: 'stripe_price_id_monthly_basic',
    yearly_key: 'stripe_price_id_yearly_basic'
  },
  {
    product: 'Standard',
    monthly_key: 'stripe_price_id_monthly_standard',
    yearly_key: 'stripe_price_id_yearly_standard'
  },
  {
    product: 'Advanced',
    monthly_key: 'stripe_price_id_monthly_advanced',
    yearly_key: 'stripe_price_id_yearly_advanced'
  }
];

let apiValues = {};

async function loadAPISettings() {
  try {
    const data = await API('/api/admin/settings');
    apiValues = {};
    (data.settings || []).forEach(s => { apiValues[s.key_name] = s.key_value || ''; });
  } catch {}
  renderAPIRows('api-rows-ai', API_KEYS_AI);
  renderAPIRows('api-rows-payment', API_KEYS_PAY);
  renderStripePrices();
  // 섹션 열릴 때 자동 연결 상태 확인
  setTimeout(() => checkAllConnections(), 300);
}

function renderAPIRows(containerId, keys) {
  document.getElementById(containerId).innerHTML = keys.map(k => `
    <div class="api-row">
      <div class="api-label">
        <strong>${k.label}</strong>
        <span>${k.desc}</span>
      </div>
      <div class="api-input-wrap">
        <input type="password" id="api-${k.key}" value="${apiValues[k.key]||''}" placeholder="Enter ${k.label}…" />
        <button class="api-eye" onclick="toggleEye('api-${k.key}',this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <div class="api-status">
        <span class="badge ${apiValues[k.key]?'badge-green':'badge-gray'}">${apiValues[k.key]?'설정됨':'미설정'}</span>
      </div>
    </div>`).join('');
}

function renderStripePrices() {
  const html = STRIPE_PRODUCT_PRICES.map(p => `
    <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border);">
      <div style="font-weight:600;color:#fff;margin-bottom:12px;font-size:15px;">${p.product}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div>
          <div style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;font-weight:600;">월간 (Monthly)</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="text" id="api-${p.monthly_key}" value="${apiValues[p.monthly_key]||''}" placeholder="price_xxx" style="flex:1;padding:10px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;font-family:inherit;" />
            <span class="badge ${apiValues[p.monthly_key]?'badge-green':'badge-gray'}" style="white-space:nowrap;">${apiValues[p.monthly_key]?'설정됨':'미설정'}</span>
          </div>
        </div>
        <div>
          <div style="font-size:13px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;font-weight:600;">연간 (Yearly)</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="text" id="api-${p.yearly_key}" value="${apiValues[p.yearly_key]||''}" placeholder="price_xxx" style="flex:1;padding:10px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:14px;font-family:inherit;" />
            <span class="badge ${apiValues[p.yearly_key]?'badge-green':'badge-gray'}" style="white-space:nowrap;">${apiValues[p.yearly_key]?'설정됨':'미설정'}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('api-rows-stripe-prices').innerHTML = html;
}

async function saveAPISettings() {
  const all = [...API_KEYS_AI, ...API_KEYS_PAY];
  const settings = all.map(k => ({ key: k.key, value: document.getElementById('api-' + k.key)?.value || '' }));
  
  // 상품별 Price ID 6개 추가
  STRIPE_PRODUCT_PRICES.forEach(p => {
    settings.push({ key: p.monthly_key, value: document.getElementById('api-' + p.monthly_key)?.value || '' });
    settings.push({ key: p.yearly_key, value: document.getElementById('api-' + p.yearly_key)?.value || '' });
  });
  
  try {
    await API('/api/admin/settings', { method: 'POST', body: JSON.stringify({ settings }) });
    alert('✅ 설정이 저장되었습니다!');
    loadAPISettings();
  } catch { alert('저장에 실패했습니다.'); }
}

// ══════════════════════════════════════════════════════════════
// 실시간 API 연결 상태 모니터
// ══════════════════════════════════════════════════════════════
function _setStep(id, icon, color, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const borderColor = color === 'green' ? '#166534' : color === 'red' ? '#7f1d1d' : color === 'yellow' ? '#78350f' : '#334155';
  const bgColor     = color === 'green' ? '#052e16' : color === 'red' ? '#450a0a' : color === 'yellow' ? '#1c1003' : '#1e293b';
  el.style.borderColor = borderColor;
  el.style.background  = bgColor;
  el.children[0].textContent = icon;
  if (label && el.children[1]) el.children[1].textContent = label;
}
function _setBadge(id, text, color) {
  const el = document.getElementById(id);
  if (!el) return;
  const bg   = color === 'green' ? 'rgba(34,197,94,.15)' : color === 'red' ? 'rgba(239,68,68,.15)' : color === 'yellow' ? 'rgba(245,158,11,.15)' : '#374151';
  const fg   = color === 'green' ? '#4ade80' : color === 'red' ? '#f87171' : color === 'yellow' ? '#fbbf24' : '#9ca3af';
  el.style.background = bg; el.style.color = fg; el.textContent = text;
}

async function checkEmailConnection() {
  _setBadge('email-conn-badge', '확인 중…', '');
  ['email-step-1','email-step-2','email-step-3','email-step-4'].forEach(id => _setStep(id, '⏳', ''));
  document.getElementById('email-conn-msg').textContent = '';
  try {
    // Step 1: Cloudflare Workers — always OK if we got here
    _setStep('email-step-1', '✅', 'green');
    const d = await API('/api/admin/check-email');
    // Step 2: API 키 설정 여부
    if (!d.key_set) {
      _setStep('email-step-2', '❌', 'red');
      _setStep('email-step-3', '—', '');
      _setStep('email-step-4', '—', '');
      _setBadge('email-conn-badge', '키 미설정', 'red');
      document.getElementById('email-conn-msg').textContent = '⚠ API 키가 설정되지 않았습니다. 아래 SendGrid API Key를 입력 후 저장하세요.';
      document.getElementById('email-step-3-label').textContent = d.provider === 'NONE' ? 'SendGrid' : d.provider;
      return;
    }
    _setStep('email-step-2', '✅', 'green');
    document.getElementById('email-step-3-label').textContent = d.provider;
    // Step 3: API 실제 연결
    if (!d.api_valid) {
      _setStep('email-step-3', '❌', 'red');
      _setStep('email-step-4', '—', '');
      _setBadge('email-conn-badge', '연결 실패', 'red');
      document.getElementById('email-conn-msg').textContent = `❌ ${d.provider} API 키 인증 실패 (${d.error || '응답 오류'}) — 키를 재발급 후 저장하세요.`;
      return;
    }
    _setStep('email-step-3', '✅', 'green');
    // Step 4: 발송 준비 완료
    _setStep('email-step-4', '✅', 'green');
    _setBadge('email-conn-badge', '정상 연결', 'green');
    document.getElementById('email-conn-msg').textContent = `✅ ${d.provider} 연결 정상 — 이메일 발송 준비 완료`;
    document.getElementById('email-conn-panel').style.borderColor = 'rgba(34,197,94,.4)';
  } catch(e) {
    _setBadge('email-conn-badge', '오류', 'red');
    document.getElementById('email-conn-msg').textContent = '오류: ' + e.message;
  }
}

async function checkStripeConnection() {
  _setBadge('stripe-conn-badge', '확인 중…', '');
  ['stripe-step-1','stripe-step-2','stripe-step-3','stripe-step-4'].forEach(id => _setStep(id, '⏳', ''));
  document.getElementById('stripe-conn-msg').textContent = '';
  document.getElementById('btn-register-webhook').style.display = 'none';
  document.getElementById('stripe-webhook-list').innerHTML = '';
  try {
    const d = await API('/api/admin/check-stripe');
    // Step 1: API 키 설정
    if (!d.stripe_key_set) {
      _setStep('stripe-step-1', '❌', 'red');
      ['stripe-step-2','stripe-step-3','stripe-step-4'].forEach(id => _setStep(id, '—', ''));
      _setBadge('stripe-conn-badge', '키 미설정', 'red');
      document.getElementById('stripe-conn-msg').textContent = '⚠ Stripe Secret Key가 설정되지 않았습니다.';
      return;
    }
    _setStep('stripe-step-1', '✅', 'green');
    // Step 2: Stripe API 연결
    if (!d.stripe_api_valid) {
      _setStep('stripe-step-2', '❌', 'red');
      ['stripe-step-3','stripe-step-4'].forEach(id => _setStep(id, '—', ''));
      _setBadge('stripe-conn-badge', '인증 실패', 'red');
      document.getElementById('stripe-conn-msg').textContent = `❌ Stripe API 키 인증 실패 (${d.error || '응답 오류'}) — 키를 확인하세요.`;
      return;
    }
    _setStep('stripe-step-2', '✅', 'green');
    // Step 3: 웹훅 등록
    const wList = d.webhooks || [];
    if (wList.length) {
      document.getElementById('stripe-webhook-list').innerHTML =
        wList.map(w => `<span style="margin-right:8px;">${w.status==='enabled'?'✅':'⚠'} ${w.url.replace('https://','').slice(0,40)}</span>`).join('<br>');
    }
    if (!d.webhook_registered) {
      _setStep('stripe-step-3', '❌', 'red');
      _setStep('stripe-step-4', '⚠', 'yellow');
      _setBadge('stripe-conn-badge', '웹훅 미등록', 'yellow');
      document.getElementById('stripe-conn-msg').textContent = '⚠ 웹훅이 Stripe에 등록되지 않았습니다. 자동 등록 버튼을 클릭하세요.';
      document.getElementById('btn-register-webhook').style.display = 'inline-flex';
      return;
    }
    _setStep('stripe-step-3', '✅', 'green');
    // Step 4: Webhook Secret 확인
    if (!d.webhook_secret_set) {
      _setStep('stripe-step-4', '⚠', 'yellow');
      _setBadge('stripe-conn-badge', '시크릿 미설정', 'yellow');
      document.getElementById('stripe-conn-msg').textContent = '⚠ Webhook Secret이 설정되지 않았습니다. Stripe Dashboard에서 whsec_ 값을 복사해 저장하세요.';
      return;
    }
    _setStep('stripe-step-4', '✅', 'green');
    _setBadge('stripe-conn-badge', '정상 연결', 'green');
    document.getElementById('stripe-conn-msg').textContent = '✅ Stripe API + 웹훅 모두 정상 연결 — 결제 처리 준비 완료';
    document.getElementById('stripe-conn-panel').style.borderColor = 'rgba(34,197,94,.4)';
  } catch(e) {
    _setBadge('stripe-conn-badge', '오류', 'red');
    document.getElementById('stripe-conn-msg').textContent = '오류: ' + e.message;
  }
}

async function checkAllConnections() {
  const btn = document.getElementById('btn-check-all');
  if (btn) { btn.disabled = true; btn.textContent = '확인 중…'; }
  await Promise.all([checkEmailConnection(), checkStripeConnection()]);
  if (btn) { btn.disabled = false; btn.textContent = '전체 확인'; }
}

async function registerStripeWebhook() {
  const btn = document.getElementById('btn-register-webhook');
  if (btn) { btn.disabled = true; btn.textContent = '등록 중…'; }
  try {
    const d = await API('/api/admin/register-webhook', { method: 'POST' });
    if (d.success) {
      toast('✅ 웹훅이 Stripe에 자동 등록되었습니다!' + (d.secret_saved ? ' Webhook Secret도 자동 저장됨.' : ''), 'success');
      await checkStripeConnection();
    } else {
      toast('웹훅 등록 실패: ' + (d.error || '알 수 없는 오류'), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ 웹훅 자동 등록'; }
    }
  } catch(e) {
    toast('오류: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '⚡ 웹훅 자동 등록'; }
  }
}

// ══════════════════════════════════════════════════════════════
// 연결 상태 진단
// ══════════════════════════════════════════════════════════════
async function runDiagnose() {
  const el = document.getElementById('diagnose-result');
  el.style.display = 'block';
  el.innerHTML = '<div style="color:var(--text-muted);padding:10px 0;">진단 중…</div>';
  try {
    const d = await API('/api/admin/diagnose');
    const c = d.config || {};

    const row = (ok, label, prefix) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span style="font-size:18px;line-height:1;">${ok ? '✅' : '❌'}</span>
        <span style="font-weight:700;color:${ok ? '#fff' : '#ef4444'};min-width:200px;">${label}</span>
        ${prefix ? `<span style="font-family:monospace;font-size:12px;color:var(--text-muted);">${prefix}</span>` : ''}
        ${!ok ? '<span style="font-size:12px;color:#ef4444;">⚠ 설정 필요</span>' : ''}
      </div>`;

    let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px;">API 키 상태</div>
        ${row(c.stripe_secret_key_set, 'Stripe Secret Key', c.stripe_secret_key_prefix)}
        ${row(c.webhook_secret_set,    'Webhook Secret',    c.webhook_secret_prefix)}
        ${row(c.sendgrid_key_set,      'SendGrid API Key',  c.sendgrid_key_prefix)}
        ${!c.stripe_secret_key_set ? '<div style="margin-top:8px;font-size:12px;color:#f59e0b;">💡 키는 저장 후 아래 "연결 상태 확인" 재클릭</div>' : ''}
      </div>
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px;">최근 Stripe 이벤트 (5건)</div>
        ${(d.recent_stripe_events || []).length === 0
          ? '<div style="color:var(--text-muted);font-size:13px;">이벤트 없음 — 아직 결제가 없거나 Webhook 미연결</div>'
          : (d.recent_stripe_events || []).map(e => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">
              <span>${e.processed ? '✅' : (e.error_msg ? '❌' : '⏳')}</span>
              <span style="color:var(--text-muted);font-family:monospace;">${e.type}</span>
              ${e.error_msg ? `<span style="color:#ef4444;">${e.error_msg.slice(0,50)}</span>` : ''}
            </div>`).join('')}
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin-top:16px;margin-bottom:12px;">최근 결제 (5건)</div>
        ${(d.recent_payments || []).length === 0
          ? '<div style="color:var(--text-muted);font-size:13px;">결제 없음</div>'
          : (d.recent_payments || []).map(p => `
            <div style="font-size:12px;margin-bottom:5px;">
              <span style="color:${p.status==='completed'?'#22c55e':'#f59e0b'};font-weight:700;">${p.status}</span>
              <span style="color:var(--text-muted);margin-left:8px;">${esc(p.customer_email||'?')}</span>
              <span style="color:#9e9e9e;margin-left:6px;">${esc(p.plan_name||'-')}</span>
            </div>`).join('')}
      </div>
    </div>`;

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;">진단 실패: ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// SendGrid 테스트 이메일 발송
// ══════════════════════════════════════════════════════════════
async function sendTestEmail() {
  const addr = (document.getElementById('test-email-addr').value || '').trim();
  if (!addr || !addr.includes('@')) { alert('수신할 이메일 주소를 입력하세요'); return; }
  const el = document.getElementById('diagnose-result');
  el.style.display = 'block';
  el.innerHTML = '<div style="color:var(--text-muted);padding:10px 0;">SendGrid 테스트 발송 중…</div>';
  try {
    const d = await API('/api/admin/test-email', { method: 'POST', body: JSON.stringify({ to: addr }) });
    if (d.success) {
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:14px 18px;">
          <span style="font-size:24px;">✅</span>
          <div>
            <div style="font-weight:700;color:#22c55e;margin-bottom:4px;">SendGrid 발송 성공!</div>
            <div style="font-size:13px;color:var(--text-muted);">${esc(addr)} 로 발송됨 — 받은편지함(스팸 포함) 확인</div>
          </div>
        </div>`;
    } else {
      el.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:14px 18px;">
          <span style="font-size:24px;">❌</span>
          <div>
            <div style="font-weight:700;color:#ef4444;margin-bottom:6px;">SendGrid 발송 실패</div>
            <div style="font-size:13px;color:var(--text-muted);line-height:1.7;">
              1. SendGrid API Key가 올바른지 확인<br>
              2. <strong style="color:#fff;">전체 저장</strong> 버튼으로 저장 후 재시도<br>
              3. Cloudflare Workers → Logs 에서 <code style="color:#e6b802;">[MAIL]</code> 로그 확인<br>
              4. SendGrid에서 <code style="color:#e6b802;">support@noteracker.com</code> 발신자 인증 확인
            </div>
          </div>
        </div>`;
    }
  } catch (e) {
    el.innerHTML = `<div style="color:#ef4444;">오류: ${e.message}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// ADMINS
// ══════════════════════════════════════════════════════════════
async function loadAdmins() {
  try {
    const data = await API('/api/admin/admins');
    const list = data.admins || [];
    document.getElementById('admins-tbody').innerHTML = list.map(a => `
      <tr>
        <td><strong style="color:#fff">${a.username}</strong></td>
        <td>${a.email}</td>
        <td><span class="badge ${a.role==='superadmin'?'badge-yellow':'badge-blue'}">${a.role}</span></td>
        <td><span class="badge ${a.totp_enabled?'badge-green':'badge-gray'}">${a.totp_enabled?'ON':'OFF'}</span></td>
        <td style="font-size:14px;">${a.last_login ? formatTime(a.last_login) : '없음'}</td>
        <td><span class="badge ${a.is_active?'badge-green':'badge-red'}">${a.is_active?'활성':'비활성'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="toggleAdmin(${a.id},${a.is_active})">${a.is_active?'비활성화':'활성화'}</button>
        </td>
      </tr>`).join('');
  } catch {
    document.getElementById('admins-tbody').innerHTML =
      '<tr><td colspan="7" style="color:var(--text-muted);text-align:center;padding:30px;">API not connected</td></tr>';
  }
}
function showAddAdmin() { document.getElementById('admin-modal').classList.add('open'); }
async function addAdmin() {
  const username = document.getElementById('new-admin-username').value.trim();
  const email    = document.getElementById('new-admin-email').value.trim();
  const password = document.getElementById('new-admin-pw').value;
  const role     = document.getElementById('new-admin-role').value;
  if (!username || !email || !password) { alert('모든 항목을 입력해 주세요.'); return; }
  try {
    await API('/api/admin/admins', { method: 'POST', body: JSON.stringify({ username, email, password, role }) });
    document.getElementById('admin-modal').classList.remove('open');
    loadAdmins();
  } catch { alert('관리자 추가에 실패했습니다.'); }
}
async function toggleAdmin(id, current) {
  if (!confirm(`해당 관리자를 ${current ? '비활성화' : '활성화'} 하시겠습니까?`)) return;
  await API('/api/admin/admins/' + id, { method: 'PATCH', body: JSON.stringify({ is_active: !current }) });
  loadAdmins();
}

function showEditAdmin(a) {
  document.getElementById('edit-admin-id').value       = a.id;
  document.getElementById('edit-admin-username').value = a.username || '';
  document.getElementById('edit-admin-email').value    = a.email    || '';
  document.getElementById('edit-admin-pw').value       = '';
  document.getElementById('edit-admin-role').value     = a.role     || 'admin';
  document.getElementById('edit-admin-modal').classList.add('open');
}

async function saveAdminEdit() {
  const id       = document.getElementById('edit-admin-id').value;
  const username = document.getElementById('edit-admin-username').value.trim();
  const email    = document.getElementById('edit-admin-email').value.trim();
  const password = document.getElementById('edit-admin-pw').value;
  const role     = document.getElementById('edit-admin-role').value;

  if (!username && !email && !password) {
    alert('수정할 항목을 하나 이상 입력해 주세요.'); return;
  }
  if (password && password.length < 8) {
    alert('비밀번호는 8자 이상이어야 합니다.'); return;
  }

  const body = {};
  if (username) body.username = username;
  if (email)    body.email    = email;
  if (password) body.password = password;
  if (role)     body.role     = role;

  try {
    const res = await API('/api/admin/admins/' + id + '/edit', {
      method: 'POST', body: JSON.stringify(body)
    });
    if (res.error) { alert('오류: ' + res.error); return; }
    document.getElementById('edit-admin-modal').classList.remove('open');
    alert('✅ 관리자 정보가 수정되었습니다.');
    loadAdmins();
  } catch { alert('수정에 실패했습니다.'); }
}

// ══════════════════════════════════════════════════════════════
// LOGO
// ══════════════════════════════════════════════════════════════
const logoFiles = { header: null, footer: null, admin: null, customer: null };

async function loadLogoSettings() {
  try {
    const data = await API('/api/admin/settings');
    const settings = {};
    (data.settings || []).forEach(s => { settings[s.key_name] = s.key_value; });
    // 관리자 대시보드 로고
    if (settings.admin_logo_url) {
      document.getElementById('admin-logo-url').value = settings.admin_logo_url;
      showLogoPreview('admin', settings.admin_logo_url);
    }
    // 고객 대시보드 로고 (이메일에도 사용)
    if (settings.customer_logo_url) {
      document.getElementById('customer-logo-url').value = settings.customer_logo_url;
      showLogoPreview('customer', settings.customer_logo_url);
    }
    // 기존 헤더/풋터 로고
    if (settings.header_logo_url) {
      document.getElementById('header-logo-url').value = settings.header_logo_url;
      showLogoPreview('header', settings.header_logo_url);
    }
    if (settings.footer_logo_url) {
      document.getElementById('footer-logo-url').value = settings.footer_logo_url;
      showLogoPreview('footer', settings.footer_logo_url);
    }
  } catch {}
}

function showLogoPreview(type, url) {
  const preview = document.getElementById(type + '-logo-preview');
  preview.innerHTML = `<img src="${url}" alt="${type} logo" />`;
}

function previewLogo(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  logoFiles[type] = file;
  const reader = new FileReader();
  reader.onload = ev => showLogoPreview(type, ev.target.result);
  reader.readAsDataURL(file);
}
function onDrag(e, id) { e.preventDefault(); document.getElementById(id).classList.add('drag'); }
function offDrag(id) { document.getElementById(id).classList.remove('drag'); }
function onDrop(e, type) {
  e.preventDefault();
  offDrag(type + '-drop');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  logoFiles[type] = file;
  const reader = new FileReader();
  reader.onload = ev => showLogoPreview(type, ev.target.result);
  reader.readAsDataURL(file);
}

async function saveLogos(type) {
  const types = type ? [type] : ['admin', 'customer', 'header', 'footer'];
  for (const t of types) {
    if (!logoFiles[t]) continue;
    const fd = new FormData();
    fd.append('file', logoFiles[t]);
    fd.append('type', t);
    try {
      const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
      const res = await fetch('/api/admin/logo', {
        method: 'POST', body: fd, headers: { 'Authorization': 'Bearer ' + sid }
      });
      const data = await res.json();
      if (data.url) {
        document.getElementById(t + '-logo-url').value = data.url;
        showLogoPreview(t, data.url);
      }
    } catch { alert('로고 업로드에 실패했습니다: ' + t); }
  }
  alert('✅ 로고가 저장되었습니다!');
}

function removeLogo(type) {
  if (!confirm('로고를 삭제하시겠습니까?')) return;
  logoFiles[type] = null;
  document.getElementById(type + '-logo-preview').innerHTML = '<div class="logo-preview-empty">업로드된 로고 없음</div>';
  document.getElementById(type + '-logo-url').value = '';
}

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
// ── Toast 알림 ─────────────────────────────────────────────
let _toastTimer;
const showToast = (msg, type = 'success') => toast(msg, type); // alias
function toast(msg, type = 'success') {
  let t = document.getElementById('admin-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'admin-toast';
    t.style.cssText = 'position:fixed;bottom:28px;right:28px;background:#1c2228;border:1px solid #323841;border-radius:10px;padding:14px 20px;color:#fff;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.5);display:flex;align-items:center;gap:10px;max-width:360px;opacity:0;transform:translateY(10px);transition:all .25s;';
    document.body.appendChild(t);
  }
  const color = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#e6b802';
  t.style.borderColor = color;
  t.innerHTML = `<span style="color:${color};font-size:18px;">${type === 'success' ? '✓' : type === 'error' ? '✗' : '!'}</span><span>${msg}</span>`;
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 3500);
}

function formatTime(iso) {
  if (!iso) return '—';
  // SQLite datetime('now')는 'YYYY-MM-DD HH:MM:SS' (UTC, 타임존 없음)
  // → 'Z' 붙여 UTC로 명시 후 로컬(고객 브라우저 기준) / KST 각각 변환
  const utc = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  const d = new Date(utc);
  if (isNaN(d.getTime())) return '—';

  // 로컬 시간 (고객 브라우저 타임존 기준)
  const localDate = d.toLocaleDateString('en-GB');
  const localTime = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  // 한국 시간 (KST = UTC+9, Asia/Seoul)
  const kstDate = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Seoul' });
  const kstTime = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });

  const sameDay = localDate === kstDate;
  const kstLabel = sameDay
    ? `KST ${kstTime}`
    : `KST ${kstDate} ${kstTime}`;

  return `${localDate} ${localTime} / ${kstLabel}`;
}

// ── 로그아웃 ──────────────────────────────────────────────────
async function doLogout() {
  try { await API('/api/auth/logout', { method: 'POST' }); } catch {}
  sessionStorage.removeItem('nr_session');
  sessionStorage.removeItem('nr_user_type');
  localStorage.removeItem('nr_session');
  window.location.href = '/';
}

// ── 테스트 데이터 초기화 ────────────────────────────────────────
async function resetCustomersData() {
  if (!confirm('⚠️ 결제 고객 데이터를 모두 삭제합니다.\n\n- 결제 고객 (stripe_customer_id 보유)\n- 결제 내역 (payments)\n- 체크아웃 세션 (checkout_sessions)\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
  if (!confirm('정말로 삭제하시겠습니까? 확인을 누르면 즉시 삭제됩니다.')) return;
  const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
  try {
    const res = await fetch('/api/admin/reset/customers', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + sid }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('결제 고객 데이터 초기화 완료 ✓', 'success');
      loadCustomers();
      loadOverview();
    } else {
      showToast('오류: ' + (data.error || '삭제 실패'), 'error');
    }
  } catch {
    showToast('네트워크 오류', 'error');
  }
}

async function resetStripeEvents() {
  if (!confirm('⚠️ Stripe 이벤트 로그를 모두 삭제합니다.\n\n이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?')) return;
  const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
  try {
    const res = await fetch('/api/admin/reset/stripe-events', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + sid }
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Stripe 이벤트 초기화 완료 ✓', 'success');
      loadStripeEvents();
    } else {
      showToast('오류: ' + (data.error || '삭제 실패'), 'error');
    }
  } catch {
    showToast('네트워크 오류', 'error');
  }
}

// ── 인증 확인 ─────────────────────────────────────────────────
(async () => {
  const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session');
  if (!sid) { window.location.href = '/login.html'; return; }
  try {
    const res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + sid } });
    if (!res.ok) { window.location.href = '/login.html'; return; }
    const data = await res.json();
    if (data.user_type !== 'admin') { window.location.href = '/dashboard.html'; return; }
    // 관리자 정보 표시
    const u = data.user;
    const initial = (u.username || 'A')[0].toUpperCase();
    document.getElementById('admin-avatar').textContent = initial;
    document.getElementById('admin-name').textContent = u.username;
    document.getElementById('admin-role').textContent = u.role === 'superadmin' ? '최고 관리자' : '관리자';
  } catch {
    // API 미연결 상태 – 개발 중에는 통과
    console.warn('Auth API not connected. Running in preview mode.');
  }
  // 초기 섹션 로드
  loadOverview();
  refreshBadges();
  setInterval(refreshBadges, 30000); // 30초마다 자동 갱신
})();

// ══════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ══════════════════════════════════════════════════════════════
const CACHE_LOG_KEY  = 'nr_cache_log';
const CACHE_LAST_KEY = 'nr_cache_last';

function showCacheToast(msg, isError) {
  let el = document.getElementById('cache-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cache-toast';
    el.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
      'padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;' +
      'z-index:9999;transition:opacity .4s;white-space:nowrap;pointer-events:none;opacity:0;';
    document.body.appendChild(el);
  }
  el.style.background = isError ? 'rgba(239,68,68,.2)'  : 'rgba(34,197,94,.2)';
  el.style.border     = isError ? '1px solid rgba(239,68,68,.5)' : '1px solid rgba(34,197,94,.5)';
  el.style.color      = isError ? '#ef4444' : '#22c55e';
  el.textContent      = (isError ? '❌ ' : '✅ ') + msg;
  el.style.opacity    = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 4000);
}

async function loadCacheManage() {
  // KV 통계 로드
  try {
    const d = await API('/api/admin/cache/stats');
    document.getElementById('kv-page').textContent  = d.page   ?? 0;
    document.getElementById('kv-obj').textContent   = d.object ?? 0;
    document.getElementById('kv-css').textContent   = d.css    ?? 0;
    document.getElementById('kv-total').textContent = d.total  ?? 0;
  } catch(e) {
    console.warn('Cache stats error:', e);
  }

  // 마지막 초기화 시간 복원
  const lastMap = JSON.parse(localStorage.getItem(CACHE_LAST_KEY) || '{}');
  const lastEls = { page: 'cache-page-last', object: 'cache-obj-last', edge: 'cache-edge-last', css: 'cache-css-last' };
  Object.entries(lastEls).forEach(([key, elId]) => {
    const el = document.getElementById(elId);
    if (el) el.textContent = lastMap[key] ? '마지막 초기화: ' + timeAgo(lastMap[key]) : '마지막 초기화: 기록 없음';
  });

  renderCacheLog();
}

async function clearCache(type) {
  const SVG_SPIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;animation:spin .8s linear infinite;display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
  const SVG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:4px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
  const typeMap = {
    page:   { api: 'clear-page',   btnId: 'btn-cache-page',   resId: 'cache-page-result',  label: '페이지 캐시',   btnText: '초기화' },
    object: { api: 'clear-object', btnId: 'btn-cache-object', resId: 'cache-obj-result',   label: '오브젝트 캐시', btnText: '초기화' },
    edge:   { api: 'clear-edge',   btnId: 'btn-cache-edge',   resId: 'cache-edge-result',  label: '엣지 캐시',     btnText: '초기화' },
    css:    { api: 'clear-css',    btnId: 'btn-cache-css',    resId: 'cache-css-result',   label: 'CSS 캐시',      btnText: '재생성' },
    all:    { api: 'clear-all',    btnId: 'btn-cache-all',    resId: null,                 label: '전체 캐시',     btnText: '전체 캐시 초기화' },
  };
  const info = typeMap[type];
  if (!info) return;

  const btn   = document.getElementById(info.btnId);
  const resEl = info.resId ? document.getElementById(info.resId) : null;

  // 로딩 상태
  if (btn)   { btn.disabled = true; btn.innerHTML = SVG_SPIN + '처리 중...'; }
  if (resEl) { resEl.style.display = 'none'; }

  try {
    const sid = sessionStorage.getItem('nr_session') || localStorage.getItem('nr_session') || '';
    const res = await fetch('/api/admin/cache/' + info.api, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + sid, 'Content-Type': 'application/json' }
    });
    let d = {};
    try { d = await res.json(); } catch(e) {}

    if (res.ok) {
      const msg = d.message || info.label + ' 초기화 완료';
      if (resEl) {
        resEl.style.cssText = 'display:block;margin-top:12px;padding:9px 14px;border-radius:8px;' +
          'font-size:12px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#22c55e;';
        resEl.textContent = '✅ ' + msg;
        setTimeout(() => { resEl.style.display = 'none'; }, 6000);
      }
      showCacheToast(msg, false);

      // 마지막 초기화 시간 저장
      const lastMap = JSON.parse(localStorage.getItem(CACHE_LAST_KEY) || '{}');
      (type === 'all' ? ['page','object','edge','css'] : [type]).forEach(t => { lastMap[t] = new Date().toISOString(); });
      localStorage.setItem(CACHE_LAST_KEY, JSON.stringify(lastMap));

      addCacheLog(info.label, msg, 'success');
      setTimeout(loadCacheManage, 400);

    } else {
      const errMsg = d.error || 'HTTP ' + res.status + ' 오류';
      if (resEl) {
        resEl.style.cssText = 'display:block;margin-top:12px;padding:9px 14px;border-radius:8px;' +
          'font-size:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444;';
        resEl.textContent = '❌ ' + errMsg;
        setTimeout(() => { resEl.style.display = 'none'; }, 8000);
      }
      showCacheToast(errMsg, true);
      addCacheLog(info.label, errMsg, 'error');
    }
  } catch(e) {
    const errMsg = '네트워크 오류: ' + e.message;
    if (resEl) {
      resEl.style.cssText = 'display:block;margin-top:12px;padding:9px 14px;border-radius:8px;' +
        'font-size:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#ef4444;';
      resEl.textContent = '❌ ' + errMsg;
      setTimeout(() => { resEl.style.display = 'none'; }, 8000);
    }
    showCacheToast(errMsg, true);
    addCacheLog(info.label, errMsg, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = SVG_ICON + info.btnText; }
  }
}

function addCacheLog(label, message, status) {
  const logs = JSON.parse(localStorage.getItem(CACHE_LOG_KEY) || '[]');
  logs.unshift({ label, message, status, time: new Date().toISOString() });
  if (logs.length > 30) logs.splice(30);
  localStorage.setItem(CACHE_LOG_KEY, JSON.stringify(logs));
  renderCacheLog();
}

function renderCacheLog() {
  const logEl = document.getElementById('cache-log');
  if (!logEl) return;
  const logs = JSON.parse(localStorage.getItem(CACHE_LOG_KEY) || '[]');
  if (!logs.length) {
    logEl.innerHTML = '<div style="color:#4a5260;text-align:center;padding:20px 0;">초기화 이력이 없습니다</div>';
    return;
  }
  logEl.innerHTML = logs.map(log => {
    const isOk = log.status === 'success';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(50,56,65,.5);">
      <span style="flex-shrink:0;">${isOk ? '✅' : '❌'}</span>
      <div style="flex:1;min-width:0;">
        <span style="font-size:13px;font-weight:700;color:${isOk ? '#22c55e' : '#ef4444'};">${log.label}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">${log.message}</span>
      </div>
      <div style="font-size:11px;color:#4a5260;flex-shrink:0;white-space:nowrap;">${timeAgo(log.time)}</div>
    </div>`;
  }).join('');
}

function clearCacheLog() {
  if (!confirm('캐시 초기화 이력을 모두 삭제하시겠습니까?')) return;
  localStorage.removeItem(CACHE_LOG_KEY);
  renderCacheLog();
}

function timeAgo(isoStr) {
  if (!isoStr) return '—';
  const s = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (s < 60)    return s + '초 전';
  if (s < 3600)  return Math.floor(s / 60) + '분 전';
  if (s < 86400) return Math.floor(s / 3600) + '시간 전';
  return Math.floor(s / 86400) + '일 전';
}
