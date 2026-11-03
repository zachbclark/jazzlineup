// Tokyo venue parsers — run via: node crawler/test.mjs
import assert from 'node:assert';
import { ok, TODAY } from './_harness.mjs';

// --- Tokyo -------------------------------------------------------------------------
import { personnelFromJpRun as jpRun, decodeBody } from '../lib.js';
import { applyRomaji } from '../clubs/_jpromaji.js';
import { parse as pitParse } from '../clubs/pitinn.js';
import { parse as bntParse } from '../clubs/bluenotetok.js';
import { parse as bsParse } from '../clubs/bodyandsoul.js';
import { parse as stParse } from '../clubs/sometimetok.js';
import { parse as alfieParse } from '../clubs/alfie.js';
import { parse as introGen } from '../clubs/introtok.js';

ok('jp: roster runs parse in both paren widths; prose stays out', () => {
  const a = jpRun('菊地成孔(Sax,Vo)林 正樹(P)宮嶋洋輔(G)小西佑果(B)秋元 修(Ds)');
  assert.equal(a.length, 5);
  assert.deepEqual(a[0], { name: '菊地成孔', instrument: 'sax, vocals' });
  const b = jpRun('井上JUJUヒロシ（sax） 岡 淳（sax） 緑川 英徳（sax）');
  assert.equal(b.length, 3);
  assert.deepEqual(jpRun('BIRTHDAY LIVE!! (great night)'), []);
  assert.deepEqual(jpRun('ソロ・ピアノ (solo piano night)'), []);
});

ok('jp: romaji only for verified names; half-translated mush suppressed', () => {
  assert.equal(applyRomaji('菊地成孔 クインテット'), 'Naruyoshi Kikuchi Quintet');
  assert.equal(applyRomaji('荒武裕一朗TRIO'), null);
  assert.equal(applyRomaji('岩崎宏美 アコースティックライブ 2026'), null);
});

ok('pitinn: day_box blocks -> dated events with start time, roster, sold-out flag', () => {
  const html = `
  <div class="day_box"><ul class="day_bar"><li class="date"> 7/1</li><li class="week"> Wed</li></ul>
    <div class="day_info"><div class="day_name">菊地成孔 クインテット</div>
      <div class="day_title">チケット売り切れ</div>
      <div class="day_open"> Open 19:00 /</div><div class="day_start"> Start 19:30</div>
      <div class="day_member">菊地成孔(Sax,Vo)林 正樹(P)宮嶋洋輔(G)小西佑果(B)秋元 修(Ds)</div>
      <div class="schedule_button"><a href="http://pit-inn.com/artist_live_info/260701kikuchi/">info</a></div>
    </div></div>`;
  const evs = pitParse(html, new Date(2026, 6, 19));
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-01');
  assert.deepEqual(evs[0].sets, ['19:30']);
  assert.equal(evs[0].personnel.length, 5);
  assert.equal(evs[0].titleAlt, 'Naruyoshi Kikuchi Quintet');
  assert.equal(evs[0].details, 'Sold out');
  assert.match(evs[0].url, /260701kikuchi/);
});

ok('bluenotejp: month page gives each run\'s info URL (2026-11 redesign)', () => {
  const html = `
    <a href="https://reserve.bluenote.co.jp/reserve/schedule/exec/4000" class="c-schedule-list-card type-today"
      data-schedule-modal-endpoint="https://reserve.bluenote.co.jp/reserve/schedule/read_event_info/4000">
      <p class="c-schedule-list-card__title">KIEFER</p></a>
    <div data-schedule-modal-endpoint="https://reserve.bluenote.co.jp/reserve/schedule/read_event_info/4000"></div>
    <a data-schedule-modal-endpoint="https://reserve.bluenote.co.jp/reserve/schedule/read_event_info/4008">
      <p class="c-schedule-list-card__title">KEIKO LEE BAND</p></a>`;
  assert.deepEqual(bntMonth(html), [
    'https://reserve.bluenote.co.jp/reserve/schedule/read_event_info/4000',
    'https://reserve.bluenote.co.jp/reserve/schedule/read_event_info/4000',
    'https://reserve.bluenote.co.jp/reserve/schedule/read_event_info/4008',
  ], 'the page\'s own URLs; the crawler dedupes across both months');
});

