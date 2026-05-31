const https = require('https');
const fs = require('fs');

const key = JSON.parse(process.env.FIREBASE_KEY);
const PROJECT = key.project_id;

// Get OAuth token using service account
async function getToken() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/datastore']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token;
}

async function writeDoc(token, ean, title, unit) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      fields: {
        title: { stringValue: title },
        unit: { stringValue: unit }
      }
    });
    const options = {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT}/databases/(default)/documents/products/${ean}`,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { GoogleAuth } = require('google-auth-library');
  
  const products = JSON.parse(fs.readFileSync('products.json', 'utf8'));
  console.log(`Total: ${products.length}`);
  
  let token = await getToken();
  let done = 0, errors = 0;
  const CONCURRENT = 20;

  for (let i = 0; i < products.length; i += CONCURRENT) {
    if(i % 2000 === 0 && i > 0) {
      token = await getToken(); // refresh token
      console.log(`✅ ${i} / ${products.length}`);
    }
    
    const chunk = products.slice(i, i + CONCURRENT);
    await Promise.all(chunk.map(async p => {
      for(let attempt = 0; attempt < 3; attempt++) {
        try {
          await writeDoc(token, p.ean, p.title, p.unit);
          done++;
          return;
        } catch(e) {
          await sleep(1000 * (attempt + 1));
        }
      }
      errors++;
    }));
  }
  
  console.log(`🎉 Done! ${done} uploaded, ${errors} errors`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
