const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function writeBatchWithRetry(batch, attempt = 0) {
  try {
    await batch.commit();
  } catch(e) {
    if(attempt < 5) {
      console.log(`Retry ${attempt+1} after error: ${e.code}`);
      await sleep(2000 * (attempt + 1));
      await writeBatchWithRetry(batch, attempt + 1);
    } else {
      throw e;
    }
  }
}

async function main() {
  const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  console.log(`Total: ${products.length}`);
  
  const BATCH_SIZE = 200;
  let done = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of chunk) {
      batch.set(db.collection('products').doc(p.ean), { title: p.title, unit: p.unit });
    }
    await writeBatchWithRetry(batch);
    done += chunk.length;
    if(done % 2000 === 0) console.log(`✅ ${done} / ${products.length}`);
    await sleep(100);
  }
  
  console.log(`🎉 Done! ${done} products uploaded`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
