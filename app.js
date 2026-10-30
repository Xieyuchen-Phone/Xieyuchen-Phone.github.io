'use strict';
/* ============================================================
   资源加速层：站内 assets/ 资源可自动走 jsDelivr CDN
   默认走站内：实测 jsDelivr 对本仓库会 301 跳转 raw.githubusercontent.com，
   而该域名在国内常连不上，会把整站拖垮。因此先走站内保证可用，
   后台探测确认 CDN 能直出 200 后，再自动切换到 CDN 提速。
   ============================================================ */
const CDN_BASE='https://cdn.jsdelivr.net/gh/Xieyuchen-Phone/Xieyuchen-Phone.github.io@main/';
let CDN_ON=false;
function cdnU(p){return (CDN_ON&&typeof p==='string'&&p.indexOf('assets/')===0)?CDN_BASE+encodeURI(p):p}
function cdnBgUrl(p){return 'url("'+cdnU(p)+'")'}
let cdnErrs=0;
/* 单个资源失败：只把这一个换回站内；连续多次失败才判定 CDN 不可达并整体回退 */
function cdnNoteFail(el){
 if(el){
  const l=el.getAttribute('data-loc');
  /* 只有当前确实是 CDN 地址才回退，避免站内重复下载一次 */
  if(l&&(el.tagName==='IMG'||el.tagName==='VIDEO')&&String(el.src||'').indexOf('jsdelivr')>=0){
   el.src=l;const po=el.getAttribute('data-loc-poster');if(po)el.poster=po;
  }
  /* 预取／探测用的游离图片不计入：它们失败不代表页面上看不到图 */
  if(!el.isConnected)return;
 }
 cdnErrs++;
 if(cdnErrs>=4&&CDN_ON)cdnFail();
}
function cdnFail(){
 if(!CDN_ON)return;CDN_ON=false;
 try{document.querySelectorAll('[data-loc]').forEach(el=>{
   const l=el.getAttribute('data-loc');if(!l)return;
   if(el.tagName==='IMG'||el.tagName==='VIDEO'){
    el.src=l;const po=el.getAttribute('data-loc-poster');if(po)el.poster=po;
   }else if(el.style){el.style.backgroundImage='url("'+l+'")'}
 })}catch(e){}
}
function cdnEl(el){
 if(!el||el.nodeType!==1)return;
 if(el.hasAttribute('data-loc')){
  if(!el.dataset.cdnBound){el.dataset.cdnBound='1';el.addEventListener('error',()=>cdnNoteFail(el),{once:true})}
  return}
 if(el.tagName==='IMG'||el.tagName==='VIDEO'){
  const p=el.getAttribute('src');
  if(p&&p.indexOf('assets/')===0){el.setAttribute('data-loc',p);el.src=cdnU(p)}
  const po=el.getAttribute('poster');
  if(po&&po.indexOf('assets/')===0){el.setAttribute('data-loc-poster',po);el.poster=cdnU(po)}
  el.addEventListener('error',()=>cdnNoteFail(el),{once:true});
 }else if(el.hasAttribute('data-bg')){
  const p=el.getAttribute('data-bg');
  if(p&&p.indexOf('assets/')===0){el.setAttribute('data-loc',p);el.style.backgroundImage=cdnBgUrl(p)}
 }
}
/* 探测 CDN 是否真能直出内容：必须 2.5s 内加载成功才算可用（301 跳 raw 的情况会超时，直接放弃） */
/* 只在 GitHub Pages 上探测 CDN：其他托管（如国内可直连的应用域名）本身就快，
   再绕道 jsDelivr 反而可能更慢，一律走同源站内路径 */
const ON_GH=location.hostname.indexOf('github.io')>=0;
function cdnProbe(){
 if(CDN_ON||!ON_GH)return;
 const u=CDN_BASE+'assets/avatar/xie.jpg';
 const i=new Image();let done=false;
 const now=()=>(window.performance&&performance.now)?performance.now():Date.now();
 const t0=now();
 i.onload=()=>{if(done)return;done=true;
  if(i.naturalWidth>0&&now()-t0<2500){CDN_ON=true;cdnUpgrade()}};
 i.onerror=()=>{done=true};
 i.src=u;
 setTimeout(()=>{if(!done){done=true;try{i.src=''}catch(e){}}},6000);
}
/* 切到 CDN：只升级还没加载完的元素，已显示的保持原样，既不闪烁也不重复下载 */
function cdnUpgrade(){
 try{document.querySelectorAll('[data-loc]').forEach(el=>{
  const l=el.getAttribute('data-loc');if(!l)return;
  if(el.tagName==='IMG'&&!el.complete){el.src=cdnU(l)}
  else if(el.tagName==='VIDEO'&&el.readyState===0){el.src=cdnU(l);const po=el.getAttribute('data-loc-poster');if(po)el.poster=cdnU(po)}
 })}catch(e){}
}
function cdnHTML(html){
 if(!html)return html;
 return String(html)
  .replace(/src="(assets\/[^"]*)"/g,(m,p)=>'src="'+cdnU(p)+'" data-loc="'+p+'"')
  .replace(/poster="(assets\/[^"]*)"/g,(m,p)=>'poster="'+cdnU(p)+'" data-loc-poster="'+p+'"');
}
const _bgCache={};
function setBg(el,p){
 if(!el)return;el.setAttribute('data-loc',p);
 const local='url("'+p+'")';
 if(!CDN_ON){el.style.backgroundImage=local;return}
 const url=cdnU(p);
 if(_bgCache[url]==='ok'){el.style.backgroundImage='url("'+url+'")';return}
 if(_bgCache[url]==='bad'){el.style.backgroundImage=local;return}
 const i=new Image();
 i.onload=()=>{_bgCache[url]='ok';if(el.getAttribute('data-loc')===p)el.style.backgroundImage='url("'+url+'")'};
 i.onerror=()=>{_bgCache[url]='bad';if(el.getAttribute('data-loc')===p)el.style.backgroundImage=local;cdnNoteFail()};
 i.src=url;}
function cdnScan(root){
 if(!root||root.nodeType!==1)return;
 cdnEl(root);
 const list=root.querySelectorAll('img[src],video[src],[data-bg]');
 for(let i=0;i<list.length;i++)cdnEl(list[i]);
}
if(window.MutationObserver){
 const _mo=new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes){cdnScan(n)}}});
 const _boot=()=>{cdnProbe();cdnScan(document.body);_mo.observe(document.body,{childList:true,subtree:true})};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_boot,{once:true});else _boot();
}
/* ============================================================
   iPhone UI / 交互引擎（中文 · 微信 · 俄罗斯方块）
   ============================================================ */
const $=s=>document.querySelector(s);
const SCREEN=$('#screen'),APP=$('#appL'),HOME=$('#homeL'),LOCK=$('#lockL'),OV=$('#ov'),PLAYER=$('#player');
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ============================ 状态 ============================ */
const SAVE_KEY='x_phone_state_v5';
let view='lock',curDark=true,SC=1,lastRect=null,animTok=0,pendingOpen=null,homePage=0;
let pincode='',noteId=0,mailId=0,missOnly=false;
let selectedDay=TODAY.d,calMonth=TODAY.m,chatId=MAIN;
let unread={秀秀:0,吴邪:0,胖子:0,苏万:0,夏池堂:0,'Ryan Rochad':0};
let mainUnread=0,todayChat=[],replyStage=0,lineIdx=0,typing=false,pendingText='',replyBusy=false,roundReady=true;
let readMail=new Set(emails.map((m,i)=>m.date!=='今天'?i:-1).filter(i=>i>=0)),nowSong=-1;
let momentLikes={};
let alarmOn=ALARM.on!==false;
let callState='',callStage=0,declined=0,extraCalls=[],callTimer=null,callAudio=null;
let tetBest=0;
let lockNotes=[];

function saveState(){
 try{localStorage.setItem(SAVE_KEY,JSON.stringify({
  unlocked:view!=='lock'&&view!=='pin',lastApp:lastAppId,homePage,curView:view,
  todayChat,replyStage,mainUnread,unread,callStage,declined,extraCalls,
  readMail:[...readMail],tetBest,noteId,mailId,chatId,alarmOn,reelIdx,nowSong,momentLikes
 }))}catch(e){}
}
function loadState(){
 try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(!s)return null;return s}catch(e){return null}
}
let lastAppId='';

/* ============================ 工具 ============================ */
const clock12=()=>{const d=new Date();return((d.getHours()%12)||12)+':'+pad(d.getMinutes())};
const nowMin=()=>{const d=new Date();return d.getHours()*60+d.getMinutes()};
function relRect(el){const s=SCREEN.getBoundingClientRect(),r=el.getBoundingClientRect();return{x:(r.left-s.left)/SC,y:(r.top-s.top)/SC,w:r.width/SC,h:r.height/SC}}
const vib=p=>{try{navigator.vibrate&&navigator.vibrate(p)}catch(e){}};
const T={duration:460,easing:'cubic-bezier(.32,.72,0,1)'};
function devRadius(){return 56}

