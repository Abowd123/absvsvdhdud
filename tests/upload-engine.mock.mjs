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
  if (m==='GET' && p.startsWith('/git/ref/heads/')) return G.ref ? J(200,{object:{sha:G.ref}}) : J(409,{message:'Git Repository is empty.'});
  if (m==='GET' && p.startsWith('/branches')) return J(200, G.ref?[{name:'main'}]:[]);
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
const files = [
  {id:'1',path:'README.md',size:6,data:Buffer.from('hello\n')},
  {id:'2',path:'src/app.js',size:10,data:Buffer.from('console.log(1)')},
  {id:'3',path:'img/logo.png',size:4,data:Buffer.from([0x89,0x50,0,0xff])},
  {id:'4',path:'gradlew',size:3,data:Buffer.from('#!x'),executable:true},
].map(f=>({...f,data:new Uint8Array(f.data)}));
const api=new GitHubAPI(); api.setToken('t');
let cfg={repo:'o/r',branch:'main',folder:'',message:'msg',authorName:'',authorEmail:'',mode:'all'};
globalThis.App = { api, goTo(){}, log(){}, uploadConfig:{getConfig:()=>cfg}, settingsManager:{get:()=>({concurrency:3,retries:2,retryDelay:1,confirmUpload:false})}, zipManager:{ getSelected:()=>files, getData: async f=>f.data } };
const eng=new UploaderEngine(); eng._sleep=()=>Promise.resolve();
const show=(t)=>{ const tr=treeFlat(G.commits[G.ref].tree); console.log('---',t,'| ref commits parents:',G.commits[G.ref].parents.length,'| files:',JSON.stringify(Object.fromEntries(Object.entries(tr).map(([k,v])=>[k,v.mode])))); console.log('stats',JSON.stringify(eng.stats),'| subtitle:',els.uploadSubtitle.innerHTML||els.uploadSubtitle.textContent); };
await eng.start(); show('1) empty repo');
await eng.start(); show('2) re-upload identical');
files[1].data=new Uint8Array(Buffer.from('console.log(2)')); files[1].gitSha=null;
cfg.mode='new'; await eng.start(); show('3) mode new (modified file must be skipped)');
cfg.mode='all'; G.simulateMove=true; await eng.start(); show('4) modified + branch moved concurrently');
console.log('content app.js =', G.blobs[treeFlat(G.commits[G.ref].tree)['src/app.js'].sha].toString(), '| other.txt kept:', !!treeFlat(G.commits[G.ref].tree)['other.txt']);
cfg.folder='docs'; eng.paused=false; const p=eng.start(); eng.cancelled=true; await p; show('5) cancel (should not change)');
