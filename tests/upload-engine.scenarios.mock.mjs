import fs from 'fs'; import crypto from 'crypto';
const el = () => ({ textContent:'', innerHTML:'', disabled:false, style:{}, value:'', classList:{add(){},remove(){},toggle(){}}, onclick:null });
const els = {}; globalThis.document = { getElementById: id => (els[id] ||= el()), querySelector: () => null, querySelectorAll: () => [] };
globalThis.Toast = { success:(...a)=>console.log('TOAST ok',...a), error:(...a)=>console.log('TOAST err',...a), warning:(...a)=>console.log('TOAST warn',...a), info(){} };
globalThis.Storage = { get:(k,d)=>d, set(){} }; globalThis.Modal = { confirm: async()=>true };
// ---- fake GitHub ----
const sha = b => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex');
const rnd = () => crypto.randomBytes(20).toString('hex');
const G = { blobs:{}, trees:{}, commits:{}, ref:null, calls:{} , movedOnce:false};
function treeFlat(t){ return G.trees[t] || {}; }
const J = (st, body, h={}) => ({ status:st, ok: st<300, headers:{ get:k=>({'content-type':'application/json',...h})[k.toLowerCase()]??null }, json: async()=>body, text: async()=>JSON.stringify(body) });
globalThis.fetch = async (url, opt={}) => {
  const m = (opt.method||'GET'); const p = url.replace('https://api.github.com/repos/o/r',''); const body = opt.body?JSON.parse(opt.body):null;
  G.calls[m+' '+p.split('/').slice(0,3).join('/')] = (G.calls[m+' '+p.split('/').slice(0,3).join('/')]||0)+1;
  if (G.refMissing && m==='GET' && p.startsWith('/git/ref/heads/')) return J(404,{message:'Not Found'});
  if (m==='GET' && p.startsWith('/git/ref/heads/')) return G.ref ? J(200,{object:{sha:G.ref}}) : J(409,{message:'Git Repository is empty.'});
  if (m==='GET' && p.startsWith('/branches')) return J(200, G.ref?[{name:'main'}]:[]);
  if (G.refMissing && m==='GET' && p.startsWith('/git/ref/')) return J(404,{message:'Not Found'});
  if (m==='GET' && p.startsWith('/git/commits/')) return J(200,{tree:{sha:G.commits[p.split('/')[3]].tree}});
  if (m==='GET' && p.startsWith('/git/trees/')) { const t=treeFlat(p.split('/')[3].split('?')[0]); return J(200,{truncated:false,tree:Object.entries(t).map(([path,v])=>({path,type:'blob',sha:v.sha,mode:v.mode}))}); }
  if (m==='POST' && p==='/git/blobs') { if(!G.ref) return J(409,{message:'Git Repository is empty.'}); if(!G.rl){G.rl=1; return J(403,{message:'You have exceeded a secondary rate limit'},{'retry-after':'0'});} if(G.failBlob && G.failBlob()) return J(502,{message:'Bad gateway'}); const b=Buffer.from(body.content,'base64'); const s=sha(b); G.blobs[s]=b; return J(201,{sha:s}); }
  if (m==='POST' && p==='/git/trees') { G.treeCalls=(G.treeCalls||0)+1; const t={...treeFlat(body.base_tree)}; for(const e of body.tree){ const s=e.sha||sha(Buffer.from(e.content,'utf8')); if(e.content!==undefined) G.blobs[s]=Buffer.from(e.content); t[e.path]={sha:s,mode:e.mode}; } const id=rnd(); G.trees[id]=t; return J(201,{sha:id}); }
  if (m==='POST' && p==='/git/commits') { const id=rnd(); G.commits[id]={tree:body.tree,parents:body.parents,message:body.message}; return J(201,{sha:id}); }
  if (m==='PATCH' && p.startsWith('/git/refs/heads/')) { if(!G.movedOnce && G.simulateMove){ G.movedOnce=true; const id=rnd(); G.commits[id]={tree:G.commits[G.ref].tree,parents:[G.ref]}; const t={...treeFlat(G.commits[G.ref].tree),'other.txt':{sha:sha(Buffer.from('x')),mode:'100644'}}; const tid=rnd(); G.trees[tid]=t; G.commits[id].tree=tid; G.ref=id; return J(422,{message:'Update is not a fast forward'}); } if(!G.commits[body.sha].parents.includes(G.ref)) return J(422,{message:'not ff'}); G.ref=body.sha; return J(200,{}); }
  if (m==='PUT' && p.startsWith('/contents/')) { const path=decodeURIComponent(p.slice(10)); const b=Buffer.from(body.content,'base64'); const s=sha(b); const tid=rnd(); G.trees[tid]={[path]:{sha:s,mode:'100644'}}; const id=rnd(); G.commits[id]={tree:tid,parents:[]}; G.ref=id; return J(201,{commit:{sha:id},content:{sha:s}}); }
  return J(404,{message:'Not Found '+m+' '+p});
};
eval((()=>{const s=fs.readFileSync(new URL('../www/index.html', import.meta.url),'utf8');const g=(a,e)=>{const i=s.indexOf(a);return s.slice(i,s.indexOf(e,i));};return g('const Utils = {','/* ====')+'\n'+g('class GitHubAPI {','/* ====')+'\n'+g('class UploaderEngine {','/* ====');})()+';globalThis.Utils=Utils;globalThis.GitHubAPI=GitHubAPI;globalThis.UploaderEngine=UploaderEngine;');

