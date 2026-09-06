// Markdown -> DOCX converter for the Arc local node guide (TR + EN).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  ExternalHyperlink, convertInchesToTwip,
} = require('docx');

const ACCENT = '1D53C8';
const INK = '131A23';
const MUTED = '55606E';
const WARN = 'B4530C';
const RULE = 'D8DEE6';
const CODE_BG = 'F2F4F7';
const HEAD_BG = 'E9EDF2';

const BODY_FONT = 'Calibri';
const HEAD_FONT = 'Segoe UI Semibold';
const MONO = 'Consolas';

const CONTENT_WIDTH = 9700; // DXA, A4 minus margins

// ---------- inline formatting ----------
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s,)]+)/g;

// Word has no colour-emoji fallback in these fonts, so emoji render as tofu
// boxes. Strip them; the callout borders carry the same signal visually.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{23E9}-\u{23FF}\u{FE0F}\u{200D}]/gu;
function clean(s) {
  return s.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/^ +/, '');
}

function runs(rawText, opts = {}) {
  const text = clean(rawText);
  const base = {
    font: opts.font || BODY_FONT,
    size: opts.size || 21, // half-points
    color: opts.color || INK,
    bold: opts.bold || false,
  };
  const out = [];
  let last = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ ...base, text: text.slice(last, m.index) }));
    const tok = m[0];
    if (tok.startsWith('**')) {
      out.push(new TextRun({ ...base, text: tok.slice(2, -2).replace(/`/g, ''), bold: true }));
    } else if (tok.startsWith('`')) {
      out.push(new TextRun({ ...base, text: tok.slice(1, -1), font: MONO, size: base.size - 2, color: ACCENT }));
    } else if (tok.startsWith('[')) {
      const label = tok.slice(1, tok.indexOf(']'));
      const url = tok.slice(tok.indexOf('](') + 2, -1);
      out.push(new ExternalHyperlink({
        link: url,
        children: [new TextRun({ ...base, text: label, color: ACCENT, underline: {} })],
      }));
    } else {
      out.push(new ExternalHyperlink({
        link: tok,
        children: [new TextRun({ ...base, text: tok, color: ACCENT, underline: {}, font: MONO, size: base.size - 2 })],
      }));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ ...base, text: text.slice(last) }));
  if (out.length === 0) out.push(new TextRun({ ...base, text: '' }));
  return out;
}

function para(text, opts = {}) {
  return new Paragraph({
    children: runs(text, opts),
    spacing: { after: opts.after === undefined ? 120 : opts.after, line: 276 },
    alignment: opts.alignment,
    indent: opts.indent,
    bullet: opts.bullet,
  });
}

function heading(text, level) {
  const sizes = { 1: 34, 2: 26, 3: 22 };
  const cleaned = clean(text).replace(/\*\*/g, '').replace(/`/g, '').trim();
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    spacing: { before: level === 1 ? 0 : level === 2 ? 360 : 240, after: level === 3 ? 100 : 160 },
    children: [new TextRun({
      text: cleaned,
      font: HEAD_FONT,
      size: sizes[level],
      bold: true,
      color: level === 3 ? INK : ACCENT,
    })],
  });
}

function codeBlock(lines, lang) {
  const paras = [];
  if (lang) {
    paras.push(new Paragraph({
      spacing: { before: 120, after: 0 },
      shading: { type: ShadingType.CLEAR, fill: CODE_BG },
      indent: { left: 140, right: 140 },
      children: [new TextRun({ text: lang.toUpperCase(), font: MONO, size: 14, color: MUTED, characterSpacing: 20 })],
    }));
  }
  lines.forEach((line, i) => {
    // keep code indentation intact — only the emoji are dropped
    const text = line.replace(EMOJI, '').replace(/^\s+$/, '');
    paras.push(new Paragraph({
      spacing: { before: i === 0 && !lang ? 120 : 0, after: i === lines.length - 1 ? 180 : 0, line: 260 },
      shading: { type: ShadingType.CLEAR, fill: CODE_BG },
      indent: { left: 140, right: 140 },
      children: [new TextRun({ text: text || ' ', font: MONO, size: 18, color: INK })],
    }));
  });
  return paras;
}

function quoteBlock(lines) {
  // ⚠️ marks a warning callout, everything else reads as a note
  const color = lines.some((l) => l.includes('⚠')) ? WARN : ACCENT;
  return lines.map((line, i) => new Paragraph({
    spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 180 : 40, line: 276 },
    indent: { left: 220 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color, space: 10 } },
    children: runs(line, { color: MUTED }),
  }));
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function buildTable(rows) {
  const header = splitRow(rows[0]);
  const bodyRows = rows.slice(2).map(splitRow);
  const cols = header.length;

  // weight columns by longest cell content
  const weights = new Array(cols).fill(1);
  [header, ...bodyRows].forEach((r) => {
    for (let i = 0; i < cols; i++) {
      const len = (r[i] || '').replace(/\[|\]\([^)]*\)|`|\*/g, '').length;
      weights[i] = Math.max(weights[i], Math.min(len, 60));
    }
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.max(900, Math.round((w / total) * CONTENT_WIDTH)));
  const sum = widths.reduce((a, b) => a + b, 0);
  widths[cols - 1] += CONTENT_WIDTH - sum;

  const cell = (text, i, isHeader) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: HEAD_BG } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      spacing: { after: 0, line: 260 },
      children: runs(text, { bold: isHeader, size: isHeader ? 19 : 19, color: isHeader ? MUTED : INK }),
    })],
  });

  return new Table({
    columnWidths: widths,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 6, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 6, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 6, color: RULE },
    },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, i, true)) }),
      ...bodyRows.map((r) => new TableRow({ children: r.map((t, i) => cell(t || '', i, false)) })),
    ],
  });
}

