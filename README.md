# ChromaSearch - 색상 기반 이미지 검색 시스템

ChromaSearch는 사용자가 원하는 색상과 비율을 지정하여 해당 색감이 많이 포함된 이미지를 검색하고 정렬할 수 있는 웹 애플리케이션입니다. 
HTML5 Canvas API를 이용하여 브라우저 내에서 직접 실시간 픽셀 RGB 분석과 HSL 계열 변환을 처리하며, 세련된 다크 모드 글래스모피즘(Glassmorphism) UI를 적용해 몰입감 있는 사용자 경험을 제공합니다.

---

## 🌟 주요 기능

1. **로그인 기능 (Mock 인증)**
   - 일반 이메일 로그인 시뮬레이션 및 GitHub/Google 소셜 로그인 스타일 연동
   - 비회원을 위한 게스트 모드 지원

2. **색상 검색 모드**
   - **단일 색상 검색**: HSL 기반의 색상 슬라이더와 6가지 퀵 프리셋(빨강, 주황, 노랑, 초록, 파랑, 보라)으로 원하는 색 계열을 즉시 필터링
   - **다중 색상 비율 검색**: 여러 개의 색상을 각각 원하는 비율(가중치)로 추가하고 조절하여 다차원 검색 진행

3. **실시간 이미지 분석 및 업로드 (Canvas API)**
   - 새로운 이미지 파일을 드래그 앤 드롭하면, 브라우저가 Canvas API로 즉시 픽셀 색상 비율을 50ms 이내로 분석
   - 분석 결과 바 차트 시각화 및 대표 색상(Dominant Color) 추출
   - 이미지 제목을 지정해 저장 시, 로컬 서버 데이터베이스(JSON)에 바로 추가되어 검색에 반영됨

4. **즐겨찾기 (Favorites)**
   - 마음에 드는 이미지 카드에서 하트 클릭 시 즐겨찾기 목록에 반영
   - '즐겨찾기' 탭을 통해 모아보기 가능 (로컬 스토리지 및 백엔드 연동)

5. **최근 검색 기록 (History)**
   - 이전 검색 조건들을 간편 히스토리 카드로 저장 및 언제든 클릭하여 복원 검색 가능

---

## 🛠 기술 스택

* **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript, HTML5 Canvas API
* **Backend**: Node.js, Express (인메모리 및 로컬 `db.json` 파일 기반 Mock 데이터베이스)

---

## 🚀 로컬 실행 방법

### 1. 의존성 패키지 설치
터미널을 열고 프로젝트 폴더 경로에서 아래 명령어를 실행하여 필요한 패키지(`express`)를 설치합니다.

```bash
# 일반적인 터미널 환경
npm install

# Windows PowerShell에서 권한(Execution Policy) 문제가 발생할 경우
npm.cmd install
```

### 2. 서버 실행
아래 명령어를 사용하여 Express 로컬 웹 서버를 실행합니다.

```bash
npm start
# 또는
node server.js
```

실행 후 브라우저에서 **[http://localhost:3000](http://localhost:3000)**에 접속합니다.

---

## 🐙 GitHub 업로드 가이드

이 프로젝트를 개인 GitHub 원격 저장소에 올리려면 다음 순서로 명령어를 실행하세요.

1. **Git 로컬 저장소 초기화 및 원격 브랜치 설정**
   ```bash
   git init
   git branch -M main
   ```

2. **파일 추가 및 커밋**
   ```bash
   git add .
   git commit -m "Initial commit: ChromaSearch 색상 기반 이미지 검색 시스템 완료"
   ```

3. **GitHub 원격 저장소 연동 및 푸시**
   - GitHub 사이트에서 새로운 빈 리포지토리(Repository)를 만듭니다.
   - 생성된 리포지토리 URL을 복사하여 아래 `<REPOSITORY_URL>` 자리에 넣고 실행합니다.
   ```bash
   git remote add origin <REPOSITORY_URL>
   git push -u origin main
   ```
   *(예: `git remote add origin https://github.com/사용자이름/색상이미지검색.git`)*
