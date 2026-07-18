import React from 'react';

// Concert-program rendering of a band roster.
//  - small groups: "Miles Okazaki guitar · Hannah Marks bass · Dan Weiss drums"
//  - big bands (8+): grouped by instrument, one section per line:
//      "tenor saxophone — Jon Irabagon, Anna Webber"
const BIG_BAND = 8;

// Tidy common long instrument words for display.
function shorten(instrument) {
  return instrument.replace(/\bsaxophones?\b/g, 'sax').replace(/\bsynthesizer\b/g, 'synth');
}

export default function Personnel({ personnel }) {
  if (!personnel?.length) return null;

  if (personnel.length >= BIG_BAND) {
    const sections = new Map(); // instrument -> [names], insertion-ordered
    for (const p of personnel) {
      const key = shorten(p.instrument);
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key).push(p.name);
    }
    return (
      <span className="personnel grouped">
        {[...sections.entries()].map(([inst, names]) => (
          <span key={inst} className="p-section">
            <span className="p-inst">{inst}</span> {names.join(', ')}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="personnel">
      {personnel.map((p, i) => (
        <span key={i} className="p-member">
          {p.name}{p.nameAlt && <span className="p-name-alt"> · {p.nameAlt}</span>} <span className="p-inst">{shorten(p.instrument)}</span>
          {i < personnel.length - 1 && <span className="p-sep"> · </span>}
        </span>
      ))}
    </span>
  );
}