/* ============================ 图标 ============================ */
const g=(p,o='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${o}>${p}</svg>`;
const G={
 chevL:`<svg viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2 2 10l8 8"/></svg>`,
 chevR:`<svg class="chev" viewBox="0 0 8 13"><path d="m1.5 1.5 5 5-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
 chevRb:g('<path d="m9 5 7 7-7 7"/>'),chevLb:g('<path d="m15 5-7 7 7 7"/>'),
 search:g('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
 plus:g('<path d="M12 5v14M5 12h14"/>'),
 dots:g('<circle cx="12" cy="12" r="9.2"/><circle cx="8" cy="12" r=".8" fill="currentColor"/><circle cx="12" cy="12" r=".8" fill="currentColor"/><circle cx="16" cy="12" r=".8" fill="currentColor"/>'),
 dotsH:g('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
 menu:g('<path d="M4 7h16M4 12h16M4 17h16"/>'),
 gear:g('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/><circle cx="12" cy="12" r="6.4"/>'),
 person:g('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
 chat:g('<path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7.1S17 4 12 4Z"/>'),
 chatPlus:g('<path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7.1S17 4 12 4Z"/><path d="M12 8.5v5M9.5 11h5"/>'),
 compass:g('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5Z"/>'),
 contacts:g('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.5" r="3"/><path d="M6.8 18c.9-2.4 2.9-3.6 5.2-3.6s4.3 1.2 5.2 3.6"/>'),
 clock:g('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
 star:g('<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>'),
 keypad:g('<g fill="currentColor" stroke="none"><circle cx="6" cy="5" r="1.7"/><circle cx="12" cy="5" r="1.7"/><circle cx="18" cy="5" r="1.7"/><circle cx="6" cy="11" r="1.7"/><circle cx="12" cy="11" r="1.7"/><circle cx="18" cy="11" r="1.7"/><circle cx="6" cy="17" r="1.7"/><circle cx="12" cy="17" r="1.7"/><circle cx="18" cy="17" r="1.7"/></g>'),
 voicemail:g('<circle cx="6.5" cy="12" r="3.5"/><circle cx="17.5" cy="12" r="3.5"/><path d="M6.5 15.5h11"/>'),
 info:g('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".7" fill="currentColor"/>'),
 compose:g('<path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>'),
 share:g('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/>'),
 heart:g('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>'),
 trash:g('<path d="M5 7h14M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
 book:g('<path d="M4 5.5C6 4.5 9 4.5 12 6c3-1.5 6-1.5 8-.5V19c-2-1-5-1-8 .5-3-1.5-6-1.5-8-.5Z"/><path d="M12 6v13.5"/>'),
 camera:g('<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11H4Z"/><circle cx="12" cy="13" r="3.5"/>'),
 flash:g('<path d="M8.5 3h7l-1 5h-5Z"/><path d="M9.5 8h5v11a2.5 2.5 0 0 1-5 0Z"/><path d="M12 11.5v2.5"/>'),
 photo:g('<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>'),
 list:g('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="18" r=".9" fill="currentColor"/>'),
 inbox:g('<path d="M3.5 13.5 6 5h12l2.5 8.5V19h-17Z"/><path d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"/>'),
 check:g('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.7L16 9.5"/>'),
 pen:g('<path d="m14.5 5.5 4 4L8 20H4v-4Z"/>'),
 globe:g('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.8 3.5 5.8 3.5 9s-1 6.2-3.5 9c-2.5-2.8-3.5-5.8-3.5-9s1-6.2 3.5-9Z"/>'),
 alarm:g('<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5M4.5 5 7 3M19.5 5 17 3"/>'),
 stopwatch:g('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M12 2.5V6"/>'),
 timer:g('<circle cx="12" cy="12" r="8.5"/><path d="M12 12 8 8"/>'),
 reels:g('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M3.5 8.5h17M9 3.5l2.5 5M14.5 3.5 17 8.5"/><path d="m10 12 5 2.8-5 2.8Z"/>'),
 grid:g('<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/>'),
 playF:'<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5Z"/></svg>',
 pauseF:'<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
 fwdF:'<svg viewBox="0 0 32 24"><path d="M2 4.5v15l12-7.5Z"/><path d="M15 4.5v15l12-7.5Z"/></svg>',
 bwdF:'<svg viewBox="0 0 32 24"><path d="M30 4.5v15l-12-7.5Z"/><path d="M17 4.5v15L5 12Z"/></svg>',
 handset:'<svg viewBox="0 0 24 24"><path d="M6.6 3.2c.6-.3 1.4-.1 1.8.5l1.9 3c.4.6.3 1.4-.2 1.9l-1.4 1.3a12.4 12.4 0 0 0 5.4 5.4l1.3-1.4c.5-.5 1.3-.6 1.9-.2l3 1.9c.6.4.8 1.2.5 1.8l-.9 1.9c-.5 1-1.6 1.6-2.7 1.4C10 19.6 4.4 14 3.3 6.8c-.2-1.1.4-2.2 1.4-2.7Z"/></svg>',
 speaker:'<svg viewBox="0 0 24 24"><path d="M3.5 9h4l5-4.5v15l-5-4.5h-4Z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
 muteF:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
 videoF:'<svg viewBox="0 0 24 24"><rect x="2.5" y="6.5" width="13" height="11" rx="2.5"/><path d="m16.5 10.5 5-3v9l-5-3Z"/></svg>',
 plusF:'<svg viewBox="0 0 24 24"><path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7Z"/></svg>',
 msgF:'<svg viewBox="0 0 24 24"><path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4-2.4c.6.1 1.3.1 2 .1 5 0 9-3.1 9-7.1S17 4 12 4Z"/></svg>',
 sil:'<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="4.3" fill="#fff"/><path d="M3.8 22c.6-4.4 4-7 8.2-7s7.6 2.6 8.2 7Z" fill="#fff"/></svg>',
 calSm:g('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
 sun:'<svg viewBox="0 0 24 24" width="24"><circle cx="12" cy="12" r="5" fill="#ffd60a"/><g stroke="#ffd60a" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g></svg>',
 moon:'<svg viewBox="0 0 24 24" width="24"><path d="M15.5 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15.5 3.5Z" fill="#fff"/></svg>',
 pcloud:'<svg viewBox="0 0 24 24" width="24"><circle cx="9" cy="9" r="4.2" fill="#ffd60a"/><path d="M8 19.5h9.5a3.5 3.5 0 0 0 .3-7A5 5 0 0 0 8.4 11 4.3 4.3 0 0 0 8 19.5Z" fill="#fff"/></svg>',
 cloud:'<svg viewBox="0 0 24 24" width="24"><path d="M7 19h10.5a4 4 0 0 0 .4-8A5.6 5.6 0 0 0 7.2 9.2 5 5 0 0 0 7 19Z" fill="#fff"/></svg>',
 rpIcon:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9h16"/><circle cx="12" cy="13.5" r="2"/></svg>',
 musicNote:'<svg viewBox="0 0 24 24"><path d="M17 3v11.5a3 3 0 1 1-2-2.8V7.3l-6 1.4v8a3 3 0 1 1-2-2.8V5.5Z"/></svg>',
 shuffleIco:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3.5h4.5V8"/><path d="M3.7 20.3 20.3 3.7"/><path d="M20.3 16v4.5H16"/><path d="M14.6 14.6l5.7 5.7"/><path d="M3.7 3.7l5.7 5.7"/></svg>',
 mic:'<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
 comment:'<svg viewBox="0 0 24 24"><path d="M20 12c0 4.4-3.6 8-8 8-1.1 0-2.2-.2-3.2-.6L4 21l1.6-4.2A7.7 7.7 0 0 1 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8Z"/></svg>',
 airplane:'<svg viewBox="0 0 24 24"><path d="M12 2.5c.9 0 1.6 1 1.9 2.8l.6 3.7 6 3.5v2l-6-1.8v4.6l2.2 1.8v1.6L12 19.3l-4.7 1.4v-1.6l2.2-1.8v-4.6l-6 1.8v-2l6-3.5.6-3.7c.3-1.8 1-2.8 1.9-2.8Z"/></svg>',
 smile:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r=".9" fill="currentColor"/><circle cx="15" cy="10" r=".9" fill="currentColor"/><path d="M8.4 14.2a4.5 4.5 0 0 0 7.2 0"/></svg>',
 tabs:'<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="13" rx="2"/><path d="M3.5 10h17"/></svg>',
 tag:'<svg viewBox="0 0 24 24"><path d="M20.5 12.6 12.6 20.5a2 2 0 0 1-2.8 0l-6.3-6.3a2 2 0 0 1-.5-2L4.4 4.4a2 2 0 0 1 2.4-2.4l7.8 1.4a2 2 0 0 1 1.6 1.6l1.4 7.8a2 2 0 0 1-.6 1.9Z"/><circle cx="9.5" cy="9.5" r="1.4"/></svg>',
 home:'<svg viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/></svg>',
 bag:'<svg viewBox="0 0 24 24"><path d="M5.5 8.5h13L17.5 20h-11Z"/><path d="M8.5 10.5V6.5a3.5 3.5 0 0 1 7 0v4"/></svg>',
 pin:'<svg viewBox="0 0 24 24"><path d="M12 21.5S5 14.9 5 9.8a7 7 0 0 1 14 0c0 5.1-7 11.7-7 11.7Z"/><circle cx="12" cy="9.8" r="2.6"/></svg>',
 building:'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="10" height="16"/><rect x="15" y="9" width="5" height="11"/><path d="M8 8h2M8 12h2M8 16h2M17 12h1.4M17 16h1.4"/></svg>',
 bowl:'<svg viewBox="0 0 24 24"><path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 20h6M8.5 7.5c1-1 1-2 0-3M13 7.5c1-1 1-2 0-3"/></svg>',
 bellOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 18a3.5 3.5 0 0 0 7 0"/><path d="M6.2 16.5h11.6c-1.4-1.2-2.2-2.9-2.2-5.2a3.6 3.6 0 0 0-7.2 0c0 2.3-.8 4-2.2 5.2Z"/><path d="M4 4l16 16"/></svg>',
};
const wxIcon=()=>`<img src="assets/appicon/wechat.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
const APPS={maps:'地图',instagram:'Instagram',photos:'照片',mail:'邮件',calendar:'日历',clock:'时钟',notes:'备忘录',weather:'天气',settings:'设置',phone:'电话',safari:'Safari',wechat:'微信',music:'音乐',tetris:'俄罗斯方块'};
function appIcon(id){
 const L=(a,b,c,d)=>`<linearGradient id="${a}" x1="0" y1="${d?1:0}" x2="${d?1:0}" y2="${d?0:1}"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
 const W=(defs,body)=>`<svg viewBox="0 0 60 60"><defs>${defs}</defs>${body}</svg>`;
 switch(id){
 case'wechat':return wxIcon();
 case'instagram':return W(`<linearGradient id="gi" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffc35c"/><stop offset=".5" stop-color="#ff3d6e"/><stop offset="1" stop-color="#7c3bf0"/></linearGradient>`,`<rect width="60" height="60" fill="url(#gi)"/><rect x="17" y="12.5" width="26" height="34" rx="4.5" fill="none" stroke="#fff" stroke-width="3.2"/><rect x="21.6" y="17" width="16.8" height="17" rx="2" fill="#fff"/>`);
 case'photos':{let p='';for(let i=0;i<10;i++)p+=`<ellipse cx="30" cy="18.2" rx="4.4" ry="10.5" fill="#fff" transform="rotate(${i*36} 30 30)"/>`;return W(L('gp','#9bdcff','#d8f1ff'),`<rect width="60" height="60" fill="url(#gp)"/>${p}<circle cx="30" cy="30" r="7.2" fill="#ffc83d"/><circle cx="30" cy="30" r="7.2" fill="none" stroke="#f0a500" stroke-width="1"/>`)}
 case'mail':return W(L('gm','#3fb0ff','#0a6cf5'),`<rect width="60" height="60" fill="url(#gm)"/><rect x="11.5" y="18" width="37" height="25" rx="3.5" fill="#fff"/><path d="M12.5 20 30 32.5 47.5 20" fill="none" stroke="#1676f3" stroke-width="2.4" stroke-linejoin="round"/>`);
 case'calendar':return W('',`<rect width="60" height="60" fill="#fff"/><text x="30" y="17.5" text-anchor="middle" font-size="9" font-weight="600" fill="#ff3b30" font-family="-apple-system,PingFang SC,sans-serif">${wdLong(TODAY.y,TODAY.m,TODAY.d)}</text><text x="30" y="47" text-anchor="middle" font-size="31" font-weight="300" fill="#111" font-family="-apple-system,PingFang SC,sans-serif">${TODAY.d}</text>`);
 case'clock':{const d=new Date(),h=d.getHours()%12,m=d.getMinutes();let tk='';for(let i=0;i<12;i++)tk+=`<path d="M30 8.5v${i%3?2.6:3.8}" stroke="#111" stroke-width="${i%3?1:1.6}" transform="rotate(${i*30} 30 30)"/>`;
  return W('',`<rect width="60" height="60" fill="#000"/><circle cx="30" cy="30" r="24" fill="#fff"/>${tk}<path d="M30 30V17" stroke="#111" stroke-width="2.6" stroke-linecap="round" transform="rotate(${h*30+m/2} 30 30)"/><path d="M30 30V11.5" stroke="#111" stroke-width="1.8" stroke-linecap="round" transform="rotate(${m*6} 30 30)"/><circle cx="30" cy="30" r="1.8" fill="#ff9500"/>`)}
 case'notes':return W(L('gn','#ffe27a','#ffc933'),`<rect width="60" height="60" fill="#fff"/><rect width="60" height="17" fill="url(#gn)"/><g stroke="#d9d9de" stroke-width="1.2"><path d="M8 27h44M8 35h44M8 43h44M8 51h44"/></g><g fill="#cfcfd4"><circle cx="10" cy="17" r=".9"/><circle cx="14" cy="17" r=".9"/><circle cx="18" cy="17" r=".9"/><circle cx="22" cy="17" r=".9"/><circle cx="26" cy="17" r=".9"/><circle cx="30" cy="17" r=".9"/><circle cx="34" cy="17" r=".9"/><circle cx="38" cy="17" r=".9"/><circle cx="42" cy="17" r=".9"/><circle cx="46" cy="17" r=".9"/><circle cx="50" cy="17" r=".9"/></g>`);
 case'weather':return W(L('gwe','#53b5ff','#1f6fe0'),`<rect width="60" height="60" fill="url(#gwe)"/><circle cx="23" cy="23" r="9.5" fill="#ffd84a"/><path d="M19 45h21.5a7.5 7.5 0 0 0 .6-15 10 10 0 0 0-19.2 3.2A6 6 0 0 0 19 45Z" fill="#fff"/>`);
 case'settings':return W(L('gs','#a7adb6','#6d727b'),`<rect width="60" height="60" fill="url(#gs)"/><circle cx="30" cy="30" r="17" fill="none" stroke="#e9eaee" stroke-width="7" stroke-dasharray="4.4 4.5"/><circle cx="30" cy="30" r="14" fill="#878c95" stroke="#e9eaee" stroke-width="3.2"/><circle cx="30" cy="30" r="5.5" fill="none" stroke="#e9eaee" stroke-width="3"/><g stroke="#e9eaee" stroke-width="2.4"><path d="M30 17.5v7M30 35.5v7M17.5 30h7M35.5 30h7"/></g>`);
 case'phone':return W(L('gph','#65f38f','#28c253'),`<rect width="60" height="60" fill="url(#gph)"/><g transform="translate(12 12) scale(1.5)" fill="#fff">${G.handset.replace(/<\/?svg[^>]*>/g,'')}</g>`);
 case'safari':return W(L('gsa','#3aa8ff','#0f5fe0'),`<rect width="60" height="60" fill="#fff"/><circle cx="30" cy="30" r="21" fill="url(#gsa)"/><g fill="none" stroke="#fff" stroke-width="1.6" opacity=".95"><ellipse cx="30" cy="30" rx="8.5" ry="21"/><path d="M9 30h42M12 19.5h36M12 40.5h36M30 9v42"/></g>`);
 case'music':return W(L('gmu','#ff6f86','#fa2b47'),`<rect width="60" height="60" fill="url(#gmu)"/><g transform="translate(13 12) scale(1.45)" fill="#fff"><path d="M17 3v11.5a3 3 0 1 1-2-2.8V7.3l-6 1.4v8a3 3 0 1 1-2-2.8V5.5Z"/></g>`);
 case'maps':return W('',`<rect width="60" height="60" fill="#e9f2df"/><path d="M0 38 60 22v12L0 50Z" fill="#fff"/><path d="M24 0h9L27 60h-9Z" fill="#ffd966"/><path d="M0 12c14 6 30-4 60 6V0H0Z" fill="#bfe3a5"/><path d="M42 60c0-8 10-10 18-12v12Z" fill="#9fd0f5"/><path d="M40 14a8 8 0 0 0-8 8c0 6 8 14 8 14s8-8 8-14a8 8 0 0 0-8-8Z" fill="#ff3b30"/><circle cx="40" cy="22" r="3" fill="#fff"/>`);
 case'tetris':return W('',`<rect width="60" height="60" fill="#1b1b22"/><g><rect x="8" y="10" width="13" height="13" rx="2" fill="#31c7ef"/><rect x="22" y="10" width="13" height="13" rx="2" fill="#f2c94c"/><rect x="36" y="10" width="13" height="13" rx="2" fill="#eb5757"/><rect x="15" y="24" width="13" height="13" rx="2" fill="#9b51e0"/><rect x="29" y="24" width="13" height="13" rx="2" fill="#6fcf97"/><rect x="8" y="38" width="13" height="13" rx="2" fill="#f2994a"/><rect x="22" y="38" width="13" height="13" rx="2" fill="#2d9cdb"/><rect x="36" y="38" width="13" height="13" rx="2" fill="#ff86b0"/></g>`);
 }return''}

/* ============================ 声音 ============================ */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(f,t0,dur,vol=.12,type='sine'){const a=ac();if(!a)return;const t=a.currentTime+t0,o=a.createOscillator(),gn=a.createGain();o.type=type;o.frequency.value=f;gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(vol,t+.008);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(gn).connect(a.destination);o.start(t);o.stop(t+dur+.05)}
function sfx(k){if(k==='key')tone(2400,0,.025,.035,'triangle');else if(k==='msg'){tone(1046,0,.22,.09);tone(1397,.1,.32,.09)}else if(k==='send'){tone(620,0,.07,.05);tone(930,.05,.09,.05)}else if(k==='unlock'){tone(1300,0,.05,.04,'triangle');tone(1700,.04,.05,.03,'triangle')}else if(k==='lock')tone(500,0,.06,.05,'triangle')}
function ringOnce(){[[784,0],[988,.2],[1175,.4],[988,.6],[784,1.0],[988,1.2],[1175,1.4],[1319,1.6]].forEach(([f,t])=>{tone(f,t,.35,.11);tone(f*2,t,.18,.03)})}
document.addEventListener('pointerdown',()=>ac(),{once:true});

function setStatus(dark){curDark=!!dark;$('#sb').classList.toggle('light',curDark);$('#hb').classList.toggle('light',curDark)}
function updateIsland(){typeof updateCrumb==='function'&&updateCrumb();
 const on=nowSong>=0&&!PLAYER.paused&&!['music','lock','pin'].includes(view)&&!OV.querySelector('.np,.call,.viewer');
 const el=$('#island');if(el)el.classList.toggle('act',on);
 const ia=el&&el.querySelector('.ia');
 if(ia)if(on&&nowSong>=0)setBg(ia,songs[nowSong].cover);else{ia.style.backgroundImage='';ia.removeAttribute('data-loc')}}

/* ============================ 锁屏 / 密码 ============================ */
function ncardHTML(n){
 const ic=n.app==='wechat'?`<div class="ni" style="position:relative;overflow:visible"><img src="${avatarOf(THEM)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;display:block"><span style="position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border-radius:5px;overflow:hidden;border:1.5px solid rgba(255,255,255,.9)">${appIcon('wechat')}</span></div>`
  :`<div class="ni" style="border-radius:9px;overflow:hidden">${appIcon('calendar')}</div>`;
 return `${ic}<div class="nt"><div class="nh"><span>${esc(n.title)}</span><small>${n.time}</small></div><div class="nb">${esc(n.body)}</div></div>`}
function renderLock(){
 const bd=bdayCountdown();
 lockNotes=[
  {title:'齐',body:'下雨了',app:'wechat',time:t('now')},
  {title:bd.label,body:`${bd.date} · 还有 ${bd.days} 天`,app:'rem',time:t('now')},
 ];
 $('#lkc').innerHTML=cdnHTML(`<div class="lk-date">${fmtLockDate()}</div><div class="lk-time" id="lkt">${clock12()}</div>
 <div class="lk-notes">${lockNotes.map((n,i)=>`<button class="ncard" onclick="lockNoteTap(${i},event)">${ncardHTML(n)}</button>`).join('')}</div>
 <button class="lk-btn" style="left:46px" onclick="event.stopPropagation();this.animate([{transform:'scale(1.2)'},{transform:'none'}],250)">${G.flash.replace('<svg','<svg width="24" height="24" style="color:#fff"')}</button>
 <button class="lk-btn" style="right:46px" onclick="event.stopPropagation();this.animate([{transform:'scale(1.2)'},{transform:'none'}],250)">${G.camera.replace('<svg','<svg width="24" height="24" style="color:#fff"')}</button>
 <div class="lk-hint">${t('swipeUp')}</div>`);
 cdnScan($('#lkc'))}
function lockNoteTap(i,e){e.stopPropagation();if(lockNotes[i].app==='wechat'){pendingOpen='wechat';mainUnread=0;saveState()}goPin()}
(function lockDrag(){const el=$('#lkc');let y0=null,dy=0,moved=false;
 el.addEventListener('pointerdown',e=>{if(view!=='lock'||e.target.closest('button'))return;y0=e.clientY;dy=0;moved=false;el.setPointerCapture(e.pointerId)});
 el.addEventListener('pointermove',e=>{if(y0===null)return;dy=Math.min(0,(e.clientY-y0)/SC);if(Math.abs(dy)>6)moved=true;el.style.transform=`translateY(${dy}px)`;el.style.opacity=1+dy/500;$('#wall').style.filter=`blur(${Math.min(24,-dy/8)}px) brightness(${1-Math.min(.38,-dy/700)})`});
 el.addEventListener('pointerup',e=>{if(y0===null)return;const d=dy;y0=null;$('#wall').style.filter='';
  if(d<-70||!moved&&!e.target.closest('button')){goPin(d)}else{el.animate([{transform:`translateY(${d}px)`,opacity:1+d/500},{transform:'none',opacity:1}],{duration:350,easing:'cubic-bezier(.2,1.3,.4,1)'});el.style.transform='';el.style.opacity=''}});
})();
function goPin(fromDy=0){view='pin';pincode='';const lk=$('#lkc');
 lk.animate([{transform:`translateY(${fromDy}px)`,opacity:Math.max(0,1+fromDy/500)},{transform:'translateY(-120px)',opacity:0}],{duration:380,easing:'cubic-bezier(.3,.7,.2,1)',fill:'forwards'});
 lk.style.transform='';lk.style.opacity='';lk.style.pointerEvents='none';$('#wall').classList.add('dim');renderPin();
 const p=$('#pinL');p.style.display='flex';p.animate([{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.9,.25,1)'})}
const PL=['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'];
function renderPin(){$('#pinL').innerHTML=`<div class="pt">${t('enterPass')}</div><div class="pdots" id="pdots">${[0,1,2,3].map(i=>`<i class="${i<pincode.length?'on':''}"></i>`).join('')}</div>
 <div class="pkeys">${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pk" onpointerdown="pinPress('${n}',this)"><b>${n}</b><small>${PL[n-1]}</small></button>`).join('')}<span></span><button class="pk" onpointerdown="pinPress('0',this)"><b>0</b><small></small></button><span></span></div>
 <div class="pbot"><button onclick="vib(10)">${t('emergency')}</button><button id="pcancel" onclick="pinCancelOrDel()">${pincode?t('delete'):t('cancel')}</button></div>`}
function pinDots(){$('#pdots').innerHTML=[0,1,2,3].map(i=>`<i class="${i<pincode.length?'on':''}"></i>`).join('');$('#pcancel').textContent=pincode?t('delete'):t('cancel')}
function pinPress(n,el){if(pincode.length>=4)return;el.classList.add('dn');setTimeout(()=>el.classList.remove('dn'),90);sfx('key');vib(8);pincode+=n;pinDots();
 if(pincode.length===4){if(pincode===PASSCODE){setTimeout(unlock,140)}else{setTimeout(()=>{const d=$('#pdots');d.classList.remove('shake');void d.offsetWidth;d.classList.add('shake');vib([60,40,60]);setTimeout(()=>{pincode='';pinDots()},420)},120)}}}
function pinCancelOrDel(){if(pincode){pincode=pincode.slice(0,-1);pinDots();return}pinCancel()}
function pinCancel(){view='lock';const p=$('#pinL');p.animate([{opacity:1},{opacity:0,transform:'translateY(30px)'}],{duration:300}).onfinish=()=>p.style.display='none';
 const lk=$('#lkc');lk.getAnimations().forEach(a=>a.cancel());lk.style.pointerEvents='';lk.animate([{transform:'translateY(-120px)',opacity:0},{transform:'none',opacity:1}],{duration:450,easing:'cubic-bezier(.2,.9,.25,1)'});$('#wall').classList.remove('dim')}
function unlock(){sfx('unlock');view='home';$('#wall').classList.remove('dim');setBg($('#wall'),'assets/wallpaper/home.jpg');
 LOCK.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'}).onfinish=()=>{LOCK.style.visibility='hidden';$('#pinL').style.display='none';$('#lkc').getAnimations().forEach(a=>a.cancel());$('#lkc').style.pointerEvents=''};
 renderHome();HOME.style.visibility='visible';HOME.animate([{transform:'scale(1.18)',opacity:0},{transform:'none',opacity:1}],{duration:560,easing:'cubic-bezier(.2,.9,.22,1)'});
 [...HOME.querySelectorAll('.app,.widget')].forEach((el,i)=>el.animate([{transform:'scale(.7)',opacity:0},{transform:'none',opacity:1}],{duration:520,delay:30+i*14,easing:'cubic-bezier(.2,1.1,.3,1)',fill:'backwards'}));
 setStatus(true);saveState();prefetchKey();
 if(chatId===MAIN&&replyStage===0&&!todayChat.length)setTimeout(()=>deliver(liveRounds[0].them[0]),900);
 if(pendingOpen==='wechat'){pendingOpen=null;setTimeout(()=>{chatId=MAIN;openApp('wechat',HOME.querySelector('.app[data-app="wechat"] .icon'))},520)}}

/* 解锁后预取轻量关键资源：来电语音等（不占大带宽） */
let prefetched=false;
function prefetchKey(){
 if(prefetched)return;prefetched=true;
 const list=[CALL1,CALL2,MOMENT_COVER,'assets/wallpaper/home.jpg'];
 const go=()=>list.forEach(u=>{try{fetch(cdnU(u),{cache:'force-cache'})}catch(e){}});
 if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:2000});else setTimeout(go,800)}
/* 进入朋友圈后再预取两条视频（此时用户很可能会点开） */
let moPrefetched=false;
function prefetchMomentVideos(){
 if(moPrefetched)return;moPrefetched=true;
 const list=MOMENTS.filter(m=>m.media&&m.media.t==='video').map(m=>m.media.src);
 const go=()=>list.forEach(u=>{try{fetch(cdnU(u),{cache:'force-cache'})}catch(e){}});
 if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:4000});else setTimeout(go,1500)}

/* ============================ 主屏幕 ============================ */
const PAGE1_APPS=['instagram','photos','mail','calendar','clock','notes','weather','settings','maps','tetris'];
function badgeOf(id){
 if(id==='mail')return emails.filter((m,i)=>!readMail.has(i)).length;
 if(id==='wechat')return mainUnread;
 return 0}
function appBtn(id){const b=badgeOf(id);return `<button class="app" data-app="${id}" onclick="openApp('${id}',this.firstElementChild)"><div class="icon"><div class="ic">${appIcon(id)}</div>${b?`<span class="bdg">${b}</span>`:''}</div><span class="lbl">${APPS[id]}</span></button>`}
function renderHome(){
 const evToday=(events[TODAY.m]||{})[TODAY.d]||[];
 HOME.innerHTML=cdnHTML(`
 <div class="hpage" id="hp0" style="transform:translateX(${homePage===0?0:-100}%)">
  <div class="hgrid">
   <button class="widget wcal" onclick="openApp('calendar',this)"><div class="wd">${wdLong(TODAY.y,TODAY.m,TODAY.d)}</div><div class="wn">${TODAY.d}</div>${evToday.map(x=>`<div class="we">${esc(x)}<small>${t('allDay')}</small></div>`).join('')||'<div class="we">复查<small>全天</small></div>'}</button>
   <button class="widget wwx" onclick="openApp('weather',this)"><div class="c">${WEATHER.city} ➚</div><div class="tp">${WEATHER.temp}</div><span style="position:absolute;top:14px;right:14px">${G.pcloud}</span><div class="ds">${WEATHER.summary}<small>最高${WEATHER.hi} 最低${WEATHER.lo}</small></div></button>
   ${PAGE1_APPS.map(appBtn).join('')}
  </div>
 </div>
 <div class="hpage" id="hp1" style="transform:translateX(${homePage===1?0:100}%)"></div>
 <div class="hdots"><i class="${homePage===0?'on':''}"></i><i class="${homePage===1?'on':''}"></i></div>
 <div class="dock">${['phone','safari','wechat','music'].map(appBtn).join('')}</div>`);
 cdnScan(HOME);
 HOME.querySelectorAll('.hgrid,.hpage').forEach(el=>el.animate([{opacity:.99},{opacity:1}],{duration:1}));
 bindHomeSwipe()}
function bindHomeSwipe(){let x0=null,y0=0;
 HOME.onpointerdown=e=>{if(view!=='home'||e.target.closest('button'))return;x0=e.clientX;y0=e.clientY;HOME.setPointerCapture(e.pointerId)};
 HOME.onpointermove=e=>{if(x0===null)return;const dx=(e.clientX-x0)/SC/HOME.clientWidth*100;if(Math.abs(e.clientY-y0)>40)return;
  const p0=HOME.querySelector('#hp0'),p1=HOME.querySelector('#hp1');const base=homePage===0?0:-100;
  const v0=Math.max(-100,Math.min(0,base+dx)),v1=Math.min(100,Math.max(0,100+base+dx));
  p0.style.transition='none';p1.style.transition='none';
  p0.style.transform=`translateX(${v0}%)`;p1.style.transform=`translateX(${v1}%)`};
 HOME.onpointerup=e=>{if(x0===null)return;const dx=(e.clientX-x0)/SC/HOME.clientWidth*100;x0=null;if(Math.abs(dx)>22){homePage=dx<0?1:0;saveState();}
  const p0=HOME.querySelector('#hp0'),p1=HOME.querySelector('#hp1');
  const t0=`translateX(${homePage===0?0:-100}%)`,t1=`translateX(${homePage===1?0:100}%)`;
  p0.animate([{transform:p0.style.transform},{transform:t0}],{duration:340,easing:'cubic-bezier(.2,.9,.25,1)'});
  p1.animate([{transform:p1.style.transform},{transform:t1}],{duration:340,easing:'cubic-bezier(.2,.9,.25,1)'});
  setTimeout(()=>{p0.style.transform=t0;p1.style.transform=t1},340);
  HOME.querySelectorAll('.hdots i').forEach((d,i)=>d.classList.toggle('on',i===homePage))}}

/* ============================ 页面引擎 ============================ */
const PARENT={note:'notes',chat:'wechat',maild:'mail',reel:'instagram',screentime:'settings',safsearch:'safari',discover:'wechat',moments:'discover'};
const rootOf=v=>PARENT[v]||v;
function viewDark(){if(['lock','pin','home'].includes(view))return true;const p=APP.lastElementChild;return!!(p&&p.dataset.dark)}
function wireScroll(pg){const sc=pg.querySelector('.scroll');if(sc)sc.addEventListener('scroll',()=>pg.classList.toggle('scrolled',sc.scrollTop>38),{passive:true})}
function show(id,anim='swap'){
 const old=[...APP.children];old.forEach(o=>{o.querySelectorAll('video').forEach(v=>v.pause())});
 if(PLAYER.dataset.voice&&!(id==='chat')){PLAYER.pause()}
 view=id;const v=VIEWS[id]();const pg=document.createElement('div');pg.className='pg '+(v.cls||'');pg.innerHTML=cdnHTML(v.html);cdnScan(pg);pg.dataset.view=id;pg.dataset.dark=v.dark?'1':'';
 if(anim==='pop')APP.insertBefore(pg,APP.firstChild);else APP.appendChild(pg);
 setStatus(v.dark);wireScroll(pg);
 const done=()=>old.forEach(o=>o.remove());
 if(anim==='push'){pg.classList.add('pushed');pg.animate([{transform:'translateX(100%)'},{transform:'none'}],T);old.forEach(o=>o.animate([{transform:'none',filter:'brightness(1)'},{transform:'translateX(-28%)',filter:'brightness(.92)'}],T));setTimeout(done,T.duration)}
 else if(anim==='pop'){pg.animate([{transform:'translateX(-28%)',filter:'brightness(.92)'},{transform:'none',filter:'brightness(1)'}],T);old.forEach(o=>{o.classList.add('pushed');o.animate([{transform:'none'},{transform:'translateX(100%)'}],{...T,fill:'forwards'})});setTimeout(done,T.duration)}
 else done();
 v.init&&v.init(pg);updateIsland();saveState();return pg}
function zoomFrames(r){const W=SCREEN.clientWidth,H=SCREEN.clientHeight,s=r.w/W,iy=Math.max(0,(H-r.h/s)/2),dx=r.x+r.w/2-W/2,dy=r.y+r.h/2-H/2;
 return[{transform:`translate(${dx}px,${dy}px) scale(${s})`,clipPath:`inset(${iy}px 0px round ${15/s}px)`,opacity:.25},{transform:'translate(0px,0px) scale(1)',clipPath:`inset(0px 0px round ${devRadius()}px)`,opacity:1}]}
function openApp(id,el){if(callState)return;if(view!=='home'){if(VIEWS[id]){lastAppId=id;show(id,'push')}return}
 lastRect=el?relRect(el):null;APP.innerHTML='';lastAppId=id;show(id,'none');const tok=++animTok;
 APP.style.visibility='visible';APP.getAnimations().forEach(a=>a.cancel());
 APP.animate(zoomFrames(lastRect||{x:166,y:396,w:60,h:60}),{duration:540,easing:'cubic-bezier(.2,.9,.22,1)'});
 HOME.animate([{transform:'none',opacity:1},{transform:'scale(1.1)',opacity:0}],{duration:400,easing:'ease-in'}).onfinish=()=>{if(tok===animTok&&view!=='home')HOME.style.visibility='hidden'}}
function closeApp(){if(callState||['home','lock','pin'].includes(view))return;
 const root=rootOf(view);if(PLAYER.dataset.voice)PLAYER.pause();lastAppId='';
 view='home';renderHome();HOME.style.visibility='visible';setStatus(true);
 const icon=HOME.querySelector(`.app[data-app="${root}"] .icon`);const r=icon?relRect(icon):{x:166,y:396,w:60,h:60};
 const tok=++animTok;APP.getAnimations().forEach(a=>a.cancel());
 const a=APP.animate(zoomFrames(r).reverse(),{duration:460,easing:'cubic-bezier(.3,.75,.2,1)',fill:'forwards'});
 a.onfinish=()=>{if(tok!==animTok)return;APP.style.visibility='hidden';APP.querySelectorAll('video').forEach(v=>v.pause());APP.innerHTML='';a.cancel()};
 HOME.animate([{transform:'scale(1.1)',opacity:0},{transform:'none',opacity:1}],{duration:460,easing:'cubic-bezier(.2,.9,.22,1)'});updateIsland();saveState()}
function push(id){show(id,'push')}
function back(){if(PARENT[view])show(PARENT[view],'pop');else closeApp()}
function hbAction(){if(callState)return;if(OV.querySelector('.viewer'))return closeViewer();if(OV.querySelector('.np'))return closeNP();
 if(view==='lock')return goPin();if(view==='pin')return;if(view==='home')return HOME.animate([{transform:'none'},{transform:'scale(.97)'},{transform:'none'}],250);closeApp()}
(function hbGesture(){const hb=$('#hb');let y0=null;hb.addEventListener('pointerdown',e=>{y0=e.clientY;hb.setPointerCapture(e.pointerId)});hb.addEventListener('pointerup',e=>{if(y0===null)return;y0=null;hbAction()})})();
function goBack(){if(callState)return;
 if(OV.querySelector('.viewer'))return closeViewer();if(OV.querySelector('.np'))return closeNP();
 if(['lock','pin','home'].includes(view)){if(view==='pin')pinCancel();return}back()}
function updateCrumb(){const on=!['lock','pin','home'].includes(view)&&!callState;$('#sb').classList.toggle('crumb',on)}
$('#sbk').innerHTML=`<svg viewBox="0 0 7 12"><path d="M6 1 1 6l5 5"/></svg>${t('home')}`;
$('#sbk').addEventListener('click',e=>{e.stopPropagation();if(callState)return;if(OV.querySelector('.viewer'))closeViewer();if(OV.querySelector('.np'))closeNP();closeApp()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')hbAction();else if(e.key==='Backspace'&&!e.target.closest('input,textarea')){e.preventDefault();goBack()}
 if(view==='tetris'&&tetAlive){if(e.key==='ArrowLeft')tetMove(-1);else if(e.key==='ArrowRight')tetMove(1);else if(e.key==='ArrowUp')tetRotate();else if(e.key==='ArrowDown')tetDrop()}});
try{history.pushState({wb:1},'');addEventListener('popstate',()=>{goBack();history.pushState({wb:1},'')})}catch(e){}

function navHTML(o){return `<div class="nav ${o.solid?'solid':''}">${o.back!==undefined?`<button class="nb-back" onclick="${o.backFn||'back()'}">${G.chevL}${o.back}</button>`:(o.left||'<span></span>')}<div class="nb-title">${o.title||''}</div><div class="nb-right">${o.right||''}</div></div>`}
function tabbar(items,on,cls=''){return `<div class="tabbar ${cls}">${items.map(([ic,l],i)=>`<button class="${i===on?'on':''}">${G[ic]||ic}<span>${l}</span></button>`).join('')}</div>`}

/* ============================ 各 App ============================ */
const VIEWS={};

/* --- 微信（聊天列表） --- */
const MUTED={'Ryan Rochad':1};
function chatPreview(id){
 const arr=chatData[id]||[];
 let last=arr.filter(x=>x[1]!=='date').slice(-1)[0];
 let time=fmtLabel(lastDateOf(id));
 if(id===MAIN&&todayChat.length){last=todayChat[todayChat.length-1];time=last[2]}
 if(!last)return{text:'',time:''};
 let txt=last[0];
 if(txt===REDPACKET)txt='[微信红包]';
 const m=mediaLabels[txt];if(m)txt='[图片]';
 if(id==='Ryan Rochad'&&last[1].startsWith('them:'))txt=last[1].slice(5)+'：'+txt;
 return{text:txt,time}}
function lastDateOf(id){const d=((chatData[id]||[]).filter(x=>x[1]==='date').slice(-1)[0]||[''])[0];return d}
function dateKeyOf(id){if(id===MAIN)return 99999;const p=parseLabel(lastDateOf(id));return p?p.y*10000+p.m*100+p.d:0}
VIEWS.wechat=()=>{
 const list=chatNames.slice().sort((a,b)=>dateKeyOf(b)-dateKeyOf(a));
 const pinned=list.filter(x=>x===MAIN),rest=list.filter(x=>x!==MAIN);
 const totalUnread=mainUnread;
 return{cls:'wxapp',html:`<div class="wx-h"><span class="wx-l"></span><b>${t('chats')}<small>（${totalUnread}）</small></b><span>${G.search}${G.chatPlus}</span></div>
 <div class="scroll">${[...pinned,...rest].map(id=>{const av=avatarOf(id)||'';const pv=chatPreview(id);const cnt=(id===MAIN?mainUnread:unread[id])||0;const muted=!!MUTED[id];
  return `<button class="crow ${id===MAIN?'crowpin':''}" onclick="chatId='${id}';push('chat')"><div class="av">${av?`<img src="${av}" alt="">`:G.sil}</div><div style="flex:1;min-width:0"><div class="cn">${esc(id)}${GROUP_CHATS[id]?`<small>${GROUP_CHATS[id]}</small>`:''}</div><div class="cp">${esc(pv.text)}</div></div><div class="cm"><span class="ct">${esc(pv.time)}</span><span class="cm2">${cnt?(muted?'<span class="cdot"></span>':`<span class="kbdg">${cnt}</span>`):''}${muted?`<span class="cmute">${G.bellOff}</span>`:''}</span></div></button>`}).join('')}</div>
 ${wxTabbar(0)}`}}
function wxTabbar(on){const items=[['chat','微信'],['contacts','通讯录'],['compass','发现'],['person','我']];
 return `<div class="tabbar">${items.map(([ic,l],i)=>`<button class="${i===on?'on':''}" onclick="wxTab(${i})">${G[ic]||ic}<span>${l}</span></button>`).join('')}</div>`}
function wxTab(i){
 if(i===0){if(view==='discover')back();else if(view==='moments'){back();back()}}
 else if(i===2){if(view==='wechat')push('discover');else if(view==='moments')back()}}

/* --- 发现 / 朋友圈 --- */
const moName=n=>n;
function ensureMomentLikes(){MOMENTS.forEach(m=>{if(!momentLikes[m.id])momentLikes[m.id]=[...m.likes]})}
function likesHTML(id){const lk=(momentLikes[id]||[]).map(moName);
 if(!lk.length)return '';
 return `<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block;vertical-align:-2px;margin-right:6px"><path d="M12 20s-7-4.6-9.2-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.2 11c-2.2 4.4-9.2 9-9.2 9Z" fill="none" stroke="#576b95" stroke-width="1.7"/></svg>${lk.map(x=>`<b>${esc(x)}</b>`).join('<span style="color:#9a9a9a">，</span>')}`}
/* --- 朋友圈视频：点击放大观看，再次点击退出 --- */
function openMoVideo(src){
 const d=document.createElement('div');d.className='pg movv';d.id='movUI';
 d.innerHTML=`<video id="movV" src="${src}" playsinline autoplay loop preload="auto" style="width:100%;height:100%;object-fit:contain;background:#000"></video>
  <div class="movtip" id="movtip">加载中…</div>`;
 d.onclick=()=>closeMoVideo();
 cdnScan(d);OV.appendChild(d);
 const v=d.querySelector('video');
 const tip=d.querySelector('#movtip');
 mediaTip(v,tip,'轻点任意位置退出');
 v.play().catch(()=>{v.muted=true;v.play().catch(()=>{})});
 d.animate([{opacity:0},{opacity:1}],{duration:240})}
function closeMoVideo(){const m=$('#movUI');if(!m)return;const v=m.querySelector('video');if(v)v.pause();
 m.animate([{opacity:1},{opacity:0}],{duration:200}).onfinish=()=>m.remove()}
function phMedia(label){return `<div class="mmph">${esc(label||'[图片]')}</div>`}
function momentMedia(m){
 if(!m.media)return '';
 const md=m.media;
 if(md.t==='video')return `<div class="mmv" onclick="openMoVideo('${md.src}')"><video src="${md.src}" poster="${md.poster||''}" playsinline preload="none" onerror="this.closest('.mmv').outerHTML=phMedia('${md.label||''}')"></video><span class="mmplay"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5.5v13l11-6.5Z" fill="#fff"/></svg></span></div>`;
 return `<div class="mmi"><img src="${md.src}" loading="lazy" onclick="event.stopPropagation();openViewerSrc('${md.src}',this)" onerror="this.parentElement.outerHTML=phMedia('${md.label||''}')"></div>`}
function momentHTML(m){
 const who=moName(m.who),av=avatarOf(who)||'';
 const liked=(momentLikes[m.id]||[]).includes('X');
 const lk=likesHTML(m.id);
 const cmts=m.comments.map(c=>`<div class="mc"><b>${esc(moName(c[0]))}</b>${c[2]?`<span style="color:#111"> 回复 </span><b>${esc(moName(c[2]))}</b>`:''}<span>：${esc(c[1])}</span></div>`).join('');
 return `<div class="mo">
  <div class="mo-av">${av?`<img src="${av}" alt="">`:G.sil}</div>
  <div class="mo-bd">
   <div class="mo-nm">${esc(who)}</div>
   ${m.text?`<div class="mo-tx">${esc(m.text)}</div>`:''}
   ${momentMedia(m)}
   <div class="mo-meta"><span class="mo-dt">${esc(m.date)}</span>
    <span class="mo-btnw"><span class="mo-pop" id="mop${m.id}"><button onclick="event.stopPropagation();moLike(${m.id})"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M12 20s-7-4.6-9.2-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.2 11c-2.2 4.4-9.2 9-9.2 9Z" fill="none" stroke="#fff" stroke-width="1.7"/></svg><span id="mop-t${m.id}">${liked?'取消':'赞'}</span></button></span>
    <button class="mo-btn" onclick="moToggle(event,${m.id})"><i></i><i></i></button></span></div>
   ${(lk||cmts)?`<div class="mo-react"><div class="mo-lk ${lk?'on':''}" id="mlk${m.id}">${lk}</div>${cmts}</div>`:''}
  </div>
 </div>`}
function moToggle(ev,id){ev.stopPropagation();
 document.querySelectorAll('.mo-pop.on').forEach(p=>{if(p.id!=='mop'+id)p.classList.remove('on')});
 $('#mop'+id).classList.toggle('on')}
document.addEventListener('click',()=>{document.querySelectorAll('.mo-pop.on').forEach(p=>p.classList.remove('on'))});
function moLike(id){const lk=momentLikes[id]||(momentLikes[id]=[]);const i=lk.indexOf('X');
 if(i>=0)lk.splice(i,1);else lk.push('X');
 saveState();$('#mop'+id).classList.remove('on');
 const el=$('#mlk'+id);const h=likesHTML(id);el.innerHTML=h;el.classList.toggle('on',!!h);
 const t=$('#mop-t'+id);if(t)t.textContent=i>=0?'赞':'取消'}
VIEWS.discover=()=>({cls:'wxapp',html:`<div class="wx-h"><span class="wx-l"></span><b>发现</b><span style="visibility:hidden">${G.search}${G.chatPlus}</span></div>
 <div class="scroll" style="background:#ededed"><div class="dgroup">
  <button class="drow" onclick="push('moments')"><span class="dic">${G.camera}</span><b>朋友圈</b><span style="margin-left:auto"></span>${G.chevR}</button>
 </div></div>
 ${wxTabbar(2)}`})
VIEWS.moments=()=>{
 ensureMomentLikes();prefetchMomentVideos();
 return{cls:'moapp',html:`<div class="mo-nav"><button class="mo-bk" onclick="back()">${G.chevL}</button><span class="mo-cam">${G.camera}</span></div>
 <div class="mo-scroll" id="moscroll">
  <div class="mo-cov"><img src="${MOMENT_COVER}" alt="" onclick="openViewerSrc('${MOMENT_COVER}',this)"></div>
  <div class="mo-me"><span class="mo-name">${OWNER}</span><span class="mo-mav"><img src="${avatarOf(ME)}" alt=""></span></div>
  ${[...MOMENTS].reverse().map(momentHTML).join('')}
 </div>`}}

/* --- 聊天室 --- */
function bubbleHTML(text){
 const m=mediaLabels[text];
 if(m&&m.kind==='image')return `<div class="bb img" onclick="event.stopPropagation();openViewerSrc('${m.src}',this.firstElementChild)"><img src="${m.src}" alt=""></div>`;
 if(text===REDPACKET)return `<div class="bb redpacket" onclick="event.stopPropagation();vib(10)"><div class="rp"><i>${G.rpIcon}</i><b>恭喜发财，大吉大利</b></div><div class="rf">${G.rpIcon}微信红包</div></div>`;
 return `<div class="bb">${esc(text)}</div>`}
function chatItems(id){
 const arr=id===MAIN?[...(chatData[id]||[]),...(todayChat.length?[['今天','date'],...todayChat]:[])]:(chatData[id]||[]);
 const grp=!!GROUP_CHATS[id];const out=[];let tm=null;
 arr.forEach((m,i)=>{
  if(m[1]==='date'){out.push({date:m[0]});tm=null;return}
  let sender=id,who=m[1],text=m[0];
  if(who.startsWith('them:')){sender=who.slice(5);who='them'}
  if(m[1]==='me')sender=ME;
  if(tm===null)tm=9*60+20+i%40;else tm+=1+(i%3);
  out.push({who,text,sender,time:ampm(tm),min:tm})});
 return{items:out,grp}}
function chatMsgs(id){
 const {items,grp}=chatItems(id);let o='';
 items.forEach((x,i)=>{
  if(x.date){o+=`<div class="dpill"><span>${esc(fmtLabel(x.date,true))}</span></div>`;return}
  const p=items[i-1];
  const first=!p||p.date||p.who!==x.who||p.sender!==x.sender;
  const me=x.who==='me';
  o+=`<div class="ln ${me?'me':'th'} ${first?'first':''}">${!me?`<div class="sav">${avatarOf(x.sender)?`<img src="${avatarOf(x.sender)}" alt="">`:G.sil}</div>`:''}
   <div class="col">${(!me&&grp)?`<div class="who">${esc(x.sender)}</div>`:''}<div class="wrap">${bubbleHTML(x.text)}</div></div>${me?`<div class="sav"><img src="${avatarOf(ME)}" alt=""></div>`:''}</div>`});
 return o}
VIEWS.chat=()=>{
 const grp=!!GROUP_CHATS[chatId];
 const unreadOther=Object.entries(unread).filter(([k])=>k!==chatId).reduce((a,[,b])=>a+b,0)+(chatId===MAIN?0:mainUnread);
 return{cls:'chat',
  html:`<div class="chat-h"><button class="bk" onclick="back()">${G.chevL}<span>${unreadOther||''}</span></button>
   <div class="nm">${esc(chatId)}${grp?`<small>${GROUP_CHATS[chatId]}</small>`:''}${MUTED[chatId]?`<span class="nm-mute">${G.bellOff}</span>`:''}</div><div class="rt">${G.dotsH}</div></div>
   <div class="msgs" id="msgs" onclick="closeKbd()">${chatMsgs(chatId)}</div>
   <div class="cin safe"><svg viewBox="0 0 24 24"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="1.6"/></svg>
    <div class="fld ph" id="fld" onclick="openKbd()">${pendingText?esc(pendingText)+'<span class="cur"></span>':'发消息…'}</div>
    ${G.smile?`<span style="width:26px">${G.dots}</span>`:''}
    <div class="snd ${pendingText?'on':''}" id="snd" onclick="sendTyped()"><svg viewBox="0 0 24 24" style="width:19px;height:19px;stroke:#fff;fill:none;stroke-width:1.8;stroke-linejoin:round"><path d="M3.5 11.5 20 4.5l-5.6 15-3.6-4.6-7.3-3.4z"/><path d="M10.8 14.9 20 4.5"/></svg></div></div>
   <div class="kbd" id="kbd"></div>`,
  init:pg=>{
   if(chatId===MAIN){mainUnread=0}else{unread[chatId]=0}
   saveState();scrollChat();
   if(chatId===MAIN&&replyStage===0&&!todayChat.length)setTimeout(()=>deliver(liveRounds[0].them[0]),1200)}}};
function scrollChat(bottom=true){const b=$('#msgs');if(b)b.scrollTop=b.scrollHeight}
function openKbd(){
 if(chatId!==MAIN||replyStage>=liveRounds.length)return;
 const k=$('#kbd');if(k.classList.contains('open'))return;
 if(!pendingText&&roundReady)pendingText=liveRounds[replyStage].mine[0];
 const f=$('#fld');if(f){f.classList.remove('ph');f.innerHTML=esc(pendingText)+'<span class="cur"></span>'}
 $('#snd')&&$('#snd').classList.add('on');
 k.innerHTML=`<div class="kin">${[['q w e r t y u i o p'],['a s f g h j k l'],['shift','z x c v b n m','bksp'],['123','space','ret']].map(row=>{
  let s=`<div class="kr">`;
  if(row.length===1){row[0].split(' ').forEach(c=>s+=`<button class="key" data-c="${c}" onpointerdown="keyTap('${c}',this)">${c}</button>`)}
  else{row.forEach(x=>{if(x==='shift')s+=`<button class="key sp">⇧</button>`;else if(x==='bksp')s+=`<button class="key sp" onclick="backspace()">⌫</button>`;
   else if(x==='space')s+=`<button class="key wide" data-c=" " onpointerdown="keyTap(' ',this)">空格</button>`;
   else if(x==='ret')s+=`<button class="key ret" onclick="sendTyped()">发送</button>`;
   else{x.split(' ').forEach(c=>s+=`<button class="key" data-c="${c}" onpointerdown="keyTap('${c}',this)">${c}</button>`)}})}
  return s+`</div>`}).join('')}
  <div class="kbot"><span>${G.globe}</span><span>${G.mic}</span></div></div>`;
 k.classList.add('open');kbPad(true);if(view==='chat'){scrollChat();setTimeout(scrollChat,420)}}
function keyTap(c,el){el.classList.add('dn');setTimeout(()=>el.classList.remove('dn'),90);sfx('key');pendingText+=c;
 const f=$('#fld');if(f){f.classList.remove('ph');f.innerHTML=esc(pendingText)+'<span class="cur"></span>'}
 $('#snd')&&$('#snd').classList.add('on')}
function backspace(){pendingText=pendingText.slice(0,-1);const f=$('#fld');if(f){if(!pendingText)f.classList.add('ph');f.innerHTML=pendingText?esc(pendingText)+'<span class="cur"></span>':'发消息…'}}
function closeKbd(){const k=$('#kbd');if(!k||!k.classList.contains('open'))return;
 k.classList.remove('open');kbPad(false);pendingText='';
 const f=$('#fld');if(f){f.classList.add('ph');f.textContent='发消息…'}$('#snd')&&$('#snd').classList.remove('on')}
function kbPad(on){const c=document.querySelector('.chat .cin');if(c)c.classList.toggle('kb-on',on)}
function advanceReply(){if(replyBusy||replyStage>=liveRounds.length)return;
 replyBusy=true;const next=liveRounds[replyStage+1];
 setTimeout(()=>{if(next){next.them.forEach((m,k)=>setTimeout(()=>deliver(m),k*900));
   replyStage++;replyBusy=false;roundReady=false;
   /* 等对方把这一轮全部发完，才把我方下一句显示到输入框 */
   const wait=900+(next.them.length-1)*900+1500;
   setTimeout(()=>{roundReady=true;
    if(view==='chat'&&chatId===MAIN){
     pendingText=next.mine[0];const f=$('#fld');if(f){f.classList.remove('ph');f.innerHTML=esc(pendingText)+'<span class="cur"></span>'}$('#snd')&&$('#snd').classList.add('on')}},wait)}
  else{AFTER_REPLY.forEach((m,k)=>setTimeout(()=>deliver(m),k*900));setTimeout(incomingCall,2200);
   replyStage++;replyBusy=false}},900)}
function sendTyped(){if(!pendingText){openKbd();return}
 const txt=pendingText;pendingText='';
 const f=$('#fld');if(f){f.classList.add('ph');f.textContent='发消息…'}$('#snd').classList.remove('on');
 appendMine(txt);advanceReply();}
function sendReply(j){
 if(replyBusy)return;
 const stage=liveRounds[replyStage];if(!stage)return;
 const txt=stage.mine[j];
 $('#kbd').classList.remove('open');const f=$('#fld');if(f){f.classList.add('ph');f.textContent='发消息…'}$('#snd').classList.remove('on');
 appendMine(txt);advanceReply();}
function refreshReplyBar(){const rb=$('#replybar');if(!rb)return;
 if(replyStage>=liveRounds.length)rb.remove();else rb.innerHTML=liveRounds[replyStage].mine.map((s,j)=>`<button onclick="sendReply(${j})">${esc(s)}</button>`).join('')}
function appendMine(txt){const tm=ampm(nowMin());todayChat.push([txt,'me',tm]);sfx('send');
 if(view==='chat'&&chatId===MAIN){const b=$('#msgs');if(b){b.insertAdjacentHTML('beforeend',`<div class="ln me pop"><div class="col"><div class="wrap">${bubbleHTML(txt)}</div></div><div class="sav"><img src="${avatarOf(ME)}" alt=""></div></div>`);scrollChat()}}saveState()}
function deliver(text){
 todayChat.push([text,'them',ampm(nowMin())]);sfx('msg');
 if(view==='chat'&&chatId===MAIN){showTyping();setTimeout(()=>{hideTyping();
   const b=$('#msgs');if(b){b.insertAdjacentHTML('beforeend',`<div class="ln th pop"><div class="sav"><img src="${avatarOf(THEM)}" alt=""></div><div class="col"><div class="wrap">${bubbleHTML(text)}</div></div></div>`);scrollChat()}},1100)}
 else{mainUnread++;if(view==='lock'||view==='pin'){renderLock()}else{banner(text);renderHome()}}
 saveState()}
function showTyping(){if(!(view==='chat'&&chatId===MAIN))return;const b=$('#msgs');if(!b||$('#typ'))return;
 b.insertAdjacentHTML('beforeend',`<div class="ln th" id="typ"><div class="sav"><img src="${avatarOf(THEM)}" alt=""></div><div class="col"><div class="wrap"><div class="bb typing pop"><i></i><i></i><i></i></div></div></div></div>`);scrollChat()}
function hideTyping(){const el=$('#typ');if(el)el.remove()}
function banner(text){OV.querySelectorAll('.banner').forEach(b=>b.remove());
 const b=document.createElement('div');b.className='banner';
 b.innerHTML=`<div class="ncard" onclick="this.closest('.banner').remove();openBannerChat()">${ncardHTML({title:MAIN,body:text,app:'wechat',time:t('now')})}</div>`;
 OV.appendChild(b);setTimeout(()=>{b.animate([{opacity:1},{opacity:0}],{duration:300}).onfinish=()=>b.remove()},4200)}
function openBannerChat(){if(callState)return;chatId=MAIN;if(view==='home')openApp('wechat',HOME.querySelector('.app[data-app="wechat"] .icon'));else if(view!=='chat')push('chat');else if(view==='chat'&&chatId!==MAIN)show('chat')}

/* ============================ 通话 ============================ */
function callTop(name){const img=name===MAIN||name===THEM?avatarOf(THEM):avatarOf(name);
 return `<div class="cav">${img?`<img src="${img}" alt="">`:`<span style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(#a5abb6,#7f858f);font-size:42px;font-weight:500">${esc(name[0])}</span>`}</div>
 <div class="cnm">${esc(name)}</div>`}
function renderCall(){
 $('#sbk').style.visibility='hidden';
 const name=callState==='ring'||callState==='active'?MAIN:MAIN;
 const d=document.createElement('div');d.className='call act';d.id='callUI';
 d.innerHTML=`
  ${callTop(MAIN)}
  <div class="csub" id="csub">${callState==='ring'?'手机':callState==='dialing'?'正在呼叫…':'00:00'}</div>
  <div class="cgridwrap" id="cbtns"></div>`;
 cdnScan(d);OV.appendChild(d);
 renderCallBtns();
 d.animate([{opacity:0},{opacity:1}],{duration:260})}
function renderCallBtns(){
 const box=$('#cbtns');if(!box)return;
 if(callState==='ring'){
  box.innerHTML=`<div class="ring-opts">
   <button class="cb"><span class="cc sm">${G.alarm}</span><span>提醒我</span></button>
   <button class="cb"><span class="cc sm">${G.msgF}</span><span>信息</span></button></div>
  <div class="ring-main">
   <button class="cb red" onclick="declineCall()"><span class="cc">${G.handset.replace('<svg','<svg style="transform:rotate(135deg)"')}</span><span>${t('decline')}</span></button>
   <button class="cb grn" onclick="acceptCall()"><span class="cc">${G.handset}</span><span>${t('accept')}</span></button></div>`}
 else{
  box.innerHTML=`<div class="cgrid6">
   <button class="cb ${onSpeaker?'on':''}" onclick="toggleSpeaker()"><span class="cc">${G.speaker}</span><span>扬声器</span></button>
   <button class="cb"><span class="cc">${G.videoF}</span><span>FaceTime</span></button>
   <button class="cb ${muted?'on':''}" onclick="toggleMute()"><span class="cc">${G.muteF}</span><span>静音</span></button>
   <button class="cb"><span class="cc">${G.plusF}</span><span>${t('addCall')}</span></button>
   <button class="cb red" onclick="endCall()"><span class="cc">${G.handset.replace('<svg','<svg style="transform:rotate(135deg)"')}</span><span>${t('endCall')}</span></button>
   <button class="cb"><span class="cc">${G.keypad}</span><span>拨号键盘</span></button></div>`}}
let muted=false,onSpeaker=false;
function toggleMute(){muted=!muted;renderCallBtns()}
function toggleSpeaker(){onSpeaker=!onSpeaker;renderCallBtns()}
function incomingCall(){
 if(callState)return;
 callState='ring';if(nowSong>=0)PLAYER.pause();
 APP.querySelectorAll('video').forEach(v=>v.pause());OV.querySelectorAll('.banner').forEach(b=>b.remove());
 renderCall();ringIv=setInterval(ringOnce,2200);ringOnce();
 setTimeout(()=>{if(callState==='ring')missCall()},24000)}
let ringIv=null;
function stopRing(){if(ringIv){clearInterval(ringIv);ringIv=null}}
function acceptCall(){
 stopRing();callState='active';renderCallBtns();
 const src=cdnU((callStage===0)?CALL1:CALL2);
 callAudio=new Audio(src);callAudio.play().catch(()=>{});
 const sub=$('#csub');let sec=0;
 callTimer=setInterval(()=>{sec++;if(sub)sub.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`},1000);
 callAudio.onended=()=>setTimeout(endCall,600);
 if(callStage===0){callStage=1;saveState()}}
function endCall(){
 if(!callState)return;
 stopRing();if(callAudio){callAudio.pause();callAudio=null}
 if(callTimer){clearInterval(callTimer);callTimer=null}
 const wasActive=callState==='active'||callState==='dialing';callState='';closeCallUI();
 if(wasActive){extraCalls.unshift([MAIN,'今天 '+new Date().getHours()+':'+pad(new Date().getMinutes()),'呼出','—']);saveState()}}
function declineCall(){stopRing();callState='';declined++;closeCallUI();DECLINED_MSG.forEach((m,k)=>setTimeout(()=>deliver(m),1200+k*1200));saveState()}
function missCall(){if(callState!=='ring')return;stopRing();callState='';declined++;closeCallUI();
 MISSED_MSG.forEach((m,k)=>setTimeout(()=>deliver(m),1200+k*1200));saveState()}
function closeCallUI(){const c=$('#callUI');if(c){c.animate([{opacity:1},{opacity:0}],{duration:240}).onfinish=()=>c.remove()}$('#sbk').style.visibility=''}
function dial(name){
 if(callState)return;
 if(name!==MAIN&&name!==THEM)return;
 if(name===MAIN||name===THEM){
  callState='dialing';renderCall();
  setTimeout(()=>{if(callState!=='dialing')return;callState='active';renderCallBtns();
   const sub=$('#csub');if(sub)sub.textContent='00:00';
   const src=cdnU(CALL2);callAudio=new Audio(src);callAudio.play().catch(()=>{});
   let sec=0;callTimer=setInterval(()=>{sec++;const s2=$('#csub');if(s2)s2.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`},1000);
   callAudio.onended=()=>setTimeout(endCall,600)},2000);
  return}
 // 其他人：短促忙音后提示无人接听
 callState='dialing';renderCall();
 let sec=0;
 callTimer=setInterval(()=>{sec++;if(sec>3){clearInterval(callTimer);callTimer=null;callState='';closeCallUI()}},1000)}

/* --- 电话 --- */
VIEWS.phone=()=>{
 const all=[...extraCalls,...calls].filter(c=>!missOnly||c[2]==='未接');
 return{html:`<div class="nav"><button style="color:var(--blue);font-size:17px;justify-self:start;padding-left:8px">${t('edit')}</button>
  <div class="seg"><button class="${missOnly?'':'on'}" onclick="missOnly=false;show('phone')">${t('all')}</button><button class="${missOnly?'on':''}" onclick="missOnly=true;show('phone')">${t('missed')}</button></div><span></span></div>
  <div class="scroll"><h1 class="lt">${t('recents')}</h1><div class="srch">${G.search}${t('search')}</div>
  ${all.map(c=>`<div class="prow ${c[2]==='未接'?'miss':''}" onclick="dial('${esc(c[0])}')"><span class="pi">${c[2]==='呼出'?'<svg viewBox="0 0 24 24"><path d="M6.6 3.2c.6-.3 1.4-.1 1.8.5l1.9 3c.4.6.3 1.4-.2 1.9l-1.4 1.3a12.4 12.4 0 0 0 5.4 5.4l1.3-1.4c.5-.5 1.3-.6 1.9-.2l3 1.9c.6.4.8 1.2.5 1.8l-.9 1.9c-.5 1-1.6 1.6-2.7 1.4C10 19.6 4.4 14 3.3 6.8c-.2-1.1.4-2.2 1.4-2.7Z"/></svg>':''}</span>
   <div class="pn"><b>${esc(c[0])}</b><small>${c[2]}${c[3]&&c[3]!=='—'?' · '+c[3]:''}</small></div><span class="pd">${esc(c[1])}</span><span class="inf">${G.info}</span></div>`).join('')}</div>
  ${tabbar([['star',t('favorites')],['clock',t('recents')],['contacts',t('contacts')],['keypad',t('keypad')],['voicemail',t('voicemail')]],1)}`}}

/* --- 备忘录 --- */
function noteDate(ds){const p=parseLabel(ds);if(!p)return ds;
 if(p.y===TODAY.y&&p.m===TODAY.m&&p.d===TODAY.d)return fmtTime(nowMin());
 const diff=Math.round((new Date(TODAY.y,TODAY.m-1,TODAY.d)-new Date(p.y,p.m-1,p.d))/864e5);
 if(diff===1)return t('yesterday');if(diff<7)return wdLong(p.y,p.m,p.d);return fmtMD(p.m,p.d)}
VIEWS.notes=()=>({cls:'grouped notes-pg',html:navHTML({title:t('app_notes'),back:t('folders'),right:G.dots})+
 `<div class="scroll"><h1 class="lt">${t('app_notes')}</h1><div class="srch">${G.search}${t('search')}</div>
 <div class="gh" style="margin-top:8px">${t('pinned')}</div><div class="group note-l">${notes.slice(0,1).map((n,i)=>`<button class="row tap" onclick="noteId=${i};push('note')"><b>${esc(n.title)}</b><small><em>${noteDate(n.date)}</em>${esc(n.body.split('\n')[0])}</small></button>`).join('')}</div>
 <div class="gh">${t('notesSec')}</div><div class="group note-l">${notes.slice(1).map((n,i)=>`<button class="row tap" onclick="noteId=${i+1};push('note')"><b>${esc(n.title)}</b><small><em>${noteDate(n.date)}</em>${esc(n.body.split('\n')[0])}</small></button>`).join('')}</div></div>
 <div class="toolbar"><span style="width:24px"></span><span style="color:#000;align-self:center;font-size:11px">${t('nNotes',notes.length)}</span>${G.compose}</div>`});
VIEWS.note=()=>{const n=notes[noteId];return{cls:'notes-pg',html:navHTML({title:'',back:t('app_notes'),right:G.share+G.dots})+
 `<div class="scroll"><div class="note-v"><div class="nd">${fmtYMD(...Object.values(parseLabel(n.date)))}</div><h2>${esc(n.title)}</h2>${esc(n.body)}</div></div>
 <div class="toolbar">${G.check}${G.camera}${G.pen}${G.compose}</div>`}};

/* --- 日历 --- */
function calHas(y,m,d){
 if(m===BDAY.m&&d===BDAY.d)return true;
 if(d===CHECKUP_DAY)return true;
 return !!(events[m]&&events[m][d])}
function calEventsOf(m,d){const out=[];
 if(m===BDAY.m&&d===BDAY.d)out.push(BDAY.label);
 if(d===CHECKUP_DAY)out.push('复查');
 (events[m]&&events[m][d]||[]).forEach(x=>out.push(x));
 return [...new Set(out)]}
VIEWS.calendar=()=>{
 const first=(new Date(TODAY.y,calMonth-1,1).getDay()+6)%7,days=new Date(TODAY.y,calMonth,0).getDate();
 let c='';for(let i=0;i<first;i++)c+='<div></div>';
 for(let d=1;d<=days;d++){const dow=(first+d-1)%7;const td=(d===TODAY.d&&calMonth===TODAY.m);
  c+=`<button class="cal-d ${td?'td':''} ${d===selectedDay?'sel':''} ${dow===5||dow===6?'we':''}" onclick="selectedDay=${d};show('calendar')"><span>${d}</span>${calHas(TODAY.y,calMonth,d)?'<i></i>':''}</button>`}
 const ev=calEventsOf(calMonth,selectedDay).map(x=>`<div class="evt"><span class="bar" style="background:${x===BDAY.label?'#ff9500':x==='复查'?'#34c759':'#af52de'}"></span><b>${esc(x)}</b><small>${t('allDay')}</small></div>`).join('')||`<div class="evt muted">${t('noEvents')}</div>`;
 return{html:navHTML({title:'',back:fmtYear(TODAY.y),backFn:'closeApp()',right:G.list+G.search+G.plus})+
 `<div class="scroll" style="padding-bottom:120px"><div style="display:flex;justify-content:space-between;align-items:center;margin:0 16px 8px">
  <h1 class="lt" style="margin:0">${fmtMonth(calMonth)}</h1>
  <span style="display:flex;gap:26px;color:var(--blue)"><button style="width:22px" onclick="calNav(-1)">${G.chevLb}</button><button style="width:22px" onclick="calNav(1)">${G.chevRb}</button></span></div>
  <div class="cal-g cal-w">${wdNarrow().map(w=>`<div>${w}</div>`).join('')}</div><div class="cal-g" id="calg">${c}</div>
  <div style="border-top:.5px solid var(--sep);margin-top:4px;padding-top:4px">${ev}</div></div>
  <div class="tabbar" style="color:#ff3b30">${[t('today'),t('calendars'),t('inbox')].map(x=>`<button style="color:#ff3b30;font-size:16px;justify-content:center">${x}</button>`).join('')}</div>`}};
function calNav(d){const n=calMonth+d;if(n<1||n>12)return;calMonth=n;selectedDay=(n===TODAY.m?TODAY.d:1);const pg=show('calendar');pg.querySelector('#calg').animate([{transform:`translateX(${d*40}%)`,opacity:0},{transform:'none',opacity:1}],{duration:350,easing:'cubic-bezier(.2,.9,.25,1)'})}

/* --- 时钟 --- */
function worldTime(off){const now=new Date();const utc=now.getTime()+now.getTimezoneOffset()*60000;
 const bj=new Date(utc+8*3600000),d=new Date(utc+off*3600000);
 const rel=Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(bj.getFullYear(),bj.getMonth(),bj.getDate()))/864e5);
 return{dstr:String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'),rel,diff:off-8}}
function toggleAlarm(){alarmOn=!alarmOn;vib(8);sfx('key');saveState();if(view==='clock')show('clock')}
VIEWS.clock=()=>{
 const ap=alarmParts(ALARM.h,ALARM.m);
 const rows=WORLD_CLOCKS.map(([n,off])=>{const w=worldTime(off);
  return `<div class="wrow"><div class="wc"><b>${esc(n)}</b><small>${w.rel<0?'昨天':w.rel>0?'明天':'今天'}，${w.diff>=0?'+':''}${w.diff}小时</small></div><div class="wt">${w.dstr}</div></div>`}).join('');
 return{cls:'dark',dark:true,html:`<div class="nav" style="color:#ff9f0a"><button style="color:#ff9f0a;font-size:17px;justify-self:start;padding-left:8px">${t('edit')}</button>
  <div class="nb-title">${t('alarm')}</div><div class="nb-right" style="color:#ff9f0a">${G.plus}</div></div>
  <div class="scroll"><h1 class="lt">${t('alarm')}</h1>
  <div style="margin:10px 16px 4px;font-size:15px;font-weight:600">${t('sleepWake')}</div>
  <div style="padding:8px 16px 14px;color:#8e8e93;font-size:15px;border-bottom:.5px solid rgba(255,255,255,.15)">${t('noAlarm')} <span style="float:right;color:#ff9f0a">${t('setUp')}</span></div>
  <div style="margin:18px 16px 4px;font-size:15px;font-weight:600">${t('other')}</div>
  <div class="alarm"><div><div class="at ${alarmOn?'':'off'}">${ap.before?`<small>${ap.dp}</small>${ap.tm}`:`${ap.tm}<small style="margin-left:4px">${ap.dp}</small>`}</div><div class="al ${alarmOn?'':'off'}">${ALARM.label}</div></div>
   <button class="sw ${alarmOn?'on':''}" onclick="toggleAlarm()"></button></div>
  <div class="gh" style="color:#8e8e93;margin:22px 16px 7px">${t('worldClock')}</div>
  <div style="border-top:.5px solid rgba(255,255,255,.12)">${rows}</div></div>
  ${tabbar([['globe',t('worldClock')],['alarm',t('alarm')],['stopwatch',t('stopwatch')],['timer',t('timer')]],1)}`}}

/* --- 天气 --- */
const WICON={sun:G.sun,moon:G.moon,cloud:G.cloud,pcloud:G.pcloud};
VIEWS.weather=()=>{const W=WEATHER;
 return{cls:'wx',dark:true,html:`<div class="scroll">
  <div class="top"><div class="lc">${W.city}</div><div class="ct">${W.summary}</div><div class="tp">${W.temp}</div><div class="ds">最高${W.hi} 最低${W.lo}</div></div>
  <div class="wcard"><div class="wh">${W.summary}，将持续一整天。</div>${W.summary}</div>
  <div class="wcard"><div class="wh">未来 8 小时</div><div class="hrs">${W.hours.map((h,i)=>`<div>${WICON[W.hourIcon[i]]||G.sun}<span>${h}</span><span>${W.hourTemp[i]}</span></div>`).join('')}</div></div>
  <div class="wcard"><div class="wh">${t('tenDay')}</div>${W.tenDay.map(d=>`<div class="d10"><span>${d[0]}</span>${G.cloud}<span class="lo">${d[1]}</span><span class="rng"><i style="left:${d[3]}%;right:${100-d[4]}%"></i></span><span>${d[2]}</span></div>`).join('')}</div>
  <div class="wcard"><div class="wh">${t('uv')}</div><div style="font-size:26px;font-weight:300">${W.uv}</div><div style="font-size:14px;opacity:.8;margin-top:2px">${W.uvLevel}</div></div>
  <div class="wcard"><div class="wh">${t('sunset')} / ${t('sunrise')}</div><div style="display:flex;justify-content:space-between;font-size:15px"><span>日落 ${W.sunset}</span><span>日出 ${W.sunrise}</span></div></div>
  </div>`}}

/* --- 照片 --- */
VIEWS.photos=()=>{
 const secs=photoSections.map(([name,list])=>`<div class="ph-sec">${esc(name)}</div><div class="ph-grid">${list.map(n=>`<button onclick="openViewer(${n})"><img src="${photoThumb(n)}" alt="" loading="lazy" decoding="async"></button>`).join('')}</div>`).join('');
 return{html:`<div class="nav solid"><span></span><div class="nb-title"></div><span></span></div>
  <div class="scroll" style="padding-top:100px">${secs}</div>
  <div class="phtabs"><button class="on">${t('library')}</button><button>${t('years')}</button><button>${t('months')}</button></div>`}};
let viewerIdx=0,viewerList=[];
/* 原图在后台加载，就绪后自动替换缩略图：点开／翻看都是即时出图，不白屏不等待 */
function viewerLoadFull(n){
 const full=cdnU(photoSrc(n));
 const pre=new Image();
 pre.onload=()=>viewerSwap(n,full);
 pre.onerror=()=>{viewerSwap(n,photoSrc(n));const t=$('#viewer .vi');if(t)cdnNoteFail(t)};
 pre.src=full;
 viewerPreload();
}
function viewerSwap(n,url){
 const t=$('#viewer .vi');
 if(t&&t.getAttribute('data-n')==String(n))t.src=url;   /* 已翻到别张则丢弃这次结果 */
}
function viewerSetThumb(img,n){
 img.setAttribute('data-n',n);
 img.setAttribute('data-loc',photoThumb(n));
 img.onerror=function(){if(this.src.indexOf('jsdelivr')>=0){this.onerror=null;this.src=this.getAttribute('data-loc');cdnNoteFail(this)}};
 img.src=cdnU(photoThumb(n));   /* 网格里已缓存，同步显示，翻看零延迟 */
}
function openViewer(n){viewerList=photoSections.flatMap(s=>s[1]);viewerIdx=viewerList.indexOf(n);
 const d=document.createElement('div');d.className='viewer';d.id='viewer';
 d.innerHTML=`<div class="vbg"></div><img class="vi" src="${cdnU(photoThumb(n))}" data-loc="${photoThumb(n)}" data-n="${n}" style="inset:8% 0;height:84%;width:100%">
  <div class="vb"><button onclick="event.stopPropagation();viewerStep(-1)">${G.chevLb}</button><span></span><button onclick="event.stopPropagation();viewerStep(1)">${G.chevRb}</button></div>
  <div class="movtip">轻点任意位置退出</div>`;
 d.onclick=()=>{if(d.dataset.swiped)return;closeViewer()};
 /* 左右滑动翻看：位移超过 45px 判定为滑动，滑动后不触发关闭 */
 let sx=0,sy=0,sd=false;
 d.addEventListener('pointerdown',e=>{sx=e.clientX;sy=e.clientY;sd=true},{passive:true});
 d.addEventListener('pointerup',e=>{if(!sd)return;sd=false;
  const dx=e.clientX-sx,dy=e.clientY-sy;
  if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){d.dataset.swiped='1';viewerStep(dx<0?1:-1);setTimeout(()=>{d.dataset.swiped=''},80)}
 },{passive:true});
 OV.appendChild(d);cdnScan(d);viewerLoadFull(n);d.animate([{opacity:0},{opacity:1}],{duration:250})}
function viewerStep(k){
 viewerIdx=(viewerIdx+k+viewerList.length)%viewerList.length;
 const n=viewerList[viewerIdx];
 const img=$('#viewer .vi');if(!img)return;
 viewerSetThumb(img,n);
 viewerLoadFull(n);
}
/* 预取前后各两张，左右翻看几乎无等待 */
function viewerPreload(){
 if(!viewerList||!viewerList.length)return;
 [1,-1,2,-2].forEach(k=>{
  const n=viewerList[(viewerIdx+k+viewerList.length)%viewerList.length];
  const i=new Image();i.src=cdnU(photoSrc(n));
 });
}
function closeViewer(){const v=$('#viewer');if(v)v.animate([{opacity:1},{opacity:0}],{duration:220}).onfinish=()=>v.remove()}
function openViewerSrc(src){const d=document.createElement('div');d.className='viewer';d.id='viewer';
 d.innerHTML=`<div class="vbg"></div><img class="vi" src="${src}" style="inset:8% 0;height:84%;width:100%">
  <div class="movtip">轻点任意位置退出</div>`;
 d.onclick=()=>closeViewer();
 cdnScan(d);OV.appendChild(d);d.animate([{opacity:0},{opacity:1}],{duration:250})}

/* --- 邮件 --- */
VIEWS.mail=()=>({html:`<div class="nav"><button style="color:var(--blue);font-size:17px;justify-self:start;padding-left:8px">${t('edit')}</button><div class="nb-title"></div><span></span></div>
 <div class="scroll"><h1 class="lt">${t('mailboxes')}</h1><div class="srch">${G.search}${t('search')}</div>
 <div class="gh">${t('updatedNow')}</div>
 ${emails.map((m,i)=>{const un=!readMail.has(i);
  return `<button class="mrw" onclick="mailId=${i};readMail.add(${i});saveState();push('maild')"><span class="dot ${un?'':'r'}"></span>
  <div class="bd"><div class="l1"><b>${esc(m.from)}</b><span>${esc(m.date)}${un?'':' ✓'}</span></div>
  <div class="sj">${esc(m.subject)}</div><div class="pv">${esc(m.body.replace(/\n/g,' ').slice(0,60))}…</div></div></button>`}).join('')}</div>`});
VIEWS.maild=()=>{const m=emails[mailId];
 return{html:navHTML({title:'',back:t('mailboxes'),right:G.trash+G.compose+G.share})+
  `<div class="scroll"><div class="mail-d"><div class="hd"><div class="ini">${esc(m.from.slice(0,1))}</div>
   <div style="flex:1"><b>${esc(m.from)}</b><small>${t('toMe')} ${esc(m.date)}</small></div></div>
   <h2>${esc(m.subject)}</h2><div class="bd">${esc(m.body)}</div></div></div>
   <div class="toolbar">${G.trash}${G.inbox}${G.compose}</div>`}};

/* --- Safari --- */
const SAFARI_FAVS=[['公司官网','公','#5e5ce6'],['拍卖日程','拍','#30d158'],['资料中心','资','#8e6b3f'],['内部系统','内','#ff453a'],['差旅','差','#5e5ce6'],['邮箱','邮','#7d7aff'],['行业资讯','行','#30d158'],['地图','地','#ff9f0a']];
VIEWS.safari=()=>({cls:'saf',html:`<div class="scroll" style="padding-top:104px">
 <h1 class="saf-h">个人收藏</h1>
 <div class="saf-favs">${SAFARI_FAVS.map(([n,c,col])=>`<button class="saf-fav"><span style="background:${col}22;color:${col}">${c}</span><small>${n}</small></button>`).join('')}</div>
 <h1 class="saf-h">隐私报告</h1>
 <div class="saf-card"><svg viewBox="0 0 24 24" style="width:26px;flex:none"><path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.4 7.5 10 4.3-1.6 7.5-5.4 7.5-10v-6Z" fill="#e8e8ed"/><path d="M12 4 6.5 6.3v5.2c0 3.5 2.3 6.7 5.5 8.3 3.2-1.6 5.5-4.8 5.5-8.3V6.3Z" fill="#fa5151"/><path d="M12 6.5v8" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="16.5" r=".9" fill="#fff"/></svg><span>过去 7 天，Safari 已阻止 <b>14 个跟踪器</b>分析你的个人资料。</span></div>
 <h1 class="saf-h">阅读列表</h1>
 <div class="saf-card" style="justify-content:center;color:#8e8e93">阅读列表为空</div>
 </div>
 <div class="sbar"><button class="ad" onclick="push('safsearch')"><span style="font-size:17px;font-weight:700;color:#000;flex:none">中</span><b>搜索或输入网站名称</b>${G.mic}</button>
 <div class="tb"><span>${G.chevLb}</span><span>${G.chevRb}</span><span>${G.share}</span><span>${G.book}</span><span>${G.tabs}</span></div></div>`});
VIEWS.safsearch=()=>({cls:'saf',html:`<div class="scroll">
 <h1 class="lt" style="font-size:28px">${t('recentSearches')}</h1>
 <div class="group" style="margin-top:10px">${searches.map(s=>`<div class="row srec"><span style="color:var(--grey);width:22px">${G.search}</span>${esc(s)}</div>`).join('')}</div>
 <div style="text-align:center;color:var(--blue);font-size:15px;margin-top:14px">${t('clear')}</div>
 </div>
 <div class="sbar"><div class="ad">${G.search}<b>${t('searchWeb')}</b></div>
 <div class="tb"><span>${G.chevLb}</span><span>${G.chevRb}</span><span>${G.share}</span><span>${G.book}</span><span>${G.tabs}</span></div></div>`});

/* --- 音乐 --- */
function playSong(i){
 if(nowSong===i&&!PLAYER.paused){PLAYER.pause();updateIsland();if(view==='music')show('music');return}
 nowSong=i;PLAYER.src=cdnU(songs[i].src);PLAYER.dataset.voice='';PLAYER.play().catch(()=>{});
 PLAYER.onended=()=>{nowSong=(nowSong+1)%songs.length;PLAYER.src=cdnU(songs[nowSong].src);PLAYER.play().catch(()=>{})};
 PLAYER.onpause=()=>updateIsland();PLAYER.onplay=()=>updateIsland();
 updateIsland();if(view==='music')show('music')}
VIEWS.music=()=>{
 const playing=nowSong>=0&&!PLAYER.paused;
 return{html:navHTML({title:'',back:t('library')})+
 `<div class="scroll" style="padding-top:104px;padding-bottom:104px"><h1 class="lt">${t('songs')}</h1>
  <div class="mact"><button onclick="playSong(${Math.floor(Math.random()*songs.length)})">${G.playF.replace('<svg','<svg width="19" height="19"')}<span>${t('play')}</span></button>
  <button onclick="shufflePlay()">${G.shuffleIco.replace('<svg','<svg width="22" height="22"')}<span>${t('shuffle')}</span></button></div>
  <div class="group">${songs.map((s,i)=>`<button class="mrow" onclick="playSong(${i})">
   <span class="art"><img src="${s.cover}" alt="" onerror="this.style.display='none'"></span>
   <span class="mt ${nowSong===i?'pl':''}">${esc(s.title)}<small>${esc(s.artist)}</small></span></button>`).join('')}</div></div>
  ${nowSong>=0?`<div class="mini" onclick="openNP()"><span class="art"><img src="${songs[nowSong].cover}" alt="" onerror="this.style.display='none'"></span><b>${esc(songs[nowSong].title)}</b><span class="mbtn" onclick="event.stopPropagation();togglePlay()">${playing?G.pauseF.replace('<svg','<svg width="22" height="22"'):G.playF.replace('<svg','<svg width="22" height="22"')}</span></div>`:''}`}};
function shufflePlay(){let i=Math.floor(Math.random()*songs.length);
 if(songs.length>1&&i===nowSong)i=(i+1+Math.floor(Math.random()*(songs.length-1)))%songs.length;
 nowSong=i;PLAYER.src=cdnU(songs[i].src);PLAYER.play().catch(()=>{});updateIsland();if(view==='music')show('music')}
function openNP(){const d=document.createElement('div');d.className='np';d.id='np';
 d.innerHTML=`<div class="npgrab"><i class="grab"></i></div><div class="bigart"><img src="${songs[nowSong].cover}" alt="" onerror="this.style.display='none'"></div>
  <div class="ti">${esc(songs[nowSong].title)}<small>${esc(songs[nowSong].artist)}</small></div>
  <div class="bar"><i style="width:0" id="npbar"></i></div><div class="tt"><span>0:00</span><span>--:--</span></div>
  <div class="ctl"><span onclick="npStep(-1)">${G.bwdF.replace('<svg','<svg width="30" height="30"')}</span>
   <span onclick="togglePlay()" id="npbtn">${(PLAYER.paused?G.playF:G.pauseF).replace('<svg','<svg width="36" height="36"')}</span>
   <span onclick="npStep(1)">${G.fwdF.replace('<svg','<svg width="30" height="30"')}</span></div>`;
 cdnScan(d);OV.appendChild(d);d.animate([{opacity:0},{opacity:1}],{duration:260});
 npDragInit(d);
 PLAYER.addEventListener('timeupdate',npTick)}
function npStep(k){if(nowSong<0)return;
 nowSong=(nowSong+k+songs.length)%songs.length;
 PLAYER.src=cdnU(songs[nowSong].src);PLAYER.play().catch(()=>{});
 saveState();updateIsland();npRefresh();if(view==='music')show('music')}
function npRefresh(){const d=$('#np');if(!d)return;const s=songs[nowSong];
 const img=d.querySelector('.bigart img');if(img)img.src=cdnU(s.cover);
 const ti=d.querySelector('.ti');if(ti)ti.innerHTML=esc(s.title)+'<small>'+esc(s.artist)+'</small>';
 const bt=$('#npbtn');if(bt)bt.innerHTML=((PLAYER.paused?G.playF:G.pauseF).replace('<svg','<svg width="36" height="36"'));
 const bar=$('#npbar');if(bar)bar.style.width='0';
 const tt=d.querySelectorAll('.tt span');if(tt[0])tt[0].textContent='0:00';if(tt[1])tt[1].textContent='--:--'}
/* 顶部横条下拉关闭详情页 */
function npDragInit(d){const g=d.querySelector('.npgrab');if(!g)return;
 let sy=0,dy=0,drag=false;
 const cy=e=>e.touches?e.touches[0].clientY:e.clientY;
 const down=e=>{drag=true;sy=cy(e);dy=0;d.style.transition='none';if(e.pointerId!==undefined&&d.setPointerCapture)try{d.setPointerCapture(e.pointerId)}catch(_){}};
 const move=e=>{if(!drag)return;e.preventDefault&&e.preventDefault();dy=Math.max(0,cy(e)-sy);
  d.style.transform='translateY('+dy+'px)';d.style.opacity=String(Math.max(.4,1-dy/420))};
 const up=()=>{if(!drag)return;drag=false;d.style.transition='';
  if(dy>90){closeNP()}else{d.animate([{transform:'translateY('+dy+'px)'},{transform:'translateY(0)'}],{duration:220, easing:'cubic-bezier(.32,.72,0,1)'});
   d.style.transform='';d.style.opacity=''}};
 g.addEventListener('pointerdown',down);g.addEventListener('pointermove',move);
 g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
 g.addEventListener('touchstart',down,{passive:true});g.addEventListener('touchmove',move,{passive:false});
 g.addEventListener('touchend',up);g.addEventListener('touchcancel',up)}
function npTick(){const bar=$('#npbar');if(!bar)return;if(!PLAYER.duration)return;bar.style.width=(PLAYER.currentTime/PLAYER.duration*100)+'%';
 const tt=document.querySelectorAll('#np .tt span');if(tt[0])tt[0].textContent=fmtSec(PLAYER.currentTime);if(tt[1])tt[1].textContent=fmtSec(PLAYER.duration)}
function fmtSec(s){s=Math.floor(s||0);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function togglePlay(){if(PLAYER.paused){PLAYER.play()}else{PLAYER.pause()}
 const b=$('#npbtn');if(b)b.innerHTML=((PLAYER.paused?G.playF:G.pauseF).replace('<svg','<svg width="36" height="36"'));
 if(view==='music')show('music')}
function closeNP(){const n=$('#np');if(n){PLAYER.removeEventListener('timeupdate',npTick);n.animate([{opacity:1},{opacity:0}],{duration:220}).onfinish=()=>n.remove()}}

/* --- Instagram --- */
let reelIdx=0;
VIEWS.instagram=()=>({cls:'ig',html:`<div class="ig-h"><b>${IG_NAME}</b>${G.plus}${G.menu}</div>
 <div class="scroll">
  <div class="igp"><div class="pp"><img src="${avatarOf(ME)}" alt=""></div>
   <div class="st"><div><b>${reels.length}</b>${t('posts')}</div><div><b>123.01万</b>${t('followers')}</div><div><b>1</b>${t('following')}</div></div></div>
  <div class="igbio">${IG_BIO}</div>
  <div class="igbtn"><button>编辑个人资料</button><button>分享主页</button></div>
  <div class="igtabs"><span class="on">${G.grid}</span><span>${G.reels}</span><span>${G.tag}</span></div>
  <div class="iggrid">${reels.map((r,i)=>{const po=r.file.replace('reels/','posters/').replace('.mp4','.jpg');
   return `<button onclick="openReel(${i})"><img src="${po}" alt="" loading="lazy">
   <span class="vc" style="left:auto;right:7px;top:6px;bottom:auto">${G.reels}</span></button>`}).join('')}</div>
 </div>
 ${tabbar([['home','首页'],['search','搜索'],['reels','Reels'],['bag','商店'],['person','我的']],0,'')}`,
 init:()=>prefetchReelsIdle()});
/* 打开 INS 主页后空闲时悄悄预取第一条 Reel，点开即可秒播 */
let reelsPrefetched=false;
function prefetchReelsIdle(){
 if(reelsPrefetched)return;reelsPrefetched=true;
 const go=()=>{const r=reels[0];if(r)fetch(cdnU(r.file),{cache:'force-cache'}).catch(()=>{})};
 if('requestIdleCallback' in window)requestIdleCallback(go,{timeout:3000});else setTimeout(go,1200)}
/* 给视频挂上缓冲进度提示：显示「加载中 xx%」，就绪后提示消失 */
function mediaTip(v,tip,readyText){
 let done=false;
 const finish=()=>{if(done)return;done=true;if(readyText){tip.textContent=readyText;setTimeout(()=>{if(tip.isConnected)tip.style.display='none'},1400)}else{tip.style.display='none'}};
 const prog=()=>{
  if(done||!v.buffered||!v.buffered.length||!v.duration)return;
  const p=Math.min(99,Math.round(v.buffered.end(v.buffered.length-1)/v.duration*100));
  tip.textContent='加载中 '+p+'%'};
 const show=()=>{if(!done&&v.readyState<3)prog()};
 if(v.readyState>=3)finish();
 else{
  v.addEventListener('canplay',finish,{once:true});
  v.addEventListener('loadeddata',show,{once:true});
  v.addEventListener('progress',show);
  v.addEventListener('waiting',show);
 }
 return finish}
function openReel(i){reelIdx=i;const r=reels[i];
 const d=document.createElement('div');d.className='pg reel';d.id='reelUI';
 const po=r.file.replace('reels/','posters/').replace('.mp4','.jpg');
 d.innerHTML=`<div class="vwrap"><video id="reelVid" src="${r.file}" poster="${po}" playsinline autoplay loop preload="auto" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${r.vertical?'cover':'contain'};background:#000"></video></div>
  <button class="rvol" id="rvol" onclick="toggleReelVol()">${G.speaker}</button>
  <div class="rtop"><button class="rback" onclick="closeReel()">${G.chevL}</button><span>Reels</span>${G.dotsH}</div>
  <div class="ract"><div><svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/></svg>${r.likes}</div>
   <div>${G.comment}${r.comments}</div><div>${G.share}${r.shares}</div></div>
  <div class="rinfo"><div class="u"><img src="${avatarOf(ME)}" alt="">${IG_NAME}<span>关注</span></div>♫ 原声 · ${IG_NAME}</div>`;
 cdnScan(d);OV.appendChild(d);const rv=d.querySelector('video');rv.muted=false;
 const tip=document.createElement('div');tip.className='rtip';tip.textContent='加载中…';
 tip.style.cssText='position:absolute;bottom:96px;left:0;right:0;text-align:center;color:rgba(255,255,255,.75);font-size:12.5px;z-index:3;pointer-events:none';
 d.appendChild(tip);
 const ok=()=>{tip.textContent='';tip.style.display='none'};
 mediaTip(rv,tip,'');
 rv.play().catch(()=>{rv.muted=true;const b=$('#rvol');if(b)b.innerHTML=G.muteF;rv.play().catch(()=>{})});
 d.animate([{opacity:0},{opacity:1}],{duration:250})}
function toggleReelVol(){const rv=$('#reelVid'),b=$('#rvol');if(!rv)return;rv.muted=!rv.muted;if(b)b.innerHTML=rv.muted?G.muteF:G.speaker}
function closeReel(){const r=$('#reelUI');if(r){r.querySelectorAll('video').forEach(v=>v.pause());r.animate([{opacity:1},{opacity:0}],{duration:220}).onfinish=()=>r.remove()}}

/* --- 地图 --- */
VIEWS.maps=()=>{
 const pins=MAP_PLACES.map(p=>`<div class="mpin" style="left:${p.x/900*100}%;top:${p.y/1200*100}%" onclick="selectPin('${p.id}')" id="pin-${p.id}">
  <span class="pc" style="background:${p.color}">${G[p.glyph]||G.photo}</span><span>${esc(p.name)}</span></div>`).join('');
 return{cls:'mapv',init:pg=>mapInit(pg),html:`<div class="mapwrap"><div class="mapcv" style="background:#f2efe9">
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px);background-size:60px 60px"></div>
   <div style="position:absolute;left:40%;top:0;bottom:0;width:14px;background:#fff;transform:rotate(6deg)"></div>
   <div style="position:absolute;top:38%;left:0;right:0;height:14px;background:#fff"></div>
   <div style="position:absolute;top:62%;left:0;right:0;height:9px;background:#ffe9b8"></div>
   ${pins}
   <div class="me-dot" style="left:${640/900*100}%;top:${520/1200*100}%"></div>
  </div></div>
  <div class="mbtns">${G.info}${G.search}</div>
  <div class="msheet" id="msheet"><div class="grab"></div>
   <div class="mfav">${MAP_PLACES.filter(p=>p.fav).map(p=>`<button onclick="selectPin('${p.id}')"><span class="fc" style="background:${p.color}">${G[p.glyph]||G.photo}</span>${esc(p.name)}<small>${esc(p.sub)}</small></button>`).join('')}</div>
   <div style="margin-top:10px;font-size:15px;font-weight:600">${t('recentsMap')}</div>
   ${MAP_RECENTS.map(r=>`<div style="padding:9px 0;border-bottom:.5px solid var(--sep);font-size:15px"><b>${esc(r[0])}</b><br><small style="color:var(--grey)">${esc(r[1])}</small></div>`).join('')}
  </div>`}};
function mapInit(pg){const cv=pg.querySelector('.mapcv'),wrap=pg.querySelector('.mapwrap');let s=.55,tx=0,ty=0;
 const apply=()=>cv.style.transform=`translate(${tx}px,${ty}px) scale(${s})`;
 const fit=()=>{const w=SCREEN.clientWidth;s=w/900;tx=(w-900*s)/2;ty=0;apply()};fit();
 let pts=new Map(),moved=false;
 wrap.onpointerdown=e=>{wrap.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false};
 wrap.onpointermove=e=>{if(!pts.has(e.pointerId))return;const p0=pts.get(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pts.size===1){tx+=(e.clientX-p0.x)/SC;ty+=(e.clientY-p0.y)/SC;if(Math.abs(e.clientX-p0.x)>4||Math.abs(e.clientY-p0.y)>4)moved=true}
  else if(pts.size===2){const arr=[...pts.values()];const d0=Math.hypot(arr[0].x-p0.x,0)}apply()};
 const up=e=>pts.delete(e.pointerId);wrap.onpointerup=up;wrap.onpointercancel=up;
 wrap.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault()}},true);
 wrap.addEventListener('wheel',e=>{e.preventDefault();const ns=Math.max(.25,Math.min(2.2,s*(e.deltaY<0?1.12:0.89)));
  const r=cv.getBoundingClientRect(),mx=(e.clientX-r.left)/s,my=(e.clientY-r.top)/s;tx-=mx*(ns-s);ty-=my*(ns-s);s=ns;apply()},{passive:false})}
function selectPin(id){const p=MAP_PLACES.find(x=>x.id===id);if(!p)return;
 document.querySelectorAll('.mpin').forEach(e=>e.classList.remove('sel'));const el=$('#pin-'+id);if(el)el.classList.add('sel');
 const sh=$('#msheet');if(sh)sh.innerHTML=`<div class="grab"></div><div class="mdet">
  <h2>${esc(p.name)}</h2><div class="sb">${esc(p.sub)}</div>
  <div class="acts"><button class="pri">路线</button><button>${t('share')}</button><button>${t('favorite')}</button></div>
  <div class="inf">${(p.info||[['信息',t('noInfo')]]).map(([k,v])=>`<div><small>${esc(k)}</small>${esc(v)}</div>`).join('')}</div></div>`}

/* --- 设置 / 屏幕使用时间 --- */
VIEWS.settings=()=>({cls:'grouped',html:`<div class="scroll">
 <div class="group" style="margin-bottom:22px"><div class="row" style="min-height:76px">
  <span style="width:58px;height:58px;border-radius:50%;overflow:hidden;background:#c8c9cc"><img src="${avatarOf(ME)}" style="width:100%;height:100%;object-fit:cover"></span>
  <div style="flex:1"><b style="font-size:20px;font-weight:500">${SETTINGS_NAME}</b><div class="muted" style="font-size:13px">${t('acct')}</div></div>${G.chevR}</div></div>
 <div class="group">
  <div class="row">${G.airplane}${t('airplane')}<span style="margin-left:auto" class="muted">${t('on')}</span></div>
  <div class="row">${G.globe}${t('cellular')}<span style="margin-left:auto">${G.chevR}</span></div>
  <div class="row">${G.globe}个人热点<span style="margin-left:auto" class="muted">关闭</span></div>
  <div class="row">${G.grid}${t('notif')}<span style="margin-left:auto">${G.chevR}</span></div>
  <div class="row">${G.alarm}${t('sound')}<span style="margin-left:auto">${G.chevR}</span></div>
 </div>
 <div class="group" style="margin-top:22px">
  <div class="row">${G.gear}${t('general')}<span style="margin-left:auto">${G.chevR}</span></div>
  <div class="row" onclick="push('screentime')">${G.timer}${t('screenTime')}<span style="margin-left:auto">${G.chevR}</span></div>
  <div class="row">${G.person}${t('privacy')}<span style="margin-left:auto">${G.chevR}</span></div>
  <div class="row">${G.photo}${t('wallpaper')}<span style="margin-left:auto">${G.chevR}</span></div>
  <div class="row">${G.camera}${t('camera')}<span style="margin-left:auto">${G.chevR}</span></div>
 </div>
 <div style="text-align:center;color:var(--grey);font-size:13px;margin-top:18px">${DEVICE_NAME}</div>
 </div>`});
const stMins=a=>{const m=a[1].match(/(\d+)小时(\d+)?/);const m2=a[1].match(/(\d+)分钟/);return (m?(+m[1])*60+(+m[2]||0):0)+(m2?+m2[1]:0)};
const stFmt=v=>v>=60?(Math.floor(v/60)+'小时'+(v%60?(v%60)+'分钟':'')):(v+'分钟');
VIEWS.screentime=()=>{const st=SCREEN_TIME;
 const mins=stMins;const mx=Math.max(...st.apps.map(mins));
 const wk=st.week;const wmax=Math.max(...wk.map(w=>w[1]));
 const avg=Math.round(wk.reduce((a,b)=>a+b[1],0)/wk.length);
 /* 分类堆叠条 */
 const catSum=st.cats.reduce((a,c)=>a+c[1],0);
 const tots=st.apps.reduce((a,x)=>a+mins(x),0);
 return{cls:'grouped st-pg',html:navHTML({title:t('screenTime'),back:'设置'})+`<div class="scroll">
  <div class="st-hero">
   <div class="st-hero-l"><div class="st-k">${t('today')}</div><div class="st-big">${st.total}</div></div>
   <div class="st-hero-r"><div class="st-k">${t('dailyAvg')}</div><div class="st-sm">${stFmt(avg)}</div>
    <div class="st-up">↑ ${t('upPct',st.up)}</div></div>
  </div>

  <div class="st-card">
   <div class="st-card-h">每周使用情况</div>
   <div class="st-week">
    <div class="st-avgline" style="bottom:${(avg/wmax*100)}%"><i></i><span>日均 ${Math.floor(avg/60)}小时</span></div>
    ${wk.map(([d,v],i)=>`<div class="st-col ${i===wk.length-1?'today':''}">
      <div class="st-bwrap"><i style="height:${Math.max(4,v/wmax*100)}%"></i></div>
      <span class="st-day">${d}</span></div>`).join('')}
   </div>
  </div>

  <div class="st-card">
   <div class="st-card-h">按类别</div>
   <div class="st-stack">${st.cats.map(([n,v,c])=>`<i style="width:${v/catSum*100}%;background:${c}"></i>`).join('')}</div>
   <div class="st-legend">${st.cats.map(([n,v,c])=>`<span><i style="background:${c}"></i>${n} ${stFmt(v)}</span>`).join('')}</div>
  </div>

  <div class="gh">${t('mostUsed')}</div>
  <div class="group">${st.apps.map(a=>{const v=mins(a);const pct=tots?v/tots*100:0;
   return `<div class="row st-app">
    <span class="st-ic" style="background:${a[2]}">${a[3]}</span>
    <div class="st-app-b"><div class="st-app-t"><b>${esc(a[0])}</b><span>${esc(a[1])}</span></div>
     <div class="st-track"><i style="width:${Math.max(4,v/mx*100)}%;background:${a[2]}"></i></div></div>
    <em class="st-pct">${Math.round(pct)}%</em></div>`}).join('')}</div>

  <div class="gh">${t('pickups')}</div>
  <div class="group"><div class="row"><b style="font-weight:500">${t('firstPickup')}</b><span style="margin-left:auto" class="muted">${st.firstPickup}</span></div>
   <div class="row"><b style="font-weight:500">${t('avgPickups')}</b><span style="margin-left:auto" class="muted">${st.pickups}</span></div></div>
  <div class="st-foot">屏幕使用时间按设备统计，数据每日 00:00 更新。</div>
 </div>`}};

/* --- 俄罗斯方块 --- */
let tetAlive=false,tetTimer=null,tetScore=0,tetLines=0,tetLevel=1;
const COLS=10,ROWS=20,CELL=19;
const SHAPES={I:[[0,1],[1,1],[2,1],[3,1]],O:[[0,0],[1,0],[0,1],[1,1]],T:[[1,0],[0,1],[1,1],[2,1]],
 S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
const COLORS={I:'#31c7ef',O:'#ffd60a',T:'#bf5af2',S:'#30d158',Z:'#ff453a',J:'#0a84ff',L:'#ff9f0a'};
let board=[],cur=null,nextQueue=[],tetPaused=false,tetClearing=null,tetBag=[];
function tetBagNext(){if(!tetBag.length)tetBag=Object.keys(SHAPES).sort(()=>Math.random()-.5);return tetBag.pop()}
function tetInit(){
 tetAlive=true;tetScore=0;tetLines=0;tetLevel=1;board=Array.from({length:ROWS},()=>Array(COLS).fill(''));
 tetBag=[];nextQueue=[tetBagNext(),tetBagNext()];tetClearing=null;tetSpawn();tetPaused=false;
 if(tetTimer)clearInterval(tetTimer);tetTimer=setInterval(tetTick,Math.max(150,700-(tetLevel-1)*65));
 const pb=$('#tetPause');if(pb)pb.innerHTML='暂停';
 tetDraw()}
function tetSpawn(){
 const k=nextQueue.shift();nextQueue.push(tetBagNext());
 cur={k,cells:SHAPES[k].map(([x,y])=>[x+3,y]),color:COLORS[k]};
 if(cur.cells.some(([x,y])=>board[y]&&board[y][x])){tetGameOver()}}
function tetCollision(cells){return cells.some(([x,y])=>x<0||x>=COLS||y>=ROWS||(y>=0&&board[y][x]))}
function tetGhost(){let g=cur.cells.map(c=>[...c]);while(!tetCollision(g.map(([x,y])=>[x,y+1])))g=g.map(([x,y])=>[x,y+1]);return g}
function tetMerge(){
 if(tetClearing)return;
 cur.cells.forEach(([x,y])=>{if(y>=0)board[y][x]=cur.color});
 const full=[];for(let y=0;y<ROWS;y++)if(board[y].every(c=>c))full.push(y);
 if(full.length){tetClearing={rows:full,t:0};
  setTimeout(()=>{full.forEach(y=>{board.splice(y,1);board.unshift(Array(COLS).fill(''))});
   const cleared=full.length;tetLines+=cleared;tetScore+=[0,100,300,500,800][cleared]*tetLevel;
   tetLevel=1+Math.floor(tetLines/10);
   if(tetScore>tetBest){tetBest=tetScore;saveState()}
   if(tetTimer){clearInterval(tetTimer);tetTimer=setInterval(tetTick,Math.max(150,700-(tetLevel-1)*65))}
   tetClearing=null;tetHUD();tetSpawn();tetDraw()},160);tetDraw();return}
 tetSpawn()}
function tetTick(){if(!tetAlive||tetPaused||tetClearing)return;
 const moved=cur.cells.map(([x,y])=>[x,y+1]);
 if(tetCollision(moved)){tetMerge()}else{cur.cells=moved}
 tetDraw()}
function tetMove(d){if(!tetAlive||tetPaused||tetClearing)return;const moved=cur.cells.map(([x,y])=>[x+d,y]);
 if(!tetCollision(moved)){cur.cells=moved;tetDraw()}}
function tetRotate(){if(!tetAlive||tetPaused||tetClearing)return;
 if(cur.k==='O')return;
 const xs=cur.cells.map(c=>c[0]),ys=cur.cells.map(c=>c[1]);
 const minX=Math.min(...xs),minY=Math.min(...ys);
 const rot=cur.cells.map(([x,y])=>[minX+(minY-y)+(cur.k==='I'?3:2),minY+x-minX]);
 if(!tetCollision(rot)){cur.cells=rot;tetDraw()}}
function tetDrop(){if(!tetAlive||tetPaused||tetClearing)return;
 while(true){const moved=cur.cells.map(([x,y])=>[x,y+1]);if(tetCollision(moved))break;cur.cells=moved;tetScore+=2}
 tetHUD();tetMerge();tetDraw()}
function tetSoft(){if(!tetAlive||tetPaused||tetClearing)return;
 const moved=cur.cells.map(([x,y])=>[x,y+1]);
 if(!tetCollision(moved)){cur.cells=moved;tetScore+=1;tetHUD()}else tetMerge();tetDraw()}
function tetPauseToggle(){if(!tetAlive)return;tetPaused=!tetPaused;
 const pb=$('#tetPause');if(pb)pb.innerHTML=tetPaused?'继续':'暂停';
 const m=$('#tetMsg');if(m)m.textContent=tetPaused?'已暂停':'◀ 左移 · ⟳ 旋转 · ▼ 加速 · ⤓ 直落 · ▶ 右移'}
function tetHUD(){const s=$('#tetScore'),l=$('#tetLines'),v=$('#tetLevel'),b2=$('#tetBest');if(s)s.textContent=tetScore;if(l)l.textContent=tetLines;if(v)v.textContent=tetLevel;if(b2)b2.textContent=tetBest}
function tetRoundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function tetCellDraw(ctx,cx,cy,color,cell,ghost){
 const pad=1,x=cx*cell+pad,y=cy*cell+pad,s=cell-pad*2;
 if(ghost){ctx.strokeStyle=color;ctx.globalAlpha=.35;ctx.lineWidth=1.6;tetRoundRect(ctx,x+1,y+1,s-2,s-2,4);ctx.stroke();ctx.globalAlpha=1;return}
 const grd=ctx.createLinearGradient(x,y,x,y+s);grd.addColorStop(0,color);grd.addColorStop(1,shade(color,-28));
 ctx.fillStyle=grd;tetRoundRect(ctx,x,y,s,s,4);ctx.fill();
 ctx.fillStyle='rgba(255,255,255,.32)';tetRoundRect(ctx,x+2.5,y+2,s-5,s*.28,3);ctx.fill();
 ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1;tetRoundRect(ctx,x+.5,y+.5,s-1,s-1,4);ctx.stroke()}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
 r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));
 return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0')}
function tetDraw(){
 const cv=$('#tetCanvas'),nx=$('#tetNext');if(!cv)return;
 const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
 const bg=ctx.createLinearGradient(0,0,cv.width,cv.height);bg.addColorStop(0,'#1b1b26');bg.addColorStop(1,'#111118');
 ctx.fillStyle=bg;ctx.fillRect(0,0,cv.width,cv.height);
 ctx.strokeStyle='rgba(255,255,255,.045)';ctx.lineWidth=1;
 for(let x=1;x<COLS;x++){ctx.beginPath();ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,cv.height);ctx.stroke()}
 for(let y=1;y<ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CELL);ctx.lineTo(cv.width,y*CELL);ctx.stroke()}
 board.forEach((row,y)=>row.forEach((c,x)=>{if(c){const flashing=tetClearing&&tetClearing.rows.includes(y);
  if(flashing){ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2)}else tetCellDraw(ctx,x,y,c,CELL)}}));
 if(cur&&!tetClearing){tetGhost().forEach(([x,y])=>{if(y>=0)tetCellDraw(ctx,x,y,cur.color,CELL,true)});
  cur.cells.forEach(([x,y])=>{if(y>=0)tetCellDraw(ctx,x,y,cur.color,CELL)})}
 if(nx){const c2=nx.getContext('2d');c2.clearRect(0,0,nx.width,nx.height);
  const bg2=c2.createLinearGradient(0,0,nx.width,nx.height);bg2.addColorStop(0,'#1b1b26');bg2.addColorStop(1,'#111118');
  c2.fillStyle=bg2;c2.fillRect(0,0,nx.width,nx.height);
  const k=nextQueue[0];const xs=SHAPES[k].map(c=>c[0]),ys=SHAPES[k].map(c=>c[1]);
  const w=(Math.max(...xs)-Math.min(...xs)+1)*15,h=(Math.max(...ys)-Math.min(...ys)+1)*15;
  const ox=(nx.width-w)/2-Math.min(...xs)*15,oy=(nx.height-h)/2-Math.min(...ys)*15;
  SHAPES[k].forEach(([x,y])=>{const px=ox+x*15,py=oy+y*15;
   const grd=c2.createLinearGradient(px,py,px,py+14);grd.addColorStop(0,COLORS[k]);grd.addColorStop(1,shade(COLORS[k],-28));
   c2.fillStyle=grd;tetRoundRect(c2,px,py,14,14,3);c2.fill();
   c2.fillStyle='rgba(255,255,255,.3)';tetRoundRect(c2,px+2,py+1.5,10,4,2);c2.fill()})}
 tetHUD()}
function tetGameOver(){tetAlive=false;if(tetTimer){clearInterval(tetTimer);tetTimer=null}
 const o=$('#tetOver');if(o){o.style.display='flex';const sc=$('#tetFinal');if(sc)sc.textContent=tetScore;const b=$('#tetBest');if(b)b.textContent=tetBest}}
VIEWS.tetris=()=>({cls:'tet',dark:true,html:`<div style="position:relative;width:100%">
  <div class="tet-title">俄罗斯方块<button id="tetPause" onclick="tetPauseToggle()">暂停</button></div>
  <div class="board">
   <div class="cv-wrap"><canvas id="tetCanvas" width="${COLS*CELL}" height="${ROWS*CELL}"></canvas>
    <div class="over" id="tetOver" style="display:none"><b>游戏结束</b>
     <div style="font-size:13.5px;opacity:.8">得分 <span id="tetFinal">${tetScore}</span></div>
     <button onclick="tetInit();document.getElementById('tetOver').style.display='none'">${t('tetrisRestart')}</button></div>
   </div>
   <div class="side">
    <div class="box">下一个<canvas id="tetNext" width="72" height="68"></canvas></div>
    <div class="box">得分<b id="tetScore">${tetScore}</b></div>
    <div class="box">等级<b id="tetLevel">${tetLevel}</b></div>
    <div class="box">消行<b id="tetLines">${tetLines}</b></div>
    <div class="box">最高<b id="tetBest">${tetBest}</b></div>
   </div>
  </div>
  <div class="btns"><button onpointerdown="tetMove(-1)">◀</button><button onpointerdown="tetRotate()">⟳</button><button onpointerdown="tetSoft()">▼</button><button onpointerdown="tetDrop()">⤓</button><button onpointerdown="tetMove(1)">▶</button></div>
  <div class="msg" id="tetMsg">◀ 左移 · ⟳ 旋转 · ▼ 加速 · ⤓ 直落 · ▶ 右移</div>
  </div>`,
 init:()=>{if(!tetAlive)tetInit();else tetDraw()}});

/* ============================ 启动 ============================ */
function boot(){
 const _bt=document.getElementById('bootTip');if(_bt)_bt.remove();
 setBg($('#wall'),'assets/wallpaper/lock.jpg');
 const st=loadState();
 if(st){
  try{todayChat=st.todayChat||[];replyStage=st.replyStage||0;mainUnread=st.mainUnread??0;unread=st.unread||unread;
   callStage=st.callStage||0;declined=st.declined||0;extraCalls=st.extraCalls||[];readMail=new Set(st.readMail||[]);
   tetBest=st.tetBest||0;homePage=st.homePage||0;chatId=st.chatId||MAIN;
   noteId=st.noteId||0;mailId=st.mailId||0;reelIdx=st.reelIdx||0;
   nowSong=(typeof st.nowSong==='number'&&st.nowSong<songs.length)?st.nowSong:-1;
   momentLikes=st.momentLikes||{};
   alarmOn=st.alarmOn!==undefined?st.alarmOn:(ALARM.on!==false)}catch(e){}
  if(st.unlocked){
   view='home';sfx('unlock');
   LOCK.style.visibility='hidden';$('#pinL').style.display='none';
   setBg($('#wall'),'assets/wallpaper/home.jpg');
   renderHome();HOME.style.visibility='visible';setStatus(true);
   if(nowSong>=0&&songs[nowSong])try{PLAYER.src=cdnU(songs[nowSong].src)}catch(e){}
   if(st.lastApp&&VIEWS[st.lastApp])setTimeout(()=>{
    APP.innerHTML='';lastAppId=st.lastApp;show(st.lastApp,'none');APP.style.visibility='visible';HOME.style.visibility='hidden';
    const cv=st.curView;
    if(cv&&cv!==st.lastApp&&VIEWS[cv]&&cv!=='reel')setTimeout(()=>{view=st.lastApp;show(cv,'none')},80);
   },400);
   return}}
 renderLock();view='lock';
 setInterval(()=>{const el=$('#lkt');if(el&&view==='lock')el.textContent=clock12()},1000);
 setInterval(()=>{const el=$('#sbt');if(el)el.textContent=clock12()},1000)}
boot();

/* --- iOS 弹性滚动（边界回弹） --- */
(function(){
 let el=null,startY=0,off=0,raf=0;
 const MAX=70,DAMP=.4;
 function back(){cancelAnimationFrame(raf);(function step(){off*=.86;if(Math.abs(off)<.5){el.style.transform='';el=null;return}el.style.transform=`translateY(${off}px)`;raf=requestAnimationFrame(step)})()}
 function bound(s){return{top:s.scrollTop<=0,end:s.scrollTop+s.clientHeight>=s.scrollHeight-2}}
 addEventListener('touchstart',e=>{const s=e.target.closest&&e.target.closest('.scroll');if(!s)return;el=s;startY=e.touches[0].clientY;off=0;cancelAnimationFrame(raf)},{passive:true});
 addEventListener('touchmove',e=>{if(!el||!(e.target.closest&&e.target.closest('.scroll')===el))return;const b=bound(el);const dy=e.touches[0].clientY-startY;
  if(dy>0&&b.top)off=Math.min(dy*DAMP,MAX);else if(dy<0&&b.end)off=Math.max(dy*DAMP,-MAX);else{off=0;el.style.transform='';return}
  el.style.transform=`translateY(${off}px)`},{passive:true});
 addEventListener('touchend',()=>{if(!el)return;back()},{passive:true});
 addEventListener('wheel',e=>{const s=e.target.closest&&e.target.closest('.scroll');if(!s)return;const b=bound(s);
  if((e.deltaY<0&&b.top)||(e.deltaY>0&&b.end)){off=Math.max(-MAX,Math.min(MAX,(off||0)-e.deltaY*DAMP));s.style.transform=`translateY(${off}px)`;cancelAnimationFrame(raf);el=s;clearTimeout(s._wt);s._wt=setTimeout(()=>{back()},120)}},{passive:true});
})();
