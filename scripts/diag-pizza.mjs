// PizzaExpress: what does the CRAWLER'S OWN fetch client receive?
//   node scripts/diag-pizza.mjs
import { fetchText } from '../crawler/lib.js';

const HEADERS = {
  accept: 'application/json',
  origin: 'https://www.pizzaexpresslive.com',
  referer: 'https://www.pizzaexpresslive.com/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

for (const per of [5, 30]) {
  const url = `https://api.pizzaexpresslive.com/products/search-event-information?page=1&itemsPerPage=${per}`;
  try {
    const body = await fetchText(url, { headers: HEADERS });
    let arr = null;
    try { const j = JSON.parse(body); arr = Array.isArray(j) ? j : (j.results ?? j.items ?? j.data ?? null); } catch { /* not json */ }
    const locs = arr ? [...new Set(arr.map((e) => e.location))].slice(0, 6) : null;
    console.log(`per=${per}: bytes=${body.length} items=${arr?.length ?? 'not-array'} locations=${JSON.stringify(locs)}`);
    if (!arr) console.log('  body head:', body.slice(0, 150).replace(/\s+/g, ' '));
  } catch (err) {
    console.log(`per=${per}: fetch FAILED -> ${String(err.message).slice(0, 100)}`);
  }
}

// round 2: show a raw Soho item and what parse() does with the real payload
import { parse as pxParse } from '../crawler/clubs/pizzaexpresslive.js';
const url2 = 'https://api.pizzaexpresslive.com/products/search-event-information?page=1&itemsPerPage=30';
const body2 = await fetchText(url2, { headers: HEADERS });
const arr2 = (() => { const j = JSON.parse(body2); return Array.isArray(j) ? j : (j.results ?? j.items ?? j.data ?? []); })();
const soho = arr2.find((e) => /soho/i.test(String(e.location))) ?? arr2[0];
console.log('raw item:', JSON.stringify(soho).slice(0, 500));
console.log('parse() on real payload:', pxParse(body2).length);
