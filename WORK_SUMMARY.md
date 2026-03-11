# 작업 요약 (2026-03-06)

## 완료된 작업

### 1. 컨테이너 너비 통일 (1500px, 좌우 50px 패딩)
- `public/css/style.css`: container padding `4rem 2rem` → `4rem 50px`
- `public/css/product.css`: `.product-grid` max-width 제거
- `public/css/services.css`: `.pricing-grid` max-width 제거
- `public/css/index.css`: `.index-blog-grid` max-width 제거
- `public/css/blog.css`: `.blog-grid` max-width 제거

### 2. CSS 유틸리티 클래스 추가 (`style.css`)
```css
.two-col-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}
.contact-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: start;
}
/* ≤1024px: 1열로 붕괴 */
```

### 3. services.html
- 가격표 섹션 제거
- 모든 인라인 max-width 제거

### 4. about.html
- 인라인 max-width wrapper 제거

### 5. malware-care.html
- 가격표 섹션 제거
- FAQ 섹션 제거
- Process 단계 카드 → `.two-col-grid` 적용

### 6. contact.html (전면 재구성 — noteracker.com/contact 기준)
구조:
- Hero
- Contact 섹션 (`.contact-layout` 2열)
  - 좌: Get In Touch 배지 → h2 → 설명 → 이메일/주소/회사 정보 → HOW IT WORKS 카드 (1~4 단계)
  - 우: Send us a message 폼 카드 (firstName, lastName, email, website, service select, message, submit)
- FAQ 섹션 (`.two-col-grid` 4개 카드)

### 7. product.html
- 가격 그리드 인라인 max-width 제거
- FAQ 인라인 max-width 제거

## 미완료 작업 (잔여)

- [ ] `product.html` FAQ 섹션 (lines 184~219) 삭제
- [ ] `services.html` Core Protection / Backup 단계 카드 → `.two-col-grid` 적용

## 배포 정보
- **라이브 사이트**: https://n0004.wonseok413.workers.dev
- **마지막 배포 버전**: `ff1c6df2-de6f-4781-bebc-1eb8b223a23c`
- **배포 명령**: `export PATH="/c/Program Files/nodejs:/c/Users/amyis/AppData/Roaming/npm:$PATH" && export CLOUDFLARE_API_TOKEN="wAk3kDGVK6_RCIwuV8715u2S_XS8V0MBPnhQmIde" && cd "/c/Users/amyis/Downloads/DDD/NNN/n0004 - 2" && npx wrangler deploy`
