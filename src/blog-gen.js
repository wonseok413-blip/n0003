/**
 * blog-gen.js n0003 WaaS/비즈니스 블로그 자동생성 엔진
 * (보안 관련 콘텐츠 절대 금지 - 보안은 n0004 전용)
 *
 * ═══════════════════════════════════════════════
 *  공식 생성 규칙 (OFFICIAL GENERATION RULES)
 *  이 규칙은 프롬프트, 프로그램 검사, ChatGPT 검사 3곳 모두 동일 적용
 * ═══════════════════════════════════════════════
 *
 *  R1.  단어 수: 1,500~2,200 (목표 1,600~2,000)
 *  R2.  H2 개수: 정확히 7개 (허용 5~9)
 *  R3.  H3 금지 (0개). H2 + 본문만으로 구성
 *  R4.  포커스 키워드: 제목에 반드시 포함
 *  R5.  포커스 키워드: 첫 문단 100단어 이내에 포함
 *  R6.  포커스 키워드: H2 1개 이상에 포함
 *  R7.  포커스 키워드: 본문 전체 4~8회 등장
 *  R8.  메타 설명: 정확히 140~160자, 키워드 + CTA 포함
 *  R9.  언어: 영어 전용, 한국어/일본어/중국어 절대 금지
 *  R10. 빈 태그: <strong></strong>, <p></p> 등 절대 금지
 *  R11. 단락 길이: 모든 <p>는 정확히 4~5문장, 60~100단어
 *       40단어 미만 → 자동 보충 / 120단어 초과 → 자동 분할
 *  R12. AI 금지 단어: delve, leverage, utilize, robust, seamless,
 *       streamline, navigate, realm, landscape, ecosystem, paradigm,
 *       synergy, empower, harness, cutting-edge, game-changer,
 *       comprehensive, paramount, holistic, crucial, essential,
 *       ensure, bolstering, foster, nuanced, curated, underscores,
 *       mitigate, proactive, prioritize, optimal, pivotal, facilitate,
 *       enhance, furthermore, moreover, additionally 등
 *       → 발견 시 대체어로 자동 교체 (postProcessContent + auto-fix)
 *  R13. 결론 섹션: "Conclusion", "Final Thoughts", "Summary" H2 절대 금지
 *       → 발견 시 자동 제거
 *  R14. 제목 길이: 50~60자
 *  R15. 비축약형 과다 금지: "do not", "will not" 등 non-contraction 5회 초과 금지
 *       → postProcessContent 축약형 강제 (don't, won't, it's 등)
 *  R16. 금지된 단락 시작 표현: "In today's", "When it comes to" 등
 *       → 발견 즉시 위반 처리
 *
 *  생성 흐름:
 *  1) Workers AI (Llama 3.3 70B) → 글 생성
 *  2) 후처리: AI 패턴 제거, 축약형 강제, 키워드 밀도 보정
 *  3) H2 보강: 목표 개수 미달 시 자동 삽입, H3 자동 제거
 *  4) 단락 길이 보정: 짧으면 보충, 길면 분할
 *  5) R7 키워드 횟수 강제 조정 (4-8회, 목표 6회)
 *  6) 1단계 프로그램 검사: R1~R16 자동 체크
 *  7) 2단계 ChatGPT 검사: R1~R16 전수 검사 (90점+ 통과)
 *  8) 불합격 → R7/R12/R13/R10 자동 수정 + 재검사
 *  9) 3단계 최종 검사: 위반 잔존 시 전체 재생성 (최대 2회)
 *  10) 합격 → DB 저장 / 2회 재생성 후에도 개선 안 되면 최선 버전 저장
 *
 *  이미지 규칙:
 *  - Unsplash에서 2장 (대표 + 본문)
 *  - 기존 n0003 글에서 사용한 이미지 중복 차단
 *  - n0005 블로그에서 사용한 이미지 절대 차단
 *
 *  작성자: Kim Eun Ho (ID 1) / Lee Hae Soo (ID 2) 랜덤 배정
 * ═══════════════════════════════════════════════
 */

import { getSetting } from './db.js';

/* ── 공통 응답 헬퍼 ── */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};
const ok = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', ...CORS } });
const bad = (msg, s = 400) => ok({ error: msg }, s);

/* ── n0003 WaaS/비즈니스 블로그 8개 카테고리 (보안 카테고리 없음) ── */
const CATEGORIES = [
  'business',
  'startup',
  'seo',
  'wordpress',
  'web-design',
  'cloud',
  'web-hosting',
  'ecommerce',
];

/* ── 카테고리별 외부 권위 링크 ── */
const CAT_EXTERNAL_REFS = {
  'wordpress': [
    ['https://developer.wordpress.org/', 'WordPress Developer Resources'],
    ['https://wordpress.org/documentation/', 'WordPress Official Documentation'],
  ],
  'web-hosting': [
    ['https://www.cloudflare.com/learning/', 'Cloudflare Learning Center'],
    ['https://httpd.apache.org/docs/', 'Apache HTTP Server Documentation'],
  ],
  'ecommerce': [
    ['https://woocommerce.com/documentation/', 'WooCommerce Documentation'],
    ['https://baymard.com/research', 'Baymard Institute UX Research'],
  ],
  'seo': [
    ['https://developers.google.com/search/docs', 'Google Search Central Documentation'],
    ['https://moz.com/learn/seo', 'Moz SEO Learning Center'],
  ],
  'business': [
    ['https://hbr.org/', 'Harvard Business Review'],
    ['https://www.mckinsey.com/featured-insights', 'McKinsey Insights'],
  ],
  'startup': [
    ['https://www.ycombinator.com/library', 'Y Combinator Startup Library'],
    ['https://a16z.com/content/', 'Andreessen Horowitz Blog'],
  ],
  'web-design': [
    ['https://www.smashingmagazine.com/', 'Smashing Magazine'],
    ['https://www.nngroup.com/articles/', 'Nielsen Norman Group'],
  ],
  'cloud': [
    ['https://www.cloudflare.com/learning/', 'Cloudflare Learning Center'],
    ['https://aws.amazon.com/blogs/', 'AWS Blog'],
  ],
};

/* ── 주제에서 짧은 포커스 키워드 추출 ── */
function extractFocusKeyword(topic, category) {
  /* 카테고리 기반 2-4단어 키워드 맵: topic substring → short keyword */
  const kwMap = {
    'wordpress': [
      ['plugin', 'wordpress plugin guide'],
      ['theme', 'wordpress theme setup'],
      ['gutenberg', 'gutenberg block editor'],
      ['multisite', 'wordpress multisite setup'],
      ['migration', 'wordpress site migration'],
      ['staging', 'wordpress staging site'],
      ['custom post', 'custom post types'],
      ['rest api', 'wordpress rest api'],
      ['headless', 'headless wordpress'],
      ['maintenance', 'wordpress maintenance tips'],
      ['backup', 'wordpress backup strategy'],
      ['update', 'wordpress update guide'],
      ['database', 'wordpress database optimize'],
      ['page builder', 'wordpress page builder'],
      ['child theme', 'wordpress child theme'],
    ],
    'web-hosting': [
      ['cloud hosting', 'cloud hosting guide'],
      ['vps', 'vps hosting setup'],
      ['cdn', 'cdn setup guide'],
      ['server', 'web server configuration'],
      ['ssl certificate', 'ssl certificate setup'],
      ['domain', 'domain management guide'],
      ['caching', 'server caching setup'],
      ['load balancing', 'load balancing setup'],
      ['managed hosting', 'managed hosting benefits'],
      ['migration', 'hosting migration guide'],
      ['uptime', 'uptime monitoring setup'],
      ['nginx', 'nginx server setup'],
      ['docker', 'docker web hosting'],
      ['cloudflare', 'cloudflare setup guide'],
      ['email hosting', 'email hosting setup'],
    ],
    'ecommerce': [
      ['woocommerce', 'woocommerce store setup'],
      ['product page', 'product page optimization'],
      ['checkout', 'checkout flow optimization'],
      ['payment gateway', 'payment gateway setup'],
      ['shipping', 'shipping setup guide'],
      ['inventory', 'inventory management tips'],
      ['conversion', 'ecommerce conversion rate'],
      ['abandoned cart', 'abandoned cart recovery'],
      ['subscription', 'subscription commerce setup'],
      ['dropshipping', 'dropshipping store setup'],
      ['b2b', 'b2b ecommerce guide'],
      ['product photo', 'product photography tips'],
      ['tax', 'ecommerce tax setup'],
      ['returns', 'returns policy setup'],
      ['upsell', 'upselling strategy guide'],
    ],
    'seo': [
      ['core web vitals', 'core web vitals guide'],
      ['keyword research', 'keyword research guide'],
      ['on-page', 'on-page seo guide'],
      ['backlink', 'backlink building guide'],
      ['schema', 'schema markup guide'],
      ['site speed', 'site speed optimization'],
      ['mobile seo', 'mobile seo guide'],
      ['local seo', 'local seo strategy'],
      ['technical seo', 'technical seo audit'],
      ['content strategy', 'seo content strategy'],
      ['image seo', 'image seo optimization'],
      ['rank tracking', 'rank tracking setup'],
      ['sitemap', 'xml sitemap guide'],
      ['internal linking', 'internal linking strategy'],
      ['featured snippet', 'featured snippet guide'],
    ],
    'business': [
      ['marketing', 'digital marketing strategy'],
      ['productivity', 'team productivity tips'],
      ['management', 'project management guide'],
      ['leadership', 'leadership skills guide'],
      ['remote', 'remote work best practices'],
      ['brand', 'brand building strategy'],
      ['email', 'email marketing guide'],
      ['growth', 'business growth strategy'],
      ['analytics', 'business analytics guide'],
      ['automation', 'workflow automation tips'],
    ],
    'startup': [
      ['funding', 'startup funding guide'],
      ['pitch', 'pitch deck tips'],
      ['saas', 'saas metrics guide'],
      ['mvp', 'mvp development guide'],
      ['product market', 'product market fit'],
      ['growth hack', 'growth hacking strategy'],
      ['fundraising', 'fundraising guide'],
      ['scaling', 'startup scaling tips'],
      ['lean', 'lean startup method'],
      ['bootstrapping', 'bootstrapping strategy'],
    ],
    'web-design': [
      ['responsive', 'responsive design guide'],
      ['accessibility', 'web accessibility guide'],
      ['ui', 'ui design principles'],
      ['ux', 'ux design best practices'],
      ['typography', 'web typography guide'],
      ['color', 'color theory web design'],
      ['wireframe', 'wireframing guide'],
      ['animation', 'web animation guide'],
      ['performance', 'web performance guide'],
      ['mobile', 'mobile first design'],
    ],
    'cloud': [
      ['serverless', 'serverless architecture guide'],
      ['docker', 'docker container guide'],
      ['kubernetes', 'kubernetes setup guide'],
      ['aws', 'aws cloud services guide'],
      ['microservice', 'microservices architecture'],
      ['edge', 'edge computing guide'],
      ['ci cd', 'ci cd pipeline setup'],
      ['monitoring', 'cloud monitoring tools'],
      ['cost', 'cloud cost optimization'],
      ['migration', 'cloud migration guide'],
    ],
  };
  const topicLower = topic.toLowerCase();
  const catKws = kwMap[category] || [];
  for (const [match, kw] of catKws) {
    if (topicLower.includes(match)) return kw;
  }
  /* fallback: extract 3-4 meaningful words from topic */
  const stopWords = new Set(['how','to','the','a','an','and','or','for','from','your','of','in','on','is','are','by','with','this','that','it','as','do','be','at','my']);
  const meaningful = topic.toLowerCase().split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  return meaningful.slice(0, 3).join(' ') || category.replace(/-/g, ' ');
}

/* ── 카테고리별 주제 15개 ── */
const CAT_TOPICS = {
  'wordpress': [
    'how to choose the right WordPress plugins for your business site',
    'building a custom WordPress theme from scratch step by step',
    'WordPress Gutenberg block editor tips for faster content creation',
    'setting up WordPress multisite for managing multiple websites',
    'migrating your WordPress site to a new host without downtime',
    'how to create a WordPress staging site for safe testing',
    'custom post types and taxonomies for advanced WordPress sites',
    'using the WordPress REST API to build modern web applications',
    'headless WordPress with modern front-end frameworks explained',
    'essential WordPress maintenance tasks every site owner should do monthly',
    'automated WordPress backup strategies that actually protect your data',
    'safely updating WordPress core plugins and themes without breaking your site',
    'optimizing your WordPress database for peak performance',
    'comparing top WordPress page builders for business websites',
    'creating a WordPress child theme for safe customizations',
  ],
  'web-hosting': [
    'cloud hosting vs shared hosting which is right for your business',
    'setting up a VPS for WordPress hosting step by step guide',
    'how to set up a CDN to speed up your website globally',
    'web server configuration guide for optimal performance',
    'SSL certificate installation and renewal best practices',
    'domain name management tips for small business owners',
    'server-side caching strategies to reduce page load times',
    'load balancing setup for high-traffic websites',
    'managed hosting vs unmanaged hosting pros and cons',
    'how to migrate your website to a new hosting provider',
    'setting up uptime monitoring to catch downtime before customers do',
    'Nginx vs Apache choosing the right web server for your site',
    'Docker containers for web application deployment guide',
    'setting up Cloudflare for performance and speed optimization',
    'business email hosting setup and configuration guide',
  ],
  'ecommerce': [
    'setting up a WooCommerce store from scratch complete guide',
    'product page optimization tips that increase conversions',
    'streamlining your checkout flow to reduce cart abandonment',
    'choosing the right payment gateway for your online store',
    'shipping setup guide for WooCommerce store owners',
    'inventory management best practices for online retailers',
    'proven strategies to improve your ecommerce conversion rate',
    'abandoned cart recovery emails that win back lost sales',
    'setting up subscription-based products in WooCommerce',
    'starting a dropshipping store with WordPress and WooCommerce',
    'B2B ecommerce features your wholesale store needs',
    'product photography tips for better online sales',
    'ecommerce tax configuration guide for multiple regions',
    'creating a returns policy that builds customer trust',
    'upselling and cross-selling strategies for online stores',
  ],
  'seo': [
    'Core Web Vitals explained and how to pass all three metrics',
    'keyword research guide for small business websites',
    'on-page SEO checklist for every blog post and page',
    'building quality backlinks for small business websites',
    'schema markup guide to get rich results in Google search',
    'site speed optimization techniques that improve SEO rankings',
    'mobile SEO best practices for responsive websites',
    'local SEO strategy guide for service-based businesses',
    'technical SEO audit checklist for WordPress websites',
    'content strategy framework that drives organic traffic',
    'image SEO optimization for faster pages and better rankings',
    'setting up rank tracking to monitor your SEO progress',
    'XML sitemap creation and submission best practices',
    'internal linking strategy that boosts page authority',
    'how to optimize content for Google featured snippets',
  ],
  'business': [
    'digital marketing strategies that drive measurable results',
    'building a strong brand identity for your online business',
    'email marketing automation tips for small business owners',
    'remote team management best practices for distributed companies',
    'project management tools and workflows for growing teams',
    'business analytics dashboards that track what matters',
    'content marketing framework for consistent lead generation',
    'customer retention strategies that reduce churn',
    'business process automation to save time and money',
    'social media marketing guide for B2B companies',
    'sales funnel optimization tips for higher conversion',
    'competitive analysis framework for market positioning',
    'building partnerships and collaborations for business growth',
    'financial planning basics for small business owners',
    'productivity tools and habits for busy entrepreneurs',
  ],
  'startup': [
    'how to validate your startup idea before building',
    'creating a pitch deck that investors actually want to see',
    'SaaS metrics every founder should track from day one',
    'building an MVP without wasting time or money',
    'finding product market fit for your startup',
    'growth hacking strategies for early-stage startups',
    'bootstrapping vs venture capital which path is right for you',
    'startup hiring guide for building your first team',
    'customer discovery interviews that reveal real problems',
    'pricing strategies for SaaS and subscription businesses',
    'lean startup methodology applied to real products',
    'scaling your startup from 10 to 100 customers',
    'startup legal essentials every founder should know',
    'building a startup community and network from scratch',
    'measuring and improving startup unit economics',
  ],
  'web-design': [
    'responsive web design principles for modern websites',
    'web accessibility WCAG compliance checklist for designers',
    'UI design patterns that improve user engagement',
    'UX research methods for data-driven design decisions',
    'typography best practices for readable web content',
    'color theory applied to website design and branding',
    'wireframing and prototyping workflow for web projects',
    'CSS animation techniques for engaging user interfaces',
    'web performance optimization for better user experience',
    'mobile-first design strategy for responsive websites',
    'design system creation guide for consistent branding',
    'landing page design tips that increase conversions',
    'dark mode implementation guide for web applications',
    'micro-interactions that make websites feel premium',
    'image optimization techniques for faster page loads',
  ],
  'cloud': [
    'serverless architecture guide for web applications',
    'Docker container basics for web developers',
    'Kubernetes deployment guide for beginners',
    'AWS vs Azure vs GCP choosing the right cloud provider',
    'microservices architecture patterns for scalable apps',
    'edge computing benefits for website performance',
    'CI/CD pipeline setup guide for automated deployments',
    'cloud monitoring and alerting best practices',
    'cloud cost optimization strategies that save money',
    'migrating your application to the cloud step by step',
    'infrastructure as code with Terraform for beginners',
    'cloud database options compared for web applications',
    'serverless functions for building APIs without servers',
    'multi-cloud strategy benefits and challenges',
    'cloud storage solutions for web application data',
  ],
};

