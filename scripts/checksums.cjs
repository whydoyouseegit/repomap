const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
async function checksums(){
  const release=path.resolve('release');
  const files=fs.readdirSync(release).filter(name=>/\.(?:zip|AppImage|dmg|exe)$/i.test(name)&&fs.statSync(path.join(release,name)).isFile()).sort();
  if(!files.length)throw new Error('No release artifacts to checksum');
  const sums=[];
  for(const name of files){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(path.join(release,name)))hash.update(chunk);sums.push(`${hash.digest('hex')}  ${name}`);}
  fs.writeFileSync(path.join(release,'SHA256SUMS.txt'),sums.join('\n')+'\n');console.log(`Checksummed ${files.length} release artifact(s)`);
}
checksums().catch(error=>{console.error(error.message);process.exitCode=1;});
