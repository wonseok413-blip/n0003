/* ─────────────────────────────────────────────
   STATE
───────────────────────────────────────────── */
const SESSION_KEY = 'nr_session';
let S = {
  token: null, postId: null,
  title: '', content: '', slug: '',
  category: '', tags: '', excerpt: '',
  seoTitle: '', seoDesc: '', featImg: '', featImgAlt: '',
  focusKw: '',
  focusKeywords: ['', '', '', '', ''],  // 5개의 포커스 키워드
  seoScore: 0, aiReview: null,
  status: 'draft',
  translations: { ko: null, ja: null, zh: null, es: null },
  dirty: false,
};

const LANGS = [
  // 주요 언어
  { code:'en', flag:'🇺🇸', name:'English' },
  { code:'ko', flag:'🇰🇷', name:'Korean' },
  { code:'ja', flag:'🇯🇵', name:'Japanese' },
  { code:'zh', flag:'🇨🇳', name:'Chinese' },
  { code:'es', flag:'🇪🇸', name:'Spanish' },
  // 유럽 언어
  { code:'de', flag:'🇩🇪', name:'German' },
  { code:'fr', flag:'🇫🇷', name:'French' },
  { code:'it', flag:'🇮🇹', name:'Italian' },
  { code:'pt', flag:'🇵🇹', name:'Portuguese' },
  { code:'nl', flag:'🇳🇱', name:'Dutch' },
  { code:'pl', flag:'🇵🇱', name:'Polish' },
  { code:'ru', flag:'🇷🇺', name:'Russian' },
  { code:'sv', flag:'🇸🇪', name:'Swedish' },
  { code:'da', flag:'🇩🇰', name:'Danish' },
  { code:'fi', flag:'🇫🇮', name:'Finnish' },
  { code:'no', flag:'🇳🇴', name:'Norwegian' },
  { code:'cs', flag:'🇨🇿', name:'Czech' },
  { code:'hu', flag:'🇭🇺', name:'Hungarian' },
  // 아시아 & 기타
  { code:'th', flag:'🇹🇭', name:'Thai' },
  { code:'vi', flag:'🇻🇳', name:'Vietnamese' },
  { code:'id', flag:'🇮🇩', name:'Indonesian' },
  { code:'ms', flag:'🇲🇾', name:'Malay' },
  { code:'hi', flag:'🇮🇳', name:'Hindi' },
];

/* ─────────────────────────────────────────────
   BOOT
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  S.token = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
  if (!S.token) return location.href = '/login.html';

  const params = new URLSearchParams(location.search);
  S.postId = params.get('id');

  renderLangRows();
  renderFocusKeywords();

  if (S.postId) {
    await loadPost();
  }

  runSEO();
  setView('split');
  toggleSchedule();
});

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function goBack() {
  if (S.dirty && !confirm('저장되지 않은 변경사항이 있습니다. 나가시겠습니까?')) return;
  location.href = '/dashboard-admin.html?section=blog';
}

/* ─────────────────────────────────────────────
   API HELPER
───────────────────────────────────────────── */
async function api(path, method='GET', body=null) {
  const opts = {
    method,
    headers: { 'Authorization': 'Bearer ' + S.token }
  };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.status);
  }
  return res.json();
}

