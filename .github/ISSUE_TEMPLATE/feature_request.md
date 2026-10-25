---
name: "✨ 要望・機能追加 (Feature Request)"
about: "人が要望を記載し、AIが設計更新(Living Docs)→MK(TDD/VRT)→IT(全体回帰)へ細分化する親Issue"
labels: ["feature", "needs-refinement"]
---

## 1. 背景・目的（Why）
<!-- なぜこの機能や改修が必要なのか、解決したい読書・利用体験上の課題を記載 -->
- 

## 2. 実現したいこと・要望の概要（What）
<!-- イメージしている挙動や対象サイト・画面を箇条書きで記載（粗い粒度でOK） -->
- 
- 

## 3. 対象外スコープ（今回やらないこと）
- 

## 4. 気になっている点・制約事項（任意）
<!-- 縦書き/ルビ表示、キャッシュ挙動、WebViewフォールバック等で迷っている箇所があれば記載 -->
- 

---

## 🤖 AI 細分化・マイクロWF進行チェックリスト（AI が自動更新）
- [ ] **Step 1: 要望分析・未確定事項（Open Questions）の確認完了**
- [ ] **Step 2: 設計更新 PR（差分仕様 `docs/specs/changes/issue-XX-*.md` 作成 ＋ App全体正本 `docs/specs/` 反映 ＆ Sub-issue 分割）の合意・マージ（＝設計 `Approved`）**
- [ ] **Step 3: MK（TDD実装・1対1 Story/UT・C0/C1 100%・縦書き/ルビ VRT）Sub-issue の完了**
  - Sub-issues: <!-- AIが起票したSub-issue番号をリンク -->
- [ ] **Step 4: IT（Playwright 全体回帰シナリオ `SCN-xx` 更新・全件 100% PASS）完了**
- [ ] **Step 5: バグ記録・申し送り事項（`HO-xx`）の精算、および差分仕様の `docs/specs/changes/archive/` への移動完了**

