// Pushes an edited offer HTML file to the database, without touching its password.
// Run with: node scripts/syncOfferContent.js <slug> [path-to-html-file]
// Defaults to offers/<slug>.html if no file path is given.
// The file should be a complete, standalone HTML document (DOCTYPE, head, style, body) —
// this strips that wrapper down to a fragment before saving, since the gate page injects
// the content into its own shell rather than serving your file as a full page.

const fs = require('fs');
const path = require('path');
const prisma = require('../db');

function toFragment(html) {
  const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  if (!styleMatch || !bodyMatch) {
    throw new Error('Expected a full HTML document with a <style> block and a <body> tag');
  }
  return `${styleMatch[0]}\n\n${bodyMatch[1].trim()}\n`;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/syncOfferContent.js <slug> [path-to-html-file]');
    process.exit(1);
  }
  const filePath = process.argv[3] || path.join(__dirname, '../offers', `${slug}.html`);

  const existing = await prisma.vbvOffer.findUnique({ where: { slug } });
  if (!existing) {
    console.error(`No offer found for slug "${slug}". Use createOffer.js to create it first.`);
    process.exit(1);
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const offerHtml = toFragment(html);

  await prisma.vbvOffer.update({ where: { slug }, data: { offerHtml } });
  console.log(`Synced content for "${existing.churchName}" (/offer/${slug}) from ${filePath}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