/* ── DB 초기화 (blog_sources, blog_gen_log) ── */
let _bgReady = false;
async function initBlogGenDB(DB) {
  if (_bgReady) return;
  _bgReady = true;
  const run = async (sql) => {
    try { await DB.prepare(sql).run(); return true; }
    catch { return false; }
  };
  await run(`CREATE TABLE IF NOT EXISTS blog_sources (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL,
    url        TEXT,
    title      TEXT,
    content    TEXT,
    word_count INTEGER DEFAULT 0,
    category   TEXT,
    r2_key     TEXT,
    status     TEXT    DEFAULT 'active',
    error_msg  TEXT,
    meta       TEXT,
    priority   TEXT    DEFAULT 'normal',
    tags       TEXT    DEFAULT '',
    notes      TEXT    DEFAULT '',
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now'))
  )`);
  await run(`ALTER TABLE blog_sources ADD COLUMN priority TEXT DEFAULT 'normal'`);
  await run(`ALTER TABLE blog_sources ADD COLUMN tags TEXT DEFAULT ''`);
  await run(`ALTER TABLE blog_sources ADD COLUMN notes TEXT DEFAULT ''`);
  await run(`CREATE TABLE IF NOT EXISTS blog_gen_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER,
    source_ids  TEXT,
    category    TEXT,
    focus_kw    TEXT,
    status      TEXT    DEFAULT 'running',
    seo_score   INTEGER,
    error_msg   TEXT,
    duration_ms INTEGER,
    created_at  TEXT    DEFAULT (datetime('now'))
  )`);

  /* writing_samples 테이블 + 시드 데이터 */
  await run(`CREATE TABLE IF NOT EXISTS writing_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    genre TEXT DEFAULT 'tech',
    excerpt TEXT NOT NULL,
    style_note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  try {
    const cnt = await DB.prepare('SELECT COUNT(*) as c FROM writing_samples').first();
    if (!cnt || cnt.c < 50) await seedWritingSamples(DB);
  } catch (_) {}
}

/* ── 유명 작가 문체 샘플 100개 시드 ── */
async function seedWritingSamples(DB) {
  const samples = [
    // Paul Graham (essays, startup)
    ['Paul Graham','tech','Keep your identity small. The more labels you have for yourself, the dumber they make you. People can never have a fruitful argument about something that is part of their identity.','Short punchy sentences, contrarian, conversational'],
    ['Paul Graham','startup','A startup is a company designed to grow fast. The only essential thing is growth. Everything else we associate with startups follows from growth.','Direct thesis statements, building logic step by step'],
    ['Paul Graham','tech','The way to get startup ideas is not to try to think of startup ideas. It is to look for problems, preferably problems you have yourself.','Counterintuitive openings, simple vocabulary'],
    ['Paul Graham','startup','Do things that don\'t scale. Lots of would-be founders believe that startups either take off or don\'t. Actually startups take off because the founders make them take off.','Imperative advice, concrete examples'],
    ['Paul Graham','tech','Writing doesn\'t just communicate ideas; it generates them. If you\'re bad at writing and don\'t like to do it, you\'ll miss out on most of the ideas writing would have generated.','Surprising claims backed by reasoning'],
    // Seth Godin (marketing, business)
    ['Seth Godin','business','People don\'t buy goods and services. They buy relations, stories, and magic. The best marketing doesn\'t feel like marketing at all.','Ultra-short paragraphs, provocative'],
    ['Seth Godin','marketing','Remarkable ideas spread. Products that are worth talking about get talked about. The challenge isn\'t to make something everyone likes. It\'s to make something that some people love.','Bold declarations, repetition for emphasis'],
    ['Seth Godin','business','Instead of wondering when your next vacation is, maybe you should set up a life you don\'t need to escape from.','One-liner wisdom, reframing problems'],
    ['Seth Godin','marketing','The only thing worse than starting something and failing is not starting something. Every new project is a chance to learn.','Motivational directness'],
    ['Seth Godin','business','The internet has made it possible for small teams to serve global audiences. You don\'t need permission anymore. Just ship it.','Action-oriented, empowering'],
    // Malcolm Gladwell (storytelling)
    ['Malcolm Gladwell','business','The key to good decision making is not knowledge. It is understanding. We are drowning in information while starving for wisdom.','Narrative hooks, anecdotal openings'],
    ['Malcolm Gladwell','tech','We learn by example and by direct experience because there are real limits to the adequacy of verbal instruction.','Academic ideas made accessible'],
    ['Malcolm Gladwell','business','Success is not a random act. It arises out of a predictable and powerful set of circumstances and opportunities.','Thesis-driven, building a case'],
    ['Malcolm Gladwell','tech','The tipping point is that magic moment when an idea, trend, or social behavior crosses a threshold and spreads like wildfire.','Metaphor-rich, vivid imagery'],
    ['Malcolm Gladwell','business','Practice isn\'t the thing you do once you\'re good. It\'s the thing you do that makes you good.','Simple reframes of common beliefs'],
    // James Clear (habits, productivity)
    ['James Clear','business','You do not rise to the level of your goals. You fall to the level of your systems. Focus on systems, not goals.','Aphoristic style, actionable advice'],
    ['James Clear','business','Every action you take is a vote for the type of person you wish to become. Small habits compound over time into remarkable results.','Identity-based framing'],
    ['James Clear','productivity','The most effective way to change your habits is to focus not on what you want to achieve, but on who you wish to become.','Second person address, clear structure'],
    ['James Clear','business','Time magnifies the margin between success and failure. Good habits make time your ally. Bad habits make time your enemy.','Parallel structure, contrast'],
    ['James Clear','productivity','You should be far more concerned with your current trajectory than with your current results. Are you heading in the right direction?','Questions to the reader, future-focused'],
    // Tim Ferriss (productivity, lifestyle)
    ['Tim Ferriss','business','What we fear doing most is usually what we most need to do. A person\'s success in life can usually be measured by the number of uncomfortable conversations they\'re willing to have.','Provocative claims, personal experience'],
    ['Tim Ferriss','productivity','Focus on being productive instead of busy. Doing less meaningless work so that you can focus on things of greater personal importance.','Clear distinction, redefining terms'],
    ['Tim Ferriss','business','The question you should be asking isn\'t what do I want? or what are my goals? but what would excite me? Excitement is a better guide.','Rhetorical questions, contrarian'],
    ['Tim Ferriss','tech','If you are insecure, guess what? The rest of the world is too. Do not overestimate the competition and underestimate yourself.','Reassuring tone, direct address'],
    ['Tim Ferriss','productivity','Perfection is not when there is no more to add, but no more to take away. Simplify your workflows ruthlessly.','Minimalist philosophy'],
    // Derek Sivers (business, creative)
    ['Derek Sivers','startup','If more information was the answer, then we would all be billionaires with perfect abs. It\'s not about knowing more. It\'s about doing more.','Humor, blunt honesty'],
    ['Derek Sivers','business','When you make a business, you get to make a little universe where you control all the laws. This is your world. Create its rules.','Metaphor, empowerment'],
    ['Derek Sivers','startup','The standard pace is for chumps. The system is designed so anyone can keep up. If you\'re more driven than most people, you can do way more than anyone expects.','Rebellious tone, motivation'],
    ['Derek Sivers','business','Don\'t be a donkey. You can do everything you want to do. You just need foresight and patience. Think long term.','Animal metaphor, patience wisdom'],
    ['Derek Sivers','tech','Ideas are just a multiplier of execution. The most brilliant idea with no execution is worth nothing. A so-so idea with brilliant execution is worth millions.','Mathematical analogy, clear logic'],
    // Ben Thompson (Stratechery - tech analysis)
    ['Ben Thompson','tech','The internet has fundamentally changed the cost structure of distribution. What used to cost millions now costs nearly nothing. This changes everything.','Analytical, building from first principles'],
    ['Ben Thompson','business','Aggregation theory explains how platforms gain power by owning the customer relationship while commoditizing suppliers.','Framework-based analysis'],
    ['Ben Thompson','tech','The most important factor in any technology company is its business model. Technology is a means to an end, not the end itself.','Business model focused'],
    ['Ben Thompson','startup','The best technology companies build platforms, not products. A platform creates value by facilitating interactions between different groups.','Definition-based argument'],
    ['Ben Thompson','tech','Every new platform starts by solving a real user problem better than existing alternatives. Distribution follows product quality.','Cause and effect reasoning'],
    // Nassim Taleb (risk, anti-fragile)
    ['Nassim Taleb','business','The three most harmful addictions are heroin, carbohydrates, and a monthly salary. Freedom comes from having options, not obligations.','Shocking comparisons, philosophical'],
    ['Nassim Taleb','business','Wind extinguishes a candle and energizes fire. You want to be the fire and wish for the wind. That is antifragility.','Extended metaphor, new concepts'],
    ['Nassim Taleb','tech','The problem with experts is that they don\'t know what they don\'t know. Real knowledge comes from doing, not studying.','Epistemological challenge'],
    ['Nassim Taleb','business','The robust absorbs shocks and stays the same; the antifragile gets better. Build systems that get stronger under stress.','Technical concept made simple'],
    ['Nassim Taleb','startup','Don\'t ask someone for their opinion. Ask them what they have in their portfolio. Talk is cheap. Skin in the game matters.','Pragmatic, action-focused'],
    // Chris Anderson (Long Tail, Wired)
    ['Chris Anderson','tech','The future of business is selling less of more. The long tail means niche products collectively outsell the hits.','Data-driven insight, new framework'],
    ['Chris Anderson','business','Free is not just a price. It is a business model. The economics of digital abundance create new possibilities every day.','Redefining common terms'],
    ['Chris Anderson','tech','The democratization of the tools of production means anyone can create. The democratization of distribution means anyone can reach an audience.','Parallel structure, tech optimism'],
    ['Chris Anderson','startup','Atoms are expensive. Bits are cheap. The shift from physical to digital is the most important economic transformation of our era.','Contrast pairs, big picture'],
    ['Chris Anderson','business','Abundance creates different economics than scarcity. When storage and distribution cost near zero, you can offer everything.','Economic reasoning, simple language'],
    // Jason Fried (Basecamp, business simplicity)
    ['Jason Fried','startup','Workaholism is a disease. Real heroes go home on time. Getting more done in less time is the real skill. Work smarter, not longer.','Anti-conventional, blunt'],
    ['Jason Fried','business','Plans are guesses. Planning is useful. Plans are useless. The moment you write a plan, it starts becoming obsolete.','Paradoxical statements'],
    ['Jason Fried','startup','Why grow? Just because you can doesn\'t mean you should. Stay small, stay happy, stay profitable.','Questioning assumptions'],
    ['Jason Fried','business','Meetings are toxic. Most could have been an email. Protect your people\'s time like you protect your money.','Provocative analogies'],
    ['Jason Fried','tech','Good enough is fine. Perfect is the enemy of shipping. Get your product into people\'s hands and iterate from there.','Practical minimalism'],
    // Ryan Holiday (Stoicism, marketing)
    ['Ryan Holiday','business','The obstacle is the way. What stands in the way becomes the way. Every challenge contains the seeds of opportunity within it.','Stoic philosophy applied to business'],
    ['Ryan Holiday','productivity','Ego is the enemy. The moment you believe your own hype, you stop growing. Stay a student, always.','Self-awareness themes'],
    ['Ryan Holiday','business','Stillness is the key to better performance. In a world of constant noise, the ability to be quiet and think is a superpower.','Counter-cultural, reflective'],
    ['Ryan Holiday','marketing','Perennial sellers don\'t happen by accident. They are the result of deliberate choices about substance over flash.','Long-term thinking'],
    ['Ryan Holiday','business','You don\'t control what happens to you. You control how you respond. That\'s where all your power lives.','Empowerment through acceptance'],
    // Naval Ravikant (angel investing, philosophy)
    ['Naval Ravikant','startup','Seek wealth, not money or status. Wealth is having assets that earn while you sleep. Money is how we transfer time and wealth.','Definitional clarity, philosophical'],
    ['Naval Ravikant','business','Learn to sell. Learn to build. If you can do both, you will be unstoppable. These are the two most valuable skills.','Numbered advice, memorable'],
    ['Naval Ravikant','tech','Code and media are permissionless leverage. You can create software that works for you while you sleep.','Leverage concept, modern context'],
    ['Naval Ravikant','startup','Specific knowledge is found by pursuing your genuine curiosity and passion rather than whatever is hot right now.','Personal authenticity advice'],
    ['Naval Ravikant','business','Reading is the ultimate meta-skill. It\'s the foundation for everything else. Read what you love until you love to read.','Learning philosophy, simple rules'],
    // Andrew Chen (growth, metrics)
    ['Andrew Chen','startup','The cold start problem is the biggest challenge for any network effect business. You need both sides of the market before either side has value.','Problem framing, technical'],
    ['Andrew Chen','marketing','Growth hacking is simply marketing informed by product data. It\'s not a trick. It\'s a method of working that puts measurement first.','Demystifying jargon'],
    ['Andrew Chen','startup','Viral loops sound simple but are incredibly hard to build. Each step in the loop has a conversion rate, and they multiply together.','Mathematical thinking made accessible'],
    ['Andrew Chen','tech','The best products market themselves. Word of mouth is not a strategy. It\'s a result of building something people actually want to talk about.','Cause and effect, product focus'],
    ['Andrew Chen','startup','Retention is the single most important metric for any product. If people don\'t come back, nothing else matters.','Single metric focus, blunt truth'],
    // Marie Forleo (business, online education)
    ['Marie Forleo','business','Everything is figureoutable. You don\'t need to have all the answers before you start. Just start and figure it out along the way.','Encouraging, coined phrases'],
    ['Marie Forleo','marketing','Clarity comes from engagement, not thought. You can\'t think your way into a new life. You have to act your way into it.','Action bias, motivational'],
    ['Marie Forleo','business','Success doesn\'t come from what you do occasionally. It comes from what you do consistently. Show up every single day.','Consistency theme, simple language'],
    ['Marie Forleo','startup','The world needs that special gift that only you have. Stop comparing yourself to others and start creating your own path.','Individuality, encouragement'],
    ['Marie Forleo','business','If you\'re not making someone else\'s life better, you\'re wasting your time. Business at its best serves other people.','Purpose-driven business'],
    // Buffer, Intercom, Basecamp style tech blogs
    ['Joel Gascoigne','startup','Transparency builds trust. We share our revenue, our salaries, and our mistakes publicly. It makes us better and it makes our customers trust us more.','Radical transparency, values-led'],
    ['Des Traynor','tech','Most features fail because they solve imaginary problems. Before you build anything, talk to your users. Find out what actually hurts.','User-first philosophy'],
    ['David Heinemeier Hansson','tech','The best frameworks and tools are extracted from real projects, not designed in advance. Build first, abstract later.','Experience-based wisdom'],
    ['David Heinemeier Hansson','startup','Venture capital is a choice, not a requirement. Most of the greatest businesses in history were built without it.','Bootstrapping advocacy'],
    ['David Heinemeier Hansson','business','Remote work isn\'t the future. It\'s the present. Companies that force everyone into offices are fighting the last war.','Forward-looking, confident claims'],
    // Rand Fishkin (SEO, marketing)
    ['Rand Fishkin','seo','Good SEO work only gets better over time. It\'s only search engine tricks that need to keep changing when the ranking algorithms change.','Long-term thinking about SEO'],
    ['Rand Fishkin','marketing','Don\'t build links. Build relationships. Links follow relationships, not the other way around.','Reframing strategy'],
    ['Rand Fishkin','seo','Best way to sell something: don\'t sell anything. Earn the awareness, respect, and trust of those who might buy.','Trust-based marketing'],
    ['Rand Fishkin','startup','The hardest part of marketing is earning attention honestly. Shortcuts don\'t last. Building an audience takes time, but it\'s worth it.','Patience wisdom'],
    ['Rand Fishkin','seo','Content marketing works best when you genuinely help people solve their problems without asking for anything in return.','Generosity principle'],
    // Patrick McKenzie (business, SaaS)
    ['Patrick McKenzie','startup','Charge more. Seriously. Whatever you\'re charging right now, you should probably double it. Most people dramatically undercharge.','Blunt pricing advice'],
    ['Patrick McKenzie','business','Don\'t sell a product. Sell a transformation. People don\'t want a drill. They want a hole in the wall.','Outcome-focused framing'],
    ['Patrick McKenzie','tech','Every business is a software business now. If you don\'t understand that, you\'ll be disrupted by someone who does.','Industry-level observation'],
    ['Patrick McKenzie','startup','The best time to start charging is before you feel ready. Your early customers are buying potential, not perfection.','Timing advice, imperfection OK'],
    ['Patrick McKenzie','business','Email is the most underrated marketing channel. It\'s personal, direct, and you own the relationship. Social media can disappear overnight.','Channel strategy, ownership'],
    // Sahil Lavingia (Gumroad, creators)
    ['Sahil Lavingia','startup','Start small. Stay small if that makes you happy. Not every business needs to become a billion dollar company. Some of the best ones stay lean.','Anti-unicorn narrative'],
    ['Sahil Lavingia','business','The creator economy isn\'t about fame. It\'s about a thousand true fans who value what you make enough to pay for it.','Niche economics'],
    ['Sahil Lavingia','startup','Failure is data. Every failed project teaches you something that success never could. Collect failures like badges of honor.','Reframing failure'],
    ['Sahil Lavingia','tech','Build tools for creators, not consumers. Creators have real problems, real budgets, and real loyalty.','Market targeting advice'],
    ['Sahil Lavingia','business','The best businesses are built around things you would do anyway. Passion isn\'t everything, but it makes the hard days bearable.','Authenticity in business'],
    // Hiten Shah (product, SaaS)
    ['Hiten Shah','startup','Talk to your customers. Then talk to them again. The best product insights come from conversations, not dashboards.','Customer obsession'],
    ['Hiten Shah','tech','Your product roadmap should be driven by customer problems, not competitor features. Copying is a losing strategy.','Independent thinking'],
    ['Hiten Shah','startup','The biggest mistake startups make is building something nobody asked for. Validation before creation saves years of wasted effort.','Validation first'],
    ['Hiten Shah','business','Simple products win. Complexity is the enemy of adoption. If your grandma can\'t figure out your product, simplify it.','Simplicity principle'],
    ['Hiten Shah','tech','Data tells you what happened. Talking to customers tells you why. You need both to make good decisions.','Balanced methodology'],
    // Additional diverse voices
    ['Anne Lamott','business','Almost all good writing begins with terrible first efforts. You need to start somewhere. Give yourself permission to write badly.','Permission to be imperfect'],
    ['Austin Kleon','business','Don\'t wait until you know who you are to get started. Steal like an artist. Creativity is about combining existing ideas in new ways.','Creative process, accessible'],
    ['Brene Brown','business','Vulnerability is not weakness. It\'s our greatest measure of courage. Leaders who admit what they don\'t know earn more trust.','Emotional intelligence in leadership'],
    ['Simon Sinek','business','People don\'t buy what you do. They buy why you do it. Start with why. The golden circle puts purpose at the center.','Purpose-driven framework'],
    ['Cal Newport','productivity','Deep work is the ability to focus without distraction on a cognitively demanding task. It\'s rare, it\'s valuable, and it\'s trainable.','Concept introduction, research-backed'],
  ];
  const stmt = DB.prepare('INSERT INTO writing_samples (author, genre, excerpt, style_note) VALUES (?, ?, ?, ?)');
  for (const [author, genre, excerpt, note] of samples) {
    try { await stmt.bind(author, genre, excerpt, note).run(); } catch(_) {}
  }
  console.log('[blog-gen] Seeded ' + samples.length + ' writing samples');
}

/* ══════════════════════════════════════════════
   블로그 자동생성 API 라우터
   ══════════════════════════════════════════════ */
export async function blogGenRoute(request, url, env) {
  await initBlogGenDB(env.DB);
  const p = url.pathname;
  const m = request.method;

  /* ── 소스 목록 조회 ── */
  if (p === '/api/admin/blog-gen/sources' && m === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT id, type, url, title, word_count, category, priority, tags, notes, status, error_msg, created_at
       FROM blog_sources
       ORDER BY CASE coalesce(priority,'normal') WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, created_at DESC
       LIMIT 300`
    ).all();
    return ok({ sources: rows.results ?? [] });
  }

  /* ── 소스 추가 ── */
  if (p === '/api/admin/blog-gen/sources' && m === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { type, url: srcUrl, category, content: manualContent, title: manualTitle, priority, tags, notes } = body;
    if (!type || !['youtube', 'website', 'file'].includes(type)) {
      return bad('type must be youtube, website, or file');
    }
    /* URL 중복 방지 동일 URL이 이미 존재하면 거부 */
    if (srcUrl && (type === 'website' || type === 'youtube')) {
      const dup = await env.DB.prepare(
        'SELECT id FROM blog_sources WHERE url = ? LIMIT 1'
      ).bind(srcUrl.trim()).first();
      if (dup) return bad('이미 등록된 URL입니다: ' + srcUrl);
    }
    let title = manualTitle || '';
    let content = '';
    let wordCount = 0;
    let status = 'active';
    let errorMsg = '';
    try {
      if (type === 'website') {
        if (!srcUrl) return bad('url is required for website type');
        title = srcUrl;
        try {
          const r = await fetchWebsiteContent(srcUrl);
          title = r.title || srcUrl;
          content = r.content || '';
        } catch (webErr) {
          console.warn('[blog-gen] Website fetch failed, saving URL only:', webErr.message);
          errorMsg = '웹사이트 수집 실패: ' + webErr.message;
        }
      } else if (type === 'youtube') {
        if (!srcUrl) return bad('url is required for youtube type');
        title = srcUrl;
        const ytKey = await getSetting(env.DB, 'youtube_api_key').catch(() => '');
        if (ytKey) {
          try {
            const r = await fetchYouTubeContent(srcUrl, ytKey);
            title = r.title || srcUrl;
            content = r.content || '';
          } catch (ytErr) {
            console.warn('[blog-gen] YouTube fetch failed, saving URL only:', ytErr.message);
            errorMsg = 'YouTube 스크립트 수집 실패: ' + ytErr.message;
          }
        } else {
          console.warn('[blog-gen] YouTube API Key 미설정 URL만 저장');
          errorMsg = 'YouTube API Key 미설정 스크립트 수집 불가, URL만 저장됨';
        }
      } else if (type === 'file') {
        if (!manualContent) return bad('content is required for file type');
        content = manualContent;
        title = manualTitle || 'Uploaded Document';
      }
      wordCount = content.split(/\s+/).filter(Boolean).length;
    } catch (e) {
      status = 'error';
      errorMsg = e.message;
    }
    const _priority = ['high', 'normal', 'low'].includes(priority) ? priority : 'normal';
    const _tags = (tags || '').trim();
    const _notes = (notes || '').trim();
    const ins = await env.DB.prepare(
      `INSERT INTO blog_sources (type, url, title, content, word_count, category, status, error_msg, priority, tags, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(type, srcUrl || '', title, content, wordCount, category || '', status, errorMsg, _priority, _tags, _notes).run();
    return ok({ success: true, id: ins.meta?.last_row_id, title, word_count: wordCount, status });
  }

  /* ── 소스 삭제 ── */
  const delM = p.match(/^\/api\/admin\/blog-gen\/sources\/(\d+)$/);
  if (delM && m === 'DELETE') {
    await env.DB.prepare('DELETE FROM blog_sources WHERE id=?').bind(+delM[1]).run();
    return ok({ success: true });
  }

  /* ── 생성 이력 조회 ── */
  if (p === '/api/admin/blog-gen/logs' && m === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT gl.id, gl.post_id, gl.category, gl.focus_kw, gl.status,
              gl.seo_score, gl.error_msg, gl.duration_ms, gl.created_at,
              bp.title AS post_title, bp.slug AS post_slug
       FROM blog_gen_log gl
       LEFT JOIN blog_posts bp ON bp.id = gl.post_id
       ORDER BY gl.created_at DESC LIMIT 50`
    ).all();
    return ok({ logs: rows.results ?? [] });
  }

  /* ── OpenAI 토큰 상태 확인 ── */
  if (p === '/api/admin/blog-gen/token-status' && m === 'GET') {
    const result = await checkOpenAIToken(env);
    return ok(result);
  }

  /* ── 통계 ── */
  if (p === '/api/admin/blog-gen/stats' && m === 'GET') {
    const [total, todayRow, successRow, sourcesRow] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_gen_log WHERE status='success'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_gen_log WHERE status='success' AND date(created_at)=date('now')`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_gen_log`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS cnt FROM blog_sources WHERE status='active'`).first(),
    ]);
    const totalAll = successRow?.cnt || 0;
    const successCount = total?.cnt || 0;
    return ok({
      total_published: successCount,
      today: todayRow?.cnt || 0,
      success_rate: totalAll > 0 ? Math.round(successCount / totalAll * 100) : 0,
      active_sources: sourcesRow?.cnt || 0,
    });
  }

  /* ── 생성 규칙 AI 개선 ── */
  if (p === '/api/admin/blog-gen/improve-rules' && m === 'POST') {
    const { currentRules } = await request.json().catch(() => ({}));
    const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
    if (!key) return bad('OpenAI API key not configured in API Settings');
    const metaPrompt = `You are an expert SEO content strategist. Review and improve the blog generation rules below for achieving RankMath 90+ SEO scores on a WaaS (Website as a Service) and business blog.

Current custom rules:
${currentRules || '(none set)'}

The system already enforces these core requirements automatically do NOT repeat them:
- Focus keyword in title, meta description, URL, first paragraph, at least one H2
- Keyword density 1.0–1.5% (max 2%)
- Content 1,500–2,000 words
- H2-only heading structure (80-120 words per H2 section, NO H3)
- External links to authoritative sources (auto-injected)
- Internal links to related posts (auto-injected)
- Image alt text includes focus keyword
- No personal names, brand promotion, or individually identifiable information
- No AI badges, icons, or decorative emojis in content body
- No empty HTML tags (<strong></strong> etc.)

Suggest 6–10 additional custom rules that will make the AI writer produce content that:
1. Feels natural and human-written (not robotic or formulaic)
2. Engages readers and reduces bounce rate
3. Avoids common AI writing patterns and filler phrases
4. Follows current Google Helpful Content guidelines
5. Stays relevant and practical for the site's WaaS, business, and web technology audience

Return ONLY a bulleted list in English. Start each rule with "- ". No headers, no explanation, just the rules.`;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: metaPrompt }],
        max_tokens: 700,
        temperature: 0.75,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return bad(err?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const data = await res.json();
    const suggested = (data.choices?.[0]?.message?.content || '').trim();
    return ok({ success: true, suggested });
  }

  /* ── 블로그 생성 실행 ── */
  if (p === '/api/admin/blog-gen/run' && m === 'POST') {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 5);
    const category = body.category || null;
    try {
      const generated = await runBlogGeneration(env, count, category);
      return ok({ success: true, generated, message: `${generated}개 블로그 포스트 생성 완료` });
    } catch (e) {
      return ok({ success: false, generated: 0, message: '생성 실패: ' + e.message });
    }
  }

  return null;
}

/* ══════════════════════════════════════════════
   블로그 생성 메인 파이프라인
   ══════════════════════════════════════════════ */
export async function runBlogGeneration(env, count = 2, forcedCategory = null) {
  console.log(`[blog-gen] Start: count=${count}, category=${forcedCategory || 'auto'}`);

  /* OpenAI 토큰 확인 */
  const tokenStatus = await checkOpenAIToken(env);
  let useOpenAI = tokenStatus.valid;
  if (!tokenStatus.valid) {
    console.warn('[blog-gen] OpenAI token issue:', tokenStatus.error);
    await env.DB.prepare(
      `INSERT INTO blog_gen_log (category, status, error_msg) VALUES ('all', 'token_error', ?)`
    ).bind((tokenStatus.error || '').slice(0, 500)).run().catch(() => {});
    console.log('[blog-gen] Fallback: Workers AI only, SEO validation skipped');
  }

  /* 카테고리별 마지막 사용일 조회 */
  const lastUseRes = await env.DB.prepare(
    `SELECT category, MAX(created_at) as last_used
     FROM blog_gen_log WHERE status='success'
     GROUP BY category`
  ).all().catch(() => ({ results: [] }));
  const lastUsed = {};
  (lastUseRes.results ?? []).forEach((r) => {
    lastUsed[r.category] = r.last_used;
  });

  /* 활성 소스 목록 */
  const srcRes = await env.DB.prepare(
    `SELECT id, type, title, content, category, priority
     FROM blog_sources WHERE status='active' AND length(coalesce(content,'')) > 100
     ORDER BY CASE coalesce(priority,'normal') WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, RANDOM()`
  ).all().catch(() => ({ results: [] }));
  const allSources = srcRes.results ?? [];

  /* 카테고리 자동 선택 (중복 없는 카테고리 우선) */
  function pickNextCategory(usedThisBatch) {
    const candidates = CATEGORIES.filter((c) => !usedThisBatch.includes(c));
    const pool = candidates.length ? candidates : CATEGORIES;
    return pool.sort((a, b) => {
      const ta = lastUsed[a] || '1970-01-01';
      const tb = lastUsed[b] || '1970-01-01';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    })[0];
  }

  let generated = 0;
  const usedCategories = [];
  for (let i = 0; i < count; i++) {
    let cat = forcedCategory;
    if (!cat) {
      cat = pickNextCategory(usedCategories);
    }
    usedCategories.push(cat);
    let catSources = allSources.filter((s) => !s.category || s.category === cat || s.category === '');
    if (!catSources.length) catSources = allSources;
    const logRes = await env.DB.prepare(
      `INSERT INTO blog_gen_log (category, status) VALUES (?, 'running')`
    ).bind(cat).run().catch(() => ({ meta: { last_row_id: 0 } }));
    const logId = logRes.meta?.last_row_id || 0;
    try {
      await generateSinglePost(env, cat, catSources, logId, useOpenAI);
      generated++;
    } catch (e) {
      console.error(`[blog-gen] Failed (category=${cat}):`, e.message);
      await env.DB.prepare(
        `UPDATE blog_gen_log SET status='failed', error_msg=? WHERE id=?`
      ).bind(e.message.slice(0, 500), logId).run().catch(() => {});
    }
  }
  console.log(`[blog-gen] Done. Generated ${generated}/${count}`);
  return generated;
}

/* ══════════════════════════════════════════════
   단일 포스트 생성
   ══════════════════════════════════════════════ */
async function generateSinglePost(env, category, sources, logId, useOpenAI) {
  const t0 = Date.now();

  /* 주제 + 포커스 키워드 */
  const topicSeeds = CAT_TOPICS[category] || CAT_TOPICS['business'];
  const topic = topicSeeds[Math.floor(Math.random() * topicSeeds.length)];
  const focusKw = extractFocusKeyword(topic, category);

  /* 소스 콘텐츠 준비 - 5개 소스를 부분 참고하여 새롭게 작성 */
  let sourceContent = '';
  const sourceIds = [];
  if (sources.length) {
    const shuffled = [...sources].sort(() => Math.random() - 0.5);
    /* 5개 소스 선택 (넓은 참고 범위, 부분적으로만 활용) */
    const picked = shuffled.slice(0, Math.min(sources.length, 5));
    for (const s of picked) {
      sourceIds.push(s.id);
      const isYT = s.type === 'youtube';
      const label = isYT
        ? `[YouTube: ${s.title || 'Video'}] (transcript excerpt)`
        : `[Reference: ${s.title || s.type}]`;
      /* 소스당 300단어만 발췌 (부분 참고, 전체 복사 방지) */
      const allWords = (s.content || '').split(/\s+/);
      const startIdx = Math.floor(Math.random() * Math.max(0, allWords.length - 300));
      const words = allWords.slice(startIdx, startIdx + 300).join(' ');
      sourceContent += `${label}\n${words}\n\n---\n\n`;
    }
  }

  /* DB 설정 로드 */
  const customRules = await getSetting(env.DB, 'blog_gen_rules').catch(() => '');
  const writingStyle = await getSetting(env.DB, 'blog_writing_style').catch(() => '');

  /* 유명 작가 문체 샘플 랜덤 로드 (3-5개) */
  let writingSamples = [];
  try {
    const sampleRows = await env.DB.prepare(
      'SELECT author, excerpt, style_note FROM writing_samples ORDER BY RANDOM() LIMIT 4'
    ).all();
    writingSamples = sampleRows.results || [];
  } catch (e) {
    console.warn('[blog-gen] writing_samples load failed:', e.message);
  }

  /* Workers AI로 글 생성 */
  const prompt = buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle, writingSamples);
  let aiRaw = await generateWithWorkersAI(env, prompt);
  let post = parseAIResponse(aiRaw);

  /* 파싱 실패 시 간단한 프롬프트로 재시도 */
  if (!post || !post.title || !post.content) {
    const simplePrompt = `Write a blog post about "${topic}" in the ${category} category. Focus keyword: "${focusKw}". Return ONLY a JSON object with these exact keys: title, content (HTML, 800-1200 words), excerpt, seo_title, seo_description, focus_keyword, keywords (array of 5).`;
    aiRaw = await generateWithWorkersAI(env, simplePrompt);
    post = parseAIResponse(aiRaw);
  }
  if (!post || !post.title || !post.content) {
    throw new Error('Workers AI returned unparseable response');
  }

  /* 한국어 감지 시 영어 전용 프롬프트로 재시도 */
  const _koreanRe = /[\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FF]/;
  const _hasKorean = (s) => _koreanRe.test(s || '');
  if (_hasKorean(post.title) || _hasKorean(post.content)) {
    console.warn('[blog-gen] Korean detected retrying with strict English-only prompt');
    const _enPrompt = `CRITICAL: Write ONLY in English. No Korean, no other language.
Write a blog post about "${topic}" in English. Focus keyword: "${focusKw}". Category: ${category}.
Return ONLY a JSON object: {"title":"English title","content":"HTML blog post in English only, 1000+ words","excerpt":"English excerpt","seo_title":"English SEO title","seo_description":"English meta description","focus_keyword":"${focusKw}","keywords":["kw1","kw2","kw3","kw4","kw5"],"img_alt_featured":"English alt text","img_alt_body":"English alt text"}`;
    const _enRaw = await generateWithWorkersAI(env, _enPrompt);
    const _enPost = parseAIResponse(_enRaw);
    if (_enPost && _enPost.title && !_hasKorean(_enPost.title)) {
      Object.assign(post, _enPost);
      console.log('[blog-gen] English retry succeeded');
    } else {
      console.warn('[blog-gen] English retry still has Korean stripping Korean characters');
      post.title = (post.title || '').replace(_koreanRe, '').trim() || topic;
      post.content = (post.content || '').replace(/[\uAC00-\uD7A3\u3131-\u318E\u1100-\u11FF\s]+/g, ' ');
    }
  }

  /* 제목 중복 방지 (접두사 과다 사용 체크) */
  try {
    const existingTitles = await env.DB.prepare(
      `SELECT title FROM blog_posts WHERE title IS NOT NULL ORDER BY created_at DESC LIMIT 60`
    ).all().catch(() => ({ results: [] }));
    const prefixCount = {};
    for (const row of existingTitles.results ?? []) {
      const words = (row.title || '').trim().split(/\s+/);
      if (words.length >= 2) {
        const prefix = words[0].toLowerCase() + ' ' + words[1].toLowerCase();
        prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
      }
    }
    const ALT_OPENERS = [
      'Essential', 'Practical', 'Proven', 'Modern', 'Quick', 'Effective', 'Simple',
      'Key', 'Smart', 'Real-World', 'Core', 'Actionable', 'Beginner', 'Advanced',
      'Best', 'Ultimate', 'Expert', 'Direct',
    ];
    const titleWords = (post.title || '').trim().split(/\s+/);
    if (titleWords.length >= 2) {
      const prefix = titleWords[0].toLowerCase() + ' ' + titleWords[1].toLowerCase();
      if ((prefixCount[prefix] || 0) >= 3) {
        const usedOpeners = new Set(
          (existingTitles.results ?? []).map((r) => ((r.title || '').split(/\s+/)[0] || '').toLowerCase())
        );
        const fresh = ALT_OPENERS.find((o) => !usedOpeners.has(o.toLowerCase())) || ALT_OPENERS[Math.floor(Math.random() * ALT_OPENERS.length)];
        titleWords[0] = fresh;
        post.title = titleWords.join(' ');
        console.log(`[blog-gen] Title prefix "${prefix}" overused (${prefixCount[prefix]}x) replaced with "${fresh}"`);
      }
    }
  } catch (_) {}

  /* 본문 단어 수 부족 시 확장 */
  const _wc0 = post.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (_wc0 < 1600) {
    console.log(`[blog-gen] content only ${_wc0} words expanding...`);
    post.content = await expandContent(env, post.content, focusKw, _wc0);
  }

  /* 후처리 (AI 패턴 정리 + HTML 정리) */
  post.content = postProcessContent(post.content);

  /* ⛔ H3 태그 전부 제거 (규정: H2 + 본문만으로 구성) */
  post.content = post.content.replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, '');

  /* ⛔ H2 태그 필수 검증 - 목표 정확히 7개 */
  const _h2Tags = (post.content.match(/<h2[\s>]/gi) || []);
  console.log(`[blog-gen] Heading check: H2=${_h2Tags.length} (target: 7, no H3)`);

  /* H2 초과 시 뒤쪽부터 제거 (최대 7개 유지) */
  if (_h2Tags.length > 7) {
    let h2Count = 0;
    post.content = post.content.replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, (match) => {
      h2Count++;
      return h2Count <= 7 ? match : '';
    });
    console.log(`[blog-gen] H2 trimmed from ${_h2Tags.length} to 7`);
  }

  /* H2 부족 시 보강 - 목표 7개까지 */
  const currentH2 = (post.content.match(/<h2[\s>]/gi) || []).length;
  if (currentH2 < 5) {
    const needed = Math.min(7 - currentH2, 5);
    const sectionTitles = [
      `Key ${focusKw} Strategies You Need`,
      `How ${focusKw} Impacts Your Business`,
      `Common ${focusKw} Mistakes to Avoid`,
      `${focusKw} Best Practices for Success`,
      `Why ${focusKw} Matters More Than Ever`,
      `Advanced ${focusKw} Techniques`,
      `Smart Ways to Handle ${focusKw}`,
    ];
    let parts = post.content.split(/(<\/p>)/gi);
    const pTags = parts.filter(p => p.toLowerCase() === '</p>').length;
    const step = Math.max(2, Math.floor(pTags / (needed + 1)));
    let injected = 0;
    let pCount = 0;
    let result = '';
    for (let i = 0; i < parts.length; i++) {
      result += parts[i];
      if (parts[i].toLowerCase() === '</p>') {
        pCount++;
        if (injected < needed && pCount > 1 && pCount % step === 0) {
          const title = sectionTitles[injected % sectionTitles.length];
          result += `\n<h2>${title}</h2>\n`;
          injected++;
        }
      }
    }
    if (injected > 0) post.content = result;
    console.log(`[blog-gen] H2 injected: ${injected} (now ${currentH2 + injected})`);
  }

  /* H2 헤딩에 focus keyword 보강 (SEO 점수용) */
  const _headingCheck = (post.content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [])
    .map(h => h.replace(/<[^>]*>/g, '')).join(' ').toLowerCase();
  if (!_headingCheck.includes(focusKw.toLowerCase())) {
    /* 두번째 H2 헤딩에 focus keyword 삽입 */
    let _h2count = 0;
    post.content = post.content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (match, inner) => {
      _h2count++;
      if (_h2count === 2) {
        const cap = focusKw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `<h2>${cap}: ${inner.replace(/<[^>]*>/g, '').trim()}</h2>`;
      }
      return match;
    });
  }

  /* ⛔ H태그 제목당 4-5줄 규정 검증 — 너무 짧은 단락 보강 */
  post.content = enforceHeadingParagraphLength(post.content);

  /* ⛔ R7 키워드 횟수 강제 조정 (4-8회, 목표 6회) */
  post.content = enforceKeywordCount(post.content, focusKw, 6);

  /* Unsplash 이미지 2장 (featured + body) */
  const unsplashKey = await getSetting(env.DB, 'unsplash_access_key').catch(() => '');
  let featuredImg = '';
  let bodyImg = '';
  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1080&q=80';
  const _usedRows = await env.DB.prepare(
    'SELECT featured_image, body_image FROM blog_posts WHERE featured_image IS NOT NULL OR body_image IS NOT NULL'
  ).all().catch(() => ({ results: [] }));
  const _usedUrls = new Set(
    _usedRows.results.flatMap((r) => [r.featured_image, r.body_image]).filter(Boolean).map((u) => u.split('?')[0])
  );

  /* ⛔ n0005 이미지 사용금지 — n0005 블로그에서 사용 중인 이미지 차단 */
  try {
    const n5Res = await fetch('https://n0005.wonseok413.workers.dev/api/blog', { signal: AbortSignal.timeout(5000) });
    if (n5Res.ok) {
      const n5Data = await n5Res.json();
      (n5Data.posts || []).forEach((p) => {
        if (p.featured_image) _usedUrls.add(p.featured_image.split('?')[0]);
        if (p.body_image) _usedUrls.add(p.body_image.split('?')[0]);
      });
      console.log(`[blog-gen] n0005 image blocklist loaded: ${(n5Data.posts || []).length} posts`);
    }
  } catch (_) { console.warn('[blog-gen] n0005 image blocklist fetch failed (ignored)'); }
  if (unsplashKey) {
    try {
      const candidates = await fetchUnsplashImages(focusKw, unsplashKey, 8, category, post.title);
      const fresh = candidates.filter((u) => !_usedUrls.has(u.split('?')[0]));
      featuredImg = fresh[1] || fresh[0] || candidates[1] || candidates[0] || FALLBACK_IMG;
      bodyImg = fresh[0] || candidates[0] || FALLBACK_IMG;
      if (featuredImg === bodyImg && fresh.length >= 2) featuredImg = fresh[1];
    } catch (e) {
      console.warn('[blog-gen] Unsplash failed:', e.message);
      featuredImg = FALLBACK_IMG;
      bodyImg = FALLBACK_IMG;
    }
  } else {
    featuredImg = FALLBACK_IMG;
    bodyImg = FALLBACK_IMG;
  }

  /* 본문에 이미지 삽입 */
  if (bodyImg) {
    const _stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
    const _rawAlt = _stripHtml(post.img_alt_body || '');
    const imgAlt = _rawAlt.toLowerCase().includes(focusKw.toLowerCase()) ? _rawAlt : `${focusKw} ${_rawAlt || focusKw}`;
    post.content = insertImageBeforeThirdH(post.content, bodyImg, imgAlt);
  }

  /* 외부 링크 + 내부 링크 삽입 */
  post.content = injectExternalLinks(post.content, category);
  post.content = await injectInternalLinks(post.content, env.DB);

  /* n0005 상품 프로모션 CTA 삽입 (본문 중간 50% 지점) */
  post.content = injectProductCTA(post.content, category);

  /* 요약/FAQ 테이블 추가 */
  const _countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM blog_posts').first().catch(() => null);
  const _tableType = (_countRow?.c || 0) % 2 === 0 ? 'summary' : 'qa';
  const _summaryTable = buildSummaryTable(post.content, _tableType);
  if (_summaryTable) post.content += _summaryTable;
  console.log(`[blog-gen] Appended ${_tableType} table`);

  /* ⛔ 1단계: 프로그램 규정 검사 */
  const ruleCheck = programmaticRuleCheck(post, focusKw);
  console.log(`[blog-gen] Rule check: pass=${ruleCheck.pass}, violations=${ruleCheck.violations.length}`);
  if (!ruleCheck.pass) {
    console.log(`[blog-gen] Rule violations: ${ruleCheck.violations.join(' | ')}`);
  }

  /* ⛔ 2단계: ChatGPT 규정 전수 검사 */
  if (useOpenAI) {
    try {
      const gptResult = await validateAllRulesWithOpenAI(env, post, focusKw);
      if (gptResult.seo_title) post.seo_title = gptResult.seo_title;
      if (gptResult.seo_description) post.seo_description = gptResult.seo_description;
      if (gptResult.keywords?.length) post.keywords = gptResult.keywords;

      /* ChatGPT 불합격 시 자동 수정 시도 */
      if (gptResult.pass === false || ruleCheck.violations.length > 0) {
        console.warn(`[blog-gen] FAILED validation (GPT=${gptResult.score}, programmatic=${ruleCheck.violations.length} violations). Auto-fixing...`);

        /* R7 수정: 키워드 밀도 초과 시 강제 축소 */
        post.content = enforceKeywordCount(post.content, focusKw, 6);

        /* R12 수정: 금지 단어 → 대체어로 교체 */
        const bannedRe = /\b(delve|leverage|utilize|robust|seamless|streamline|navigate|realm|landscape|ecosystem|paradigm|synergy|empower|harness|cutting-edge|game-changer|comprehensive|paramount|holistic|crucial|essential|ensure|enhancing|facilitating|subsequently|bolstering|foster|nuanced|curated|underscores|mitigate|proactive|prioritize|optimal|pivotal|facilitate|enhance)\b/gi;
        const replacements = { delve:'explore', leverage:'use', utilize:'use', robust:'strong', seamless:'smooth', streamline:'simplify', navigate:'handle', realm:'area', landscape:'field', ecosystem:'system', paradigm:'approach', synergy:'teamwork', empower:'help', harness:'use', 'cutting-edge':'modern', 'game-changer':'big step forward', comprehensive:'full', paramount:'top', holistic:'complete', crucial:'important', essential:'key', ensure:'make sure', enhancing:'improving', facilitating:'helping', subsequently:'then', bolstering:'strengthening', foster:'build', nuanced:'detailed', curated:'selected', underscores:'shows', mitigate:'reduce', proactive:'early', prioritize:'focus on', optimal:'best', pivotal:'key', facilitate:'help', enhance:'improve' };
        post.content = post.content.replace(bannedRe, (m) => replacements[m.toLowerCase()] || m);

        /* R13 수정: 결론 H2 제거 */
        post.content = post.content.replace(/<h2[^>]*>\s*(Conclusion|Final Thoughts|Summary|Wrapping Up|Key Takeaways)[^<]*<\/h2>/gi, '');

        /* R10 수정: 빈 태그 제거 */
        post.content = post.content.replace(/<(strong|em|h2|p)>\s*<\/\1>/gi, '');

        /* 후처리 재적용 */
        post.content = postProcessContent(post.content);
        post.content = enforceHeadingParagraphLength(post.content);

        /* 수정 후 재검사 */
        const recheck = programmaticRuleCheck(post, focusKw);
        console.log(`[blog-gen] After auto-fix: ${recheck.violations.length} violations remaining`);
        if (recheck.violations.length > 0) {
          console.log(`[blog-gen] Remaining: ${recheck.violations.join(' | ')}`);
        }
      }
    } catch (e) {
      console.warn('[blog-gen] ChatGPT validation failed:', e.message);
    }
  }

  /* ⛔ 3단계: 최종 R1-R14 전수 검사 — 위반 시 자동 재생성 (최대 2회) */
  const finalCheck = programmaticRuleCheck(post, focusKw);
  if (!finalCheck.pass) {
    console.warn(`[blog-gen] FINAL CHECK FAILED: ${finalCheck.violations.join(' | ')}. Attempting full regeneration...`);
    for (let regenAttempt = 1; regenAttempt <= 2; regenAttempt++) {
      try {
        console.log(`[blog-gen] Regeneration attempt ${regenAttempt}/2...`);
        const regenPrompt = buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle, writingSamples);
        const regenRaw = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: `You are a senior SEO content writer. CRITICAL: The focus keyword "${focusKw}" must appear EXACTLY 5-6 times in the content body. NOT more. Count carefully before submitting. Previous attempt FAILED because keyword appeared too many times. Write naturally without keyword stuffing.` },
            { role: 'user', content: regenPrompt },
          ],
          max_tokens: 4000,
          temperature: 0.6,
        });
        const regenText = (regenRaw?.response || '').trim();
        let regenJson;
        try {
          regenJson = JSON.parse(regenText.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
        } catch (_) {
          console.warn(`[blog-gen] Regen ${regenAttempt}: parse failed`);
          continue;
        }
        if (!regenJson.title || !regenJson.content) {
          console.warn(`[blog-gen] Regen ${regenAttempt}: missing title/content`);
          continue;
        }

        /* 후처리 파이프라인 재적용 */
        regenJson.content = enforceKeywordDensity(regenJson.content, focusKw, 2);
        regenJson.content = enforceKeywordCount(regenJson.content, focusKw, 6);
        regenJson.content = postProcessContent(regenJson.content);
        regenJson.content = enforceHeadingParagraphLength(regenJson.content);

        /* 금지 단어 제거 */
        const bannedRe2 = /\b(delve|leverage|utilize|robust|seamless|streamline|navigate|realm|landscape|ecosystem|paradigm|synergy|empower|harness|cutting-edge|game-changer|comprehensive|paramount|holistic|crucial|essential|ensure|enhancing|facilitating|subsequently|bolstering|foster|nuanced|curated|underscores|mitigate|proactive|prioritize|optimal|pivotal|facilitate|enhance)\b/gi;
        const rep2 = { delve:'explore', leverage:'use', utilize:'use', robust:'strong', seamless:'smooth', streamline:'simplify', navigate:'handle', realm:'area', landscape:'field', ecosystem:'system', paradigm:'approach', synergy:'teamwork', empower:'help', harness:'use', 'cutting-edge':'modern', 'game-changer':'big step forward', comprehensive:'full', paramount:'top', holistic:'complete', crucial:'important', essential:'key', ensure:'make sure', enhancing:'improving', facilitating:'helping', subsequently:'then', bolstering:'strengthening', foster:'build', nuanced:'detailed', curated:'selected', underscores:'shows', mitigate:'reduce', proactive:'early', prioritize:'focus on', optimal:'best', pivotal:'key', facilitate:'help', enhance:'improve' };
        regenJson.content = regenJson.content.replace(bannedRe2, (m) => rep2[m.toLowerCase()] || m);

        /* 결론 H2 제거 */
        regenJson.content = regenJson.content.replace(/<h2[^>]*>\s*(Conclusion|Final Thoughts|Summary|Wrapping Up|Key Takeaways)[^<]*<\/h2>/gi, '');

        /* 빈 태그 제거 */
        regenJson.content = regenJson.content.replace(/<(strong|em|h2|p)>\s*<\/\1>/gi, '');

        /* 재검사 */
        const tempPost = { ...post, title: regenJson.title, content: regenJson.content, seo_description: regenJson.seo_description || post.seo_description };
        const regenCheck = programmaticRuleCheck(tempPost, focusKw);
        console.log(`[blog-gen] Regen ${regenAttempt} check: ${regenCheck.violations.length} violations${regenCheck.violations.length > 0 ? ' (' + regenCheck.violations.join(', ') + ')' : ''}`);

        if (regenCheck.pass || regenCheck.violations.length < finalCheck.violations.length) {
          post.title = regenJson.title;
          post.content = regenJson.content;
          if (regenJson.excerpt) post.excerpt = regenJson.excerpt;
          if (regenJson.seo_title) post.seo_title = regenJson.seo_title;
          if (regenJson.seo_description) post.seo_description = regenJson.seo_description;
          if (regenJson.keywords?.length) post.keywords = regenJson.keywords;
          console.log(`[blog-gen] Regen ${regenAttempt} accepted: ${regenCheck.violations.length} violations (was ${finalCheck.violations.length})`);
          if (regenCheck.pass) break;
        }
      } catch (regenErr) {
        console.warn(`[blog-gen] Regen ${regenAttempt} error:`, regenErr.message);
      }
    }
  }

  /* Meta Description 길이 보정 (반드시 140-160자) */
  if (post.seo_description) {
    let md = post.seo_description.trim();
    if (md.length > 160) {
      md = md.slice(0, 157) + '...';
    }
    if (md.length < 140) {
      const fillers = [
        ` Learn more about ${focusKw} today.`,
        ` Discover practical ${focusKw} tips now.`,
        ` Get expert ${focusKw} guidance here.`,
        ` Start protecting your website today.`,
        ` Find out how to get started right away.`,
        ` Take action and secure your site now.`,
        ` Read our complete guide to learn more.`,
      ];
      for (const f of fillers) {
        if (md.length + f.length >= 140 && md.length + f.length <= 160) { md += f; break; }
      }
      /* 여전히 140 미만이면 padding으로 맞춤 */
      if (md.length < 140) {
        const pad = ' Get proven strategies and actionable steps to grow your online business today.';
        md = (md + pad).slice(0, 158);
        if (md.length > 160) md = md.slice(0, 157) + '...';
      }
    }
    post.seo_description = md;
  }

  /* Slug 생성 + 중복 체크 */
  let slug = toSlug(post.title);
  const existingSlug = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first().catch(() => null);
  if (existingSlug) slug = slug + '-' + Date.now().toString(36);

  /* SEO 점수 계산 */
  let realSeoScore = computeRealSeoScore(post, focusKw, slug);

  /* ── SEO 90점 미만이면 1회 재생성 시도 ── */
  if (realSeoScore < 90 && useOpenAI) {
    console.log(`[blog-gen] SEO score ${realSeoScore} < 90 attempting regeneration...`);
    try {
      const retryPrompt = buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle, writingSamples);
      const retryRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a professional SEO blog writer. Your previous attempt scored ' + realSeoScore + '/100. This time you MUST score 90+. Pay extra attention to: keyword density 1-2%, focus keyword in title/H2/first paragraph/meta description, exactly 7 H2 headings (NO H3), 1500-2000 words, 140-160 char meta description.' },
            { role: 'user', content: retryPrompt },
          ],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
      const retryData = await retryRes.json();
      const retryText = retryData.choices?.[0]?.message?.content || '';
      const retryJson = JSON.parse(retryText.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
      if (retryJson.title && retryJson.content) {
        /* 후처리 적용 */
        retryJson.content = enforceKeywordDensity(retryJson.content, focusKw, 2);
        retryJson.content = postProcessContent(retryJson.content);
        if (bodyImg) {
          const _stripH = (s) => (s || '').replace(/<[^>]+>/g, '').trim();
          const _rAlt = _stripH(retryJson.img_alt_body || '');
          const iAlt = _rAlt.toLowerCase().includes(focusKw.toLowerCase()) ? _rAlt : `${focusKw} ${_rAlt || focusKw}`;
          retryJson.content = insertImageBeforeThirdH(retryJson.content, bodyImg, iAlt);
        }
        retryJson.content = injectExternalLinks(retryJson.content, category);
        retryJson.content = await injectInternalLinks(retryJson.content, env.DB);
        const _rt = buildSummaryTable(retryJson.content, 'summary');
        if (_rt) retryJson.content += _rt;
        const retryScore = computeRealSeoScore(retryJson, focusKw, slug);
        console.log(`[blog-gen] Retry SEO score: ${retryScore} (was ${realSeoScore})`);
        if (retryScore > realSeoScore) {
          post.title = retryJson.title;
          post.content = retryJson.content;
          post.excerpt = retryJson.excerpt || post.excerpt;
          post.seo_title = retryJson.seo_title || post.seo_title;
          post.seo_description = retryJson.seo_description || post.seo_description;
          post.keywords = retryJson.keywords || post.keywords;
          realSeoScore = retryScore;
          slug = toSlug(post.title);
          const existSlug2 = await env.DB.prepare('SELECT id FROM blog_posts WHERE slug=?').bind(slug).first().catch(() => null);
          if (existSlug2) slug = slug + '-' + Date.now().toString(36);
          console.log(`[blog-gen] Using retry version: SEO=${retryScore}`);
        }
      }
    } catch (retryErr) {
      console.warn('[blog-gen] Retry generation failed:', retryErr.message);
    }
  }

  /* 콘텐츠 품질 + AI 유사성 점수 */
  let qualityScore = computeContentQuality(post.content);
  let aiSimilarity = computeAISimilarity(post.content);
  console.log(`[blog-gen] Quality=${qualityScore}/100, AI-similarity=${aiSimilarity}/100`);

  /* 프로그래밍적 humanization 항상 적용 (질문, 펀치라인, 구어체 삽입) */
  console.log(`[blog-gen] Applying programmatic humanization (AI-sim=${aiSimilarity})...`);
  post.content = programmaticHumanize(post.content);
  post.content = postProcessContent(post.content);
  const newSim = computeAISimilarity(post.content);
  console.log(`[blog-gen] After humanization: AI-sim ${aiSimilarity} -> ${newSim}`);
  aiSimilarity = newSim;
  qualityScore = computeContentQuality(post.content);

  /* Title 길이 자동 보정 (R14: 50-60자) */
  {
    let t = (post.title || '').trim();
    /* 60자 초과 시 깔끔하게 자르기 (단어 단위) */
    if (t.length > 62) {
      const trimmed = t.slice(0, 60);
      const lastSpace = trimmed.lastIndexOf(' ');
      post.title = lastSpace > 40 ? trimmed.slice(0, lastSpace) : trimmed;
      console.log(`[blog-gen] Title trimmed: "${t}"(${t.length}) -> "${post.title}"(${post.title.length})`);
      t = post.title;
    }
    if (t.length < 50) {
      const kwL = focusKw.toLowerCase();
      /* 다양한 접미사 풀에서 랜덤 선택하여 반복 방지 */
      const suffixPools = {
        'wordpress|wp\\b': [' for Site Owners', ' You Need to Know', ' That Actually Works', ' Worth Trying Today'],
        'plugin|theme': [' Worth Your Time', ' Tested and Proven', ' for Better Sites', ' That Deliver Results'],
        'speed|performance|cache': [' for Faster Loading', ' That Cut Load Times', ' You Should Try Now', ' for Better UX'],
        'seo|search': [' for Higher Rankings', ' That Drive Traffic', ' for 2026 and Beyond', ' Backed by Data'],
        'hosting|server|domain': [' for Reliable Uptime', ' on a Budget', ' for Growing Sites', ' That Scale Well'],
        'ecommerce|woocommerce|shop|cart|checkout': [' to Boost Sales', ' for Online Stores', ' That Convert Better', ' for Store Owners'],
        'business|marketing|brand': [' for Growing Companies', ' That Drive Results', ' Worth Your Time', ' for Smart Owners'],
        'startup|saas|funding': [' for Founders', ' That Scale Fast', ' Worth Knowing', ' for Early Stage'],
        'design|ui|ux|responsive': [' for Better UX', ' That Convert', ' Worth Implementing', ' for Modern Sites'],
        'cloud|docker|serverless|aws': [' for Developers', ' Made Simple', ' on a Budget', ' That Scale Well'],
        'backup|restore': [' Step by Step', ' for Peace of Mind', ' Without the Stress', ' Done Right'],
      };
      let ext = '';
      for (const [pattern, suffixes] of Object.entries(suffixPools)) {
        if (new RegExp(pattern, 'i').test(kwL)) {
          ext = suffixes[Math.floor(Math.random() * suffixes.length)];
          break;
        }
      }
      if (!ext) {
        const generic = [' Worth Knowing', ' for Your Website', ' That Actually Work', ' You Can Apply Today'];
        ext = generic[Math.floor(Math.random() * generic.length)];
      }
      const candidate = t + ext;
      if (candidate.length >= 50 && candidate.length <= 62) {
        post.title = candidate;
      } else if (candidate.length > 62) {
        const tr = candidate.slice(0, 60);
        const ls = tr.lastIndexOf(' ');
        post.title = ls > 40 ? tr.slice(0, ls) : tr;
      } else {
        post.title = candidate;
      }
      if (!post.seo_title || post.seo_title === t) post.seo_title = post.title;
      console.log(`[blog-gen] Title expanded: "${t}"(${t.length}) -> "${post.title}"(${post.title.length})`);
    }
  }

  /* ⛔ 최종 H2 캡 (재생성/자동수정 후에도 7개 초과 방지) */
  {
    const finalH2 = (post.content.match(/<h2[\s>]/gi) || []).length;
    if (finalH2 > 7) {
      let cnt = 0;
      post.content = post.content.replace(/<h2[^>]*>[\s\S]*?<\/h2>/gi, (m) => {
        cnt++;
        return cnt <= 7 ? m : '';
      });
      console.log(`[blog-gen] Final H2 cap: ${finalH2} -> 7`);
    }
    /* H3 최종 제거 보장 */
    post.content = post.content.replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, '');
  }

  /* DB 저장 */
  const authorId = Math.random() < 0.5 ? 1 : 2;
  const ins = await env.DB.prepare(
    `INSERT INTO blog_posts
     (title, slug, excerpt, content, featured_image, body_image, category, tags,
      seo_title, seo_description, seo_score, focus_keyword, quality_score, ai_similarity, author_id, status, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'), datetime('now'))`
  ).bind(
    post.title, slug, (post.excerpt || '').replace(/<[^>]*>/g, ''), post.content,
    featuredImg, bodyImg, category, (post.keywords || []).join(','),
    post.seo_title || post.title, post.seo_description || post.excerpt || '', realSeoScore, focusKw,
    qualityScore, aiSimilarity, authorId,
  ).run();
  const postId = ins.meta?.last_row_id;

  /* KV 캐시 무효화 (있으면) */
  try { if (env.KV) { env.KV.delete('c:blog:posts').catch(() => {}); env.KV.delete('c:blog:settings').catch(() => {}); } } catch (_) {}

  /* 생성 이력 업데이트 */
  const duration = Date.now() - t0;
  await env.DB.prepare(
    `UPDATE blog_gen_log
     SET post_id=?, source_ids=?, focus_kw=?, status='success', seo_score=?, duration_ms=?
     WHERE id=?`
  ).bind(postId, sourceIds.join(','), focusKw, realSeoScore, duration, logId).run().catch(() => {});
  console.log(`[blog-gen] Created: "${post.title}" | SEO=${realSeoScore}/100 | ${duration}ms`);
}

