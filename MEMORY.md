# n0003 프로젝트 메모리

## ⛔🚨 최최최우선 중단 규칙 🚨⛔

> ##### 🔴 ***<u>"중단" 또는 "중단해" 가 나오면 즉각 모든 생각·코딩·툴 실행을 멈추고 대기한다</u>*** 🔴
> ##### 🔴 ***<u>"중단" 또는 "중단해" 가 나오면 즉각 모든 생각·코딩·툴 실행을 멈추고 대기한다</u>*** 🔴
> ##### 🔴 ***<u>"중단" 또는 "중단해" 가 나오면 즉각 모든 생각·코딩·툴 실행을 멈추고 대기한다</u>*** 🔴
> ##### 🔴 ***<u>"중단" 또는 "중단해" 가 나오면 즉각 모든 생각·코딩·툴 실행을 멈추고 대기한다</u>*** 🔴
> ##### 🔴 ***<u>"중단" 또는 "중단해" 가 나오면 즉각 모든 생각·코딩·툴 실행을 멈추고 대기한다</u>*** 🔴

## 작업 지침 (최우선)
- **프리뷰 절대 금지**: `preview_start` 사용 금지
- **작업 흐름**: 수정내용 확인 → 대기 → "시작해" 명령 → 작업 → 완료 후 대기 → "배포해" 명령 → 배포
- 사용자 명령 없이 자의적으로 배포하지 않을 것
- **`` (em dash) 절대 사용 금지**: 어떤 새로운 텍스트, 코드, 주석, 프롬프트에도 `` (U+2014) 사용 금지. 대체: 필요시 `-` (하이픈) 또는 `,` 사용

## 배포 정보 (검증 완료)
- **사이트**: https://n0003.wonseok413.workers.dev
- **참조 사이트**: https://n0005.wonseok413.workers.dev
- **향후 도메인**: noteracker.kr
- **Cloudflare 계정**: wonseok413@gmail.com / Noteracker LTD.
- **API Token**: `wAk3kDGVK6_RCIwuV8715u2S_XS8V0MBPnhQmIde`
- **토큰 저장 위치**: `.env` 파일 (gitignore됨) + `deploy.sh` 스크립트
- **GitHub**: https://github.com/wonseok413-blip/n0003 (branch: main)
- **배포 순서**: 로컬 수정 → `git push origin main` → Cloudflare 배포
- **배포 명령**: `export PATH="/c/Program Files/nodejs:/c/Users/amyis/AppData/Roaming/npm:$PATH" && export CLOUDFLARE_API_TOKEN="wAk3kDGVK6_RCIwuV8715u2S_XS8V0MBPnhQmIde" && cd "/c/Users/amyis/Downloads/DDD/NNN/n0003" && npx wrangler deploy`
- **GitHub push**: `cd "/c/Users/amyis/Downloads/DDD/NNN/n0003" && git add -A && git commit -m "update" && git push origin main`

## 프로젝트 개요
- Noteracker Ltd. 웹사이트 (WordPress 멀웨어 케어 & 관리 서비스)
- n0004와 완벽히 동일한 사이트 (noteracker.kr 용)
- Cloudflare Workers로 배포 (wrangler), 정적 사이트 + Worker API
- 로컬 개발 서버: `server.js` (포트 8889)

## 필수 규칙

### 헤더/푸터 공통 컴포넌트
- **새로운 페이지를 만들 때 반드시 공통 헤더/푸터 컴포넌트를 사용할 것**
- 헤더: `public/components/header.html` (보조 헤더 `.sub-header` + 메인 헤더 `.header` 포함)
- 푸터: `public/components/footer.html`
- 페이지에 `<div id="header-one"></div>`, `<div id="footer-one"></div>` 삽입
- `src/worker.js`의 HTMLRewriter가 HEADER_HTML/FOOTER_HTML로 교체 주입
- 컴포넌트 내 경로는 모두 절대 경로 사용 (`/components/...`, `/images/...`, `/pages/...`)
- 헤더/푸터를 직접 HTML에 하드코딩하지 말 것
- 보조 헤더(프로모 바)도 `header.html` 안에서 함께 관리 (별도 파일 분리 금지)

## 파일 구조
- `public/` - 정적 파일 루트
- `public/components/` - 공통 컴포넌트 (header.html, footer.html)
- `public/css/` - 스타일시트
- `public/js/` - 전체 JS (컴포넌트 로딩, 애니메이션 등)
- `src/worker.js` - 메인 Worker (HTMLRewriter로 헤더/푸터 주입, API 라우트)
- `src/admin.js` - 관리자 API
- `src/auth.js` - 인증
- `src/blog-gen.js` - 블로그 자동생성
- `src/db.js` - DB 초기화
