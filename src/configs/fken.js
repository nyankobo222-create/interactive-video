// FKENコンフィグ
// url: null のチャプターはデモ用プレースホルダーで再生されます
// 実際の動画を使う場合は url に MP4 の URL を入れてください（Cloudflare R2 等）

export default {
  company: {
    name: "株式会社FKEN",
    tagline: "スタッフ募集 RECRUIT",
    phone: "0833-57-4497",
    contactUrl: "https://fken.net/#anker-contact",
  },
  theme: {
    primary: "#2a9824",
    primaryLight: "#e3f2fd",
  },
  chapters: {
    C01: { url: null, demoDuration: 15, demoLabel: "オープニング" },
    C02: { url: null, demoDuration: 4,  demoLabel: "タイトル：未経験からプロへ" },
    C03: { url: null, demoDuration: 8,  demoLabel: "スタッフ①：前職インタビュー" },
    C04: { url: null, demoDuration: 8,  demoLabel: "スタッフ①：研修の様子" },
    C05: { url: null, demoDuration: 8,  demoLabel: "スタッフ①：職場環境" },
    C06: { url: null, demoDuration: 4,  demoLabel: "タイトル：人間関係に自信あり" },
    C07: { url: null, demoDuration: 8,  demoLabel: "スタッフ②：人間関係インタビュー" },
    C08: { url: null, demoDuration: 8,  demoLabel: "スタッフ②：助け合いについて" },
    C09: { url: null, demoDuration: 8,  demoLabel: "スタッフ②：差し入れエピソード" },
    C10: { url: null, demoDuration: 4,  demoLabel: "タイトル：代表の想い" },
    C11: { url: null, demoDuration: 8,  demoLabel: "代表：働きやすさについて" },
    C12: { url: null, demoDuration: 8,  demoLabel: "代表：教育体制について" },
    C13: { url: null, demoDuration: 8,  demoLabel: "代表：求職者へのメッセージ" },
    C14: { url: null, demoDuration: 15, demoLabel: "エンドメニュー" },
  },
  flow: {
    intro: { chapter: "C01", pauseAt: 15 },
    branches: [
      {
        id: "b1",
        label: "01 未経験からプロへ",
        sublabel: "Zero to Pro",
        chapters: ["C02", "C03", "C04", "C05"],
      },
      {
        id: "b2",
        label: "02 人間関係に自信あり",
        sublabel: "Supportive Team",
        chapters: ["C06", "C07", "C08", "C09"],
      },
      {
        id: "b3",
        label: "03 代表の想い",
        sublabel: "CEO's Vision",
        chapters: ["C10", "C11", "C12", "C13"],
      },
    ],
    endMenu: "C14",
  },
};