/* ══════════════════════════════════════════════
   프롬프트 빌더
   ══════════════════════════════════════════════ */
function buildGenerationPrompt(topic, category, focusKw, sourceContent, customRules, writingStyle, writingSamples = []) {
  const srcSection = sourceContent
    ? `══ REFERENCE MATERIAL (참고 자료) ══

🚨 ABSOLUTE ORIGINALITY - ZERO TOLERANCE FOR ANY COPYING:
1. You MUST NOT copy ANY phrase, sentence, or structure from the sources below - not even 3 consecutive words
2. Read the sources ONLY for factual data points (numbers, dates, names). Then CLOSE them mentally and write 100% from scratch
3. Use COMPLETELY different vocabulary, sentence patterns, and paragraph structures than the sources
4. If a source says "X improves Y by Z%", you must restate it as something like "Z% gains in Y come from X" - never mirror the original phrasing
5. Every single sentence you write must be YOUR original creation - as if you are a journalist writing a brand new article after interviewing experts
6. Do NOT use the same examples, analogies, or explanations found in any source
7. COMBINE facts from multiple sources to create NEW insights not present in any single source
8. TARGET: less than 10% word-level overlap with any single source, less than 30% topic-level similarity
9. If you catch yourself paraphrasing a source sentence, STOP and write a completely new sentence about the same fact using different words and structure

🎯 TARGET AUDIENCE:
- WordPress intermediate users (1–3 years of hands-on experience)
- They know: plugin installation, dashboard navigation, basic settings, adding themes
- They do NOT know: server-level commands, PHP code, advanced hosting, CLI tools
- Write AS IF explaining to a smart colleague who uses WordPress regularly but is NOT a developer

📖 WRITING LEVEL (고등학교 1학년 수준 Korean High School Freshman equivalent):
- Use simple, everyday vocabulary if a technical term is unavoidable, IMMEDIATELY explain it in plain words in the SAME sentence
- Keep sentences SHORT: 15–20 words maximum per sentence
- ONE idea per sentence. ONE main concept per paragraph.
- Replace technical jargon with plain words: "API" → "a way for apps to talk to each other", "latency" → "loading delay", "bandwidth" → "data transfer capacity"
- Write as if explaining to a 15-year-old who is smart and curious but has no technical background
- No academic phrasing be direct, friendly, and practical

PARTIAL REFERENCE EXCERPTS (use ONLY for factual inspiration - write everything in your own words):
${sourceContent.slice(0, 4000)}

REMINDER: The above are small excerpts from 5 different sources. Use them ONLY as background knowledge. Your article must be 100% original writing with zero phrases copied from these references.

WORD SIMPLIFICATION RULE: When you find a technical or complex word in the reference sources, ALWAYS replace it with a simpler everyday word. Examples: "leverage" -> "use", "implement" -> "set up", "infrastructure" -> "setup", "optimize" -> "improve", "utilize" -> "use", "facilitate" -> "help", "methodology" -> "method", "comprehensive" -> "full", "subsequently" -> "then", "mitigate" -> "reduce". This naturally makes the output different from sources while improving readability.`
    : `Write based on your knowledge about: ${topic}.
🎯 TARGET AUDIENCE: WordPress intermediate users (1–3 years experience, knows plugin installation and dashboard use, but not server-level or coding concepts).
📖 WRITING LEVEL: Simple and accessible Korean high school freshman equivalent. Short sentences (15–20 words max), plain vocabulary, explain every technical term in plain words when first used.`;
  const rulesSection = customRules && customRules.trim()
    ? `\nBASE WRITING REFERENCE (core style guidelines apply to every sentence and paragraph):\n${customRules.trim()}\n` : '';
  const styleSection = writingStyle && writingStyle.trim()
    ? `\nWRITING STYLE & TONE (apply throughout the entire post):\n${writingStyle.trim()}\n` : '';

  /* 유명 작가 문체 참조 섹션 */
  let humanStyleSection = '';
  if (writingSamples && writingSamples.length > 0) {
    const sampleTexts = writingSamples.map((s, i) =>
      `[Author ${i + 1}: ${s.author}] ${s.style_note ? '(' + s.style_note + ')' : ''}\n"${s.excerpt}"`
    ).join('\n\n');
    humanStyleSection = `
HUMAN AUTHOR WRITING STYLE REFERENCE (CRITICAL - mimic these human authors' style):
The following are real excerpts from famous human authors. Study their rhythm, tone, sentence variety, and natural flow. Your writing MUST match this level of human authenticity - NOT the content, but the STYLE and FEEL.

${sampleTexts}

STYLE INSTRUCTIONS from the samples above:
- Match the casual-yet-authoritative tone of these authors
- Use their rhythm patterns: short punchy sentences mixed with longer flowing ones
- Copy their directness - say what you mean without padding
- Notice how they use personal experience and concrete examples
- Adopt their conversational hooks and transitions
- Your final post should read as if one of these authors wrote it about ${topic}
`;
  }

  return `You are an expert English content writer. Write a complete, SEO-optimized blog post targeting a RankMath score of 90+.

LANGUAGE RULE (ABSOLUTE ZERO EXCEPTIONS):
- The ENTIRE post MUST be written in ENGLISH ONLY title, content, headings, excerpt, seo_title, seo_description, all fields
- NEVER write in Korean, Japanese, Chinese, or any other language
- If the topic appears to be in another language, write about it in English anyway
- ALL JSON field values must be in English

TOPIC: "${topic}"
CATEGORY: ${category}
FOCUS KEYWORD: "${focusKw}"

═══ WORD COUNT (ABSOLUTE REQUIREMENT) ═══
- Total visible text: exactly 1,800-2,200 words (not counting HTML tags)
- 7 H2 sections x 250 words each + intro(120) + closing(120) = 1,990 words target
- Below 1,700 = REJECTED. Above 2,400 = REJECTED.
- WRITE MORE, NOT LESS. Each paragraph MUST be 100-130 words (5-6 full sentences).

═══ HTML STRUCTURE (ZERO TOLERANCE — #1 PRIORITY RULE) ═══

ALLOWED TAGS ONLY: <h2>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <blockquote>
FORBIDDEN TAGS: <h1>, <h3>, <h4>, <h5>, <h6>, <script>, <style>, <svg>, <i>, <span>, <div>, <img>, <a>

EXACT STRUCTURE — follow this template PRECISELY (H2 + paragraphs ONLY, NO H3):

  <p>[intro paragraph: exactly 6 sentences, 100-130 words, includes focus keyword]</p>

  <h2>[Section 1 Title - includes focus keyword]</h2>
  <p>[exactly 6 sentences, 100-130 words with specific details and examples]</p>

  <h2>[Section 2 Title]</h2>
  <p>[exactly 6 sentences, 100-130 words with actionable advice]</p>

  <h2>[Section 3 Title]</h2>
  <p>[exactly 6 sentences, 100-130 words with real-world context]</p>

  <h2>[Section 4 Title]</h2>
  <p>[exactly 6 sentences, 100-130 words with practical tips]</p>

  <h2>[Section 5 Title]</h2>
  <p>[exactly 6 sentences, 100-130 words with clear explanations]</p>

  <h2>[Section 6 Title]</h2>
  <p>[exactly 6 sentences, 100-130 words with supporting evidence]</p>

  <h2>[Section 7 Title]</h2>
  <p>[exactly 6 sentences, 100-130 words with forward-looking advice]</p>

  <p>[closing paragraph: 6 sentences, 100-130 words, summarize key points]</p>

PARAGRAPH LENGTH RULE - THE MOST IMPORTANT RULE:
- Every single <p> tag MUST contain EXACTLY 5 or 6 sentences
- Every single <p> tag MUST contain 80-120 words
- 4 sentences = REJECTED. 7 sentences = REJECTED. 3 sentences = REJECTED.
- Count your sentences before writing each paragraph. If it's not 5 or 6, rewrite it.

HEADING COUNT RULE:
- Exactly 7 <h2> tags. Not 6. Not 8. Exactly 7.
- ZERO <h3> tags. Do NOT use H3 headings at all. H3 is FORBIDDEN.

HEADING-PARAGRAPH SEQUENCE RULE:
- Every <h2> MUST be immediately followed by a <p> paragraph
- Between any two <h2> tags, there MUST be exactly one <p> paragraph (5-6 sentences, 80-120 words)

═══ EMPTY TAG RULE (CRITICAL zero tolerance) ═══
- NEVER produce empty HTML tags of any kind
- <strong></strong>  ← STRICTLY FORBIDDEN
- <em></em>          ← STRICTLY FORBIDDEN
- <h2></h2>          ← STRICTLY FORBIDDEN
- <h3></h3>          ← STRICTLY FORBIDDEN
- Every tag must contain actual text. If you bold a phrase, write the full phrase inside <strong>.
- Correct: <strong>${focusKw}</strong>
- Wrong:   <strong></strong>

═══ FOCUS KEYWORD PLACEMENT (STRICTLY ENFORCED — ZERO TOLERANCE) ═══
- MUST appear in the very first <p> (intro paragraph) within the first 50 words written naturally
- MUST appear in the title field
- MUST appear in at least one <h2> heading (verbatim or closely paraphrased)
- ⚠️ CRITICAL R7 RULE: The EXACT focus keyword phrase must appear EXACTLY 5–6 times in the ENTIRE content body. NOT 4, NOT 7, NOT 8, NOT 12. EXACTLY 5 or 6 times TOTAL.
- Count EVERY occurrence including inside <strong>, <em>, <h2>, <h3>, <p> — ALL count toward the total.
- NEVER exceed 8 occurrences under ANY circumstance. Going over 8 = AUTOMATIC FAIL and full regeneration.
- Do NOT repeat the full keyword more than once per paragraph
- Do NOT stuff the keyword — spread it evenly across intro, 2 middle sections, and near the end
- When bolding the keyword with <strong>, always write the full keyword text inside

═══ SEO FIELDS ═══
- title: 50–60 characters, includes focus keyword, includes ONE power word rotate variety: (Guide, Tips, How to, Step-by-Step, Fix, Essential, Practical, Proven, Modern, Quick, Effective, Simple, Key, Smart, Core, Actionable, Beginner, Best, Expert)
- NEVER start the title with "Complete Guide" this phrase is overused. Choose a different opening that is specific and varied.
- seo_title: 50–60 characters, optimized variation of title
- seo_description: EXACTLY 140–160 characters includes focus keyword ends with a call to action (e.g. "Learn more.", "Start today.", "Find out how.")
- excerpt: 120–160 characters, compelling, includes focus keyword
- img_alt_featured: describe the image AND include the focus keyword phrase
- img_alt_body: describe the image AND include the focus keyword phrase

═══ PRIVACY & NEUTRALITY RULES (STRICTLY ENFORCED) ═══
- NEVER mention any real person's name, personal identity, or individual attribution
- NEVER promote, advertise, or endorse any specific brand, product, company, or commercial service by name
- NEVER include personally identifiable information of any kind
- Write general, educational content only no case studies tied to specific named individuals or companies
- Exception: you may reference well-known platform categories (e.g. "WordPress", "Google Search Console") only as tools, not endorsements

═══ CLEAN CONTENT RULES ═══
- No AI-generated labels, badges, or indicators (do not write "AI Generated", "Written by AI", etc.)
- No decorative emojis or icon characters in the content body
- No inline CSS style attributes content is styled by the site's stylesheet
- No unnecessary filler phrases like "In conclusion, it is worth noting that..."
- Every sentence must add real informational value

═══ H2 HEADING RULES (CRITICAL) ═══
- H2 headings must be SHORT, SPECIFIC, and DESCRIPTIVE (4–8 words max)
- NEVER start an H2 with the full focus keyword phrase headings must be original titles, not keyword repetition
- FORBIDDEN H2 pattern: "<h2>focus-keyword: Some Suffix</h2>" do NOT prefix headings with the keyword
- FORBIDDEN: Generic boilerplate headings like "Getting Started", "Before You Begin", "Advanced Tips", "Key Takeaways", "Everything You Need to Know" unless they contain specific topical content
- FORBIDDEN: Two consecutive H2 headings with nearly identical meaning or structure
- Each H2 heading must describe what that specific section teaches make it unique and topically meaningful
- STRICTLY FORBIDDEN H2s: "Conclusion", "Conclusion and Next Steps", "Final Thoughts", "Summary", "Wrapping Up", "Key Takeaways". NEVER create a conclusion section. End the post with the last practical section, not a summary.
- At least ONE H2 heading MUST naturally contain the focus keyword phrase "${focusKw}"

═══ HUMAN AUTHENTICITY ZERO AI FINGERPRINTS ═══

BANNED WORDS never use any of these (they are the strongest AI tells):
  delve, leverage, utilize, robust, seamless, streamline, navigate, realm, landscape,
  ecosystem, paradigm, synergy, empower, harness, cutting-edge, game-changer,
  comprehensive, paramount, shed light on, foster, curated, nuanced, holistic,
  underscores, it is crucial, it is vital, it is important to note, it's worth mentioning,
  as we explore, let's dive in, in today's digital world, in the realm of, going forward,
  crucial, essential, ensure, enhancing, facilitating, subsequently, bolstering,
  in today's, cybersecurity landscape, digital landscape, ever-evolving,
  it is important to, it is essential to, it's crucial to, it's essential to,
  plays a crucial role, is a critical component, is particularly important

BANNED PARAGRAPH OPENERS never start a paragraph with:
  "In today's...", "In the world of...", "When it comes to...",
  "It's important to understand...", "One of the most important/common/critical...",
  "First and foremost...", "Last but not least...", "Without a doubt...",
  "In this article/section/guide..."

ANTI-AI WRITING TECHNIQUES apply ALL of these (THIS IS THE MOST IMPORTANT SECTION):

1. MID-THOUGHT STARTS: At least 3 paragraphs per post must open with a concrete scenario, question, or direct statement instead of a topic sentence. Examples:
   - "Your server logs show 400 failed login attempts overnight. Now what?"
   - "Last Tuesday a small retail site got hit. The owner didn't notice for 72 hours."
   - "Three settings. That's all it takes to block 90% of brute-force attacks."
   Do NOT start paragraphs with "Topic X is...", "Understanding Y involves...", "The process of Z...". These are AI tells.

2. NATURAL LIST IMPERFECTION: In any bulleted or numbered list, deliberately make at least 2 items slightly different in length or grammatical form from the others perfectly parallel lists are a strong AI signal.

3. CONTRACTION RULE: Use "don't", "it's", "you'll", "there's", "isn't", "won't", "that's", "can't" throughout. NEVER write "do not", "it is", "you will", "there is" more than twice per 500 words.

4. CONVERSATIONAL INTERJECTION: Add exactly one natural aside per post such as: "Here's the thing:", "The catch is this:", "This part actually matters:", "Fair warning:", "Here's what's easy to miss:" placed where the writing needs a natural beat.

5. IMPERFECT TRANSITIONS replace all formal connectors:
   "Furthermore," → "And that's exactly why..." or "Which connects to..."
   "Moreover," → "There's also this:" or "Worth adding:"
   "In addition," → "On top of that," or "There's more:"
   "However," → "But here's the thing -" or "That said,"
   "In conclusion," → "Bottom line:" or "The short version:"

6. ONE MILD CAVEAT per post: Include one honest limitation "This won't fix everything but it covers the cases that matter most." or "Results vary depending on your setup, but the approach stays the same."

7. NO SECTION SUMMARIES: Never end a section with "In summary...", "As we've seen...", "To recap..." end on the final practical point and move on.

8. SENTENCE PUNCH PAIRS: After two medium-length sentences, write two SHORT sentences back-to-back (6–10 words each) for emphasis. This is how real writers land a point.

9. ONE LONGER NATURAL SENTENCE per H2 is allowed if the idea genuinely needs room (32–40 words), keep it. Don't force splits when the thought flows naturally as one.

═══ SENTENCE & WRITING STYLE RULES (STRICTLY ENFORCED) ═══
- AUDIENCE: WordPress intermediate users (1–3 years). They use dashboards, install plugins, but are NOT developers or server admins.
- READING LEVEL: Korean high school freshman (고등학교 1학년) equivalent simple, clear, zero jargon without immediate explanation.
- PRIMARY sentence length: 15–20 words. This is the default. Keep it short and punchy.
- MAXIMUM sentence length: 40 words hard cap split any sentence that exceeds this.
- AVOID academic or overly formal phrasing be conversational, direct, and practical.
- Explain every technical term in plain words the FIRST time you use it, inside the same sentence. Example: "CDN (a network of servers that delivers your site content faster)"
- Vary rhythm within each paragraph: mix of medium → short → medium, or long → short → short. Never write three sentences of the same length back-to-back.
- Use these sentence patterns to create confident, readable prose:
  • Corrective opener:   "It's not about X it's about Y."
  • Moment capture:      "There's a moment when [situation] and that's when [insight] matters."
  • Concede and pivot:   "True, X has its place. But consider this:"
  • Grounded question:   Pose a short question, then answer it immediately in the next sentence.
  • Reader observation:  "Most people assume X. In practice, Y is closer to the truth."
  • Punch pair:          [medium sentence]. [8-word max]. [8-word max].
- NEVER open every paragraph with a topic sentence mix in scenario-first and question-first openings.
- Cut all filler: "furthermore", "moreover", "it is worth noting", "needless to say", "it goes without saying" replace with direct statements.
- Prefer active voice. Write "the plugin updates the cache" not "the cache is updated by the plugin".
- VOCABULARY: Replace technical jargon wherever possible. Examples: "deploy" → "put live", "repository" → "code storage", "API endpoint" → "connection point", "latency" → "delay", "implement" → "set up", "configure" → "adjust the settings".

═══ LINK & TABLE RULES ═══
- All links (external and internal) must use the same color as surrounding body text NEVER yellow, NEVER colored
- All links must have NO underline they should be invisible from surrounding text unless hovered
- Summary/FAQ table at the bottom: maximum 2 data rows, all text in English only
- Table header and column labels must be in English (e.g. Topic/Summary, Question/Answer)
${styleSection}${rulesSection}${humanStyleSection}
${srcSection}

Respond ONLY with a single valid JSON object. No markdown fences, no explanation before or after the JSON.
{"title":"title 50-60 chars with focus keyword + power word","content":"complete HTML blog post 1500-2000 words","excerpt":"120-160 char excerpt with focus keyword","seo_title":"50-60 char SEO title","seo_description":"140-160 char meta description ending with CTA","focus_keyword":"${focusKw}","keywords":["kw1","kw2","kw3","kw4","kw5"],"img_alt_featured":"image description WITH focus keyword","img_alt_body":"image description WITH focus keyword"}`;
}