ok('bluenotejp: run JSON -> one event per date, per-date sets, price, artist url', () => {
  const info = {
    basic_info: {
      titles: { en_prefix: '', en_title: 'KIEFER', jp_title: 'キーファー', en_suffix: '★38thアニヴァーサリー' },
      catchphrase: 'ブルーノート・デビュー作をリリースする\r\nLAジャズ・シーンの最重要人物が初登場',
      music_charge_label: 'Music Charge ¥9,500',
    },
    schedule_list: [
      { date_iso: '2026-11-01', stages: [{ label: '1st', start_time: '4:30pm' }, { label: '2nd', start_time: '7:30pm' }] },
      { date_iso: '2026-11-02', stages: [{ label: '1st', start_time: '6:00pm' }, { label: '2nd', start_time: '8:30pm' }] },
    ],
    links: { detail_page_url: 'https://www.bluenote.co.jp/jp/artists/kiefer/' },
  };
  const evs = bntParse(info);
  assert.deepEqual(evs.map((e) => [e.date, e.sets]), [
    ['2026-11-01', ['16:30', '19:30']],
    ['2026-11-02', ['18:00', '20:30']],
  ]);
  assert.equal(evs[0].clubId, 'bluenotetok');
  assert.equal(evs[0].title, 'KIEFER');
  assert.equal(evs[0].titleAlt, 'キーファー');
  assert.equal(evs[0].priceText, '¥9,500');
  assert.equal(evs[0].url, 'https://www.bluenote.co.jp/jp/artists/kiefer/');
  assert.match(evs[0].details, /^ブルーノート・デビュー作をリリースする LAジャズ/);
});

ok('cottonclub: <br/> in a title becomes a space', () => {
  const evs = ccParse({
    basic_info: { titles: { en_title: 'odol ONE-MAN LIVE 2026  <br/>at COTTON CLUB', jp_title: 'オドル' },
      music_charge_label: 'Music Charge ¥6,600' },
    schedule_list: [{ date_iso: '2026-11-01', stages: [{ start_time: '4:30pm' }, { start_time: '7:30pm' }] }],
    links: { detail_page_url: 'https://www.cottonclubjapan.co.jp/jp/sp/artists/odol-261101/' },
  });
  assert.equal(evs[0].title, 'odol ONE-MAN LIVE 2026 at COTTON CLUB');
  assert.equal(evs[0].clubId, 'cottonclubtok');
});

ok('bluenotejp: same title, same night, two runs -> one event with both sets', () => {
  const run = (sets) => ccParse({ basic_info: { titles: { en_title: 'XMAS SPECIAL' } },
    schedule_list: [{ date_iso: '2026-12-24', stages: sets.map((t) => ({ start_time: t })) }] });
  const merged = bntMerge([run(['1:00pm']), run(['7:00pm', '9:30pm'])]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sets, ['13:00', '19:00', '21:30']);
});

ok('bluenotejp: full-width yen price; a date with no stages keeps the show, sets empty', () => {
  const evs = ccParse({
    basic_info: { titles: { en_title: 'TBA SPECIAL' }, music_charge_label: 'Music Charge ￥6,600 / ￥8,000' },
    schedule_list: [{ date_iso: '2026-12-31', stages: [] }, { date_iso: '2027-01-01', stages: [{ start_time: 'TBA' }] }],
  });
  assert.deepEqual(evs.map((e) => [e.date, e.sets, e.priceText]), [
    ['2026-12-31', [], '¥6,600'],
    ['2027-01-01', [], '¥6,600'],
  ]);
  assert.equal(evs[0].url, 'https://www.cottonclubjapan.co.jp/jp/sp/artists/', 'no artist page -> site url');
});