let pass=0, fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('PASS',m);} else {fail++;console.log('FAIL',m);} };
const api=new GitHubAPI(); api.setToken('t');
let cfg={repo:'o/r',branch:'main',folder:'',message:'msg',authorName:'Ali',authorEmail:'a@x.com',mode:'all'};
let files=[];
globalThis.App = { api, goTo(){}, log(){}, uploadConfig:{getConfig:()=>cfg}, settingsManager:{get:()=>({concurrency:4,retries:1,retryDelay:1,confirmUpload:false,inlineKB:512})}, zipManager:{ getSelected:()=>files, getData: async f=>f.data } };
const eng=new UploaderEngine(); eng._sleep=()=>Promise.resolve();
const tree=()=>treeFlat(G.commits[G.ref].tree);
// A) 1200 text files -> single commit, batched trees
files=Array.from({length:1200},(_,i)=>({id:'t'+i,path:`data/f${i}.txt`,size:8,data:new Uint8Array(Buffer.from('file '+i+'\n'))}));
await eng.start();
ok(Object.keys(tree()).length===1200,'A: 1200 files in repo');
ok(G.treeCalls>=4,'A: tree built in batches ('+G.treeCalls+' requests)');
ok(eng.stats.uploaded===1200 && eng.stats.failed===0,'A: stats uploaded=1200');
const blobCallsA = G.calls['POST /git/blobs']||0;
ok(blobCallsA===0,'A: text files inlined, no blob requests');
ok(G.commits[G.ref].parents.length===1,'A: one new commit on top of bootstrap');
// B) folder prefix + author
cfg.folder='docs/v1'; files=[{id:'b1',path:'x.md',size:2,data:new Uint8Array(Buffer.from('hi'))}];
await eng.start();
ok(!!tree()['docs/v1/x.md'],'B: target folder prefix applied');
// C) persistent blob failure on one binary file -> others committed, failed listed, retry fixes it
cfg.folder=''; let bad=true;
files=[{id:'c1',path:'bin/a.bin',size:3,data:new Uint8Array([0,1,2])},{id:'c2',path:'bin/b.bin',size:3,data:new Uint8Array([0,9,9])},{id:'c3',path:'c.txt',size:2,data:new Uint8Array(Buffer.from('ok'))}];
let n=0; G.failBlob=()=>{ n++; return bad && n<=2; }; // first blob (+its retry) fail
await eng.start();
ok(eng.stats.failed===1,'C: exactly one failed file');
ok(Object.keys(tree()).filter(k=>k.startsWith('bin/')||k==='c.txt').length===2,'C: other two committed');
bad=false; await eng.retry('failed');
ok(eng.stats.failed===0 && !!tree()['bin/a.bin'] && !!tree()['bin/b.bin'],'C: retry failed uploads the missing file');
// D) update-only mode
cfg.mode='update'; files=[{id:'d1',path:'c.txt',size:3,data:new Uint8Array(Buffer.from('ok2'))},{id:'d2',path:'nope.txt',size:1,data:new Uint8Array(Buffer.from('n'))}];
await eng.start();
ok(!tree()['nope.txt'] && G.blobs[tree()['c.txt'].sha].toString()==='ok2','D: update-only updates existing, skips new');
// E) branch missing on non-empty repo -> clear error, nothing committed
cfg.mode='all'; cfg.branch='does-not-exist'; const before=G.ref; G.refMissing=true;
await eng.start();
ok(G.ref===before && eng.stats.failed===2,'E: missing branch fails cleanly');
cfg.branch='main'; G.refMissing=false;
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
