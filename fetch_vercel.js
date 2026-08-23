const https = require('https');
const token = process.env.VERCEL_TOKEN;

// Get the deployment details to find the deployment ID
const url = process.argv[2] || 'awlad-sakr-4g101etma-sayed1221.vercel.app';
https.get(`https://api.vercel.com/v13/deployments/${url}`, {
  headers: { 'Authorization': 'Bearer ' + token }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const deployment = JSON.parse(data);
    const id = deployment.id;
    console.log('Deployment ID:', id);

    // Get the files for this deployment
    https.get(`https://api.vercel.com/v6/deployments/${id}/files`, {
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        const files = JSON.parse(data2);
        const indexFile = files.find(f => f.name === 'index.html' || f.name === 'index');
        if(indexFile) {
          console.log('Found index.html, UID:', indexFile.uid);
          // Download the file content
          https.get(`https://api.vercel.com/v7/file/${indexFile.uid}`, {
             headers: { 'Authorization': 'Bearer ' + token }
          }, (res3) => {
             let htmlData = '';
             res3.on('data', chunk => htmlData += chunk);
             res3.on('end', () => {
               require('fs').writeFileSync('index_recovered_from_vercel.html', htmlData, 'utf8');
               console.log('Successfully recovered index.html from Vercel! Length:', htmlData.length);
             });
          });
        } else {
          console.log('Could not find index.html in files:', files.map(f=>f.name));
        }
      });
    });
  });
});
