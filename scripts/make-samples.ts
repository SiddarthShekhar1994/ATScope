/**
 * Generates test fixtures in ./samples:
 *  - weak-two-column.pdf   : sidebar layout, contact in the header band, weak bullets
 *  - weak-sidebar.docx     : layout table + skills table + header contact + text box
 *  - decent-single.docx    : clean single column, mixed bullet quality
 */
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  HeadingLevel,
  BorderStyle,
} from 'docx';

const out = path.join(process.cwd(), 'samples');
fs.mkdirSync(out, { recursive: true });

async function twoColumnPdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const draw = (text: string, x: number, y: number, size = 10, f = font) => page.drawText(text, { x, y, size, font: f, color: ink });

  // Header band (top 0.5"): contact line where Word puts headers.
  draw('jordan.blake@email.com  |  (555) 201-8844  |  linkedin.com/in/jordanblake  |  Austin, TX', 72, 762, 9);

  // Name
  draw('Jordan Blake', 72, 715, 24, bold);
  draw('Marketing Coordinator', 72, 697, 12);

  // Left sidebar column (x 72..230)
  let y = 660;
  const left = (t: string, size = 9, f = font) => {
    draw(t, 72, y, size, f);
    y -= size + 4;
  };
  left('SKILLS', 11, bold);
  y -= 2;
  for (const s of ['Social Media', 'Microsoft Office', 'Canva', 'Email Campaigns', 'Google Analytics', 'Team Player', 'Communication', 'Hard Worker', 'Event Planning']) left(s);
  y -= 8;
  left('EDUCATION', 11, bold);
  y -= 2;
  left('B.A. Communications', 9, bold);
  left('State University');
  left('2016 - 2020');
  y -= 8;
  left('INTERESTS', 11, bold);
  y -= 2;
  left('Photography, travel,');
  left('yoga, podcasts');
  // Decorative skill bars (vector shapes)
  for (let i = 0; i < 9; i++) {
    page.drawRectangle({ x: 72, y: 250 - i * 14, width: 120, height: 5, color: rgb(0.85, 0.85, 0.85) });
    page.drawRectangle({ x: 72, y: 250 - i * 14, width: 40 + i * 8, height: 5, color: rgb(0.2, 0.2, 0.2) });
  }
  draw('PROFICIENCY', 72, 268, 11, bold);

  // Right main column (x 260..540)
  let ry = 660;
  const right = (t: string, size = 9.5, f = font, indent = 0) => {
    draw(t, 260 + indent, ry, size, f);
    ry -= size + 4;
  };
  right('ABOUT ME', 11, bold);
  ry -= 2;
  right('Results-driven and passionate marketing professional with experience in various');
  right('marketing tasks. I am a hard worker who thinks outside the box and is seeking');
  right('a dynamic role where I can leverage my skills.');
  ry -= 8;
  right('WHERE I HAVE WORKED', 11, bold);
  ry -= 2;
  right('Marketing Coordinator', 10, bold);
  right('Brightline Media, Austin TX   |   June 2021 - Present');
  right('- Responsible for managing social media accounts.', 9.5, font, 8);
  right('- Helped with email campaigns and newsletters.', 9.5, font, 8);
  right('- Worked on various marketing tasks as needed.', 9.5, font, 8);
  right('- Assisted with planning events and webinars.', 9.5, font, 8);
  right('- Duties included updating the website and blog.', 9.5, font, 8);
  ry -= 8;
  right('Marketing Intern', 10, bold);
  right('Lone Star Agency   |   Summer 2020');
  right('- Responsible for creating content for clients.', 9.5, font, 8);
  right('- Helped the team with research and reports.', 9.5, font, 8);
  right('- Attended meetings and took notes.', 9.5, font, 8);
  ry -= 8;
  right('Sales Associate', 10, bold);
  right('Retail Co   |   2018 - 2020');
  right('- Responsible for customer service and sales.', 9.5, font, 8);
  right('- Worked the register and stocked shelves.', 9.5, font, 8);

  // Footer
  draw('Page 1 of 1', 290, 30, 8);
  fs.writeFileSync(path.join(out, 'weak-two-column.pdf'), await pdf.save());
}