import { parseArtistPage as bntArtist, parseMonth as bntMonth, mergeRuns as bntMerge } from '../clubs/_bluenotejp.js';
import { parse as ccParse } from '../clubs/cottonclubtok.js';
ok('bluenotejp: artist-page MEMBER table -> roman roster', () => {
  const html = `<h5><img alt="MEMBER"></h5><table>
    <tr><td class="pr20"><p>Simon Phillips(ds)</p></td><td><p>サイモン・フィリップス（ドラムス）</p></td></tr>
    <tr><td class="pr20"><p>Ernest Tibbs(b)</p></td><td><p>アーネスト・ティブス（ベース）</p></td></tr>
    <tr><td class="pr20"><p>Otmaro Ruiz(key)</p></td><td><p>オトマロ・ルイーズ（キーボード）</p></td></tr>
  </table>`;
  const got = bntArtist(html);
  assert.deepEqual(got.personnel, [
    { name: 'Simon Phillips', instrument: 'drums' },
    { name: 'Ernest Tibbs', instrument: 'bass' },
    { name: 'Otmaro Ruiz', instrument: 'keys' },
  ]);
  assert.equal(bntArtist('<p>no member table</p>'), null);

  // Cotton Club shape: plain MEMBER heading, "Name (abbr)" lines, bracketed
  // sections after; the nav's MEMBERS link must not trigger the match
  const cc = bntArtist(`<nav><a href="/jp/members/">MEMBERS</a></nav>
    <p>MEMBER</p><p>Joyce Moreno (vo,g)<br>Tutty Moreno (ds)<br>Rodolfo Stroeter (b)<br>Helio Alves (p)</p>
    <p>[予約受付開始日]</p><p>【Web先行受付】</p>`);
  assert.deepEqual(cc.personnel.map((p) => p.name),
    ['Joyce Moreno', 'Tutty Moreno', 'Rodolfo Stroeter', 'Helio Alves']);
  assert.equal(cc.personnel[0].instrument, 'vocals, guitar');
});

ok('bodyandsoul: dated slugs, two-set times, inline roster, charge', () => {
  const html = `
  <h2 class="event-arc-title"><a href="https://bodyandsoul.co.jp/event/260719">小田桐和寛カルテット</a></h2>
  <div class="event-arc-info"><p>M.Charge ￥4,800(税込￥5,280)</p>
  <p>Open 18:30, 1st 19:30, 2nd 21:00</p></div>
  小田桐和寛(ds) 曽我部泰紀(as) 石川広行(tp) 中林薫平(b)`;
  const evs = bsParse(html);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].date, '2026-07-19');
  assert.deepEqual(evs[0].sets, ['19:30', '21:00']);
  assert.equal(evs[0].personnel.length, 4);
  assert.equal(evs[0].priceText, '¥4,800');
});

ok('sometime: text listings -> band or leader titles, matinee tag, rosters', () => {
  const html = `<p>2026.07 LIVE SCHEDULE</p>
  <p>07.01 wed 2set サキソフォビア 井上JUJUヒロシ（sax） 岡 淳（sax） 緑川 英徳（sax） 吉本 章紘（sax） ✴︎Charge 3,000yen</p>
  <p>07.04 sat 昼の部 2set 佐藤 達哉（sax） 瀬田 創太（p） ✴︎Charge2,000yen</p>`;
  const evs = stParse(html);
  assert.equal(evs.length, 2);
  assert.equal(evs[0].title, 'サキソフォビア', 'band name leads');
  assert.equal(evs[0].date, '2026-07-01');
  assert.equal(evs[0].personnel.length, 4);
  assert.equal(evs[0].priceText, '¥3,000');
  assert.match(evs[1].title, /昼の部/, 'matinee tagged');
  assert.equal(evs[1].personnel.length, 2);
});

ok('alfie: house set time from header; quoted band names; close days skipped', () => {
  const html = `<p>開店:18:45、演奏:19:15~20:45、閉店:23:30となります。</p>
  <p>1 (wed) [jazz] Ayuko(vo) 松原慶史(g) 高橋佳輝(eb) 塚田陽太(ds) ￥5500</p>
  <p>6 (mon) close</p>
  <p>7 (tue) [jazz] "Axis Quintet" 松坂光輝(pf) 龍野日菜子(tp) 松下美月(ts) 大参泰平(b) 後藤龍太郎(ds) ￥5500</p>
  <p>8 (wed) [world] SAYAKA(vln) Carlos Cespedes(vo,g) 川村竜(eb) ￥5500</p>`;
  const evs = alfieParse(html, 2026, 7);
  assert.equal(evs.length, 3, 'close day skipped');
  assert.deepEqual(evs[0].sets, ['19:15'], 'house start from header, not assumed');
  assert.equal(evs[0].title, 'Ayuko');
  assert.equal(evs[1].title, 'Axis Quintet', 'quoted band name wins');
  assert.equal(evs[1].personnel.length, 5);
  assert.equal(evs[2].details, '[world]', 'non-jazz genre tagged in details');
});