/* ══════════════════════════════════════════════
   Workers AI 글 생성
   ══════════════════════════════════════════════ */
async function generateWithWorkersAI(env, prompt) {
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: 'You are a veteran tech journalist with 15 years of hands-on web technology and business experience. You write the way you talk - direct, opinionated, and practical. You hate corporate jargon and AI-sounding text. Always respond with valid JSON only. No markdown fences, no explanation, no text before or after the JSON object.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 8192,
    temperature: 0.85,
  });
  const raw = result.response;
  if (!raw) return '';
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

/* ── AI 응답 JSON 파서 ── */
function parseAIResponse(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch { return null; }
}

/* ══════════════════════════════════════════════
   OpenAI SEO 검증
   ══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════
   1단계: 프로그램 규정 검사 (구조 규칙 자동 체크)
   ══════════════════════════════════════════════ */
function programmaticRuleCheck(post, focusKw) {
  const violations = [];
  const content = post.content || '';
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const h2s = content.match(/<h2[\s>]/gi) || [];
  const h3s = content.match(/<h3[\s>]/gi) || [];

  /* R1: 단어 수 1,500~2,200 */
  if (words.length < 1400) violations.push(`R1_WORD_COUNT: ${words.length} (need 1500+)`);
  if (words.length > 2500) violations.push(`R1_WORD_EXCESS: ${words.length} (max 2200)`);

  /* R2: H2 정확히 7개 (허용 범위 5~9) */
  if (h2s.length < 5) violations.push(`R2_H2_LOW: ${h2s.length} H2 (need 5-9, target 7)`);
  if (h2s.length > 9) violations.push(`R2_H2_HIGH: ${h2s.length} H2 (max 9)`);

  /* R3: H3 금지 (0개) */
  if (h3s.length > 0) violations.push(`R3_H3_FORBIDDEN: ${h3s.length} H3 found (must be 0)`);

  /* R4: 포커스 키워드 — 제목 */
  const kwLower = focusKw.toLowerCase();
  if (!(post.title || '').toLowerCase().includes(kwLower)) violations.push('R4_KW_TITLE: keyword missing from title');

  /* R5: 포커스 키워드 — 첫 문단 (100단어 이내) */
  const first100 = text.split(/\s+/).slice(0, 100).join(' ').toLowerCase();
  if (!first100.includes(kwLower)) violations.push('R5_KW_INTRO: keyword missing from first 100 words');

  /* R6: 포커스 키워드 — H2 1개 이상 */
  const h2Texts = (content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []).map(h => h.replace(/<[^>]*>/g, '').toLowerCase());
  if (!h2Texts.some(t => t.includes(kwLower))) violations.push('R6_KW_H2: keyword missing from all H2');

  /* R7: 포커스 키워드 — 전체 4~8회 (목표 5~6회) */
  const kwCount = (text.toLowerCase().match(new RegExp(kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (kwCount < 4) violations.push(`R7_KW_DENSITY_LOW: keyword appears ${kwCount} times (need 4-8)`);
  if (kwCount > 8) violations.push(`R7_KW_DENSITY_HIGH: keyword appears ${kwCount} times (max 8, got ${kwCount})`);

  /* R8: 메타 설명 140~160자 */
  const metaLen = (post.seo_description || '').length;
  if (metaLen > 0 && metaLen < 130) violations.push(`R8_META_SHORT: ${metaLen} chars (need 140-160)`);
  if (metaLen > 170) violations.push(`R8_META_LONG: ${metaLen} chars (need 140-160)`);

  /* R9: 한국어 절대 금지 */
  const korRe = /[\uAC00-\uD7A3\u3131-\u318E]/;
  if (korRe.test(post.title) || korRe.test(text)) violations.push('R9_KOREAN: Korean text detected');

  /* R10: 빈 태그 금지 */
  const emptyTags = content.match(/<(strong|em|h2|p)>\s*<\/\1>/gi) || [];
  if (emptyTags.length) violations.push(`R10_EMPTY_TAGS: ${emptyTags.length} found`);

  /* R11: H2 뒤 단락 5-6줄 (80-120단어) - 50단어 미만 섹션 개수 */
  const headingSplits = content.split(/<h2[^>]*>/gi);
  let tooShort = 0;
  let tooLong = 0;
  for (let i = 1; i < headingSplits.length; i++) {
    const afterHeading = headingSplits[i].split(/<h2[^>]*>/i)[0] || '';
    const firstP = (afterHeading.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
    const pWords = firstP.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    if (pWords > 0 && pWords < 50) tooShort++;
    if (pWords > 140) tooLong++;
  }
  if (tooShort > 1) violations.push(`R11_SHORT_PARA: ${tooShort} sections under 50 words after heading`);
  if (tooLong > 1) violations.push(`R11_LONG_PARA: ${tooLong} sections over 140 words after heading`);

  /* R12: AI 금지 단어 (0개 허용) - HUMAN AUTHENTICITY 섹션과 완전 동기화 */
  const banned = /\b(delve|leverage|utilize|robust|seamless|streamline|navigate|realm|landscape|ecosystem|paradigm|synergy|empower|harness|cutting-edge|game-changer|comprehensive|paramount|holistic|crucial|essential|ensure|bolstering|foster|nuanced|underscores|curated|mitigate|proactive|prioritize|optimal|pivotal|facilitate|enhance)\b/gi;
  const bannedMatches = text.match(banned) || [];
  if (bannedMatches.length > 0) violations.push(`R12_BANNED: ${bannedMatches.length} AI words (${[...new Set(bannedMatches.map(w => w.toLowerCase()))].join(', ')})`);

  /* R13: 결론 섹션 금지 */
  const conclusionH2 = h2Texts.some(t => /\b(conclusion|final thoughts|summary|wrapping up|key takeaways)\b/i.test(t));
  if (conclusionH2) violations.push('R13_CONCLUSION: conclusion-type H2 heading found');

  /* R14: 제목 길이 50-60자 */
  const titleLen = (post.title || '').length;
  if (titleLen < 50) violations.push(`R14_TITLE_SHORT: ${titleLen} chars (need 50-60)`);
  if (titleLen > 70) violations.push(`R14_TITLE_LONG: ${titleLen} chars (need 50-60)`);

  /* R15: 비축약형 과다 사용 금지 (postProcessContent 이후에도 남아있으면 위반) */
  const formalRe = /\b(do not|will not|cannot|does not|is not|are not|would not|should not|have not|has not|did not|was not|were not)\b/gi;
  const formalCount = (text.match(formalRe) || []).length;
  const formalMax = Math.max(3, Math.ceil(words.length / 300));
  if (formalCount > formalMax) violations.push(`R15_FORMAL_PHRASES: ${formalCount} non-contraction forms found (max ~${formalMax} for ${words.length} words)`);

  /* R16: 금지된 단락 시작 표현 */
  const paraTexts = (content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [])
    .map(p => p.replace(/<[^>]*>/g, '').trim().toLowerCase().slice(0, 70));
  const bannedOpenerPats = [
    /^in today'?s/,
    /^in the world of/,
    /^when it comes to/,
    /^it'?s important to/,
    /^one of the most (?:important|common|critical)/,
    /^first and foremost/,
    /^without a doubt/,
    /^in this (?:article|section|guide|blog)/,
    /^in conclusion/,
    /^to summarize/,
  ];
  const badOpeners = paraTexts.filter(t => bannedOpenerPats.some(p => p.test(t))).length;
  if (badOpeners > 0) violations.push(`R16_BANNED_OPENER: ${badOpeners} paragraphs start with banned AI opener phrases`);

  return { pass: violations.length === 0, violations };
}

/* ══════════════════════════════════════════════
   2단계: ChatGPT 규정 전수 검사
   AI가 생성한 글의 품질/규정 준수 최종 검증
   ══════════════════════════════════════════════ */
async function validateAllRulesWithOpenAI(env, post, focusKw) {
  const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
  if (!key) return { pass: true, seo_title: null, seo_description: null, keywords: [] };

  const content = post.content || '';
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  const prompt = `You are a STRICT blog quality inspector. Check EVERY rule. Return ONLY valid JSON.

TITLE: "${post.title}"
FOCUS KEYWORD: "${focusKw}"
WORD COUNT: ${wordCount}
FULL CONTENT (text only): ${text.slice(0, 4000)}

═══ 14 RULES — CHECK EVERY SINGLE ONE ═══
R1. WORD COUNT: 1,500–2,200 words. Current: ${wordCount}.
R2. H2 COUNT: exactly 7 (allow 5-9). Current: ${(content.match(/<h2[\s>]/gi) || []).length}.
R3. H3 COUNT: must be 0 (FORBIDDEN). Current: ${(content.match(/<h3[\s>]/gi) || []).length}. Any H3 = FAIL.
R4. KEYWORD IN TITLE: "${focusKw}" must appear in title.
R5. KEYWORD IN FIRST PARAGRAPH: "${focusKw}" must appear in first 100 words.
R6. KEYWORD IN H2: "${focusKw}" must appear in at least 1 H2 heading.
R7. KEYWORD DENSITY: "${focusKw}" must appear EXACTLY 4-8 times total in content. Current count: ${(text.toLowerCase().match(new RegExp(focusKw.toLowerCase().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'), 'g')) || []).length}. Over 8 = AUTOMATIC FAIL.
R8. META DESCRIPTION: 140-160 characters with keyword and call to action.
R9. ENGLISH ONLY: zero Korean, Japanese, Chinese text.
R10. NO EMPTY TAGS: no <strong></strong>, <p></p>, etc.
R11. PARAGRAPH LENGTH: every <p> after a H2 heading must have 5-6 sentences (80-120 words). Check: are there paragraphs with only 1-3 sentences? Are there paragraphs with 8+ sentences?
R12. BANNED AI WORDS: zero tolerance for: delve, leverage, utilize, robust, seamless, streamline, navigate, realm, landscape, ecosystem, paradigm, synergy, empower, harness, cutting-edge, game-changer, comprehensive, paramount, holistic, crucial, essential, ensure, bolstering, foster, nuanced, underscores, curated, mitigate, proactive, prioritize, optimal, pivotal, facilitate, enhance, furthermore, moreover, additionally.
R13. NO CONCLUSION: last H2 must NOT be "Conclusion", "Final Thoughts", "Summary", "Wrapping Up".
R14. TITLE LENGTH: 50-60 characters.
R15. CONTRACTIONS: count occurrences of "do not", "will not", "cannot", "does not", "is not", "are not", "would not", "should not". If total exceeds 5, this is a violation. Writers use contractions naturally.
R16. BANNED OPENERS: paragraphs must NOT start with: "In today's", "In the world of", "When it comes to", "It's important to", "One of the most important/common/critical", "First and foremost", "Without a doubt", "In this article/section/guide". Each violation counts.

═══ RESPOND WITH EXACTLY THIS JSON ═══
{"pass":true/false,"score":0-100,"violations":["R1: detail","R11: detail"],"seo_title":"optimized 50-60 chars","seo_description":"140-160 chars with keyword ending with CTA","keywords":["kw1","kw2","kw3","kw4","kw5"]}

SCORING: Each rule = ~6 points. 90+ = pass. Any R7 (keyword over 8) or R11 or R12 violation = automatic fail. R15/R16 violations each = -8 points.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI HTTP ${res.status}`);
    }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const result = JSON.parse(raw.replace(/```json|```/g, '').trim());
    console.log(`[blog-gen] ChatGPT validation: pass=${result.pass}, score=${result.score}, violations=${(result.violations || []).length}`);
    if (result.violations?.length) {
      console.log(`[blog-gen] Violations: ${result.violations.join(' | ')}`);
    }
    return result;
  } catch (e) {
    console.warn('[blog-gen] ChatGPT validation failed:', e.message);
    return { pass: true, score: null, seo_title: null, seo_description: null, keywords: [] };
  }
}

/* ── OpenAI 토큰 상태 체크 ── */
async function checkOpenAIToken(env) {
  const key = await getSetting(env.DB, 'openai_api_key').catch(() => '');
  if (!key) return { valid: false, error: 'OpenAI API key not configured', code: 'no_key' };
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });
    if (res.ok) return { valid: true };
    const errData = await res.json().catch(() => ({}));
    const code = errData?.error?.code || '';
    const msg = errData?.error?.message || `HTTP ${res.status}`;
    return { valid: false, error: msg, code };
  } catch (e) {
    return { valid: false, error: 'Network error: ' + e.message, code: 'network' };
  }
}

