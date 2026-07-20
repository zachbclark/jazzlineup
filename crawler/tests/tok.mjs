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

ok('bluenotejp: rowspan runs fan out to each date; price + intro ride along', () => {
  const html = `
  <div class="scheduleTable"><table class="later"><tr>
    <td class="dayBox sat"><span class="day">1</span><span class="week">sat.</span></td>
    <td class="scheduleBox" rowspan="2"><span class="twoColumnsType clearfix">
      <span class="columnTxt"><span class="title">MASATO HONDA B.B.STATION -Big Band Night-</span></span></span></td>
    </tr><tr><td class="dayBox sun"><span class="day">2</span><span class="week">sun.</span></td></tr></table>
  <div class="priceBox"><div class="set"><span class="priceText">Music charge &yen;</span><span class="price">8,000</span></div></div>
  <div class="details"><span class="intro">スター・サックス奏者率いるビッグバンド</span></div></div>`;
  const evs = bntParse(html, 2026, 8);
  assert.equal(evs.length, 2, 'two dates from the rowspan run');
  assert.equal(evs[0].date, '2026-08-01');
  assert.equal(evs[1].date, '2026-08-02');
  assert.equal(evs[0].clubId, 'bluenotetok');
  assert.equal(evs[0].priceText, '¥8,000');
  assert.match(evs[0].details, /ビッグバンド/);
});

ok('bluenotejp: per-date seatings scope sets; artist link becomes the url', () => {
  const html = `
  <table class="later"><tr>
    <td class="dayBox"><span class="day">23</span><span class="week">thu.</span></td>
    <td class="scheduleBox" rowspan="3"><span class="columnTxt">
      <a href="https://www.bluenote.co.jp/jp/artists/citrus-sun/"><span class="title">CITRUS SUN</span></a></span></td>
    </tr><tr><td class="dayBox"><span class="day">24</span></td></tr>
    <tr><td class="dayBox sat"><span class="day">25</span></td></tr></table>
  <div class="priceBox"><span class="price">11,500</span></div>
  <div class="details">
    <span class="text">2026 7.23 thu. - 7.25 sat.</span>
    <span class="text">7.23 thu., 7.24 fri.<br />
　[1st]Open5:00pm Start6:00pm　[2nd]Open7:45pm Start8:30pm<br />
7.25 sat.<br />
　[1st]Open1:30pm Start2:30pm　[2nd]Open6:00pm Start7:00pm<br/></span>
  </div>`;
  const evs = bntParse(html, 2026, 7);
  assert.equal(evs.length, 3);
  assert.deepEqual(evs[0].sets, ['18:00', '20:30'], 'thu gets the weekday seatings');
  assert.deepEqual(evs[1].sets, ['18:00', '20:30']);
  assert.deepEqual(evs[2].sets, ['14:30', '19:00'], 'sat gets the matinee seatings');
  assert.match(evs[0].url, /artists\/citrus-sun/);
});

import { parseArtistPage as bntArtist, parseShowtimes as bntTimes } from '../clubs/_bluenotejp.js';
ok('bluenotejp: artist-page MEMBER table -> roman roster; single seating line = fallback', () => {
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

  const t = bntTimes('[1st]Open5:00pm Start6:00pm　[2nd]Open7:45pm Start8:30pm');
  assert.deepEqual(t.fallback, ['18:00', '20:30'], 'unscoped seating line covers the whole run');
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
