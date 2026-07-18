// Curated kanji -> romaji for Japanese jazz artists. VERIFIED READINGS ONLY:
// Japanese name readings are ambiguous (菊地成孔 is Naruyoshi, never the
// dictionary guess), so nothing goes in this table without a known-correct
// reading. An event whose artists aren't here simply shows no romaji line —
// absent beats wrong. Grow this table over time; suggest-a-venue mail and
// the r/Jazz crowd will happily correct us.
//
// applyRomaji(title) -> romanized title, or null when nothing (or not
// everything useful) could be converted.
const ARTISTS = {
  '菊地成孔': 'Naruyoshi Kikuchi',
  '林正樹': 'Masaki Hayashi',
  '林 正樹': 'Masaki Hayashi',
  '山下洋輔': 'Yosuke Yamashita',
  '上原ひろみ': 'Hiromi Uehara',
  '大西順子': 'Junko Onishi',
  '渡辺貞夫': 'Sadao Watanabe',
  '渡辺香津美': 'Kazumi Watanabe',
  '日野皓正': 'Terumasa Hino',
  '日野"JINO"賢二': 'Kenji "JINO" Hino',
  '小曽根真': 'Makoto Ozone',
  '秋吉敏子': 'Toshiko Akiyoshi',
  '穐吉敏子': 'Toshiko Akiyoshi',
  '峰厚介': 'Kosuke Mine',
  '板橋文夫': 'Fumio Itabashi',
  '林栄一': 'Eiichi Hayashi',
  '類家心平': 'Shinpei Ruike',
  '石若駿': 'Shun Ishiwaka',
  '挾間美帆': 'Miho Hazama',
  '馬場智章': 'Tomoaki Baba',
  '矢野沙織': 'Saori Yano',
  '川嶋哲郎': 'Tetsuro Kawashima',
  '須川崇志': 'Takashi Sugawa',
  '福田重男': 'Shigeo Fukuda',
  '西山瞳': 'Hitomi Nishiyama',
  '田中信正': 'Nobumasa Tanaka',
  '本田雅人': 'Masato Honda',
  '太田剣': 'Ken Ota',
  '宮川純': 'Jun Miyakawa',
  '井上銘': 'May Inoue',
  '市原ひかり': 'Hikari Ichihara',
  '纐纈歩美': 'Ayumi Koketsu',
  '桑原あい': 'Ai Kuwabara',
  '山中千尋': 'Chihiro Yamanaka',
  '大林武司': 'Takeshi Ohbayashi',
  '黒田卓也': 'Takuya Kuroda',
  '守屋純子': 'Junko Moriya',
  '池田篤': 'Atsushi Ikeda',
  '安ヵ川大樹': 'Daiki Yasukagawa',
  '坂田明': 'Akira Sakata',
  '坪口昌恭': 'Masayasu Tzboguchi',
  '早川岳晴': 'Takeharu Hayakawa',
  '藤掛正隆': 'Masataka Fujikake',
  '栗林すみれ': 'Sumire Kuribayashi',
  '藤本一馬': 'Kazuma Fujimoto',
  '大友良英': 'Otomo Yoshihide',
  '藤井郷子': 'Satoko Fujii',
  '田村夏樹': 'Natsuki Tamura',
  '佐藤允彦': 'Masahiko Satoh',
  '渋谷毅': 'Takeshi Shibuya',
  '森山威男': 'Takeo Moriyama',
  '本田珠也': 'Tamaya Honda',
  '芳垣安洋': 'Yasuhiro Yoshigaki',
  '水谷浩章': 'Hiroaki Mizutani',
  '松風鉱一': 'Koichi Matsukaze',
  '灰野敬二': 'Keiji Haino',
  '石橋英子': 'Eiko Ishibashi',
};

// JP listings space surname from given name unpredictably (坂田 明 vs 坂田明),
// so build a lookup that also carries every spaced split of each key.
const LOOKUP = {};
for (const [jp, en] of Object.entries(ARTISTS)) {
  LOOKUP[jp] = en;
  const bare = jp.replace(/\s+/g, '');
  LOOKUP[bare] = en;
  for (let i = 1; i < bare.length; i++) {
    LOOKUP[bare.slice(0, i) + ' ' + bare.slice(i)] = en;
  }
}

// Exact-name lookup for personnel chips: '坂田 明' -> 'Akira Sakata' | null.
export function romajiName(name) {
  const n = String(name).trim();
  return LOOKUP[n] ?? LOOKUP[n.replace(/\s+/g, '')] ?? null;
}

// Decorate a parsed roster with verified English names (nameAlt).
export function romajiPersonnel(personnel) {
  return personnel.map((p) => {
    const en = romajiName(p.name);
    return en ? { ...p, nameAlt: en } : p;
  });
}

// katakana ensemble/format words — unambiguous, safe to convert
const WORDS = {
  'トリオ': 'Trio', 'カルテット': 'Quartet', 'クインテット': 'Quintet',
  'セクステット': 'Sextet', 'セプテット': 'Septet', 'オクテット': 'Octet',
  'ビッグバンド': 'Big Band', 'オーケストラ': 'Orchestra', 'デュオ': 'Duo',
  'スペシャル': 'Special', 'セッション': 'Session', 'バンド': 'Band',
  'ソロ': 'Solo', 'ライブ': 'Live', 'ナイト': 'Night',
};

export function applyRomaji(title) {
  let t = String(title);
  let hit = false;
  // longest keys first so spaced variants don't leave fragments behind
  for (const jp of Object.keys(LOOKUP).sort((a, b) => b.length - a.length)) {
    if (t.includes(jp)) { t = t.split(jp).join(LOOKUP[jp]); hit = true; }
  }
  if (!hit) return null; // no verified artist -> no romaji line at all
  for (const [jp, en] of Object.entries(WORDS)) {
    t = t.split(jp).join(' ' + en);
  }
  t = t.replace(/\s+/g, ' ').trim();
  // if substantial kanji remains, the line would be half-translated mush —
  // only show romaji when the result reads clean
  const cjkLeft = (t.match(/[一-龯ぁ-ん]/g) ?? []).length;
  return cjkLeft <= 1 ? t : null;
}