/* ─────────────────────────────────────────────
   LOAD POST
───────────────────────────────────────────── */
async function loadPost() {
  try {
    const data = await api('/api/admin/blog/' + S.postId);
    const p = data.post;
    S.title = p.title || '';
    S.content = p.content || '';
    S.slug = p.slug || '';
    S.category = p.category || '';
    S.tags = p.tags || '';
    S.excerpt = p.excerpt || '';
    S.seoTitle = p.seo_title || '';
    S.seoDesc = p.seo_description || '';
    S.featImg = p.featured_image || '';
    S.seoScore = p.seo_score || 0;
    S.aiReview = p.ai_review ? JSON.parse(p.ai_review) : null;
    S.status = p.status || 'draft';

    document.getElementById('title-input').value = S.title;
    document.getElementById('md-input').value = S.content;
    document.getElementById('meta-slug').value = S.slug;
    document.getElementById('meta-category').value = S.category;
    document.getElementById('meta-tags').value = S.tags;
    document.getElementById('meta-excerpt').value = S.excerpt;
    document.getElementById('meta-seo-title').value = S.seoTitle;
    document.getElementById('meta-seo-desc').value = S.seoDesc;
    document.getElementById('meta-img').value = S.featImg;
    if (S.featImg) updateFeatImgPreview();
    if (p.featured_image_alt) document.getElementById('meta-img-alt').value = p.featured_image_alt;

    document.getElementById('tb-title').textContent = S.title || '새 포스트';
    const statusMap = { published: 'Published', scheduled: '예약발행', draft: 'Draft' };
    document.getElementById('tb-status').textContent = statusMap[S.status] || 'Draft';

    // 예약발행 상태 복원
    if (S.status === 'scheduled' && p.scheduled_at) {
      const radio = document.querySelector('input[name="publish-mode"][value="scheduled"]');
      if (radio) radio.checked = true;
      const dtInput = document.getElementById('schedule-datetime');
      dtInput.style.display = 'block';
      // ISO → datetime-local 형식
      dtInput.value = p.scheduled_at.slice(0, 16);
    }

    renderPreview();
    runSEO();

    if (S.aiReview) renderAIResult(S.aiReview);
  } catch (e) {
    toast('❌ 포스트 로드 실패: ' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────────
   SAVE DRAFT
───────────────────────────────────────────── */
async function saveDraft() {
  collectMetaFields();
  const body = {
    title: S.title,
    content: S.content,
    slug: S.slug || toSlug(S.title),
    category: S.category,
    tags: S.tags,
    excerpt: S.excerpt,
    seo_title: S.seoTitle,
    seo_description: S.seoDesc,
    featured_image: S.featImg,
    featured_image_alt: S.featImgAlt,
    seo_score: S.seoScore,
    status: 'draft'
  };

  try {
    if (S.postId) {
      await api('/api/admin/blog/' + S.postId, 'PUT', body);
      toast('✅ 저장되었습니다');
    } else {
      const res = await api('/api/admin/blog', 'POST', body);
      S.postId = res.id;
      history.replaceState(null, '', '/blog-editor.html?id=' + S.postId);
      toast('✅ 새 포스트가 생성되었습니다');
    }
    S.dirty = false;
  } catch (e) {
    toast('❌ 저장 실패: ' + e.message, 'error');
  }
}

/* ─────────────────────────────────────────────
   PUBLISH
───────────────────────────────────────────── */
function openPublishModal() {
  collectMetaFields();
  document.getElementById('pub-title').textContent = S.title || '(제목 없음)';
  document.getElementById('pub-slug').textContent = '/blog/' + (S.slug || toSlug(S.title) || '-');
  document.getElementById('pub-cat').textContent = S.category || '(미분류)';
  document.getElementById('pub-seo').textContent = S.seoScore + '/100';
  document.getElementById('pub-ai').textContent = S.aiReview ? '완료' : '미실행';
  document.getElementById('pub-seo-warn').style.display = S.seoScore < 60 ? 'block' : 'none';
  document.getElementById('modal-publish').classList.add('open');
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function doPublish() {
  collectMetaFields();

  const pubMode = document.querySelector('input[name="publish-mode"]:checked')?.value || 'immediate';
  const schedDt = document.getElementById('schedule-datetime').value;

  let status = 'published';
  let scheduledAt = null;
  if (pubMode === 'scheduled') {
    if (!schedDt) { toast('❌ 예약 발행 날짜를 선택해주세요', 'error'); return; }
    if (new Date(schedDt) <= new Date()) { toast('❌ 예약 시간은 현재보다 이후여야 합니다', 'error'); return; }
    status = 'scheduled';
    scheduledAt = new Date(schedDt).toISOString();
  }

  const body = {
    title: S.title,
    content: S.content,
    slug: S.slug || toSlug(S.title),
    category: S.category,
    tags: S.tags,
    excerpt: S.excerpt,
    seo_title: S.seoTitle,
    seo_description: S.seoDesc,
    featured_image: S.featImg,
    featured_image_alt: S.featImgAlt,
    seo_score: S.seoScore,
    status,
    scheduled_at: scheduledAt
  };

  const btn = document.getElementById('btn-do-publish');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> 발행 중…';

  try {
    if (S.postId) {
      await api('/api/admin/blog/' + S.postId, 'PUT', body);
    } else {
      const res = await api('/api/admin/blog', 'POST', body);
      S.postId = res.id;
    }
    S.status = status;
    S.dirty = false;
    const statusLabel = status === 'scheduled' ? '예약발행' : 'Published';
    document.getElementById('tb-status').textContent = statusLabel;
    closeModal('modal-publish');
    const msg = status === 'scheduled'
      ? '✅ 예약 발행이 설정되었습니다 (' + new Date(scheduledAt).toLocaleString('ko-KR') + ')'
      : '✅ 발행되었습니다';
    toast(msg);

    // ★ 발행 후 자동 다국어 번역 시작 (즉시 발행/예약 발행 모두)
    if (S.postId) {
      startAutoTranslation(S.postId);
    }

  } catch (e) {
    toast('❌ 발행 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg> 지금 발행';
  }
}

/* ─────────────────────────────────────────────
   AUTO TRANSLATION (발행 후 자동 23개국어 번역)
───────────────────────────────────────────── */
async function startAutoTranslation(postId) {
  const TRANSLATE_LANGS = LANGS.filter(l => l.code !== 'en');
  const total = TRANSLATE_LANGS.length;
  let done = 0, failed = 0;

  // 번역 진행 상태 토스트
  toast(`🌐 다국어 번역 시작 (0/${total})…`);

  for (const lang of TRANSLATE_LANGS) {
    try {
      await api('/api/admin/blog/' + postId + '/translate', 'POST', { lang: lang.code });
      done++;
    } catch (e) {
      failed++;
      console.warn(`Translation failed for ${lang.code}:`, e.message);
    }
    // 진행 상태 업데이트 (5개마다)
    if ((done + failed) % 5 === 0 || (done + failed) === total) {
      toast(`🌐 번역 진행: ${done + failed}/${total} (성공: ${done}, 실패: ${failed})`);
    }
  }

  if (failed === 0) {
    toast(`✅ 다국어 번역 완료 ${done}개 언어 전체 성공`);
  } else {
    toast(`⚠️ 번역 완료 성공: ${done}개, 실패: ${failed}개`, 'warn');
  }
}

/* ─────────────────────────────────────────────
   FIELDS
───────────────────────────────────────────── */
function collectMetaFields() {
  S.title = document.getElementById('title-input').value.trim();
  S.content = document.getElementById('md-input').value;
  S.slug = document.getElementById('meta-slug').value.trim();
  S.category = document.getElementById('meta-category').value;
  S.tags = document.getElementById('meta-tags').value.trim();
  S.excerpt = document.getElementById('meta-excerpt').value.trim();
  S.seoTitle = document.getElementById('meta-seo-title').value.trim();
  S.seoDesc = document.getElementById('meta-seo-desc').value.trim();
  S.featImg = document.getElementById('meta-img').value.trim();
  S.featImgAlt = document.getElementById('meta-img-alt').value.trim();
  S.focusKw = document.getElementById('focus-keyword').value.trim();
}

function onTitleChange() {
  S.title = document.getElementById('title-input').value;
  document.getElementById('tb-title').textContent = S.title || '새 포스트';
  S.dirty = true;
  runSEO();
}
function onContentChange() {
  S.content = document.getElementById('md-input').value;
  S.dirty = true;
  renderPreview();
  runSEO();
}
function onSlugInput() {
  const v = document.getElementById('meta-slug').value;
  document.getElementById('slug-preview').textContent = '/blog/' + (v || '-');
  S.dirty = true;
}
function onSeoTitleChange() {
  const v = document.getElementById('meta-seo-title').value;
  document.getElementById('seo-title-count').textContent = v.length + '/60';
  S.dirty = true;
}
function onMetaDescChange() {
  const v = document.getElementById('meta-seo-desc').value;
  document.getElementById('meta-desc-count').textContent = v.length + '/160';
  S.dirty = true;
}
function countChars(inputId, countId, min, max) {
  const v = document.getElementById(inputId).value;
  const el = document.getElementById(countId);
  el.textContent = v.length + ' chars';
  el.className = 'pf-count ' + (v.length > max ? 'bad' : v.length >= min ? 'ok' : '');
  S.dirty = true;
}

/* ─────────────────────────────────────────────
   MARKDOWN HELPERS
───────────────────────────────────────────── */
function insertMd(before, after='') {
  const ta = document.getElementById('md-input');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const text = ta.value;
  ta.value = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + before.length;
  onContentChange();
}
function wrapMd(before, after) {
  const ta = document.getElementById('md-input');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const text = ta.value;
  const sel = text.slice(start, end);
  ta.value = text.slice(0, start) + before + sel + after + text.slice(end);
  ta.focus();
  ta.selectionStart = start + before.length;
  ta.selectionEnd = end + before.length;
  onContentChange();
}
function insertParagraph() {
  insertMd('\n\n', '');
}
function insertLink() {
  const url = prompt('URL:');
  if (url) insertMd('[링크텍스트]('+url+')', '');
}
function insertImage() {
  document.getElementById('image-file-input').click();
}
function insertTable() {
  insertMd('\n| 컬럼1 | 컬럼2 | 컬럼3 |\n|-------|-------|-------|\n| 내용1 | 내용2 | 내용3 |\n');
}

/* ─────────────────────────────────────────────
   IMAGE UPLOAD
───────────────────────────────────────────── */
function onImageFileSelected(e) {
  const file = e.target.files[0];
  if (file) uploadImage(file);
  e.target.value = '';
}

function onEditorDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-overlay').style.display = 'flex';
}
function onEditorDragLeave(e) {
  e.preventDefault();
  document.getElementById('drop-overlay').style.display = 'none';
}
function onEditorDrop(e) {
  e.preventDefault();
  document.getElementById('drop-overlay').style.display = 'none';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    uploadImage(file);
  }
}
function onPaste(e) {
  // 1. 이미지 파일 붙여넣기 처리
  const items = e.clipboardData.items;
  for (let item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) uploadImage(file);
      e.preventDefault();
      return;
    }
  }

  // 2. HTML 콘텐츠 붙여넣기 → 마크다운 자동 변환
  const html = e.clipboardData.getData('text/html');
  if (html && hasConvertibleHtml(html)) {
    e.preventDefault();
    const md = htmlToMarkdown(html);
    // textarea 현재 커서 위치에 변환된 마크다운 삽입
    const ta = document.getElementById('md-input');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + md + after;
    ta.selectionStart = ta.selectionEnd = start + md.length;
    onContentChange();
    toast('✅ HTML → 마크다운 자동 변환 완료');
    return;
  }
}

/* ── 변환 가능한 HTML 태그가 있는지 확인 ── */
function hasConvertibleHtml(html) {
  return /<(h[1-6]|strong|b|em|i|u|ul|ol|li|blockquote|a|img|p|br|hr|pre|code|table|tr|td|th)[^>]*>/i.test(html);
}

/* ── HTML → Markdown 변환 ── */
function htmlToMarkdown(html) {
  // 임시 div에서 파싱
  const div = document.createElement('div');
  div.innerHTML = html;

  // 불필요한 태그 제거 (style, script, meta, head 등)
  div.querySelectorAll('style, script, meta, head, link, title, noscript').forEach(el => el.remove());

  // 변환 실행
  let md = nodeToMd(div);

  // 정리: 연속 빈줄 3개 이상 → 2개로
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

function nodeToMd(node) {
  let result = '';

  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      // 텍스트 노드
      result += child.textContent;
    } else if (child.nodeType === 1) {
      // 요소 노드
      const tag = child.tagName.toLowerCase();
      const inner = nodeToMd(child).trim();

      switch (tag) {
        case 'h1': result += '\n\n# ' + inner + '\n\n'; break;
        case 'h2': result += '\n\n## ' + inner + '\n\n'; break;
        case 'h3': result += '\n\n### ' + inner + '\n\n'; break;
        case 'h4': result += '\n\n#### ' + inner + '\n\n'; break;
        case 'h5': result += '\n\n##### ' + inner + '\n\n'; break;
        case 'h6': result += '\n\n###### ' + inner + '\n\n'; break;
        case 'p':
          result += '\n\n' + inner + '\n\n';
          break;
        case 'br':
          result += '\n';
          break;
        case 'hr':
          result += '\n\n---\n\n';
          break;
        case 'strong':
        case 'b':
          if (inner) result += '**' + inner + '**';
          break;
        case 'em':
        case 'i':
          if (inner) result += '*' + inner + '*';
          break;
        case 'u':
          result += inner; // 마크다운에 밑줄 없음, 텍스트만
          break;
        case 'del':
        case 's':
        case 'strike':
          if (inner) result += '~~' + inner + '~~';
          break;
        case 'code':
          if (child.parentElement?.tagName?.toLowerCase() === 'pre') {
            result += inner; // pre 안의 code는 pre에서 처리
          } else {
            result += '`' + inner + '`';
          }
          break;
        case 'pre':
          result += '\n\n```\n' + (child.textContent || '').trim() + '\n```\n\n';
          break;
        case 'blockquote':
          result += '\n\n' + inner.split('\n').map(line => '> ' + line).join('\n') + '\n\n';
          break;
        case 'a': {
          const href = child.getAttribute('href') || '';
          if (href && inner) {
            result += '[' + inner + '](' + href + ')';
          } else {
            result += inner;
          }
          break;
        }
        case 'img': {
          const src = child.getAttribute('src') || '';
          const alt = child.getAttribute('alt') || '이미지';
          if (src) result += '![' + alt + '](' + src + ')';
          break;
        }
        case 'ul':
          result += '\n\n' + convertList(child, 'ul') + '\n\n';
          break;
        case 'ol':
          result += '\n\n' + convertList(child, 'ol') + '\n\n';
          break;
        case 'li':
          // li는 부모(ul/ol)에서 처리하므로 여기선 inner만
          result += inner;
          break;
        case 'table':
          result += '\n\n' + convertTable(child) + '\n\n';
          break;
        case 'div':
        case 'section':
        case 'article':
        case 'main':
        case 'header':
        case 'footer':
        case 'span':
        case 'figure':
        case 'figcaption':
          // 컨테이너 태그는 내용만 추출
          result += nodeToMd(child);
          break;
        default:
          // 기타 태그는 내용만
          result += nodeToMd(child);
          break;
      }
    }
  }
  return result;
}