function hr() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 1 } },
    children: [new TextRun({ text: '' })],
  });
}

// ---------- markdown walk ----------
function convert(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(...codeBlock(buf, lang));
      continue;
    }

    if (/^\|/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) { buf.push(lines[i]); i++; }
      if (buf.length >= 2) {
        out.push(buildTable(buf));
        out.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '' })] }));
      }
      continue;
    }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(...quoteBlock(buf.filter((l) => l.trim() !== '')));
      continue;
    }

    if (/^-\s+/.test(line)) {
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        out.push(para(lines[i].replace(/^-\s+/, ''), { bullet: { level: 0 }, after: 60 }));
        i++;
      }
      out.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: '' })] }));
      continue;
    }

    if (/^---\s*$/.test(line)) { out.push(hr()); i++; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { out.push(heading(h[2], h[1].length)); i++; continue; }

    if (line.trim() === '') { i++; continue; }

    // consecutive non-empty lines form one paragraph
    const buf = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() !== '' &&
      !/^[#>|-]/.test(lines[i]) && !/^```/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    const text = buf.join(' ');
    const italic = /^\*[^*].*\*$/.test(text.trim());
    out.push(new Paragraph({
      spacing: { after: 140, line: 276 },
      children: italic
        ? [new TextRun({ text: text.trim().slice(1, -1), italics: true, color: MUTED, size: 19, font: BODY_FONT })]
        : runs(text),
    }));
  }
  return out;
}

// ---------- build ----------
async function build(srcPath, outPath, meta) {
  const md = fs.readFileSync(srcPath, 'utf8');
  const children = [
    new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: meta.title, font: HEAD_FONT, size: 40, bold: true, color: ACCENT })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: meta.subtitle, font: BODY_FONT, size: 22, color: MUTED })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
      children: [new TextRun({ text: meta.chips, font: MONO, size: 16, color: MUTED })],
    }),
    // drop the markdown's own H1 (replaced by the header above) and the
    // cross-language link, which means nothing in a standalone Word file
    ...convert(
      md.split(/\r?\n/)
        .filter((l, idx) => !(idx === 0 && /^#\s/.test(l)) && !/^(🇬🇧|🇹🇷)/.test(l))
        .join('\n')
    ),
  ];

  const doc = new Document({
    creator: 'izzetcakmak',
    title: meta.title,
    description: meta.subtitle,
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.85),
            bottom: convertInchesToTwip(0.85),
            left: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
          },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('wrote', outPath, (buffer.length / 1024).toFixed(0) + ' KB');
}

(async () => {
  const dir = path.dirname(__filename);
  await build(
    path.join(dir, 'README.tr.md'),
    process.argv[2],
    {
      title: 'Arc Local Node — Kurulum Rehberi',
      subtitle: 'Kendi bilgisayarında tam bir Arc test ağı: 5 validator, 1 full node, blok tarayıcı ve Grafana.',
      chips: 'arc-node v0.8.0 (Zero8)  ·  chain id 1337  ·  gas: USDC  ·  rpc :8545  ·  grafana :3000  ·  WSL2 / Ubuntu',
      skipLines: 8,
    }
  );
  await build(
    path.join(dir, 'README.md'),
    process.argv[3],
    {
      title: 'Arc Local Node — Setup Guide',
      subtitle: 'A complete Arc test network on your own machine: 5 validators, 1 full node, explorer and Grafana.',
      chips: 'arc-node v0.8.0 (Zero8)  ·  chain id 1337  ·  gas: USDC  ·  rpc :8545  ·  grafana :3000  ·  WSL2 / Ubuntu',
      skipLines: 8,
    }
  );
})();