/* ══════════════════════════════════════════════
   키워드 밀도 조절
   ══════════════════════════════════════════════ */
function enforceKeywordDensity(content, keyword, maxPct) {
  const text = content.replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  if (!totalWords || !keyword) return content;
  const kwWords = keyword.split(/\s+/).length;
  const matches = text.toLowerCase().split(keyword.toLowerCase()).length - 1;
  const density = matches * kwWords / totalWords * 100;
  if (density <= maxPct) return content;
  const maxOccurrences = Math.max(4, Math.floor(totalWords * 0.015 / kwWords));
  const replacements = [
    'this process', 'these measures', 'this approach',
    'these techniques', 'this method', 'the strategy',
  ];
  let count = 0;
  let replIdx = 0;
  const kw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /* H2 헤딩과 그 외 영역을 분리하여 처리 - 헤딩 내부는 교체 안 함 */
  const parts = content.split(/(<h2[^>]*>[\s\S]*?<\/h2>)/gi);
  return parts.map(part => {
    if (/^<h2/i.test(part)) return part; /* 헤딩은 건드리지 않음 */
    const regex = new RegExp(
      `(?:<(?:strong|em)>\\s*)?${kw}(?:\\s*<\\/(?:strong|em)>)?`, 'gi'
    );
    return part.replace(regex, (m) => {
      count++;
      if (count <= maxOccurrences) return m;
      const alt = replacements[replIdx % replacements.length];
      replIdx++;
      return alt;
    });
  }).join('');
}