ok('intro: generator emits Tue/Wed/Thu/Sun jams + Saturday all-nighter, Mon/Fri dark', () => {
  const evs = introGen(new Date(2026, 6, 20)); // a Monday
  const jams = evs.filter((e) => e.titleAlt === 'Practice Jam Session');
  const allNighters = evs.filter((e) => /All-Night/.test(e.titleAlt ?? ''));
  assert.equal(jams.length, 32, '4 nights x 8 weeks');
  assert.equal(allNighters.length, 8);
  assert.ok(!evs.some((e) => [1, 5].includes(new Date(e.date + 'T12:00:00Z').getUTCDay())), 'Mon closed, Fri elsewhere');
});

ok('jp: verified names decorate personnel; unknown names stay native-only', () => {
  const evs = pitParse(`
  <div class="day_box"><ul class="day_bar"><li class="date"> 7/21</li></ul>
    <div class="day_info"><div class="day_name">坂田 明×Triple Edge</div>
      <div class="day_start"> Start 19:30</div>
      <div class="day_member">坂田 明(Sax,Cl,Vo)坪口昌恭(P,Syn)早川岳晴(B)藤掛正隆(Ds)</div>
    </div></div>`, new Date(2026, 6, 19));
  assert.equal(evs.length, 1);
  assert.equal(evs[0].titleAlt, 'Akira Sakata×Triple Edge');
  const p = evs[0].personnel;
  assert.equal(p[0].nameAlt, 'Akira Sakata');
  assert.equal(p[1].nameAlt, 'Masayasu Tzboguchi');
  assert.equal(p.filter((x) => x.nameAlt).length, 4, 'all four are verified names');
});

ok('lib: Shift_JIS pages decode correctly (the Alfie prod bug)', () => {
  // "￥5500" encoded as Shift_JIS bytes: UTF-8 decode mojibakes it
  const sjisBytes = new Uint8Array([0x3c, 0x6d, 0x65, 0x74, 0x61, 0x20, 0x63, 0x68, 0x61, 0x72, 0x73, 0x65, 0x74, 0x3d, 0x22, 0x53, 0x68, 0x69, 0x66, 0x74, 0x5f, 0x4a, 0x49, 0x53, 0x22, 0x3e, 0x81, 0x8f, 0x35, 0x35, 0x30, 0x30]);
  const out = decodeBody(sjisBytes.buffer, 'text/html');
  assert.ok(out.includes('￥5500'), 'yen sign must survive: ' + out.slice(-8));
  // plain UTF-8 stays untouched
  const utf8 = new TextEncoder().encode('<meta charset="utf-8">￥5500');
  assert.ok(decodeBody(utf8.buffer, 'text/html').includes('￥5500'));
});

// --- Billboard Live Tokyo ----------------------------------------------------------
import { parse as bbtParse } from '../clubs/billboardtok.js';
ok('billboardtok: shop-attributed cards; React comments stripped; both stages as sets', () => {
  const html = `
  <h2><span>>TOKYO<</span></h2><span>>TOKYO<</span>
  <div class="ArtistCardFull_root__x1"><hgroup>
    <h3 class="EventHeading_mainTitle__abc" aria-label="藤木直人"><span>藤木直人</span></h3>
    <p class="EventHeading_subTitle__def">Naohito Fujiki Live Tour ver14.5 Billboard Live 2026</p></hgroup>
    <ul><li>1st Stage<!-- --> / Open <!-- -->14:00<!-- --> / Start <!-- -->15:00</li>
    <li>2nd Stage<!-- --> / Open <!-- -->17:00<!-- --> / Start <!-- -->18:00</li></ul>
    <ul><li>S指定席 ￥13,100</li><li>カジュアル ￥11,500</li></ul></div>
  <span>>YOKOHAMA<</span>
  <div class="ArtistCardFull_root__x2"><h3 class="EventHeading_mainTitle__abc" aria-label="Someone Else"></h3>
    <ul><li>1st Stage / Start 15:00</li></ul></div>`;
  const evs = bbtParse(html, '2026-07-19');
  assert.equal(evs.length, 1, 'Yokohama card excluded');
  assert.equal(evs[0].title, '藤木直人');
  assert.match(evs[0].titleAlt, /Naohito Fujiki/);
  assert.deepEqual(evs[0].sets, ['15:00', '18:00']);
  assert.equal(evs[0].priceText, 'from ¥11,500');
});
