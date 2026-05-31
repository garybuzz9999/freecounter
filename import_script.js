const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  console.log(`Total: ${products.length}`);
  
  const BATCH_SIZE = 500;
  let done = 0;
  
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const chunk = products.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const p of chunk) {
      const ref = db.collection('products').doc(p.ean);
      batch.set(ref, { title: p.title, unit: p.unit });
    }
    await batch.commit();
    done += chunk.length;
    console.log(`✅ ${done} / ${products.length}`);
  }
  
  console.log('🎉 Done!');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