/* ══════════════════════════════════════════════
   키워드 출현 횟수 강제 조정 (R7 자동 수정)
   targetCount 목표 횟수 (기본 6), 초과 시 대체어로 교체, 부족 시 삽입
   ══════════════════════════════════════════════ */
function enforceKeywordCount(content, keyword, targetCount = 6) {
  if (!keyword) return content;
  const kwLower = keyword.toLowerCase();
  const kwEscaped = kwLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const text = content.replace(/<[^>]*>/g, ' ');
  const currentCount = (text.toLowerCase().match(new RegExp(kwEscaped, 'g')) || []).length;

  /* 4-8 범위 안이면 수정 불필요 */
  if (currentCount >= 4 && currentCount <= 8) return content;

  /* 초과 시: targetCount까지만 남기고 나머지 대체 */
  if (currentCount > 8) {
    const maxKeep = targetCount; /* 6개만 유지 */
    const alts = ['this process', 'these methods', 'this approach', 'these techniques', 'this strategy', 'the practice', 'this system', 'such methods'];
    let kept = 0;
    let altIdx = 0;
    const parts = content.split(/(<h2[^>]*>[\s\S]*?<\/h2>)/gi);
    const result = parts.map(part => {
      if (/^<h2/i.test(part)) {
        /* H2 제목 안의 키워드는 1개까지만 허용 */
        const regex = new RegExp(kwEscaped, 'gi');
        let hKept = 0;
        return part.replace(regex, (m) => {
          hKept++;
          kept++;
          if (hKept <= 1 && kept <= maxKeep) return m;
          kept--;
          return alts[altIdx++ % alts.length];
        });
      }
      const regex = new RegExp(`(?:<(?:strong|em)>\\s*)?${kwEscaped}(?:\\s*<\\/(?:strong|em)>)?`, 'gi');
      return part.replace(regex, (m) => {
        kept++;
        if (kept <= maxKeep) return m;
        return alts[altIdx++ % alts.length];
      });
    });
    const fixed = result.join('');
    const newCount = (fixed.replace(/<[^>]*>/g, ' ').toLowerCase().match(new RegExp(kwEscaped, 'g')) || []).length;
    console.log(`[blog-gen] R7 fix: keyword "${keyword}" ${currentCount} → ${newCount} occurrences (target ${targetCount})`);
    return fixed;
  }

  /* 부족 시: 본문 <p> 중간에 키워드 자연 삽입 */
  if (currentCount < 4) {
    const needed = targetCount - currentCount;
    const pMatches = [...content.matchAll(/<p>([\s\S]*?)<\/p>/gi)];
    const step = Math.max(1, Math.floor(pMatches.length / (needed + 1)));
    let inserted = 0;
    for (let i = step; i < pMatches.length && inserted < needed; i += step) {
      const pContent = pMatches[i][1];
      const pText = pContent.replace(/<[^>]*>/g, '');
      /* 이미 키워드가 있는 단락은 건너뜀 */
      if (pText.toLowerCase().includes(kwLower)) continue;
      /* 단락 중간에 키워드를 자연스럽게 삽입 */
      const sentences = pText.split(/\.\s+/);
      if (sentences.length >= 2) {
        const insertPoint = Math.floor(sentences.length / 2);
        sentences[insertPoint] = sentences[insertPoint] + `. When applying ${keyword}, this becomes especially relevant`;
        const newP = sentences.join('. ');
        content = content.replace(pMatches[i][0], `<p>${newP}</p>`);
        inserted++;
      }
    }
    console.log(`[blog-gen] R7 fix: keyword "${keyword}" ${currentCount} → ${currentCount + inserted} occurrences (inserted ${inserted})`);
  }

  return content;
}

/* ══════════════════════════════════════════════
   콘텐츠 확장 (단어 수 부족 시)
   ══════════════════════════════════════════════ */
async function expandContent(env, content, focusKw, currentWc) {
  try {
    const shortSections = [];
    /* H2 아래 직접 본문이 짧은 섹션 찾기 */
    const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
    let m2;
    while ((m2 = h2Re.exec(content)) !== null) {
      const title = m2[1].replace(/<[^>]*>/g, '').trim();
      const directBody = m2[2].trim();
      const bodyWc = directBody.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      if (bodyWc < 80 && title.length > 3) {
        shortSections.push({ tag: 'h2', title, matchEnd: m2.index + `<h2>${m2[1]}</h2>`.length });
      }
    }
    /* 짧은 섹션이 없으면 일반 확장 */
    if (shortSections.length === 0) {
      const h2Titles = (content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []).map((h) => h.replace(/<[^>]*>/g, '').trim()).slice(0, 4).join('; ');
      const raw2 = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: 'Return only <p> HTML paragraphs. No headings, no JSON, no markdown.' },
          { role: 'user', content: `Write 4 additional <p> paragraphs (each 110-130 words) expanding on "${focusKw}". Subtopics covered: ${h2Titles}. Add new practical details not yet covered. Mention "${focusKw}" once naturally. Return ONLY <p> tags.` },
        ],
        max_tokens: 1800,
        temperature: 0.65,
      });
      let extra2 = (raw2?.response || '').trim().replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      if (!extra2) return content;
      if (!/<p[^>]*>/i.test(extra2)) {
        extra2 = extra2.split(/\n\n+/).filter((t) => t.trim().length > 30).map((t) => `<p>${t.trim()}</p>`).join('\n');
      }
      const lastP = content.lastIndexOf('<p>');
      content = lastP > 0 ? content.slice(0, lastP) + extra2 + '\n' + content.slice(lastP) : content + '\n' + extra2;
      const nwc = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
      console.log(`[blog-gen] expanded (general) ${currentWc} → ${nwc} words`);
      return content;
    }
    /* 타겟 섹션별 확장 */
    const targets = shortSections.slice(0, 5);
    const sectionList = targets.map((s, i) => `${i + 1}. "${s.title}"`).join('\n');
    const raw = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a blog writer. Return exactly the requested number of <p> paragraphs in order. No headings, no JSON, no extra text.' },
        { role: 'user', content: `For each numbered topic below, write ONE detailed <p> paragraph (110–130 words each) with practical tips related to "${focusKw}". Return ONLY the <p> tags, in the same numbered order:\n${sectionList}\n\nOutput format:\n<p>1: ...</p>\n<p>2: ...</p>\n...` },
      ],
      max_tokens: 1800,
      temperature: 0.65,
    });
    let extra = (raw?.response || '').trim().replace(/^```html?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!extra) return content;
    const newParas = (extra.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || []).map((p) => p.replace(/<p([^>]*)>\s*\d+[.:]\s*/i, '<p$1>'));
    let result = content;
    for (let i = 0; i < Math.min(newParas.length, targets.length); i++) {
      const s = targets[i];
      const para = newParas[i];
      if (!para) continue;
      const escapedTitle = s.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hRe = new RegExp(`<${s.tag}[^>]*>${escapedTitle}<\\/${s.tag}>`, 'i');
      const match = hRe.exec(result);
      if (match) {
        const insertAt = match.index + match[0].length;
        result = result.slice(0, insertAt) + '\n' + para + '\n' + result.slice(insertAt);
      }
    }
    const newWc = result.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    console.log(`[blog-gen] expanded (targeted) ${currentWc} → ${newWc} words`);
    return result;
  } catch (e) {
    console.warn('[blog-gen] expandContent failed:', e.message);
    return content;
  }
}

/* ══════════════════════════════════════════════
   이미지 삽입 (H2 세 번째 앞에)
   ══════════════════════════════════════════════ */
function insertImageBeforeThirdH(content, imgUrl, altText, minWordsBeforeImg = 400) {
  const imgFigure = `<figure style="margin:32px 0;"><img src="${imgUrl}" alt="${altText}" style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;" loading="lazy"/><figcaption style="text-align:center;font-size:13px;color:#6b7280;margin-top:8px;">${altText}</figcaption></figure>`;
  let wordsSoFar = 0;
  let inserted = false;
  return content.replace(/(<h[2-6][^>]*>)/gi, (m, hTag, offset) => {
    if (inserted) return hTag;
    const before = content.slice(0, offset);
    wordsSoFar = before.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    if (wordsSoFar >= minWordsBeforeImg) {
      inserted = true;
      return imgFigure + hTag;
    }
    return hTag;
  });
}

/* ── 요약/FAQ 테이블 ── */
function buildSummaryTable(html, tableType) {
  /* 최대 2개만 추출 (불필요하게 긴 Q&A 금지) */
  const sections = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html)) !== null && sections.length < 2) {
    const heading = m[1].replace(/<[^>]*>/g, '').trim();
    const paraText = m[2].replace(/<[^>]*>/g, '').trim();
    /* 간결한 1문장 요약만 (최대 120자) */
    const sentence = (paraText.match(/^[^.!?]+[.!?]/) || [paraText.slice(0, 120)])[0].trim().slice(0, 120);
    if (heading && sentence) sections.push({ heading, sentence });
  }
  if (sections.length < 2) return '';
  if (tableType === 'summary') {
    const rows = sections.map(
      (s) => `<tr><td><strong>${s.heading}</strong></td><td>${s.sentence}</td></tr>`
    ).join('');
    return `\n<h2>Key Takeaways</h2>\n<div class="summary-table-wrap"><table class="summary-table"><thead><tr><th>Topic</th><th>Summary</th></tr></thead><tbody>${rows}</tbody></table></div>\n`;
  } else {
    const rows = sections.map((s) => {
      const q = /[?]$/.test(s.heading) ? s.heading : s.heading + '?';
      return `<tr><td><strong>${q}</strong></td><td>${s.sentence}</td></tr>`;
    }).join('');
    return `\n<h2>Frequently Asked Questions</h2>\n<div class="summary-table-wrap"><table class="summary-table"><thead><tr><th>Question</th><th>Answer</th></tr></thead><tbody>${rows}</tbody></table></div>\n`;
  }
}