function convertList(listEl, type) {
  const items = listEl.querySelectorAll(':scope > li');
  return [...items].map((li, i) => {
    const text = nodeToMd(li).trim();
    const prefix = type === 'ol' ? (i + 1) + '. ' : '- ';
    return prefix + text;
  }).join('\n');
}

function convertTable(tableEl) {
  const rows = tableEl.querySelectorAll('tr');
  if (!rows.length) return '';
  let md = '';
  let isFirstRow = true;
  rows.forEach(row => {
    const cells = row.querySelectorAll('th, td');
    const cellTexts = [...cells].map(c => c.textContent.trim());
    md += '| ' + cellTexts.join(' | ') + ' |\n';
    if (isFirstRow) {
      md += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n';
      isFirstRow = false;
    }
  });
  return md.trim();
}

async function uploadImage(file) {
  if (file.size > 5 * 1024 * 1024) {
    toast('❌ 파일 크기는 5MB 이하만 가능합니다', 'error');
    return;
  }
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (!allowed.includes(file.type)) {
    toast('❌ JPG, PNG, WEBP, GIF 형식만 지원합니다', 'error');
    return;
  }

  toast('📤 이미지 업로드 중…');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/admin/blog/upload-image', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + S.token },
      body: formData
    });

    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    insertMd(`![이미지](${data.url})\n`);
    toast('✅ 이미지 업로드 완료');
  } catch (e) {
    toast('❌ 이미지 업로드에 실패했습니다. 다시 시도해주세요', 'error');
  }
}