async function sidebarDocx() {
  const p = (text: string, opts: { bold?: boolean; bullet?: boolean; size?: number } = {}) =>
    new Paragraph({
      children: [new TextRun({ text, bold: opts.bold, size: (opts.size ?? 10.5) * 2 })],
      bullet: opts.bullet ? { level: 0 } : undefined,
    });
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  const sidebar = new TableCell({
    borders: cellBorders,
    width: { size: 32, type: WidthType.PERCENTAGE },
    children: [
      p('CONTACT', { bold: true, size: 11 }),
      p('Priya Natarajan'),
      p('priya.n@email.com'),
      p('(555) 318-2210'),
      p('San Jose, CA'),
      p(''),
      p('SKILLS', { bold: true, size: 11 }),
      p('Python'),
      p('SQL'),
      p('Excel'),
      p('Tableau'),
      p('Communication'),
      p('Problem Solving'),
      p(''),
      p('EDUCATION', { bold: true, size: 11 }),
      p('B.S. Information Systems'),
      p('San Jose State University'),
      p('2017 – 2021'),
    ],
  });
  const main = new TableCell({
    borders: cellBorders,
    width: { size: 68, type: WidthType.PERCENTAGE },
    children: [
      p('Priya Natarajan', { bold: true, size: 20 }),
      p('Data Analyst'),
      p(''),
      p('PROFILE', { bold: true, size: 11 }),
      p('Detail-oriented data analyst with a passion for turning data into insights. Seeking a challenging position in a fast-paced environment.'),
      p(''),
      p('EXPERIENCE', { bold: true, size: 11 }),
      p('Data Analyst, Nimbus Health — Jan 2022 – Present', { bold: true }),
      p('Responsible for building dashboards for the operations team.', { bullet: true }),
      p('Helped with weekly reporting and ad hoc analysis.', { bullet: true }),
      p('Worked with stakeholders to understand requirements.', { bullet: true }),
      p('Utilized SQL and Python for data cleaning.', { bullet: true }),
      p(''),
      p('Business Analyst Intern, Coastal Bank — Jun 2021 – Dec 2021', { bold: true }),
      p('Assisted with data collection and entry.', { bullet: true }),
      p('Participated in team meetings and presentations.', { bullet: true }),
      p('Created reports in Excel.', { bullet: true }),
    ],
  });
  const layout = new Table({ rows: [new TableRow({ children: [sidebar, main] })], width: { size: 100, type: WidthType.PERCENTAGE } });

  const skillsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: ['Languages', 'Python, SQL', 'Tools', 'Tableau, Excel'].map((t) => new TableCell({ children: [p(t)] })) }),
      new TableRow({ children: ['Databases', 'PostgreSQL', 'Methods', 'A/B testing'].map((t) => new TableCell({ children: [p(t)] })) }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        headers: { default: new Header({ children: [p('priya.n@email.com · (555) 318-2210 · linkedin.com/in/priyan')] }) },
        footers: { default: new Footer({ children: [p('Priya Natarajan — Résumé')] }) },
        children: [layout, p(''), p('TECHNICAL SUMMARY', { bold: true, size: 11 }), skillsTable],
      },
    ],
  });
  fs.writeFileSync(path.join(out, 'weak-sidebar.docx'), await Packer.toBuffer(doc));
}

async function decentDocx() {
  const p = (text: string, opts: { bold?: boolean; bullet?: boolean; size?: number; heading?: boolean } = {}) =>
    new Paragraph({
      heading: opts.heading ? HeadingLevel.HEADING_2 : undefined,
      children: [new TextRun({ text, bold: opts.bold, size: (opts.size ?? 10.5) * 2 })],
      bullet: opts.bullet ? { level: 0 } : undefined,
    });
  const doc = new Document({
    sections: [
      {
        children: [
          p('Marcus Oyelaran', { bold: true, size: 20 }),
          p('Chicago, IL · marcus.oyelaran@email.com · (555) 640-1177 · linkedin.com/in/marcusoyelaran · github.com/moyelaran'),
          p('Summary', { bold: true, size: 12 }),
          p('Backend engineer with 5 years building payment and ledger services in Go and Python. Owns reliability for systems handling 40M transactions a month.'),
          p('Experience', { bold: true, size: 12 }),
          p('Senior Software Engineer — Ledgerly, Chicago, IL | Mar 2022 – Present', { bold: true }),
          p('Led migration of the settlement service from Python to Go, cutting p99 latency from 900ms to 140ms across 40M monthly transactions.', { bullet: true }),
          p('Designed an idempotent retry layer that reduced duplicate payouts by 98%, saving an estimated $1.2M annually.', { bullet: true }),
          p('Responsible for on-call rotation and incident reviews.', { bullet: true }),
          p('Mentored 3 junior engineers; two were promoted within a year.', { bullet: true }),
          p('Software Engineer — Ledgerly | Jul 2019 – Mar 2022', { bold: true }),
          p('Built the reconciliation pipeline (Kafka, PostgreSQL) processing 6M records nightly with zero missed SLAs in 2021.', { bullet: true }),
          p('Worked on various features for the merchant dashboard.', { bullet: true }),
          p('Wrote integration tests that raised coverage from 41% to 83%.', { bullet: true }),
          p('Education', { bold: true, size: 12 }),
          p('B.S. Computer Science — University of Illinois Urbana-Champaign, 2019'),
          p('Skills', { bold: true, size: 12 }),
          p('Go, Python, PostgreSQL, Kafka, Redis, Docker, Kubernetes, AWS (ECS, RDS, SQS), Terraform, gRPC, Datadog'),
        ],
      },
    ],
  });
  fs.writeFileSync(path.join(out, 'decent-single.docx'), await Packer.toBuffer(doc));
}

void (async () => {
  await twoColumnPdf();
  await sidebarDocx();
  await decentDocx();
  console.log("samples written to", out);
})();