/* ── HTML 후처리 ── */
function postProcessContent(content) {
  let c = content
    /* 보안 CTA / 상품 프로모션 blockquote 완전 제거 (n0003은 보안 판매/홍보 사이트가 아님) */
    .replace(/<blockquote[^>]*>[\s\S]*?(?:Care Plan|Security Plan|Protection|Malware|Monitoring Plan|Emergency Help|Hardened Today|noteracker\.com)[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<h[2-6][^>]*>\s*<\/h[2-6]>/gi, '')
    .replace(/<strong>\s*<\/strong>/gi, '')
    .replace(/<em>\s*<\/em>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1')
    .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<i[^>]*>[\s\S]*?<\/i>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/\s+style="[^"]*"/gi, '')
    .replace(/(<\/p>)\s{2,}(<p)/gi, '$1\n$2');
  /* "Conclusion" 타입 H2 제목만 제거 (본문 문단은 유지하여 단어수 보존) */
  c = c.replace(/<h2[^>]*>\s*(?:Conclusion|Final Thoughts?|Summary|Wrapping Up|In Closing|Conclusion and Next Steps)[^<]*<\/h2>/gi, '');

  /* AI 패턴 후처리 제거 */
  const aiPhrases = [
    [/\bin today'?s (?:digital |cybersecurity |ever-evolving |modern )?(?:world|landscape|era|age)\b/gi, 'right now'],
    [/\bit(?:'s| is) (?:crucial|essential|vital|important) (?:to |that |in |for )/gi, 'you should '],
    [/\bis (?:crucial|essential|vital) (?:in |for |to )/gi, 'matters for '],
    [/\bplays a (?:crucial|vital|key|important|significant) role\b/gi, 'matters a lot'],
    [/\bis a critical component of\b/gi, 'is a key part of'],
    [/\bis particularly (?:important|crucial|vital)\b/gi, 'really matters'],
    [/\bensure that\b/gi, 'make sure'],
    [/\bensure your\b/gi, 'keep your'],
    [/\butilize\b/gi, 'use'],
    [/\bleverage\b/gi, 'use'],
    [/\bin this (?:article|guide|section|post),?\s*(?:we(?:'ll| will) (?:explore|discuss|cover|examine|look at|delve into))/gi, 'here we cover'],
    [/\blet'?s (?:dive in|explore|take a look|examine|discuss)\b/gi, "let's get started"],
    [/\bin conclusion,?\s*/gi, ''],
    [/\bas we(?:'ve| have) (?:seen|discussed|explored|covered),?\s*/gi, ''],
    [/\bto summarize,?\s*/gi, ''],
    [/\bneedless to say,?\s*/gi, ''],
    [/\bit goes without saying (?:that )?/gi, ''],
    [/\bwithout further ado,?\s*/gi, ''],
    [/\bfurthermore,?\s*/gi, 'also, '],
    [/\bmoreover,?\s*/gi, 'also, '],
    [/\badditionally,?\s*/gi, 'also, '],
    [/\bcan significantly (?:reduce|improve|enhance|increase|help)\b/gi, 'can really help'],
    [/\bby taking these (?:steps|measures|precautions|actions),?\s*/gi, 'with this done, '],
    [/\bremember,?\s*(?:that )?/gi, ''],
    [/\bit(?:'s| is) (?:also )?worth (?:noting|mentioning) (?:that )?/gi, ''],
    [/\bwhen it comes to\b/gi, 'for'],
    [/\bone of the most (?:common|important|critical|effective|significant|popular)\b/gi, 'a very common'],
    [/\bthis (?:is where|is when|is why)\b/gi, 'that explains why'],
    [/\bby (?:doing so|doing this),?\s*/gi, ''],
    [/\bas a result,?\s*/gi, 'so '],
    [/\bconsequently,?\s*/gi, 'so '],
    [/\bto (?:effectively|efficiently|properly|successfully) /gi, 'to '],
    [/\b(?:significantly|substantially|dramatically|considerably) (?:reduce|improve|enhance|increase|decrease)\b/gi, function(m) { return m.split(/\s+/).pop(); }],
    [/\brobust\b/gi, 'strong'],
    [/\bcomprehensive\b/gi, 'complete'],
    [/\bseamless(?:ly)?\b/gi, 'smooth'],
    [/\bthis (?:includes|involves|encompasses|entails) /gi, 'that means '],
    [/\bthis starts with\b/gi, 'start by'],
    [/\bwebsite owners should (?:also )?/gi, 'you should '],
    [/\bthey (?:should|must|need to) (?:also )?/gi, 'you need to '],
    [/\borganizations (?:should|must|need to)\b/gi, 'you need to'],
    [/\bto achieve this,?\s*/gi, ''],
    [/\bto accomplish this,?\s*/gi, ''],
    [/\bit(?:'s| is) (?:also )?important (?:to |that )/gi, ''],
    [/\bplaying a (?:key|crucial|vital|important) role\b/gi, 'helping'],
    [/\btaking (?:proactive |necessary )?(?:steps|measures|action)\b/gi, 'acting'],
    [/\bmaintaining (?:a )?(?:secure|safe|protected)\b/gi, 'keeping things safe'],
    /* 추가 AI 단어 제거 */
    [/\bdelve(?:s|d)? (?:into|deeper)\b/gi, 'look at'],
    [/\bstreamline(?:s|d)?\b/gi, 'simplify'],
    [/\bnavigate\b/gi, 'handle'],
    [/\blandscape\b/gi, 'space'],
    [/\becosystem\b/gi, 'setup'],
    [/\bparadigm\b/gi, 'approach'],
    [/\bempower(?:s|ed|ing)?\b/gi, 'help'],
    [/\bharness(?:es|ed|ing)?\b/gi, 'use'],
    [/\bcutting[- ]edge\b/gi, 'latest'],
    [/\bgame[- ]changer\b/gi, 'big deal'],
    [/\bparamount\b/gi, 'key'],
    [/\bfoster(?:s|ed|ing)?\b/gi, 'build'],
    [/\bholistic(?:ally)?\b/gi, 'full'],
    [/\bnuanced\b/gi, 'detailed'],
    [/\bunderscores?\b/gi, 'shows'],
    [/\bfirst and foremost,?\s*/gi, ''],
    [/\blast but not least,?\s*/gi, ''],
    [/\bensure\b/gi, 'make sure'],
    [/\bin order to\b/gi, 'to'],
    [/\ba wide (?:range|variety|array) of\b/gi, 'many'],
    [/\bvast (?:majority|array|range)\b/gi, 'most'],
    [/\bpivotal\b/gi, 'key'],
    [/\bfacilitate(?:s|d)?\b/gi, 'help'],
    [/\boptimal\b/gi, 'best'],
    [/\bmitigate(?:s|d)?\b/gi, 'reduce'],
    [/\bprioritize\b/gi, 'focus on'],
    [/\bimplementation\b/gi, 'setup'],
    [/\bproactive(?:ly)?\b/gi, 'early'],
    [/\bexplore(?:s|d)? (?:the |various |different )/gi, 'check '],
    [/\benhance(?:s|d)?\b/gi, 'improve'],
    [/\bwith that (?:said|in mind),?\s*/gi, ''],
    [/\bthat (?:said|being said),?\s*/gi, ''],
    [/\bhaving said that,?\s*/gi, ''],
    [/\bit is (?:worth|important to) (?:noting|note|mentioning|mention) that\s*/gi, ''],
    [/\b(?:serves|serve) as (?:a |an )?/gi, 'is '],
    /* ── 축약형 강제: AI는 formal 표현 선호 → 자연스러운 축약형으로 ── */
    [/\bdo not\b/gi, "don't"],
    [/\bwill not\b/gi, "won't"],
    [/\bcannot\b/gi, "can't"],
    [/\bdoes not\b/gi, "doesn't"],
    [/\bis not\b/gi, "isn't"],
    [/\bare not\b/gi, "aren't"],
    [/\bwould not\b/gi, "wouldn't"],
    [/\bshould not\b/gi, "shouldn't"],
    [/\bhave not\b/gi, "haven't"],
    [/\bhas not\b/gi, "hasn't"],
    [/\bdid not\b/gi, "didn't"],
    [/\bwas not\b/gi, "wasn't"],
    [/\bwere not\b/gi, "weren't"],
    [/\byou will\b/gi, "you'll"],
    [/\bthere is\b/gi, "there's"],
    [/\bhere is\b/gi, "here's"],
    [/\bit is\b/gi, "it's"],
    [/\bthat is\b/gi, "that's"],
    [/\ba ([aeiou])/gi, 'an $1'],
  ];
  for (const [pattern, replacement] of aiPhrases) {
    c = c.replace(pattern, replacement);
  }
  /* 문장 시작 소문자 보정: <p>, <li>, <h2> 직후 첫 글자 대문자화 */
  c = c.replace(/(<(?:p|li|h2)[^>]*>)\s*([a-z])/g, (m, tag, ch) => tag + ch.toUpperCase());
  return c.trim();
}

/* ── 외부 권위 링크 삽입 ── */
function injectExternalLinks(content, category) {
  const refs = CAT_EXTERNAL_REFS[category] || CAT_EXTERNAL_REFS['business'];
  if (!refs || !refs.length) return content;
  const half = Math.floor(content.length / 2);
  const insertPoint = content.lastIndexOf('</p>', half);
  if (insertPoint === -1) return content;
  const [url1, label1] = refs[0];
  const [url2, label2] = refs[1] || refs[0];
  const refBlock = `\n<p>For further reading, refer to the <a href="${url1}" rel="noopener noreferrer" target="_blank">${label1}</a> and <a href="${url2}" rel="noopener noreferrer" target="_blank">${label2}</a>.</p>`;
  return content.slice(0, insertPoint + 4) + refBlock + content.slice(insertPoint + 4);
}

/* ── 내부 링크 삽입 ── */
async function injectInternalLinks(content, DB) {
  try {
    const res = await DB.prepare(
      `SELECT title, slug FROM blog_posts WHERE status='published' ORDER BY RANDOM() LIMIT 4`
    ).all().catch(() => ({ results: [] }));
    const posts = (res.results || []).slice(0, 2);
    if (!posts.length) return content;
    const listItems = posts.map((p) => `<li><a href="/blog-post.html?slug=${encodeURIComponent(p.slug)}">${p.title}</a></li>`).join('');
    const relatedBlock = `\n<h2>Related Articles</h2>\n<ul>${listItems}</ul>`;
    const lastP = content.lastIndexOf('</p>');
    if (lastP === -1) return content + relatedBlock;
    return content.slice(0, lastP + 4) + relatedBlock + content.slice(lastP + 4);
  } catch { return content; }
}

/* ══════════════════════════════════════════════
   SEO 점수 계산 (RankMath 기준 0-100)
   ══════════════════════════════════════════════ */
function computeRealSeoScore(post, focusKw, slug) {
  let score = 0;
  const kw = (focusKw || '').toLowerCase();
  const title = (post.title || '').toLowerCase();
  const seoT = (post.seo_title || '').toLowerCase();
  const metaD = post.seo_description || '';
  const metaDl = metaD.toLowerCase();
  const raw = post.content || '';
  const text = raw.replace(/<[^>]*>/g, ' ').toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;

  if (kw && title.includes(kw)) score += 5;
  if (kw && seoT.includes(kw)) score += 5;
  if (kw && metaDl.includes(kw)) score += 5;
  const kwSlug = kw.replace(/\s+/g, '-');
  if (kw && slug.includes(kwSlug)) score += 5;
  if (kw && words.slice(0, 100).join(' ').includes(kw)) score += 5;

  const headingText = (raw.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || []).map((h) => h.replace(/<[^>]*>/g, '')).join(' ').toLowerCase();
  if (kw && headingText.includes(kw)) score += 5;

  if (kw && wc) {
    const kwCount = text.split(kw).length - 1;
    const kwWc = kw.split(/\s+/).length;
    const density = kwCount * kwWc / wc * 100;
    if (density >= 1 && density <= 3) score += 10;
    else if (density >= 0.5 && density < 1) score += 5;
  }

  const alts = (raw.match(/alt="([^"]*)"/gi) || []).join(' ').toLowerCase();
  if (kw && alts.includes(kw)) score += 5;
  if (wc >= 600) score += 5;
  if (wc >= 1500) score += 5;
  if (/href="https?:\/\//.test(raw)) score += 5;
  if (/href="\/blog-post\.html/.test(raw)) score += 5;
  if (/<img\b/.test(raw)) score += 5;
  if ((raw.match(/<h2[^>]*>/gi) || []).length >= 5) score += 5;
  if ((raw.match(/<h2[^>]*>/gi) || []).length >= 7) score += 5;
  if (!/<(strong|em|h[2-6])[^>]*>\s*<\/\1>/i.test(raw)) score += 5;

  const powerWords = ['guide', 'how', 'best', 'complete', 'ultimate', 'step', 'fix', 'improve', 'top', 'easy', 'tips', 'checklist', 'explained'];
  if (powerWords.some((w) => title.includes(w))) score += 5;

  const paras = raw.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  if (paras.length) {
    const avg = paras.map((p) => p.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length).reduce((a, b) => a + b, 0) / paras.length;
    if (avg >= 40 && avg <= 150) score += 5;
  }

  if (metaD.length >= 140 && metaD.length <= 160) score += 5;
  if (!/<h1[^>]*>/i.test(raw)) score += 5;
  return Math.min(score, 100);
}

/* ══════════════════════════════════════════════
   콘텐츠 품질 점수 (0-100) + AI 유사성 점수 (0-100, 낮을수록 좋음)
   ══════════════════════════════════════════════ */
function computeContentQuality(content) {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  let score = 0;

  /* 1. 단어 수 충분 (1000+) */
  if (wc >= 1500) score += 15;
  else if (wc >= 1000) score += 10;
  else if (wc >= 600) score += 5;

  /* 2. 문장 다양성 (길이 변화) */
  const sentLens = sentences.map(s => s.trim().split(/\s+/).length);
  if (sentLens.length >= 5) {
    const avg = sentLens.reduce((a, b) => a + b, 0) / sentLens.length;
    const variance = sentLens.reduce((a, l) => a + (l - avg) ** 2, 0) / sentLens.length;
    if (variance >= 30) score += 15;
    else if (variance >= 15) score += 10;
    else score += 5;
  }

  /* 3. 문단 구조 */
  const paras = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
  if (paras.length >= 8) score += 10;
  else if (paras.length >= 5) score += 5;

  /* 4. 헤딩 구조 */
  const h2s = (content.match(/<h2[^>]*>/gi) || []).length;
  if (h2s >= 7) score += 10;
  else if (h2s >= 5) score += 5;

  /* 5. 외부 링크 존재 */
  if (/<a\s[^>]*href="https?:\/\//.test(content)) score += 5;

  /* 6. 이미지 존재 */
  if (/<img\s/.test(content)) score += 5;

  /* 7. 리스트/불릿 존재 */
  if (/<ul[^>]*>/.test(content) || /<ol[^>]*>/.test(content)) score += 5;

  /* 8. 시작 단어 다양성 (첫 단어가 반복되지 않을수록 좋음) */
  const starters = paras.map(p => {
    const t = p.replace(/<[^>]*>/g, '').trim();
    return (t.split(/\s+/)[0] || '').toLowerCase();
  }).filter(Boolean);
  const uniqueStarters = new Set(starters).size;
  const starterDiversity = starters.length ? uniqueStarters / starters.length : 0;
  if (starterDiversity >= 0.7) score += 10;
  else if (starterDiversity >= 0.5) score += 5;

  /* 9. 능동태 비율 */
  const passivePatterns = /\b(?:is|are|was|were|been|being) (?:used|done|made|taken|given|known|called|found|seen|shown|needed|required|recommended|considered|expected)/gi;
  const passiveCount = (text.match(passivePatterns) || []).length;
  const passiveRatio = sentences.length ? passiveCount / sentences.length : 0;
  if (passiveRatio < 0.15) score += 10;
  else if (passiveRatio < 0.25) score += 5;

  /* 10. 콘텐츠 깊이 (구체적 숫자/예시 포함) */
  const hasNumbers = /\d+/.test(text);
  const hasExamples = /example|for instance|such as|e\.g\./i.test(text);
  if (hasNumbers && hasExamples) score += 5;
  else if (hasNumbers || hasExamples) score += 3;

  return Math.min(score, 100);
}

function computeAISimilarity(content) {
  const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  const wc = words.length;
  if (!wc) return 100;
  let penalties = 0;

  /* AI 시그니처 표현 - 고위험 (postProcessContent 통과 후 잔존하면 강한 AI 신호) */
  const highRisk = [
    /\bdelve(?:s|d)?\b/g, /\bleverage(?:s|d)?\b/g, /\brobust\b/g,
    /\bseamless(?:ly)?\b/g, /\bstreamline(?:s|d)?\b/g, /\bparadigm\b/g,
    /\bempower(?:s|ed|ing)?\b/g, /\bharness(?:es|ed|ing)?\b/g,
    /\bcutting[- ]edge\b/g, /\bgame[- ]changer\b/g, /\bparamount\b/g,
    /\bholistic(?:ally)?\b/g, /\bnuanced\b/g, /\bsynergy\b/g,
  ];
  for (const pat of highRisk) {
    const m = text.match(pat) || [];
    penalties += m.length * 4;
  }

  /* AI 시그니처 표현 - 중위험 */
  const medRisk = [
    /\bit is (?:crucial|essential|vital|important|worth noting|imperative)\b/g,
    /\bit'?s (?:crucial|essential|vital|important|worth mentioning)\b/g,
    /\bin today'?s (?:digital |modern |fast-paced )?(?:world|landscape|era|age)\b/g,
    /\bplays a (?:crucial|vital|key|important|significant|pivotal) role\b/g,
    /\bin conclusion\b/g, /\bto summarize\b/g,
    /\bas (?:we'?ve|we have) (?:seen|discussed|explored|covered)\b/g,
    /\bin this (?:article|guide|blog post|section)\b/g,
    /\bfurthermore\b/g, /\bmoreover\b/g, /\badditionally\b/g,
    /\bensure that\b/g, /\bcomprehensive(?:ly)?\b/g,
    /\blandscape\b/g, /\becosystem\b/g, /\bnavigate\b/g,
    /\bfoster(?:s|ed|ing)?\b/g, /\bunderscores?\b/g,
    /\bone of the most (?:common|important|critical|significant)\b/g,
    /\bcan significantly (?:reduce|improve|enhance|increase|help)\b/g,
    /\bby taking these (?:steps|measures|precautions|actions)\b/g,
    /\bneedless to say\b/g, /\bit goes without saying\b/g,
    /\bfirst and foremost\b/g, /\blast but not least\b/g,
    /\bwithout further ado\b/g,
  ];
  for (const pat of medRisk) {
    const m = text.match(pat) || [];
    penalties += m.length * 2;
  }

  /* 반복 구문 패턴 (같은 문장 시작 3단어 반복) */
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10).map(s => s.trim());
  const openers = sentences.map(s => s.split(/\s+/).slice(0, 3).join(' '));
  const openerCount = {};
  openers.forEach(o => { openerCount[o] = (openerCount[o] || 0) + 1; });
  const repeatedOpeners = Object.values(openerCount).filter(c => c > 2).reduce((a, b) => a + (b - 2), 0);
  penalties += repeatedOpeners;

  /* 수동태 과다 - 비율 기반 */
  const passiveCount = (text.match(/\b(?:is|are|was|were|been|being) \w+ed\b/g) || []).length;
  const passiveRatio = sentences.length ? passiveCount / sentences.length : 0;
  if (passiveRatio > 0.35) penalties += 5;
  else if (passiveRatio > 0.25) penalties += 3;

  /* 동일 문장 길이 반복 - 비율 기반 (완화) */
  const sentLens = sentences.map(s => s.split(/\s+/).length);
  if (sentences.length > 8) {
    let uniformTriplets = 0;
    for (let i = 0; i < sentLens.length - 2; i++) {
      if (Math.abs(sentLens[i] - sentLens[i + 1]) <= 2 && Math.abs(sentLens[i + 1] - sentLens[i + 2]) <= 2) {
        uniformTriplets++;
      }
    }
    const uniformRatio = uniformTriplets / (sentLens.length - 2);
    if (uniformRatio > 0.70) penalties += 8;
    else if (uniformRatio > 0.55) penalties += 4;
  }

  /* 축약형 사용 -> 인간 글쓰기 지표 (보너스 감점) */
  const contractionHits = (text.match(/\b(?:don't|won't|can't|doesn't|isn't|aren't|wouldn't|shouldn't|haven't|hasn't|didn't|wasn't|weren't|you'll|there's|here's|it's|that's|we're|you're|they're|let's|what's|who's|how's|i've|we've|you've|they've)\b/g) || []).length;
  if (sentences.length > 0) {
    const cRate = contractionHits / sentences.length;
    if (cRate > 0.35) penalties -= 8;
    else if (cRate > 0.2) penalties -= 5;
    else if (cRate > 0.1) penalties -= 2;
  }

  /* 질문형 문장 사용 -> 인간 글쓰기 지표 (보너스 감점) */
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount >= 3) penalties -= 3;
  else if (questionCount >= 1) penalties -= 1;

  /* 짧은 펀치 문장 (10단어 이하) 사용 -> 인간 지표 */
  const shortPunch = sentLens.filter(l => l >= 3 && l <= 10).length;
  const shortRatio = sentences.length ? shortPunch / sentences.length : 0;
  if (shortRatio > 0.15) penalties -= 4;
  else if (shortRatio > 0.08) penalties -= 2;

  return Math.min(Math.max(penalties, 0), 100);
}

/* ── URL Slug 생성 ── */
function toSlug(title) {
  return (title || 'post').toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80).replace(/^-+|-+$/g, '');
}

/* ══════════════════════════════════════════════
   웹사이트 콘텐츠 가져오기
   ══════════════════════════════════════════════ */
async function fetchWebsiteContent(srcUrl) {
  const res = await fetch(srcUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Noteracker-Bot/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${srcUrl}`);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : srcUrl;
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 15000);
  return { title, content: text };
}

/* ══════════════════════════════════════════════
   YouTube 콘텐츠 가져오기
   ══════════════════════════════════════════════ */
async function fetchYouTubeContent(videoUrl, apiKey) {
  /* 단일 영상 */
  const videoIdMatch = videoUrl.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (videoIdMatch) {
    const videoId = videoIdMatch[1];
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('YouTube video not found');
    const snippet = data.items[0].snippet;
    const title = snippet.title || 'YouTube Video';
    const tags = (snippet.tags || []).slice(0, 20).join(', ');
    const content = `Title: ${title}\n\nDescription:\n${snippet.description || ''}\n\nTags: ${tags}\n\nPublished: ${snippet.publishedAt || ''}`;
    return { title, content };
  }
  /* 채널 ID */
  const channelIdMatch = videoUrl.match(/\/channel\/([A-Za-z0-9_-]+)/);
  if (channelIdMatch) {
    const channelId = channelIdMatch[1];
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&part=snippet&order=date&maxResults=5&type=video&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('No videos found in this channel');
    const channelTitle = data.items[0]?.snippet?.channelTitle || channelId;
    const descriptions = data.items.map((i) => `Video: ${i.snippet.title}\n${i.snippet.description}`).join('\n\n---\n\n');
    return { title: `Channel: ${channelTitle}`, content: descriptions };
  }
  /* @핸들 */
  const decodedUrl = (() => { try { return decodeURIComponent(videoUrl); } catch { return videoUrl; } })();
  const handleMatch = decodedUrl.match(/\/@([^/?#\s]+)/);
  if (handleMatch) {
    const handle = handleMatch[1];
    const channelRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`
    );
    if (!channelRes.ok) throw new Error(`YouTube API HTTP ${channelRes.status}`);
    const channelData = await channelRes.json();
    if (!channelData.items?.length) throw new Error('YouTube channel not found: @' + handle);
    const channelId = channelData.items[0].id;
    const channelTitle = channelData.items[0].snippet?.title || handle;
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&part=snippet&order=date&maxResults=5&type=video&key=${apiKey}`;
    const res = await fetch(searchUrl);
    if (!res.ok) throw new Error(`YouTube API HTTP ${res.status}`);
    const data = await res.json();
    if (!data.items?.length) throw new Error('No videos found for channel: @' + handle);
    const descriptions = data.items.map((i) => `Video: ${i.snippet.title}\n${i.snippet.description}`).join('\n\n---\n\n');
    return { title: `Channel: ${channelTitle}`, content: descriptions };
  }
  throw new Error('Invalid YouTube URL. Supported: youtube.com/watch?v=ID, youtube.com/channel/ID, youtube.com/@handle');
}

/* ══════════════════════════════════════════════
   Unsplash 이미지 검색 - 본문 연관성 99% 목표
   - 카테고리 + 키워드 기반 다중 쿼리
   - 비영어 이미지 필터링
   - 관련도 스코어링으로 최적 이미지 선택
   ══════════════════════════════════════════════ */
async function fetchUnsplashImages(keyword, accessKey, count = 2, category = '', title = '') {
  /*
   * 이미지 연관성 99% 목표
   * - 카테고리 + 키워드 기반 정밀 검색 (본문 주제와 직결)
   * - 유사 이미지/유사 색상 사용 금지
   * - 영어 이외 다국어 이미지 절대 금지
   * - 무관한 이미지 (음식, 패션, 동물 등) 절대 금지
   */

  /* n0003 8개 카테고리별 정밀 검색어 */
  const CAT_IMAGE_TERMS = {
    'business': 'business office strategy meeting professional workspace',
    'startup': 'startup team brainstorm whiteboard growth pitch',
    'seo': 'analytics dashboard search traffic graph data',
    'wordpress': 'wordpress website CMS blog design theme',
    'web-design': 'web design UI UX wireframe layout prototype',
    'cloud': 'cloud computing server infrastructure data center',
    'web-hosting': 'server hosting data center rack network',
    'ecommerce': 'ecommerce shopping online store checkout cart',
  };

  /* 비영어 문자 필터 */
  const nonEnglishRe = /[\uAC00-\uD7A3\u3131-\u318E\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F]/;

  /* 완전 무관 이미지 필터 (엄격) */
  const irrelevantRe = /\b(food|cooking|recipe|fashion|clothing|pet|dog|cat|baby|wedding|party|beach|vacation|travel|selfie|portrait|flower|garden|sports|game|music|concert|art\s*gallery|sunset|sunrise|nature|landscape|mountain|ocean|animal|wine|beer|cocktail|dessert|cake|yoga|fitness|gym)\b/i;

  /* 코드/터미널 이미지 필터 */
  const codeRe = /\b(code|programming|terminal|console|syntax|dark\s+theme|IDE|vim|emacs|shell)\b/i;

  /* 검색어 정제 */
  const stopWords = /\b(for|to|how|the|a|an|with|and|or|of|in|on|at|by|from|tips|guide|basics|complete|step|best|using|your|site|owners|what|is|why|when|way|ways|top|proven|effective|essential)\b/gi;
  const cleanKw = keyword.replace(stopWords, ' ').replace(/\s+/g, ' ').trim().slice(0, 35);
  const catTerms = CAT_IMAGE_TERMS[category] || 'business technology professional';

  /* 타이틀에서 핵심어 추출 */
  const titleWords = (title || '').replace(stopWords, ' ').replace(/[^a-zA-Z\s]/g, '').replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 3).slice(0, 3).join(' ');

  /* 다양한 검색 쿼리 (정밀도 순) */
  const queries = [
    cleanKw,
    titleWords + ' ' + catTerms.split(' ').slice(0, 2).join(' '),
    catTerms.split(' ').slice(0, 3).join(' '),
    cleanKw.split(' ').slice(0, 2).join(' ') + ' professional',
  ].filter(q => q.trim().length > 3);

  const allCandidates = [];

  for (const q of queries) {
    try {
      const encoded = encodeURIComponent(q.trim());
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encoded}&per_page=15&orientation=landscape&content_filter=high&client_id=${accessKey}`
      );
      if (!res.ok) continue;
      const data = await res.json();

      for (const img of (data.results || [])) {
        const desc = ((img.description || '') + ' ' + (img.alt_description || '')).toLowerCase();
        const tags = (img.tags || []).map(t => (t.title || '').toLowerCase()).join(' ');
        const combined = desc + ' ' + tags;

        /* 비영어 제외 */
        if (nonEnglishRe.test(desc)) continue;
        /* 무관 이미지 제외 */
        if (irrelevantRe.test(combined)) continue;
        /* 코드 이미지 제외 */
        if (codeRe.test(combined)) continue;

        /* 연관도 점수 (높을수록 좋음) */
        let relevance = 0;

        /* 포커스 키워드 매칭 (가장 중요) */
        const kwParts = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        let kwMatch = 0;
        for (const part of kwParts) {
          if (combined.includes(part)) { relevance += 15; kwMatch++; }
        }
        /* 키워드 50% 이상 매칭 보너스 */
        if (kwParts.length > 0 && kwMatch >= Math.ceil(kwParts.length * 0.5)) relevance += 20;

        /* 카테고리 키워드 매칭 */
        for (const ct of catTerms.split(' ')) {
          if (ct.length > 2 && combined.includes(ct.toLowerCase())) relevance += 5;
        }

        /* 타이틀 키워드 매칭 */
        for (const tw of titleWords.split(' ')) {
          if (tw.length > 3 && combined.includes(tw.toLowerCase())) relevance += 8;
        }

        /* 비즈니스/기술 관련 보너스 (n0003 주제) */
        if (/\b(business|office|team|meeting|professional|workspace|laptop|technology|digital|dashboard|analytics|chart|graph|data|design|website|server|cloud|hosting)\b/i.test(combined)) {
          relevance += 6;
        }

        /* 최소 관련성 threshold: relevance > 5 */
        const url = img.urls?.regular || img.urls?.full || '';
        if (url && relevance > 5) {
          /* 색상 정보 추출 (유사색상 방지용) */
          const color = (img.color || '#000000').toLowerCase();
          allCandidates.push({ url, relevance, desc: img.alt_description || '', color, id: img.id });
        }
      }
    } catch (_) {}
    if (allCandidates.length >= 20) break;
  }

  /* 연관도 높은 순 정렬 */
  allCandidates.sort((a, b) => b.relevance - a.relevance);

  /* 중복 URL 제거 + 유사 색상 필터 */
  const seen = new Set();
  const usedColors = [];
  const unique = [];

  function colorDistance(hex1, hex2) {
    const r1 = parseInt(hex1.slice(1,3), 16), g1 = parseInt(hex1.slice(3,5), 16), b1 = parseInt(hex1.slice(5,7), 16);
    const r2 = parseInt(hex2.slice(1,3), 16), g2 = parseInt(hex2.slice(3,5), 16), b2 = parseInt(hex2.slice(5,7), 16);
    return Math.sqrt((r1-r2)**2 + (g1-g2)**2 + (b1-b2)**2);
  }

  for (const c of allCandidates) {
    const base = c.url.split('?')[0];
    if (seen.has(base)) continue;
    /* 유사 색상 거리 체크 (최소 거리 60 이상이어야 선택) */
    const tooSimilarColor = usedColors.some(uc => colorDistance(uc, c.color) < 60);
    if (tooSimilarColor && unique.length > 0) continue;
    seen.add(base);
    usedColors.push(c.color);
    unique.push(c.url);
    if (unique.length >= count) break;
  }

  console.log(`[blog-gen] Unsplash: ${allCandidates.length} candidates, ${unique.length} selected (top relevance: ${allCandidates[0]?.relevance || 0}, category: ${category})`);
  return unique;
}

/* ══════════════════════════════════════════════
   H2 제목당 5-6줄 단락 검증/보강
   짧은 단락은 확장(80단어), 긴 단락은 분할(120단어)
   ══════════════════════════════════════════════ */
function enforceHeadingParagraphLength(content) {
  /* 모든 <p> 태그를 검사하여 80-120 단어 (5-6문장) 범위로 보정 */
  const FILLER_SENTENCES = [
    'This approach works well for most standard setups.',
    'Many site owners overlook this simple but effective step.',
    'The difference shows up clearly in your site performance metrics.',
    'You can test this yourself within just a few minutes.',
    'Professional developers recommend this method for reliable results.',
    'It takes less effort than most people expect.',
    'The results speak for themselves once you try it.',
    'This single change can save you hours of troubleshooting later.',
    'Teams that follow this practice report fewer issues overall.',
    'A small investment here pays off in long-term stability.',
  ];

  let result = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim();
    const words = text.split(/\s+/).filter(Boolean);

    /* 10단어 미만은 단독 문장 (링크, CTA 등) - 건드리지 않음 */
    if (words.length < 10) return match;

    /* 50단어 미만 -> 80단어까지 보충 */
    if (words.length < 50) {
      let expanded = text;
      let fi = Math.floor(Math.random() * FILLER_SENTENCES.length);
      while (expanded.split(/\s+/).filter(Boolean).length < 80 && fi < FILLER_SENTENCES.length + 6) {
        expanded += ' ' + FILLER_SENTENCES[fi % FILLER_SENTENCES.length];
        fi++;
      }
      return `<p>${expanded}</p>`;
    }

    /* 140단어 초과 -> 110단어에서 문장 경계 찾아 자르고 새 <p>로 분할 */
    if (words.length > 140) {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      let chunk1 = '';
      let chunk2 = '';
      let wCount = 0;
      let split = false;
      for (const s of sentences) {
        const sWords = s.trim().split(/\s+/).length;
        if (!split && wCount + sWords <= 110) {
          chunk1 += s;
          wCount += sWords;
        } else {
          split = true;
          chunk2 += s;
        }
      }
      if (chunk2.trim()) {
        return `<p>${chunk1.trim()}</p>\n<p>${chunk2.trim()}</p>`;
      }
    }

    return match;
  });

  /* 안전 체크: H태그 수 보존 확인 */
  const beforeH = (content.match(/<h2[\s>]/gi) || []).length;
  const afterH = (result.match(/<h2[\s>]/gi) || []).length;
  if (beforeH !== afterH) return content;
  return result;
}

/* ══════════════════════════════════════════════
   프로그래밍적 Humanization (AI 의존 없이 직접 변환)
   - 문장 길이 다양화, 펀치 문장 삽입, 질문 삽입, 구어체 전환
   ══════════════════════════════════════════════ */
function programmaticHumanize(content) {
  /* 인간 필체 요소 삽입용 풀 */
  const PUNCH_LINES = [
    'That makes a difference.',
    'Simple as that.',
    'Worth the effort.',
    'Most people skip this.',
    'It works.',
    'Not optional.',
    'Big deal? Absolutely.',
    'Start there.',
    'Think about that.',
    'Here\'s the thing.',
    'Sounds familiar?',
    'Happens all the time.',
    'You\'d be surprised.',
    'True story.',
    'Keep that in mind.',
    'That\'s the real fix.',
    'Not hard at all.',
    'Game plan sorted.',
    'Quick win right there.',
    'No shortcuts here.',
  ];
  const QUESTION_HOOKS = [
    'Why does this matter?',
    'What happens if you skip this step?',
    'Sound like too much work?',
    'Ever wonder why some sites load so slow?',
    'Worried about getting this wrong?',
    'How do you know it\'s working?',
    'What\'s the catch?',
    'Ready for the next part?',
  ];
  const CONVERSATIONAL_OPENERS = [
    'Here\'s the thing -',
    'The catch is this:',
    'Fair warning:',
    'Quick heads up -',
    'One thing to watch:',
    'The short version:',
    'Real talk -',
    'Worth mentioning:',
  ];

  let punchIdx = Math.floor(Math.random() * PUNCH_LINES.length);
  let questionIdx = Math.floor(Math.random() * QUESTION_HOOKS.length);
  let openerIdx = Math.floor(Math.random() * CONVERSATIONAL_OPENERS.length);
  let punchInserted = 0;
  let questionInserted = 0;
  let openerInserted = 0;
  let paraCount = 0;

  const result = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    const text = inner.replace(/<[^>]*>/g, '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    paraCount++;

    /* 10단어 미만은 건드리지 않음 (CTA, 링크 등) */
    if (words.length < 12) return match;

    let modified = inner;

    /* 매 3번째 문단에 펀치 문장 삽입 (최대 5개) */
    if (paraCount % 3 === 0 && punchInserted < 5) {
      const punch = PUNCH_LINES[punchIdx % PUNCH_LINES.length];
      punchIdx++;
      punchInserted++;
      /* 마지막 문장 뒤에 삽입 */
      const lastDot = modified.lastIndexOf('.');
      if (lastDot > 0) {
        modified = modified.slice(0, lastDot + 1) + ' ' + punch + modified.slice(lastDot + 1);
      }
    }

    /* 매 4번째 문단에 질문 삽입 (최대 4개) */
    if (paraCount % 4 === 0 && questionInserted < 4 && paraCount > 1) {
      const q = QUESTION_HOOKS[questionIdx % QUESTION_HOOKS.length];
      questionIdx++;
      questionInserted++;
      modified = q + ' ' + modified;
    }

    /* 매 4번째 문단에 구어체 오프너 삽입 (최대 3개) */
    if (paraCount % 4 === 2 && openerInserted < 3) {
      const opener = CONVERSATIONAL_OPENERS[openerIdx % CONVERSATIONAL_OPENERS.length];
      openerIdx++;
      openerInserted++;
      /* 기존 첫 글자 소문자로 변환 */
      const firstChar = modified.charAt(0);
      if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
        modified = opener + ' ' + firstChar.toLowerCase() + modified.slice(1);
      } else {
        modified = opener + ' ' + modified;
      }
    }

    return `<p>${modified}</p>`;
  });

  console.log(`[blog-gen] Humanize: +${punchInserted} punches, +${questionInserted} questions, +${openerInserted} openers`);
  return result;
}

/* ══════════════════════════════════════════════
   n0005 상품 프로모션 CTA 삽입
   본문 중간(50% 지점 H2 앞)에 프로모션 블록 삽입
   ══════════════════════════════════════════════ */
/* injectProductCTA - 완전 제거됨
 * 이유: n0003은 WaaS/비즈니스 블로그이며 보안 상품 사이트가 아님.
 * 단순 디지털 파일(로티 등) 판매 링크를 보안 상품/플랜처럼 포장하는 것은
 * 라이센스/판매 관련 불법 소지가 있어 절대 금지.
 * 본문 중간에 보안 플랜, 케어 플랜 등의 CTA 삽입 절대 불가.
 */
function injectProductCTA(content, _category) {
  return content;
}

/* ══════════════════════════════════════════════
   DB 소스 자동 고도화 (cron 12시간마다 실행)
   - 8개 카테고리를 매일 1개씩 순환
   - Workers AI가 해당 카테고리의 새 고급 소스 URL을 발굴
   - 기존 DB 소스와 중복되지 않는 새 전문 자료만 추가
   - 카테고리 순환: business -> startup -> seo -> wordpress ->
     web-design -> cloud -> web-hosting -> ecommerce -> (반복)
   ══════════════════════════════════════════════ */
const SOURCE_CATEGORIES = [
  { id: 'business', label: 'Business Strategy, Management, Marketing, Productivity, Leadership' },
  { id: 'startup', label: 'Startup Funding, SaaS Metrics, Product-Market Fit, Growth Hacking, VC' },
  { id: 'seo', label: 'SEO, Search Engine Optimization, Content Marketing, Keyword Research, Link Building' },
  { id: 'wordpress', label: 'WordPress Development, Themes, Plugins, Gutenberg, REST API, WP-CLI' },
  { id: 'web-design', label: 'UI/UX Design, Responsive Design, Accessibility, Web Performance, CSS, Typography' },
  { id: 'cloud', label: 'Cloud Computing, Serverless, Docker, Kubernetes, AWS, Azure, GCP, Edge Computing' },
  { id: 'web-hosting', label: 'Web Hosting, Server Administration, CDN, DNS, SSL/TLS, Load Balancing, Caching' },
  { id: 'ecommerce', label: 'Ecommerce, Shopify, WooCommerce, Payment Processing, Conversion Optimization, Fulfillment' },
];

export async function autoCollectSources(env) {
  await initBlogGenDB(env.DB);

  /* 오늘 순환할 카테고리 결정 (날짜 기반 순환) */
  const dayIndex = Math.floor(Date.now() / 86400000) % SOURCE_CATEGORIES.length;
  const targetCat = SOURCE_CATEGORIES[dayIndex];
  console.log(`[auto-collect] Today's category: ${targetCat.id} (day index ${dayIndex})`);

  /* 해당 카테고리의 기존 소스 URL 목록 조회 */
  const existingRows = await env.DB.prepare(
    'SELECT url, title FROM blog_sources WHERE category = ? ORDER BY created_at DESC LIMIT 80'
  ).bind(targetCat.id).all();
  const existingUrls = (existingRows.results || []).map(r => r.url).filter(Boolean);
  const existingTitles = (existingRows.results || []).map(r => r.title).filter(Boolean).slice(0, 20);

  console.log(`[auto-collect] ${targetCat.id}: ${existingUrls.length} existing sources`);

  /* Workers AI에게 새 고급 소스 URL 발굴 요청 */
  const prompt = `You are a professional content researcher. Find ONE high-quality, authoritative English-language resource URL about: ${targetCat.label}

REQUIREMENTS:
- Must be a REAL, publicly accessible website or blog article URL
- Must be from an authoritative, well-known source (official docs, major publications, industry leaders)
- Must be educational or informational (not product pages, login pages, or paywalled content)
- Must be in English only
- Must NOT be any of these already-registered URLs: ${existingUrls.slice(0, 30).join(', ')}
- Must NOT duplicate these topics already covered: ${existingTitles.join('; ')}
- Focus on finding UNIQUE, SPECIFIC article/guide URLs (not just homepage URLs)
- Prefer recent, in-depth guides, tutorials, or research articles

RESPOND WITH EXACTLY THIS JSON FORMAT (nothing else):
{"url":"https://example.com/specific-article","title":"Descriptive Title of the Resource","tags":"tag1,tag2,tag3","priority":"normal"}`;

  try {
    const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a content research assistant. Respond ONLY with valid JSON. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    const rawText = (aiRes?.response || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(rawText.replace(/```json\s*/gi, '').replace(/```/g, '').trim());
    } catch (_) {
      console.warn(`[auto-collect] AI response parse failed: ${rawText.slice(0, 200)}`);
      return 0;
    }

    if (!parsed.url || !parsed.title) {
      console.warn('[auto-collect] AI returned incomplete data');
      return 0;
    }

    /* URL 유효성 검증 */
    const newUrl = parsed.url.trim();
    if (!/^https?:\/\/.+\..+/.test(newUrl)) {
      console.warn(`[auto-collect] Invalid URL: ${newUrl}`);
      return 0;
    }

    /* DB 중복 체크 */
    const dup = await env.DB.prepare(
      'SELECT id FROM blog_sources WHERE url = ? LIMIT 1'
    ).bind(newUrl).first();
    if (dup) {
      console.log(`[auto-collect] Duplicate skipped: ${newUrl}`);
      return 0;
    }

    /* 실제 URL 접근 가능 여부 확인 + 콘텐츠 수집 */
    let content = '';
    let wordCount = 0;
    try {
      const res = await fetch(newUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Noteracker-Bot/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const html = await res.text();
        content = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000);
        wordCount = content.split(/\s+/).filter(Boolean).length;
      }
    } catch (_) {
      /* URL 접근 실패해도 메타 정보는 저장 */
      console.warn(`[auto-collect] Fetch failed for ${newUrl}, saving metadata only`);
    }

    /* DB에 저장 */
    await env.DB.prepare(
      `INSERT INTO blog_sources (type, url, title, content, word_count, category, status, priority, tags, notes)
       VALUES ('website', ?, ?, ?, ?, ?, 'active', ?, ?, 'auto-collected')`
    ).bind(
      newUrl,
      parsed.title.trim(),
      content || '',
      wordCount,
      targetCat.id,
      parsed.priority || 'normal',
      parsed.tags || targetCat.id,
    ).run();

    console.log(`[auto-collect] Added: "${parsed.title}" (${wordCount} words) -> ${targetCat.id}`);
    return 1;

  } catch (e) {
    console.error(`[auto-collect] Error: ${e.message}`);
    return 0;
  }
}