/* ─────────────────────────────────────────────
   FEATURED IMAGE UPLOAD & PREVIEW
───────────────────────────────────────────── */
function uploadFeaturedImage() {
  document.getElementById('featured-img-input').click();
}
function updateFeatImgPreview() {
  const url = document.getElementById('meta-img').value.trim();
  const thumb = document.getElementById('feat-img-thumb');
  const placeholder = document.getElementById('feat-img-placeholder');
  if (url) {
    thumb.src = url;
    thumb.style.display = 'block';
    placeholder.style.display = 'none';
    thumb.onerror = () => { thumb.style.display = 'none'; placeholder.style.display = 'block'; };
  } else {
    thumb.style.display = 'none';
    placeholder.style.display = 'block';
  }
  S.featImg = url;
}
async function onFeaturedImgSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';
  if (file.size > 5 * 1024 * 1024) { toast('❌ 파일 크기는 5MB 이하만 가능합니다', 'error'); return; }
  const allowed = ['image/jpeg','image/png','image/webp','image/gif'];
  if (!allowed.includes(file.type)) { toast('❌ JPG, PNG, WEBP, GIF 형식만 지원합니다', 'error'); return; }
  toast('📤 대표 이미지 업로드 중…');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/blog/upload-image', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + S.token }, body: fd
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    document.getElementById('meta-img').value = data.url;
    S.featImg = data.url;
    updateFeatImgPreview();
    toast('✅ 대표 이미지 업로드 완료');
  } catch (e) {
    toast('❌ 대표 이미지 업로드 실패', 'error');
  }
}

/* ─────────────────────────────────────────────
   SCHEDULED PUBLISH
───────────────────────────────────────────── */
function toggleSchedule() {
  const mode = document.querySelector('input[name="publish-mode"]:checked')?.value;
  document.getElementById('schedule-datetime').style.display = mode === 'scheduled' ? 'inline-block' : 'none';
  document.getElementById('lbl-immediate').style.background = mode === 'immediate' ? 'rgba(230,184,2,.2)' : 'transparent';
  document.getElementById('lbl-immediate').style.color = mode === 'immediate' ? '#e6b802' : '#d9d9d9';
  document.getElementById('lbl-scheduled').style.background = mode === 'scheduled' ? 'rgba(168,85,247,.2)' : 'transparent';
  document.getElementById('lbl-scheduled').style.color = mode === 'scheduled' ? '#a855f7' : '#d9d9d9';
}

/* ─────────────────────────────────────────────
   VIEW MODE
───────────────────────────────────────────── */
function setView(mode) {
  const input = document.getElementById('md-input');
  const preview = document.getElementById('md-preview');
  const btnSplit = document.getElementById('btn-split');
  const btnEdit = document.getElementById('btn-edit-only');
  const btnPreview = document.getElementById('btn-preview-only');

  btnSplit.classList.remove('active');
  btnEdit.classList.remove('active');
  btnPreview.classList.remove('active');

  if (mode === 'split') {
    input.style.display = 'block';
    preview.classList.add('show');
    btnSplit.classList.add('active');
  } else if (mode === 'edit') {
    input.style.display = 'block';
    preview.classList.remove('show');
    btnEdit.classList.add('active');
  } else {
    input.style.display = 'none';
    preview.classList.add('show');
    btnPreview.classList.add('active');
  }
}

/* ─────────────────────────────────────────────
   MARKDOWN PREVIEW
───────────────────────────────────────────── */
function renderPreview() {
  const md = document.getElementById('md-input').value;
  document.getElementById('md-preview').innerHTML = mdToHtml(md);
  // 동적 스타일 적용 (스타일 탭 설정 반영)
  applyDynamicStylesToPreview();
}

/* 스타일 탭의 현재 설정을 미리보기에 즉시 반영 */
function applyDynamicStylesToPreview() {
  const h1Size = document.getElementById('h1-size')?.value;
  if (!h1Size) return; // 스타일 탭 요소가 아직 없으면 스킵
  updatePreviewStyles(
    document.getElementById('h1-size').value, document.getElementById('h1-color').value,
    document.getElementById('h1-lh').value,   document.getElementById('h1-weight').value,
    document.getElementById('h2-size').value, document.getElementById('h2-color').value,
    document.getElementById('h2-lh').value,   document.getElementById('h2-weight').value,
    document.getElementById('h3-size').value, document.getElementById('h3-color').value,
    document.getElementById('h3-lh').value,   document.getElementById('h3-weight').value,
    document.getElementById('h4-size').value, document.getElementById('h4-color').value,
    document.getElementById('h4-lh').value,   document.getElementById('h4-weight').value,
    document.getElementById('h5-size').value, document.getElementById('h5-color').value,
    document.getElementById('h5-lh').value,   document.getElementById('h5-weight').value,
    document.getElementById('h6-size').value, document.getElementById('h6-color').value,
    document.getElementById('h6-lh').value,   document.getElementById('h6-weight').value,
    document.getElementById('p-size').value,  document.getElementById('p-color').value,
    document.getElementById('p-lh').value,    document.getElementById('p-ls').value
  );
}

