// Creates or updates a password-protected brand offer page.
// Run with: node scripts/createOffer.js path/to/offer.json
// The JSON file must have: { "slug": "...", "churchName": "...", "password": "...", "offerHtml": "..." }
// Upserts by slug, so re-running with the same slug updates that offer in place.

const fs = require('fs');
const bcrypt = require('bcrypt');
const prisma = require('../db');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/createOffer.js path/to/offer.json');
    process.exit(1);
  }

  const { slug, churchName, password, offerHtml } = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!slug || !churchName || !password || !offerHtml) {
    console.error('offer.json must include slug, churchName, password, and offerHtml');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const offer = await prisma.vbvOffer.upsert({
    where: { slug },
    update: { churchName, passwordHash, offerHtml },
    create: { slug, churchName, passwordHash, offerHtml },
  });

  console.log(`Saved offer "${offer.churchName}" at /offer/${offer.slug}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