function mdToHtml(md) {
  if (!md) return '<p style="color:#4a5260;font-style:italic;">미리보기할 내용이 없습니다…</p>';
  
  // HTML 태그가 이미 포함되어 있는지 확인 (워드프레스 등에서 복사한 경우)
  const hasHtmlTags = /<(h[1-6]|p|div|span|strong|em|b|i|u|ul|ol|li|blockquote|a|img|table|tr|td|th|thead|tbody|br|hr|pre|code)[^>]*>/i.test(md);
  
  if (hasHtmlTags) {
    // HTML이 포함된 경우: HTML 태그는 유지하면서 마크다운도 함께 처리
    let h = md
      // 코드 블록 (마크다운)
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_,l,c)=>`<pre><code class="lang-${l}">${c.trimEnd().replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code></pre>`)
      // 인라인 코드 (마크다운)
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      // 마크다운 헤딩 (HTML 태그가 아닌 라인만)
      .replace(/^###### ([^<\n]+)$/gm,'<h6>$1</h6>')
      .replace(/^##### ([^<\n]+)$/gm,'<h5>$1</h5>')
      .replace(/^#### ([^<\n]+)$/gm,'<h4>$1</h4>')
      .replace(/^### ([^<\n]+)$/gm,'<h3>$1</h3>')
      .replace(/^## ([^<\n]+)$/gm,'<h2>$1</h2>')
      .replace(/^# ([^<\n]+)$/gm,'<h1>$1</h1>')
      // 마크다운 인용구
      .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
      // 마크다운 구분선
      .replace(/^---$/gm,'<hr/>')
      // 마크다운 볼드/이탤릭
      .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/~~(.+?)~~/g,'<del>$1</del>')
      // 마크다운 이미지/링크
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1"/>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
      // 마크다운 리스트
      .replace(/^\s*[-*+] (.+)$/gm,'<li>$1</li>')
      .replace(/^\s*\d+\. (.+)$/gm,'<li>$1</li>')
      // 줄바꿈 처리 (HTML 태그 뒤가 아닌 경우만)
      .replace(/\n\n+(?!<)/g,'<br/><br/>')
      .replace(/\n(?!<)/g,'<br/>');
    return h;
  } else {
    // 순수 마크다운인 경우: 기존 로직 (HTML 이스케이프 포함)
    let h = md
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      // code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_,l,c)=>`<pre><code class="lang-${l}">${c.trimEnd()}</code></pre>`)
      // inline code
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      // headings
      .replace(/^###### (.+)$/gm,'<h6>$1</h6>')
      .replace(/^##### (.+)$/gm,'<h5>$1</h5>')
      .replace(/^#### (.+)$/gm,'<h4>$1</h4>')
      .replace(/^### (.+)$/gm,'<h3>$1</h3>')
      .replace(/^## (.+)$/gm,'<h2>$1</h2>')
      .replace(/^# (.+)$/gm,'<h1>$1</h1>')
      // blockquote
      .replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>')
      // hr
      .replace(/^---$/gm,'<hr/>')
      // bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/~~(.+?)~~/g,'<del>$1</del>')
      // links + images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1"/>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>')
      // lists
      .replace(/^\s*[-*+] (.+)$/gm,'<li>$1</li>')
      .replace(/^\s*\d+\. (.+)$/gm,'<li>$1</li>')
      .replace(/(<li>[\s\S]+?<\/li>)(?=\n\n|\n<[^l]|$)/g,'<ul>$1</ul>')
      // tables
      .replace(/^\|(.+)\|$/gm, row => {
        const cells = row.slice(1,-1).split('|');
        if (cells.every(c => /^[-:]+$/.test(c.trim()))) return '';
        return '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
      })
      .replace(/(<tr>[\s\S]+?<\/tr>)/g,'<table>$1</table>')
      // paragraphs
      .replace(/\n\n+/g,'</p><p>')
      .replace(/\n/g,'<br/>');
    return '<p>' + h + '</p>';
  }
}

/* ─────────────────────────────────────────────
   TABS
───────────────────────────────────────────── */
function switchTab(tab) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel-body').forEach(b => b.classList.remove('active'));
  document.querySelector(`.panel-tab[data-tab="${tab}"]`).classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

/* ─────────────────────────────────────────────
   SEO CHECK
───────────────────────────────────────────── */
function runSEO() {
  collectMetaFields();
  const checks = [];
  let pass = 0;

  // 1. Title length
  const titleLen = S.title.length;
  if (titleLen >= 50 && titleLen <= 60) { checks.push({ s:'pass', t:'제목 길이', d:`${titleLen}자 (최적: 50-60자)` }); pass++; }
  else if (titleLen >= 30 && titleLen <= 69) { checks.push({ s:'warn', t:'제목 길이', d:`${titleLen}자 (권장: 50-60자)` }); pass += 0.5; }
  else { checks.push({ s:'fail', t:'제목 길이', d:`${titleLen}자 (권장: 50-60자)` }); }

  // 2. Focus keyword in title
  if (!S.focusKw) { checks.push({ s:'warn', t:'포커스 키워드', d:'키워드 미설정' }); pass += 0.5; }
  else if (S.title.toLowerCase().includes(S.focusKw.toLowerCase())) { checks.push({ s:'pass', t:'포커스 키워드', d:'제목에 포함됨' }); pass++; }
  else { checks.push({ s:'fail', t:'포커스 키워드', d:'제목에 미포함' }); }

  // 3. Meta description
  const descLen = S.seoDesc.length;
  if (descLen >= 120 && descLen <= 160) { checks.push({ s:'pass', t:'메타 설명', d:`${descLen}자 (최적: 120-160자)` }); pass++; }
  else if (descLen >= 80 && descLen <= 179) { checks.push({ s:'warn', t:'메타 설명', d:`${descLen}자 (권장: 120-160자)` }); pass += 0.5; }
  else { checks.push({ s:'fail', t:'메타 설명', d:`${descLen}자 (권장: 120-160자)` }); }

  // 4. Content length (word count)
  const words = S.content.split(/\s+/).filter(w => w).length;
  if (words >= 600) { checks.push({ s:'pass', t:'본문 길이', d:`${words}단어 (600단어 이상)` }); pass++; }
  else if (words >= 300) { checks.push({ s:'warn', t:'본문 길이', d:`${words}단어 (권장: 600단어 이상)` }); pass += 0.5; }
  else { checks.push({ s:'fail', t:'본문 길이', d:`${words}단어 (권장: 600단어 이상)` }); }

  // 5. Keyword density
  if (S.focusKw && words > 0) {
    const kwCount = (S.content.toLowerCase().match(new RegExp(S.focusKw.toLowerCase(), 'g')) || []).length;
    const density = (kwCount / words * 100).toFixed(1);
    if (density >= 0.5 && density <= 2.5) { checks.push({ s:'pass', t:'키워드 밀도', d:`${density}% (최적: 0.5-2.5%)` }); pass++; }
    else if (density > 2.5) { checks.push({ s:'warn', t:'키워드 밀도', d:`${density}% (과다 사용)` }); pass += 0.5; }
    else { checks.push({ s:'fail', t:'키워드 밀도', d:`${density}% (부족)` }); }
  } else {
    checks.push({ s:'warn', t:'키워드 밀도', d:'키워드 또는 본문 없음' }); pass += 0.5;
  }

  // 6. H tag structure (마크다운 + HTML 태그 모두 감지)
  const h1Md = (S.content.match(/^# /gm) || []).length;
  const h1Html = (S.content.match(/<h1[\s>]/gi) || []).length;
  const h1Count = h1Md + h1Html;
  const h2Md = (S.content.match(/^## /gm) || []).length;
  const h2Html = (S.content.match(/<h2[\s>]/gi) || []).length;
  const h2Count = h2Md + h2Html;
  if (h1Count === 1 && h2Count >= 2) { checks.push({ s:'pass', t:'헤딩 구조', d:`H1: ${h1Count}개, H2: ${h2Count}개` }); pass++; }
  else if (h1Count > 1) { checks.push({ s:'fail', t:'헤딩 구조', d:`H1이 ${h1Count}개 (1개만 권장)` }); }
  else { checks.push({ s:'warn', t:'헤딩 구조', d:`H1: ${h1Count}개, H2: ${h2Count}개` }); pass += 0.5; }

  // 7. Images (마크다운 + HTML img 태그 모두 감지)
  const imgMd = (S.content.match(/!\[.*?\]\(.*?\)/g) || []).length;
  const imgHtml = (S.content.match(/<img[\s]/gi) || []).length;
  const imgCount = imgMd + imgHtml;
  if (imgCount >= 1) { checks.push({ s:'pass', t:'이미지', d:`${imgCount}개 이미지 포함` }); pass++; }
  else { checks.push({ s:'fail', t:'이미지', d:'이미지 없음' }); }

  // Calculate score
  S.seoScore = Math.round((pass / 7) * 100);

  // Update UI
  const ring = document.getElementById('seo-ring');
  const circumference = 163.4;
  const offset = circumference - (S.seoScore / 100) * circumference;
  ring.style.strokeDashoffset = offset;
  ring.style.stroke = S.seoScore >= 70 ? 'var(--green)' : S.seoScore >= 50 ? 'var(--focus)' : 'var(--red)';

  document.getElementById('seo-ring-val').textContent = S.seoScore;
  const gradeEl = document.getElementById('seo-grade');
  gradeEl.textContent = S.seoScore >= 70 ? '양호' : S.seoScore >= 50 ? '보통' : '개선 필요';
  gradeEl.className = 'seo-score-grade ' + (S.seoScore >= 70 ? 'grade-good' : S.seoScore >= 50 ? 'grade-ok' : 'grade-poor');
  document.getElementById('seo-pass-count').textContent = `${Math.round(pass)} / 7 항목`;

  const checkList = document.getElementById('seo-checks');
  checkList.innerHTML = checks.map(c => `
    <div class="seo-item">
      <svg class="seo-icon ${c.s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        ${c.s === 'pass' ? '<polyline points="20 6 9 17 4 12"/>' : c.s === 'warn' ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
      </svg>
      <div class="seo-msg"><strong>${c.t}</strong><span>${c.d}</span></div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────
   AI REVIEW
───────────────────────────────────────────── */
async function runAIReview() {
  collectMetaFields();
  if (!S.title && !S.content) {
    toast('⚠️ 제목 또는 본문을 입력해주세요', 'warn');
    return;
  }

  const btnTop = document.getElementById('btn-ai-top');
  btnTop.disabled = true;
  btnTop.innerHTML = '<span class="spin"></span> AI SEO 최적화 중…';

  try {
    // 1단계: AI SEO 최적화 요청 (90점 이상 목표)
    const res = await api('/api/admin/blog/ai-review', 'POST', {
      title: S.title,
      content: S.content.slice(0, 4000),
      mode: 'seo-optimize',
      current_meta: {
        seo_title: S.seoTitle,
        seo_description: S.seoDesc,
        focus_keywords: S.focusKeywords.filter(k=>k).join(', ')
      }
    });

    const r = res.review;

    // 2단계: 자동 적용
    // SEO 제목
    if (r.optimized_seo_title) {
      document.getElementById('meta-seo-title').value = r.optimized_seo_title;
      S.seoTitle = r.optimized_seo_title;
      onSeoTitleChange();
    }
    // 메타 설명
    if (r.optimized_seo_description) {
      document.getElementById('meta-seo-desc').value = r.optimized_seo_description;
      S.seoDesc = r.optimized_seo_description;
      onMetaDescChange();
    }
    // 요약
    if (r.optimized_excerpt) {
      document.getElementById('meta-excerpt').value = r.optimized_excerpt;
      S.excerpt = r.optimized_excerpt;
    }
    // 포커스 키워드
    if (r.focus_keywords && r.focus_keywords.length) {
      S.focusKeywords = r.focus_keywords.slice(0, 5);
      while (S.focusKeywords.length < 5) S.focusKeywords.push('');
      S.focusKw = S.focusKeywords[0] || '';
      document.getElementById('focus-keyword').value = S.focusKw;
      renderFocusKeywords();
    }
    // 태그
    if (r.suggested_tags && r.suggested_tags.length) {
      document.getElementById('meta-tags').value = r.suggested_tags.join(', ');
      S.tags = r.suggested_tags.join(', ');
    }
    // 카테고리
    if (r.suggested_category) {
      document.getElementById('meta-category').value = r.suggested_category;
      S.category = r.suggested_category;
    }
    // 슬러그
    if (r.suggested_slug && !S.slug) {
      document.getElementById('meta-slug').value = r.suggested_slug;
      S.slug = r.suggested_slug;
      onSlugInput();
    }

    S.aiReview = r;
    S.dirty = true;

    // AI 분석 결과 표시
    renderAIResult(r);

    // SEO 재검사
    runSEO();

    switchTab('seo');
    toast('✅ AI SEO 최적화 완료 메타 필드가 자동 적용되었습니다');
  } catch (e) {
    toast('❌ AI SEO 최적화 실패: ' + e.message, 'error');
  } finally {
    btnTop.disabled = false;
    btnTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg> AI SEO';
  }
}

function renderAIResult(r) {
  // r can be { review: {...} } or the review object directly
  const data = r.review || r;

  // AI SEO 섹션 표시
  document.getElementById('ai-seo-section').style.display = 'block';
  document.getElementById('ai-scores').style.display = 'flex';
  document.getElementById('ai-s-readability').textContent = data.scores?.readability ?? '-';
  document.getElementById('ai-s-seo').textContent = data.scores?.seo ?? '-';
  document.getElementById('ai-s-tone').textContent = data.scores?.tone ?? '-';

  const resultEl = document.getElementById('ai-result');
  resultEl.classList.remove('empty');
  resultEl.textContent = data.feedback || '피드백 없음';

  if (data.suggested_tags && data.suggested_tags.length) {
    const tagsEl = document.getElementById('ai-suggested-tags');
    tagsEl.style.display = 'flex';
    tagsEl.innerHTML = data.suggested_tags.map(t => `<span class="ai-tag">${t}</span>`).join('');
    document.getElementById('ai-apply-tags-btn').style.display = 'block';
  }

  // 개선사항 표시
  if (data.improvements && data.improvements.length) {
    let impHtml = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">';
    impHtml += '<div style="font-size:12px;color:var(--focus);font-weight:700;margin-bottom:6px;">📋 개선사항</div>';
    impHtml += data.improvements.map(imp => `<div style="font-size:12px;color:var(--muted);padding:3px 0;line-height:1.5;">• ${imp}</div>`).join('');
    impHtml += '</div>';
    resultEl.innerHTML = resultEl.textContent + impHtml;
  }
}

function applyAITags() {
  const data = S.aiReview?.review || S.aiReview;
  if (!data || !data.suggested_tags) return;
  const existing = document.getElementById('meta-tags').value.split(',').map(t => t.trim()).filter(t => t);
  const merged = [...new Set([...existing, ...data.suggested_tags])];
  document.getElementById('meta-tags').value = merged.join(', ');
  toast('✅ 추천 태그가 적용되었습니다');
  S.dirty = true;
}

/* ─────────────────────────────────────────────
   AI OPTIMIZE (Focus Keywords)
───────────────────────────────────────────── */
async function runAIOptimize() {
  collectMetaFields();
  if (!S.title && !S.content) {
    toast('⚠️ 제목 또는 본문을 입력해주세요', 'warn');
    return;
  }

  const btn = document.getElementById('btn-ai-optimize');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> 메타 생성 중…';

  try {
    const res = await api('/api/admin/blog/ai-review', 'POST', {
      title: S.title,
      content: S.content.slice(0, 4000),
      mode: 'meta-fill'
    });
    
    const meta = res.meta;
    if (!meta) throw new Error('No meta data returned');

    // 포커스 키워드 적용
    if (meta.focus_keywords && meta.focus_keywords.length) {
      S.focusKeywords = meta.focus_keywords.slice(0, 5);
      while (S.focusKeywords.length < 5) S.focusKeywords.push('');
      S.focusKw = S.focusKeywords[0] || '';
      document.getElementById('focus-keyword').value = S.focusKw;
      renderFocusKeywords();
    }

    // 슬러그 적용 (비어있을 때만 덮어씀)
    if (meta.slug) {
      document.getElementById('meta-slug').value = meta.slug;
      S.slug = meta.slug;
      onSlugInput();
    }

    // 카테고리 적용
    if (meta.category) {
      const catSelect = document.getElementById('meta-category');
      // 유효한 옵션인지 확인
      const validCats = [...catSelect.options].map(o => o.value);
      if (validCats.includes(meta.category)) {
        catSelect.value = meta.category;
        S.category = meta.category;
      }
    }

    // 태그 적용
    if (meta.tags) {
      document.getElementById('meta-tags').value = meta.tags;
      S.tags = meta.tags;
    }

    // 요약 적용
    if (meta.excerpt) {
      document.getElementById('meta-excerpt').value = meta.excerpt;
      S.excerpt = meta.excerpt;
      countChars('meta-excerpt','exc-count',0,160);
    }

    // SEO 제목 적용
    if (meta.seo_title) {
      document.getElementById('meta-seo-title').value = meta.seo_title;
      S.seoTitle = meta.seo_title;
      onSeoTitleChange();
    }

    // 메타 설명 적용
    if (meta.seo_description) {
      document.getElementById('meta-seo-desc').value = meta.seo_description;
      S.seoDesc = meta.seo_description;
      onMetaDescChange();
    }

    S.dirty = true;
    runSEO();
    toast('✅ 모든 메타 필드가 자동 생성되었습니다');
  } catch (e) {
    toast('❌ 메타 자동 생성 실패: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 검증';
  }
}

function renderFocusKeywords() {
  const container = document.getElementById('focus-keywords-container');
  container.innerHTML = S.focusKeywords.map((kw, i) => `
    <input type="text" placeholder="키워드 ${i+1}" value="${kw}" 
      oninput="S.focusKeywords[${i}]=this.value;S.dirty=true"/>
  `).join('');
}

/* ─────────────────────────────────────────────
   LANGUAGES
───────────────────────────────────────────── */
function renderLangRows() {
  const container = document.getElementById('lang-rows');
  container.innerHTML = LANGS.map(l => `
    <div style="background:var(--bg3);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:6px;">
      <span style="font-size:16px;">${l.flag}</span>
      <span style="font-size:12px;color:var(--white);font-weight:600;">${l.code.toUpperCase()}</span>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────
   STYLE PREVIEW
───────────────────────────────────────────── */
function updateStylePreview() {
  const h1Size = document.getElementById('h1-size').value;
  const h1Color = document.getElementById('h1-color').value;
  const h1Lh = document.getElementById('h1-lh').value;
  const h1Weight = document.getElementById('h1-weight').value;
  
  const h2Size = document.getElementById('h2-size').value;
  const h2Color = document.getElementById('h2-color').value;
  const h2Lh = document.getElementById('h2-lh').value;
  const h2Weight = document.getElementById('h2-weight').value;
  
  const h3Size = document.getElementById('h3-size').value;
  const h3Color = document.getElementById('h3-color').value;
  const h3Lh = document.getElementById('h3-lh').value;
  const h3Weight = document.getElementById('h3-weight').value;
  
  const h4Size = document.getElementById('h4-size').value;
  const h4Color = document.getElementById('h4-color').value;
  const h4Lh = document.getElementById('h4-lh').value;
  const h4Weight = document.getElementById('h4-weight').value;
  
  const h5Size = document.getElementById('h5-size').value;
  const h5Color = document.getElementById('h5-color').value;
  const h5Lh = document.getElementById('h5-lh').value;
  const h5Weight = document.getElementById('h5-weight').value;
  
  const h6Size = document.getElementById('h6-size').value;
  const h6Color = document.getElementById('h6-color').value;
  const h6Lh = document.getElementById('h6-lh').value;
  const h6Weight = document.getElementById('h6-weight').value;
  
  const pSize = document.getElementById('p-size').value;
  const pColor = document.getElementById('p-color').value;
  const pLh = document.getElementById('p-lh').value;
  const pLs = document.getElementById('p-ls').value;
  
  // H1 미리보기
  const h1Prev = document.getElementById('h1-preview');
  h1Prev.style.fontSize = h1Size + 'px';
  h1Prev.style.color = h1Color;
  h1Prev.style.lineHeight = h1Lh;
  h1Prev.style.fontWeight = h1Weight;
  
  // H2 미리보기
  const h2Prev = document.getElementById('h2-preview');
  h2Prev.style.fontSize = h2Size + 'px';
  h2Prev.style.color = h2Color;
  h2Prev.style.lineHeight = h2Lh;
  h2Prev.style.fontWeight = h2Weight;
  
  // H3 미리보기
  const h3Prev = document.getElementById('h3-preview');
  h3Prev.style.fontSize = h3Size + 'px';
  h3Prev.style.color = h3Color;
  h3Prev.style.lineHeight = h3Lh;
  h3Prev.style.fontWeight = h3Weight;
  
  // H4 미리보기
  const h4Prev = document.getElementById('h4-preview');
  h4Prev.style.fontSize = h4Size + 'px';
  h4Prev.style.color = h4Color;
  h4Prev.style.lineHeight = h4Lh;
  h4Prev.style.fontWeight = h4Weight;
  
  // H5 미리보기
  const h5Prev = document.getElementById('h5-preview');
  h5Prev.style.fontSize = h5Size + 'px';
  h5Prev.style.color = h5Color;
  h5Prev.style.lineHeight = h5Lh;
  h5Prev.style.fontWeight = h5Weight;
  
  // H6 미리보기
  const h6Prev = document.getElementById('h6-preview');
  h6Prev.style.fontSize = h6Size + 'px';
  h6Prev.style.color = h6Color;
  h6Prev.style.lineHeight = h6Lh;
  h6Prev.style.fontWeight = h6Weight;
  
  // P 미리보기
  const pPrev = document.getElementById('p-preview');
  pPrev.style.fontSize = pSize + 'px';
  pPrev.style.color = pColor;
  pPrev.style.lineHeight = pLh;
  pPrev.style.letterSpacing = pLs === '0' ? '0' : pLs + 'px';
  
  // CSS 스타일 업데이트
  updatePreviewStyles(h1Size, h1Color, h1Lh, h1Weight, 
                      h2Size, h2Color, h2Lh, h2Weight,
                      h3Size, h3Color, h3Lh, h3Weight,
                      h4Size, h4Color, h4Lh, h4Weight,
                      h5Size, h5Color, h5Lh, h5Weight,
                      h6Size, h6Color, h6Lh, h6Weight,
                      pSize, pColor, pLh, pLs);
}

function updatePreviewStyles(h1Size, h1Color, h1Lh, h1Weight,
                             h2Size, h2Color, h2Lh, h2Weight,
                             h3Size, h3Color, h3Lh, h3Weight,
                             h4Size, h4Color, h4Lh, h4Weight,
                             h5Size, h5Color, h5Lh, h5Weight,
                             h6Size, h6Color, h6Lh, h6Weight,
                             pSize, pColor, pLh, pLs) {
  let style = document.getElementById('dynamic-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'dynamic-styles';
    document.head.appendChild(style);
  }
  
  style.textContent = `
    #md-preview h1 { 
      font-size: ${h1Size}px !important; 
      color: ${h1Color} !important; 
      line-height: ${h1Lh} !important; 
      font-weight: ${h1Weight} !important; 
    }
    #md-preview h2 { 
      font-size: ${h2Size}px !important; 
      color: ${h2Color} !important; 
      line-height: ${h2Lh} !important; 
      font-weight: ${h2Weight} !important; 
    }
    #md-preview h3 { 
      font-size: ${h3Size}px !important; 
      color: ${h3Color} !important; 
      line-height: ${h3Lh} !important; 
      font-weight: ${h3Weight} !important; 
    }
    #md-preview h4 { 
      font-size: ${h4Size}px !important; 
      color: ${h4Color} !important; 
      line-height: ${h4Lh} !important; 
      font-weight: ${h4Weight} !important; 
    }
    #md-preview h5 { 
      font-size: ${h5Size}px !important; 
      color: ${h5Color} !important; 
      line-height: ${h5Lh} !important; 
      font-weight: ${h5Weight} !important; 
    }
    #md-preview h6 { 
      font-size: ${h6Size}px !important; 
      color: ${h6Color} !important; 
      line-height: ${h6Lh} !important; 
      font-weight: ${h6Weight} !important; 
    }
    #md-preview p { 
      font-size: ${pSize}px !important; 
      color: ${pColor} !important; 
      line-height: ${pLh} !important; 
      letter-spacing: ${pLs === '0' ? '0' : pLs + 'px'} !important;
    }
  `;
}

function resetStyles() {
  // H1 기본값
  document.getElementById('h1-size').value = 28;
  document.getElementById('h1-color').value = '#ffffff';
  document.getElementById('h1-lh').value = 1.3;
  document.getElementById('h1-weight').value = 800;
  
  // H2 기본값
  document.getElementById('h2-size').value = 24;
  document.getElementById('h2-color').value = '#ffffff';
  document.getElementById('h2-lh').value = 1.3;
  document.getElementById('h2-weight').value = 700;
  
  // H3 기본값
  document.getElementById('h3-size').value = 20;
  document.getElementById('h3-color').value = '#ffffff';
  document.getElementById('h3-lh').value = 1.3;
  document.getElementById('h3-weight').value = 700;
  
  // H4 기본값
  document.getElementById('h4-size').value = 18;
  document.getElementById('h4-color').value = '#c6cdc6';
  document.getElementById('h4-lh').value = 1.3;
  document.getElementById('h4-weight').value = 700;
  
  // H5 기본값
  document.getElementById('h5-size').value = 16;
  document.getElementById('h5-color').value = '#c6cdc6';
  document.getElementById('h5-lh').value = 1.3;
  document.getElementById('h5-weight').value = 700;
  
  // H6 기본값
  document.getElementById('h6-size').value = 14;
  document.getElementById('h6-color').value = '#9e9e9e';
  document.getElementById('h6-lh').value = 1.3;
  document.getElementById('h6-weight').value = 600;
  
  // P 기본값
  document.getElementById('p-size').value = 15;
  document.getElementById('p-color').value = '#c6cdc6';
  document.getElementById('p-lh').value = 1.8;
  document.getElementById('p-ls').value = 0;
  
  updateStylePreview();
  toast('✅ 기본 스타일이 복원되었습니다', 'success');
}

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
function toSlug(str) {
  return str.toLowerCase()
    .replace(/[^\w\s가-힣-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function toast(msg, type='success') {
  const el = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}
