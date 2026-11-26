// Loaded first so the page is translated before anything renders.
import { currentLang, setLang } from './i18n.js';
import { createOfficeScene } from './scene.js';
import { personalities, summarizeBrief } from './life.js';
import { mountWorkspaceTools } from './workspace-tools.js';
import { mountSettingsPage } from './settings-page.js';
import { mountSubscriptionUsage } from './subscription-usage.js';
import { mountFolderPicker } from './folder-picker.js';
import { mountAccessMode } from './access-mode.js';
import { moodFace, mountOfficeShop } from './office-shop.js';
import { emotions } from './economy.js';
const {
  attachmentFileBytes, attachmentImageBytes, attachmentLimit, attachmentTotalBytes, attachmentType, attachmentTypes = {}
} = await import('./attachment-types.js').catch(() => ({}));

const $ = id => document.getElementById(id);
const icons = {
  floor: '<path d="m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5"/>',
  history: '<path d="M4 7a8.5 8.5 0 1 1-1 8 M4 3v5h5 M12 7v6l3 2"/>',
  plus: '<path d="M5 12h14 M12 5v14"/>',
  chat: '<path d="M4 4h16v12H9l-5 4z M8 8h8 M8 12h5"/>',
  compose: '<path d="M13 4H5v15h15v-8 M11 13l1-4 7-7 3 3-7 7z"/>',
  back: '<path d="M19 12H5m7-7-7 7 7 7"/>',
  chev: '<path d="m7 10 5 5 5-5"/>', send: '<path d="m3 11 17-8-5 18-4-7z M11 14l9-11"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a6 6 0 0 1 12 0v3 M16 5a3 3 0 0 1 0 6 M18 14a5 5 0 0 1 3 5"/>',
  pointer: '<path d="m4 3 5 16 3-6 6-3z"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6 M12 7h.1"/>',
  login: '<path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M4 12h11m-4-4 4 4-4 4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  file: '<path d="M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6"/>',
  refresh: '<path d="M20 10a8 8 0 1 0-2 8m2-13v5h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5 19 19 M5 19l1.5-1.5 M17.5 6.5 19 5"/>',
  moon: '<path d="M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  shop: '<path d="M4 9h16l-1.5 11h-13z M8 9V7a4 4 0 0 1 8 0v2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.3 3 7.9 7 9.5 4-1.6 7-5.2 7-9.5V6z M12 8v5 M12 16.2h.01"/>'
};
const iconMarkup = name => '<svg viewBox="0 0 24 24">' + icons[name] + '</svg>';
for (const icon of document.querySelectorAll('[data-icon]')) {
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconMarkup(icon.dataset.icon);
}
function el(tag, className, value) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (value != null) item.textContent = value;
  return item;
}
const subscriptionUsage = mountSubscriptionUsage(el);
function pixelArt(canvas, rows, palette) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  rows.forEach((row,y) => [...row].forEach((p,x) => {
    if (palette[p]) { ctx.fillStyle = palette[p]; ctx.fillRect(x,y,1,1); }
  }));
}
pixelArt($('brand-goose'), [
  '................','.......KKKK.....','......KWWWKK....','......KWWWKWK...','......KWWKYYK...','......KWWKYY....','......KWWK......','...KKKKWWK......','..KWWWWWWK......','.KWWWWWWWWK.....','..KWWWSSWWK.....','...KSSWWWK......','....KKKKK.......','.....Y.Y........','....YY.YY.......'
], {K:'#354433',W:'#fff7da',S:'#c5c6a7',Y:'#d69246'});
const statusNames = {idle:'待命',unknown:'未連線',unavailable:'待登入',queued:'排隊中',planning:'規劃中',working:'處理中',delegated:'已分派',reviewing:'審閱中',done:'已完成',failed:'失敗'};
const active = new Set(['planning','working','delegated','reviewing']);
const identities = [
  {id:'claude',manager:'claude',name:'Claude',role:'主管',kind:'manager'},
  {id:'claude-research',manager:'claude',name:'Mira',role:'研究員',kind:'worker'},
  {id:'claude-review',manager:'claude',name:'Theo',role:'審閱員',kind:'worker'},
  {id:'codex',manager:'codex',name:'Codex',role:'主管',kind:'manager'},
  {id:'codex-build',manager:'codex',name:'Finn',role:'工程師',kind:'worker'},
  {id:'codex-test',manager:'codex',name:'Nova',role:'測試員',kind:'worker'}
];
const state = {tasks:[],messages:[],employees:[],activities:[],drafts:[],slackThreads:[],backend:{ready:false},modelCatalog:null,onboarding:null};
let transport = 'loading', received = false, view = 'floor', source = 'office', choice = 'both', targetTouched = false;
let selected = '', threadId = '', slackId = '', sending = false, scene, previousChat = '', previousTeams = '', previousList = '', previousScene = '';
let lastSequence = 0, issuedSequence = 0;
let stateTag = '';
const chatBox = $('chat-body'), field = $('message'), newChatMarkup = chatBox.innerHTML;
const titleFor = key => ({claude:'Claude',codex:'Codex',both:'兩位主管'}[key] || key);
const targetsFor = target => target==='both' ? ['claude','codex'] : [target];
const teamReady = id => state.backend.managers?.[id] ?? state.backend.ready;
const targetReady = target => state.backend.ready===true && targetsFor(target).every(teamReady);
const defaultTarget = () => targetReady('both')?'both':['claude','codex'].find(targetReady)||'both';
const workers = () => state.employees.length ? state.employees.map(person =>
  person.status==='idle' && !teamReady(person.manager) ? {...person,status:'unavailable'} : person
) : identities.map(e=>({...e,status:'unknown'}));
const readable = value => statusNames[value] || value || '待命';
function when(value, date = false) {
  const stamp = new Date(value);
  return Number.isNaN(+stamp) ? '' : stamp.toLocaleString('zh-TW',date ? {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false} : {hour:'2-digit',minute:'2-digit',hour12:false});
}
function getStore(key) { try {return JSON.parse(localStorage.getItem('goose-office:' + key));} catch{return null;} }
function putStore(key, value) { try {if(value == null) localStorage.removeItem('goose-office:'+key); else localStorage.setItem('goose-office:'+key,JSON.stringify(value));} catch { /* Storage can be disabled. */ } }
// The 辦公室日常 switch is the one control for office animation. With no choice saved yet it follows the system's
// reduced-motion setting; once someone flips it, their choice wins over the system.
let lifeEnabled = typeof getStore('office-life') === 'boolean' ? getStore('office-life') : !matchMedia('(prefers-reduced-motion: reduce)').matches;
let lifeFrame = null;
// Day / night in the office: follows the local clock (auto), or stays day or night.
let daylight = ['auto', 'day', 'night'].includes(getStore('daylight')) ? getStore('daylight') : 'auto';
const savedModels = {...getStore('models')};
const effortLabels = {none:'Off',low:'Low',medium:'Medium',high:'High',xhigh:'XHigh',max:'Max'};
let previousModelMenu = '';
const themeToggle = $('theme-toggle');
const themeIcon = themeToggle.querySelector('[data-icon]');
const themeColor = document.querySelector('meta[name="theme-color"]');
function setTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle.setAttribute('aria-pressed', String(light));
  themeToggle.title = light ? '切換至深色模式' : '切換至亮色模式';
  themeIcon.dataset.icon = light ? 'moon' : 'sun';
  themeIcon.innerHTML = iconMarkup(themeIcon.dataset.icon);
  themeColor.content = light ? '#f8fbf7' : '#11191e';
}
setTheme(getStore('theme'));
const langToggle = $('lang-toggle');
function renderLang() {
  const lang = currentLang();
  for (const option of langToggle.children) option.classList.toggle('on', option.dataset.lang === lang);
  langToggle.title = lang === 'en' ? '切換為中文介面' : '切換為英文介面';
}
langToggle.addEventListener('click', () => { setLang(currentLang() === 'en' ? 'zh' : 'en'); renderLang(); });
renderLang();
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  setTheme(theme);
  putStore('theme', theme);
});
const draftKey = () => 'draft:' + (threadId || 'new');
const attachmentDrafts = new Map();
const draftAttachments = () => attachmentDrafts.get(draftKey()) || [];
const attachmentInput = $('attachment-input');
attachmentInput.accept=Object.keys(attachmentTypes).map(ext=>'.'+ext).join(',');
let previousAttachmentList = '';
let pastedImages = 0;

function clearDraftAttachments(key) {
  for (const entry of attachmentDrafts.get(key) || []) if (entry.preview) URL.revokeObjectURL(entry.preview);
  attachmentDrafts.delete(key);
}

function addAttachments(files, pasted = false) {
  if (sending || slackId || !attachmentType) return;
  const draft=draftAttachments().slice();
  let total=draft.reduce((sum,entry)=>sum+entry.file.size,0);
  const rejected=new Set();
  for (const file of files) {
    const screenshotType=Object.keys(attachmentTypes).find(ext=>attachmentTypes[ext]===file.type && file.type.startsWith('image/'));
    const name=pasted&&screenshotType ? `截圖-${++pastedImages}.${screenshotType}` : file.name.trim();
    const mime=attachmentType(name);
    if (!mime || name.length>180 || /[\x00-\x1f\x7f\\/:*?"<>|]/.test(name)) {
      rejected.add('支援 PNG、JPEG、WebP、PDF、TXT、Markdown、CSV 和 JSON。');
      continue;
    }
    if (!file.size || file.size>attachmentFileBytes) { rejected.add('請選擇 10 MB 以下的非空白檔案。'); continue; }
    if (mime.startsWith('image/')&&file.size>attachmentImageBytes) { rejected.add('單張圖片最多 7 MB。'); continue; }
    if (draft.length>=attachmentLimit) { rejected.add('一次最多附加 5 個檔案。'); break; }
    if (total+file.size>attachmentTotalBytes) { rejected.add('附件總大小最多 20 MB。'); continue; }
    draft.push({ id:crypto.randomUUID(), name, file, mime, preview:mime.startsWith('image/')?URL.createObjectURL(file):'' });
    total+=file.size;
  }
  if (draft.length) attachmentDrafts.set(draftKey(),draft);
  note([...rejected].join(' '));
  renderControls();
}

function renderDraftAttachments() {
  const entries=draftAttachments();
  const key=JSON.stringify([sending,entries.map(entry=>entry.id)]);
  if (key===previousAttachmentList) return;
  previousAttachmentList=key;
  const container=$('composer-attachments');
  container.hidden=!entries.length;
  container.replaceChildren(...entries.map(entry=>{
    const card=el('div','attachment-item'+(entry.preview?' attachment-image':''));
    const remove=el('button','attachment-remove');
    remove.type='button';
    remove.disabled=sending;
    remove.setAttribute('aria-label','移除 '+entry.name);
    remove.innerHTML=iconMarkup('close');
    remove.onclick=()=>{
      if (entry.preview) URL.revokeObjectURL(entry.preview);
      const rest=draftAttachments().filter(file=>file.id!==entry.id);
      if (rest.length) attachmentDrafts.set(draftKey(),rest);
      else attachmentDrafts.delete(draftKey());
      note('');
      renderControls();
      $('attach').focus();
    };
    if (entry.preview) {
      const image=el('img');
      image.src=entry.preview; image.alt=entry.name;
      card.append(image);
    } else {
      const icon=el('span','attachment-file-icon');
      icon.innerHTML=iconMarkup('file'); icon.setAttribute('aria-hidden','true');
      card.append(icon);
    }
    const filename=el('span','attachment-name',entry.name);
    filename.title=entry.name;
    card.append(filename,remove);
    return card;
  }));
}

function encodeAttachment(entry) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve({ name:entry.name,data:reader.result.split(',')[1] });
    reader.onerror=()=>reject(new Error('無法讀取「'+entry.name+'」。請移除後重新附加。'));
    reader.readAsDataURL(entry.file);
  });
}

function saveDraft() {
  if(!slackId) {
    const options=workspaceTools.draft();
    putStore(draftKey(),field.value||options.workflow.length||options.references.length ? {text:field.value,choice} : null);
  }
}
function restoreDraft() {
  const stored = getStore(draftKey());
  field.value = typeof stored?.text === 'string' ? stored.text : '';
  if (['claude','codex','both'].includes(stored?.choice)) choice = stored.choice;
}
function teamOf(id) {return id === 'codex' || id?.startsWith('codex-') ? 'codex' : 'claude';}
function avatar(id) {
  const team = teamOf(id), span = el('span','avatar ' + team);
  span.setAttribute('aria-hidden','true');
  const canvas = document.createElement('canvas'); canvas.width=14;canvas.height=14;
  const palette = {h:team==='claude'?'#a85e43':'#273b4c',H:team==='claude'?'#d68a58':'#536c77',s:'#efbc95',S:'#d39979',e:'#354049',j:team==='claude'?'#c37c56':'#668db7',J:team==='claude'?'#e6a875':'#9bbbd3',w:'#f5e4ca',g:'#283b49'};
  if(id==='user'){palette.h='#5d5344';palette.j='#8baf77';palette.J='#c5d798';}
  const rows = team==='codex' && id!=='user' ? [
    '..............','....hhhhh.....','...hHHHHhh....','..hHHhhHHhh...','..hhhhssshh...','..hsssssssh...','..sgeeggees...','..sgeeSSges...','...sssssss....','....sSSss.....','...jjssjjj....','..jjJwwJjjj...','.jjjjJJjjjjj..','.jjjjjjjjjjj..'
  ]:[
    '..............','.....HHhh.....','...hHHhHHh....','..hhHhHhhHh...','..hHhsshhHh...','..hhssssssh...','..ssessesss...','..sssSSsss....','...sssssss....','....sSSss.....','...jjssjjj....','..jjJwwJjjj...','.jjjjJJjjjjj..','.jjjjjjjjjjj..'
  ];
  pixelArt(canvas,rows,palette); span.append(canvas); return span;
}
function statusNode(value) {
  return el('span','status '+(active.has(value)?'busy':value==='failed'?'problem':''),readable(value));
}
function routineLabel(frame) {
  if (frame.phase==='back') return '回座位';
  if (frame.kind==='recap') return '聊聊剛結束的交辦';
  if (frame.kind==='social') return frame.phase==='out'?'走向休息角':'在休息角聊天';
  return frame.phase==='out'?'起身走動':frame.action;
}
function renderPersonality(staff = workers()) {
  const person=staff.find(member=>member.id===selected);
  const personality=person&&personalities[person.id];
  $('member-profile').hidden=!personality;
  if(!personality)return;
  $('profile-name').textContent=person.name;
  $('profile-trait').textContent=personality.trait;
  $('profile-bio').textContent=personality.bio;
  const isParticipant=lifeFrame?.actors.includes(person.id);
  $('profile-routine').textContent=isParticipant?'日常 · '+routineLabel(lifeFrame):
    '常做的事 · '+personality.habits.map(habit=>habit.action).join('、');
  renderProfileEconomy(person.id);
}
let previousProfileEconomy='';
function renderProfileEconomy(id) {
  const economy=shop?.economy;
  const key=JSON.stringify([id,economy?.agents[id],economy?.inventory]);
  if(key===previousProfileEconomy)return;
  previousProfileEconomy=key;
  $('profile-economy').replaceChildren(...(economy?[shop.moodMeters(id),shop.giftButtons(id)]:[]));
}
let reaction=null;
function showReaction(lead,text,point) {
  clearTimeout(reaction?.timer);
  const bubble=$('office-dialogue');
  const actor=workers().find(person=>person.id===lead);
  bubble.hidden=false;
  bubble.dataset.team=actor?.manager||'claude';
  $('dialogue-speaker').textContent=actor?.name||'';
  $('dialogue-text').textContent=text;
  $('dialogue-thread').hidden=true;
  const speech=point&&{...point,actor:lead};
  positionOfficeDialogue(speech);
  reaction={speech,timer:setTimeout(()=>{reaction=null;renderOfficeLife(lifeFrame);},3600)};
}
// Keeps the speech bubble over its speaker while the map is dragged or zoomed.
function followSpeech() {
  const speech=reaction?.speech||lifeFrame?.speech;
  const anchor=speech?.actor&&scene?.anchorOf?.(speech.actor);
  if(anchor){Object.assign(speech,anchor);positionOfficeDialogue(speech);}
}
function positionOfficeDialogue(speech) {
  if(!speech)return;
  const bubble=$('office-dialogue');
  const room=bubble.parentElement;
  const width=room.clientWidth, height=room.clientHeight;
  if(!width||!height)return;
  const x=width*speech.x, y=height*speech.y;
  const headY=speech.top!=null?height*speech.top:y-.13*height;
  const left=Math.max(6,Math.min(width-bubble.offsetWidth-6,x-bubble.offsetWidth/2));
  const above=headY-bubble.offsetHeight-7;
  const below=above<6;
  const top=Math.max(6,Math.min(height-bubble.offsetHeight-6,below?y+7:above));
  bubble.dataset.edge=below?'below':'above';
  bubble.style.left=left+'px';
  bubble.style.top=top+'px';
  bubble.style.setProperty('--tail-x',Math.max(10,Math.min(bubble.offsetWidth-12,x-left))+'px');
}
function renderOfficeLife(frame) {
  lifeFrame=frame;
  if(reaction){renderPersonality();return;}
  const bubble=$('office-dialogue');
  const speech=frame?.speech;
  bubble.hidden=!speech;
  if(speech){
    const actor=workers().find(person=>person.id===speech.actor);
    bubble.dataset.team=actor?.manager||'claude';
    $('dialogue-speaker').textContent=actor?.name||'';
    $('dialogue-text').textContent=speech.text;
    const recap=$('dialogue-thread');
    recap.hidden=!speech.threadId;
    recap.onclick=speech.threadId?()=>openThread(speech.threadId):null;
    positionOfficeDialogue(speech);
  }
  renderPersonality();
}
function renderLifeToggle() {
  const button=$('office-life-toggle');
  button.setAttribute('aria-pressed',String(lifeEnabled));
  button.title=lifeEnabled?'暫停辦公室動畫（人物會停在座位上）':'播放辦公室動畫（包含走動、小動作與遊樂設施）';
}
function moodNode(status) {
  const emotion=status&&emotions[status.emotion];
  const node=el('span','mood-face'+(emotion?' '+emotion.tone:''));
  if(emotion){node.append(moodFace(status.emotion),el('span','mood-label',emotion.label));}
  if(emotion){node.title=emotion.label+' · 心情 '+Math.round(status.mood)+' · 精力 '+Math.round(status.energy);node.setAttribute('aria-label',node.title);node.setAttribute('role','img');}
  else node.hidden=true;
  return node;
}
function renderTeams() {
  const staff = workers(), moodOf=id=>shop?.economy?.agents[id], sig=JSON.stringify([staff,selected,staff.map(person=>moodOf(person.id)?.emotion)]);
  if(sig!==previousTeams){
    previousTeams=sig;
    const cards = ['claude','codex'].map(id=>{
      const manager=staff.find(person=>person.id===id);
      const card=el('article','team-card '+id);
      if(!manager)return card;
      const lead=el('button','manager'+(selected===id?' chosen':''));lead.dataset.employee=id;
      lead.setAttribute('aria-pressed',String(selected===id));
      const name=el('span','manager-name');name.append(el('strong','',manager.name),el('em','','主管'));
      lead.title=personalities[id].trait;
      lead.append(avatar(id),name,moodNode(moodOf(id)),statusNode(manager.status));card.append(lead);
      const list=el('div','worker-list');
      staff.filter(p=>p.manager===id && p.id!==id).forEach(person=>{
        const b=el('button','worker'+(selected===person.id?' chosen':''));
        b.dataset.employee=person.id;b.title=[person.name,person.role,personalities[person.id]?.trait,readable(person.status)].filter(Boolean).join(' · ');
        b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(selected===person.id));
        b.append(el('i','worker-dot'+(active.has(person.status)?' busy':'')),el('span','',person.name),el('span','worker-role',person.role),moodNode(moodOf(person.id)));list.append(b);
      });
      card.append(list);return card;
    });
    $('teams').replaceChildren(...cards);
    $('team-count').textContent=staff.filter(person=>person.kind==='manager').length+' 位主管 · '+staff.filter(person=>person.kind==='worker').length+' 位員工';
  }
  const person=staff.find(p=>p.id===selected);
  $('selection-hint').textContent=person ? person.name+' · '+(person.kind==='manager'?'主管':titleFor(person.manager)+' 組 / '+person.role)+' · '+readable(person.status) : '點選角色查看成員 · 拖曳移動、滾輪縮放';
  renderPersonality(staff);
  const economy=shop?.economy;
  const data={agents:staff,selected,lifeEnabled,daylight,economy:economy&&{floor:economy.floor,placed:economy.placed,agents:economy.agents},tasks:state.tasks.map(({threadId,manager,workerId,status,createdAt,updatedAt,text})=>
    ({threadId,manager,workerId,status,createdAt,updatedAt,brief:summarizeBrief(text)}))};
  const sceneKey=JSON.stringify(data);
  if(scene && previousScene!==sceneKey){
    if(scene.update)scene.update(data);else scene.setState({...data,selectedId:selected});
    previousScene=sceneKey;
  }
}
function groupedThreads() {
  const threads=new Map();
  for(const task of state.tasks){
    let group=threads.get(task.threadId);
    if(!group){group={id:task.threadId,tasks:[],updatedAt:'',text:'',managers:[]};threads.set(group.id,group);}
    group.tasks.push(task);
    if(task.updatedAt>group.updatedAt) group.updatedAt=task.updatedAt;
    if(!group.managers.includes(task.manager))group.managers.push(task.manager);
  }
  for(const group of threads.values()){
    group.tasks.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
    const first=state.messages.find(message=>message.threadId===group.id&&message.author==='user');
    group.text=group.tasks[0].text||first?.attachments?.[0]?.name||'附件交辦';
    const latest=new Map(group.tasks.map(task=>[task.manager,task]));
    const states=Array.from(latest.values(),t=>t.status);
    group.status=states.find(s=>active.has(s))??states.find(s=>s==='queued')??states.find(s=>s==='failed')??'done';
  }
  return [...threads.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
function renderList() {
  workspaceTools.setView(view==='history'?source:'');
  if(view!=='history')return;
  const query=$('search').value.toLowerCase().trim(),filter=$('hist-filter').value;
  $('hist-filter').hidden=source==='slack';
  document.querySelectorAll('[data-source]').forEach(b=>{b.classList.toggle('on',b.dataset.source===source);b.setAttribute('aria-pressed',b.dataset.source===source);});
  if(source==='board'||source==='knowledge')return;
  let rows=source==='slack' ? [...state.slackThreads].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))) : groupedThreads();
  rows=rows.filter(row=>{
    const matched=!query||String(row.text||'').toLowerCase().includes(query)||(row.messages||state.messages.filter(m=>m.threadId===row.id)).some(m=>m.text.toLowerCase().includes(query));
    return matched && (source==='slack'||filter==='all'||(filter==='active'?(active.has(row.status)||row.status==='queued'):row.status===filter));
  });
  const sig=JSON.stringify([source,rows,threadId,slackId,query,filter,transport]);if(sig===previousList)return;previousList=sig;
  if(!rows.length){$('threads').replaceChildren(el('p','history-empty',transport==='loading'?'正在讀取紀錄…':query||filter!=='all'&&source!=='slack'?'沒有符合條件的任務':source==='slack'?'尚無同步的 Slack 對話':'尚無網頁交辦紀錄'));return;}
  $('threads').replaceChildren(...rows.map(row=>{
    const isSlack=source==='slack', b=el('button','thread-row'+((isSlack?slackId:threadId)===row.id?' on':''));
    b.dataset.thread=row.id;
    const name=el('span','thread-text');
    name.append(el('strong','',row.text||row.messages?.[0]?.text||'Slack 對話'),el('small','',(isSlack?'Slack':row.managers.map(titleFor).join('、'))+' · '+when(row.updatedAt,true)));
    b.append(name,isSlack?el('span','meta','唯讀'):statusNode(row.status));return b;
  }));
}
function effortOptions(manager, model) {
  const catalog=state.modelCatalog?.[manager];
  return catalog?.models.find(item=>item.id===model)?.efforts ?? catalog?.defaultEfforts ?? [];
}
function modelSelection(manager, saved = savedModels[manager]) {
  const catalog=state.modelCatalog?.[manager];
  if(!catalog)return {model:'',effort:''};
  const model=catalog.models.some(item=>item.id===saved?.model)?saved.model:catalog.defaultModel;
  const choices=effortOptions(manager,model);
  const preferred=choices.includes(saved?.effort)?saved.effort:catalog.defaultEffort;
  const effort=choices.includes(preferred)?preferred:choices.at(-1);
  return {model,effort};
}
function modelOption(value,label) {
  const option=el('option','',label);
  option.value=value;
  return option;
}
function createEffortSlider(manager) {
  const wrapper=el('span','effort-control');
  const track=el('span','effort-track');
  const scale=el('span','effort-scale');
  const label=el('span','effort-value');
  scale.setAttribute('aria-hidden','true');
  label.setAttribute('aria-hidden','true');
  const input=el('input','effort-slider');
  input.type='range';
  input.min='0';
  input.step='1';
  input.setAttribute('aria-label',titleFor(manager)+' 推理強度');
  track.append(scale,input);
  wrapper.append(track,label);

  let choices=[];
  function update() {
    const index=input.valueAsNumber;
    const effort=choices[index];
    const text=effortLabels[effort] ?? effort ?? '';
    label.textContent=text;
    input.setAttribute('aria-valuetext',text);
    const progress=100*index/Math.max(1,choices.length-1);
    scale.style.setProperty('--effort-progress',`${progress}%`);
    return effort;
  }
  function fill(model, effort) {
    choices=effortOptions(manager,model);
    input.max=String(Math.max(0,choices.length-1));
    input.value=String(Math.max(0,choices.indexOf(effort)));
    scale.replaceChildren(...choices.map(()=>el('span','effort-tick')));
    return update();
  }
  return {wrapper,input,fill,update};
}
function renderModelSettings() {
  const container=$('model-settings');
  const catalog=state.modelCatalog;
  container.hidden=!!slackId||!catalog;
  if(container.hidden)return;
  const targets=targetsFor(choice);
  const key=JSON.stringify(targets.map(manager=>[manager,catalog[manager]]));
  if(key!==previousModelMenu) {
    previousModelMenu=key;
    const header=el('div','model-row model-head');
    header.setAttribute('aria-hidden','true');
    header.append(el('span'),el('span','','模型'),el('span','','Effort'));
    const rows=targets.filter(manager=>catalog[manager]).map(manager=>{
      const row=el('div','model-row');
      row.dataset.modelManager=manager;
      const info=catalog[manager];
      const selection=modelSelection(manager);
      const model=el('select');
      model.setAttribute('aria-label',titleFor(manager)+' 模型');
      model.append(...info.models.map(item=>modelOption(item.id,item.label)));
      model.value=selection.model;
      const effort=createEffortSlider(manager);
      effort.fill(selection.model,selection.effort);
      function save(effortValue) {
        savedModels[manager]={model:model.value,effort:effortValue};
        putStore('models',savedModels);
      }
      model.onchange=()=>{
        const selection=modelSelection(manager,{model:model.value,effort:savedModels[manager]?.effort});
        save(effort.fill(selection.model,selection.effort));
        effort.input.disabled=effort.input.max==='0';
      };
      effort.input.oninput=()=>save(effort.update());
      const portrait=el('span','model-manager');
      portrait.title=titleFor(manager);
      portrait.setAttribute('role','img');
      portrait.setAttribute('aria-label',portrait.title);
      portrait.append(avatar(manager));
      const modelWrap=el('span','model-select');
      modelWrap.append(model);
      row.append(portrait,modelWrap,effort.wrapper);
      return row;
    });
    container.replaceChildren(header,...rows);
  }
  for(const row of container.querySelectorAll('[data-model-manager]')) {
    const model=row.querySelector('select');
    const effort=row.querySelector('.effort-slider');
    model.disabled=sending;
    effort.disabled=sending||effort.max==='0';
  }
}
function renderControls(){
  const tools=workspaceTools.draft();
  const hasPlan=tools.workflow.length>0;
  const invalidPlan=hasPlan&&(choice==='both'||!field.value.trim());
  document.querySelectorAll('[data-target]').forEach(b=>{
    const target=b.dataset.target;
    b.classList.toggle('on',target===choice);
    b.setAttribute('aria-pressed',target===choice);
    b.disabled=!!slackId||sending;
  });
  const unavailable=targetsFor(choice).filter(id=>!teamReady(id)).map(titleFor);
  let readinessNote=!slackId&&transport==='ok'&&unavailable.length
    ? unavailable.join('、')+' 尚未就緒。請點右上角的「登入」查看設定。' : '';
  if(!slackId&&hasPlan&&choice==='both') readinessNote='分工需要指定一位審閱主管。';
  const targetStatus=$('target-status');
  if(targetStatus.textContent!==readinessNote)targetStatus.textContent=readinessNote;
  targetStatus.hidden=!readinessNote;
  $('chat-new').disabled=sending;$('history-new').disabled=sending;
  $('chat-board').hidden=!threadId||!state.tasks.some(task=>task.threadId===threadId&&task.hasWorkflow);
  $('chat-heading').textContent=slackId?'Slack 對話紀錄':threadId?'任務對話':'任務交辦台';
  document.querySelector('.recipients').hidden=!!slackId;
  $('composer').hidden=!!slackId;$('compose-footer').hidden=!!slackId;
  if(slackId)subscriptionUsage.close();
  renderModelSettings();
  renderDraftAttachments();
  workspaceTools.renderDraft();
  field.placeholder=(threadId?'追問':'交辦給')+titleFor(choice)+'…';
  $('attach').disabled=sending||!attachmentType;
  if (!attachmentType) $('attach').title='請重新啟動 Goose Office 以啟用附件。';
  $('send').disabled=(!field.value.trim()&&!draftAttachments().length&&!tools.references.length)||
    invalidPlan||sending||transport!=='ok'||!targetReady(choice);
  const sendHint=sending?'正在送出':transport!=='ok'?'等待本機服務連線':readinessNote||'送出任務';
  $('send').title=sendHint;field.readOnly=sending;
  $('send').querySelector('span').textContent=sending?'送出中':'送出';
}
const markdown = window.markdownit?.({ html: false, breaks: true });
const previewTypes = {
  png:'img',jpg:'img',jpeg:'img',gif:'img',webp:'img',
  mp4:'video',webm:'video',mp3:'audio',wav:'audio',ogg:'audio'
};
function officeFile(reference, taskId) {
  if (!taskId || !reference?.startsWith('office-file:')) return null;
  let name;
  try { name = decodeURIComponent(reference.slice('office-file:'.length)); }
  catch { return null; }
  if(!name || name.startsWith('.') || /[\\/:*?"<>|]/.test(name)) return null;
  return { name, url: '/api/tasks/'+encodeURIComponent(taskId)+'/files/'+encodeURIComponent(name),
    type: previewTypes[name.split('.').at(-1).toLowerCase()] };
}
function externalLink(link) {
  link.target='_blank';
  link.rel='noopener noreferrer';
}
function messageText(content, text, {taskId, raw = false, preview = false} = {}) {
  if (!markdown || raw) {
    content.append(el('p','plain-reply',text));
    return;
  }
  const block=el('div','markdown');
  block.innerHTML=markdown.render(text || '');
  const files=new Map();
  for (const node of block.querySelectorAll('a, img')) {
    const isImage=node.tagName==='IMG';
    const ref=node.getAttribute(isImage?'src':'href');
    const file=officeFile(ref,taskId);
    if (file && !preview) {
      const link=isImage?el('a','',node.alt||file.name):node;
      link.href=file.url+'?download=1';
      if(isImage)node.replaceWith(link);
      files.set(file.url,file);
    } else if (ref?.startsWith('office-file:')) {
      node.replaceWith(document.createTextNode(isImage?node.alt:node.textContent));
    } else if (isImage) {
      const link=el('a','',node.alt||'開啟圖片');
      if(/^https?:\/\//i.test(ref||'')){link.href=ref;externalLink(link);}
      node.replaceWith(link.href?link:document.createTextNode(link.textContent));
    } else if (/^https?:\/\//i.test(ref||'')) {
      externalLink(node);
    }
  }
  content.append(block);
  for (const file of files.values()) {
    if(!Object.hasOwn(previewTypes,file.name.split('.').at(-1).toLowerCase()))continue;
    const media=el(file.type,'reply-media');
    media.src=file.url;
    if(file.type==='img'){media.alt=file.name;media.loading='lazy';}
    else {media.controls=true;media.preload='metadata';media.setAttribute('aria-label',file.name);}
    content.append(media);
  }
}
const activityKinds={stage:'',command:'執行指令',file:'檔案操作',web:'瀏覽網頁',screenshot:'截圖',video:'處理影片',task:'執行子任務',tool:'使用工具'};
const activityStates={running:'進行中',done:'完成',failed:'失敗',unconfirmed:'未回報結果'};
const expandedActivities=new Map();
function activityAge(start,end) {
  const elapsed=Math.max(0,Math.floor(((end?Date.parse(end):Date.now())-Date.parse(start))/1000));
  if(!Number.isFinite(elapsed))return '';
  return elapsed<60?elapsed+' 秒':Math.floor(elapsed/60)+' 分 '+elapsed%60+' 秒';
}
function refreshTimers() {
  for(const timer of chatBox.querySelectorAll('[data-active-since]'))timer.textContent=activityAge(timer.dataset.activeSince);
}
function renderActivity(task,rows,staff) {
  const isRunning=active.has(task.status);
  const open=isRunning||task.status==='queued';
  const details=el('details','activity-group');
  details.open=expandedActivities.get(task.id) ?? open;
  const headline=el('summary');
  const running=rows.filter(row=>row.status==='running');
  const latest=running.at(-1) || rows.at(-1);
  const actor=staff.find(p=>p.id===latest?.actor)?.name || titleFor(task.manager);
  const current=open?(latest?(activityKinds[latest.kind] || latest.label):readable(task.status)):'工作紀錄';
  const indicator=el('span',isRunning?'activity-indicator running':'activity-indicator');
  indicator.setAttribute('aria-hidden','true');
  headline.append(indicator,el('strong','',actor),el('span','activity-current',current));
  if(rows.length) {
    const timer=el('time','',activityAge(rows[0].startedAt,open?null:task.updatedAt));
    if(open)timer.dataset.activeSince=rows[0].startedAt;
    headline.append(timer);
  }
  headline.onclick=()=>expandedActivities.set(task.id,!details.open);
  details.append(headline);
  const list=el('ol','activity-list');
  for(const row of rows) {
    const item=el('li','activity-item');
    const label=activityKinds[row.kind]?activityKinds[row.kind]+' · '+row.label:row.label;
    const name=staff.find(p=>p.id===row.actor)?.name||row.actor;
    const heading=el('div','activity-line');
    const badge=el('span','activity-state',activityStates[row.status]||row.status);
    badge.dataset.status=row.status;
    heading.append(el('span','',name+' · '+label),badge);
    item.append(heading);
    if(row.detail)item.append(el(row.kind==='command'?'code':'span','activity-detail',row.detail));
    if(row.note)item.append(el('span','activity-note',row.note));
    list.append(item);
  }
  if(!rows.length)list.append(el('li','activity-item','等候主管接手。'));
  details.append(list);
  return details;
}
function renderMessage(message, staff) {
  if(message.author==='system'){
    const notice=el('div','system-msg',message.text);
    notice.append(el('time','',when(message.createdAt)));
    return notice;
  }
  const author=staff.find(p=>p.id===message.author);
  const row=el('div','msg'),body=el('div','msg-content'),head=el('header');
  head.append(el('b','',message.author==='user'?'你':author?.name||message.author),
    message.preview?el('span','writing-label','撰寫中'):el('time','',when(message.createdAt)));
  body.append(head);
  if (message.text) messageText(body,message.text,{taskId:message.taskId,raw:message.author==='user',preview:message.preview});
  if (message.attachments?.length) {
    const files=el('div','message-attachments');
    for (const file of message.attachments) {
      const url='/api/attachments/'+encodeURIComponent(file.id);
      const image=file.mime.startsWith('image/');
      const link=el('a','attachment-item'+(image?' attachment-image':''));
      link.href=url+'?download=1';
      link.download=file.name;
      link.title='下載 '+file.name;
      if (image) {
        const preview=el('img');
        preview.src=url; preview.alt=''; preview.loading='lazy';
        link.append(preview);
      } else {
        const icon=el('span','attachment-file-icon');
        icon.innerHTML=iconMarkup('file'); icon.setAttribute('aria-hidden','true');
        link.append(icon);
      }
      link.append(el('span','attachment-name',file.name));
      files.append(link);
    }
    body.append(files);
  }
  if (message.references?.length) {
    const references=el('div','message-references');
    for (const ref of message.references) {
      const quote=el('details','message-reference');
      const person=staff.find(member=>member.id===ref.author);
      const label=el('summary','','引用 · '+(ref.author==='user'?'你':person?.name||ref.author));
      const source=el('button','small-action','開啟原任務');
      source.type='button';
      source.onclick=()=>{ showView('history'); openThread(ref.sourceThread); };
      quote.append(label,el('blockquote','',ref.excerpt),source);
      references.append(quote);
    }
    body.append(references);
  }
  row.append(avatar(message.author),body);
  if(message.preview)row.setAttribute('aria-live','off');
  return row;
}
function renderChat(force=false) {
  const item=slackId?state.slackThreads.find(s=>s.id===slackId):null;
  const relevant=slackId?(item?.messages||[]):threadId?state.messages.filter(m=>m.threadId===threadId):[];
  const taskGroup=slackId?[]:state.tasks.filter(t=>t.threadId===threadId).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
  const taskIds=new Set(taskGroup.map(task=>task.id));
  const histories=new Map();
  for(const event of state.activities){
    if(!taskIds.has(event.taskId))continue;
    if(!histories.has(event.taskId))histories.set(event.taskId,[]);
    histories.get(event.taskId).push(event);
  }
  const drafts=state.drafts.filter(draft=>taskIds.has(draft.taskId));
  const sig=JSON.stringify([slackId,threadId,relevant,taskGroup,[...histories],drafts]);
  refreshTimers();
  if(!force&&sig===previousChat)return;previousChat=sig;
  const nearEnd=chatBox.scrollHeight-chatBox.scrollTop-chatBox.clientHeight<90;
  if(!slackId&&!threadId){chatBox.innerHTML=newChatMarkup;return;}
  const messages=el('div','messages');
  if(slackId)messages.append(el('p','system-msg','從本機 Slack 紀錄同步 · 唯讀'));
  const staff=workers();
  const timeline=relevant.map(message=>({at:message.createdAt, node:()=>renderMessage(message,staff)}));
  for(const task of taskGroup) {
    const rows=histories.get(task.id)||[];
    if(rows.length||active.has(task.status)||task.status==='queued') {
      timeline.push({at:rows[0]?.startedAt||task.createdAt,node:()=>renderActivity(task,rows,staff)});
    }
  }
  for(const draft of drafts)timeline.push({at:draft.startedAt,node:()=>renderMessage({
    author:draft.actor,text:draft.text,createdAt:draft.startedAt,preview:true
  },staff)});
  for(const entry of timeline.sort((a,b)=>String(a.at).localeCompare(String(b.at))))messages.append(entry.node());
  const nodes=[];
  if(taskGroup.length){
    const summary=el('div','thread-summary');
    for(const task of new Map(taskGroup.map(t=>[t.manager,t])).values()){
      const status=el('span','',titleFor(task.manager)+' · '+readable(task.status));
      if(task.model)status.title=task.model+(task.effort?' · Effort '+(effortLabels[task.effort]||task.effort):'');
      summary.append(status);
    }
    nodes.push(summary);
  }
  if(!timeline.length)messages.append(el('p','meta',slackId?'此對話暫無訊息。':'正在載入對話…'));
  nodes.push(messages); chatBox.replaceChildren(...nodes);
  if(force||nearEnd)chatBox.scrollTop=chatBox.scrollHeight;
}
function showView(next) {
  view=next;
  $('floor-view').hidden=next!=='floor';$('history-view').hidden=next!=='history';
  $('shop-view').hidden=next!=='shop';$('settings-view').hidden=next!=='settings';
  const wide=next==='shop'||next==='settings';
  $('dispatch').hidden=wide;
  document.querySelector('.layout').classList.toggle('single',wide);
  $('chat-new').hidden=next!=='floor';$('chat-return').hidden=next!=='history';
  for(const [key,id] of [['floor','floor-nav'],['history','history-nav'],['shop','shop-nav'],['settings','settings-nav']]){
    const b=$(id); b.classList.toggle('selected',key===next);
    if(key===next)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
  renderList();
}
function note(text){$('form-note').textContent=text;$('form-note').hidden=!text;}
function goChatMobile(){if(matchMedia('(max-width:840px)').matches)$('dispatch').scrollIntoView({block:'start',behavior:'instant'});}
function openThread(id,isSlack=false){
  if(sending)return;
  saveDraft();slackId=isSlack?id:'';threadId=isSlack?'':id;note('');
  const group=groupedThreads().find(t=>t.id===id);
  choice=group?.managers.length===1?group.managers[0]:defaultTarget();
  if(!isSlack)restoreDraft();
  renderControls();renderChat(true);renderList();goChatMobile();
}
function openNew(target){
  if(sending)return;
  saveDraft();slackId='';threadId='';choice=defaultTarget();restoreDraft();if(target)choice=target;
  note('');renderControls();renderChat(true);renderList();
}
function selectEmployee(id) {
  if(sending)return;
  const person=workers().find(p=>p.id===id);if(!person)return;
  selected=id; const activeTask=state.tasks.find(t=>t.id===person.taskId);
  if(activeTask)openThread(activeTask.threadId);
  else openNew(person.manager||id);
  renderTeams();
}
const loginDialog = $('login-dialog');
const loginFeedback = $('login-feedback');
const loginCheck = $('login-check');
const loginStart = $('login-start');
const loginCancel = $('login-cancel');
const loginProgress = $('login-progress');
const loginStatusLabels = {
  ready:'已就緒', login:'待登入', setup:'待設定', loading:'檢查中', offline:'無法檢查',
  installing:'安裝中', authorizing:'等候授權', failed:'待重試', cancelled:'已取消'
};
let loginRequest = false;
function showLoginFeedback(message) {
  loginFeedback.textContent=message;
  loginFeedback.hidden=!message;
}
function renderLoginStatus() {
  const setup=state.onboarding;
  const running=['running','cancelling'].includes(setup?.state);
  const ready=transport==='ok'&&targetReady('both');
  for (const id of ['claude','codex']) {
    let connection;
    if (transport==='loading') connection={state:'loading',detail:'正在檢查本機登入設定。'};
    else if (transport==='error') connection={state:'offline',detail:'無法連線至本機服務。請確認 Goose Office 正在執行。'};
    else connection=state.backend.connections?.[id] ?? (teamReady(id)
      ? {state:'ready',detail:'已找到本機登入設定。'}
      : {state:'setup',detail:'請依下方步驟完成本機設定。'});
    const step=setup?.managers?.[id];
    if (transport==='ok' && step && !teamReady(id) && step.state!=='ready') connection=step;
    const badge=$(id+'-login-status');
    badge.dataset.state=connection.state;
    badge.textContent=loginStatusLabels[connection.state];
    $(id+'-login-detail').textContent=connection.detail;
  }
  const progress=setup?.detail || (transport==='ok'&&!setup ? '請重新啟動 Goose Office 以啟用自動設定。' : '');
  if (loginProgress.textContent!==progress) loginProgress.textContent=progress;
  loginProgress.hidden=!progress;
  loginStart.hidden=running||ready;
  loginStart.disabled=loginRequest||transport!=='ok'||!setup;
  loginStart.textContent=['failed','cancelled'].includes(setup?.state)?'重試設定':'開始設定';
  loginCancel.hidden=!running;
  loginCancel.disabled=loginRequest||setup?.state==='cancelling';
}
function renderState() {
  const ok=transport==='ok',ready=ok&&targetReady('both');
  const offline=['claude','codex'].filter(id=>!teamReady(id));
  $('service').dataset.health=ready?'ready':transport==='loading'?'loading':'warn';
  $('service-label').textContent=ready?'已連線':transport==='loading'?'連線中':ok&&offline.length===1?titleFor(offline[0])+' 待登入':ok?'引擎未就緒':'離線';
  $('backend-name').textContent=state.backend.label||'本機工作區';
  $('backend-detail').textContent=ok?(state.backend.detail||(ready?'本機服務已連線。':'請檢查代理引擎設定。')):transport==='loading'?'正在取得服務狀態。':'無法連線至本機服務，會自動重試。';
  $('active-count').textContent=received?state.tasks.filter(t=>active.has(t.status)).length:'—';
  $('queue-count').textContent=received?state.tasks.filter(t=>t.status==='queued').length:'—';
  const count=new Set(state.tasks.map(t=>t.threadId)).size+state.slackThreads.length;
  $('nav-count').textContent=count>0?count:'';
  renderLoginStatus();
  renderTeams();renderList();renderControls();renderChat();
  workspaceTools.refreshPane();
}
async function refresh({checkLogin=false}={}) {
  const seq=++issuedSequence;
  try{
    const options={cache:'no-store',signal:AbortSignal.timeout(23000)};
    if(checkLogin) Object.assign(options,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    else if(stateTag) options.headers={'If-None-Match':stateTag};
    const res=await fetch(checkLogin?'/api/connections/check':'/api/state',options);
    if(res.status===304){
      if(seq<lastSequence)return transport==='ok';
      lastSequence=seq;
      if(transport!=='ok'){transport='ok';renderState();}
      else {refreshTimers();workspaceTools.refreshPane();}
      return true;
    }
    if(!res.ok)throw Error('state '+res.status);
    const next=await res.json();
    if(!Array.isArray(next.tasks)||!Array.isArray(next.messages)||!Array.isArray(next.employees))throw Error('state');
    if(seq<lastSequence)return transport==='ok';lastSequence=seq;
    stateTag=res.headers.get('ETag')||'';
    Object.assign(state,{...next,activities:next.activities||[],drafts:next.drafts||[],slackThreads:next.slackThreads||[],backend:next.backend||{ready:false},modelCatalog:next.modelCatalog||null,onboarding:next.onboarding||null});
    if(!received&&!targetTouched&&!getStore(draftKey())&&!targetReady(choice))choice=defaultTarget();
    transport='ok';received=true;
  }catch{if(checkLogin||seq<lastSequence)return false;lastSequence=seq;transport='error';}
  renderState();
  return transport==='ok';
}
$('login-open').onclick=()=>loginDialog.showModal();
async function requestLoginSetup(action) {
  if (loginRequest) return;
  loginRequest=true;
  showLoginFeedback('');
  renderLoginStatus();
  const seq=++issuedSequence;
  try {
    const res=await fetch('/api/connections/setup/'+action,{
      method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(res.status===404 ? '請重新啟動 Goose Office 以啟用自動設定。' : '無法更新設定，請稍後再試。');
    const result=await res.json();
    if (seq>=lastSequence) {
      lastSequence=seq;
      state.onboarding=result.onboarding;
    }
  } catch (error) {
    showLoginFeedback(error.name==='Error'&&error.message ? error.message : '無法確認設定狀態，請稍後再試。');
  } finally {
    loginRequest=false;
    renderLoginStatus();
  }
  if (action==='start'&&loginDialog.open&&!loginCancel.hidden) loginCancel.focus();
}
loginStart.onclick=()=>requestLoginSetup('start');
loginCancel.onclick=()=>requestLoginSetup('cancel');
for (const button of loginDialog.querySelectorAll('[data-copy-command]')) {
  button.onclick=async()=>{
    const command=button.previousElementSibling.textContent;
    try {
      await navigator.clipboard.writeText(command);
      showLoginFeedback('已複製指令，請貼到終端機執行。');
    } catch {
      showLoginFeedback('無法使用剪貼簿。請選取指令後手動複製。');
    }
  };
}
loginCheck.onclick=async()=>{
  loginCheck.disabled=true;
  showLoginFeedback('正在檢查本機登入狀態…');
  try {
    const updated=await refresh({checkLogin:true});
    showLoginFeedback(updated?'本機登入狀態已更新。':'檢查失敗，請確認本機服務已啟動後再試一次。');
  } finally {
    loginCheck.disabled=false;
  }
};
$('brand').onclick=$('floor-nav').onclick=()=>showView('floor');$('history-nav').onclick=()=>showView('history');$('shop-nav').onclick=()=>shop.open();
const settingsPage=mountSettingsPage($('settings-view'));
$('settings-nav').onclick=()=>{showView('settings');settingsPage.open();};
// Deep links: /#history, /#shop and /#settings open that page.
const openFromHash=()=>({'#history':()=>showView('history'),'#shop':()=>shop.open(),'#settings':()=>$('settings-nav').onclick()})[location.hash]?.();
window.addEventListener('hashchange',openFromHash);
for(const b of document.querySelectorAll('[data-source]'))b.onclick=()=>{source=b.dataset.source;renderList();};
$('threads').onclick=e=>{const b=e.target.closest('[data-thread]');if(b)openThread(b.dataset.thread,source==='slack');};
$('teams').onclick=e=>{const b=e.target.closest('[data-employee]');if(b)selectEmployee(b.dataset.employee);};
$('search').oninput=$('hist-filter').onchange=renderList;
for(const b of document.querySelectorAll('[data-target]'))b.onclick=()=>{targetTouched=true;choice=b.dataset.target;saveDraft();note('');renderControls();};
$('chat-new').onclick=$('history-new').onclick=()=>{openNew();goChatMobile();field.focus({preventScroll:true});};
$('chat-return').onclick=()=>{
  showView('floor');
  goChatMobile();
  $('chat-heading').focus({preventScroll:true});
};
$('chat-board').onclick=()=>{source='board';workspaceTools.setBoardThread(threadId);showView('history');};
$('attach').onclick=()=>attachmentInput.click();
attachmentInput.onchange=()=>{
  addAttachments(attachmentInput.files);
  attachmentInput.value='';
};
field.onpaste=event=>{
  if (!attachmentType) return;
  const files=Array.from(event.clipboardData?.items||[])
    .filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter(Boolean);
  if (files.length) {
    event.preventDefault();
    addAttachments(files,true);
  }
};
field.oninput=()=>{saveDraft();renderControls();};
field.onkeydown=e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){
    e.preventDefault();if(!$('send').disabled)$('composer').requestSubmit();
  }
};
$('composer').onsubmit=async e=>{
  e.preventDefault();const text=field.value.trim();
  if($('send').disabled||slackId)return;
  const entries=draftAttachments();
  const {references,workflow}=workspaceTools.draft();
  const quotes=references.map(({id,offset})=>({id,offset}));
  const managers=targetsFor(choice);
  const modelSettings=Object.fromEntries(managers.map(manager=>[manager,modelSelection(manager)])
    .filter(([,setting])=>setting.model||setting.effort));
  const existing=state.tasks.find(t=>t.threadId===threadId);
  if(threadId&&!existing){note('這個任務串已無法取得，請新增交辦。');return;}
  const endpoint=existing?'/api/tasks/'+encodeURIComponent(existing.id)+'/messages':'/api/tasks';
  const key=draftKey(),pendingKey='pending:'+key,stored=getStore(pendingKey);
  const parts=[endpoint,managers,text];
  const access=accessMode.value();parts.push(access);
  if(Object.keys(modelSettings).length)parts.push(modelSettings);
  if(entries.length)parts.push(entries.map(entry=>entry.id));
  if(quotes.length||workflow.length)parts.push({ quotes,workflow });
  const fingerprint=JSON.stringify(parts);
  const clientId=stored?.fingerprint===fingerprint?stored.clientId:crypto.randomUUID();
  putStore(pendingKey,{fingerprint,clientId});
  sending=true;renderControls();note('');
  try{
    const attachments=entries.length ? await Promise.all(entries.map(encodeAttachment)) : undefined;
    const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({managers,text,clientId,modelSettings,attachments,workDir:folderPicker.value(),access,
        references:quotes.length?quotes:undefined,workflow:workflow.length?workflow:undefined
      }),signal:AbortSignal.timeout(entries.length?90000:12000)});
    const answer=await res.json().catch(()=>null);
    if(!res.ok)throw Error(typeof answer?.error==='string'?answer.error:'服務回應 HTTP '+res.status);
    if(!answer?.threadId)throw Error('服務未回傳任務編號');
    clearDraftAttachments(key);
    workspaceTools.clearDraft(key);
    putStore(key,null);putStore(pendingKey,null);threadId=answer.threadId;
    field.value='';await refresh();renderChat(true);
  }catch(error){note('送出未確認，草稿已保留。'+error.message);}
  finally{sending=false;renderControls();}
};
const accessMode=mountAccessMode({root:$('access-mode'),iconMarkup});
const folderPicker=mountFolderPicker({root:$('folder-picker'),iconMarkup,onError:message=>note(message)});
const workspaceTools=mountWorkspaceTools({
  el, people:identities, getDraftKey:draftKey, getStore, putStore, getChoice:()=>choice,
  setChoice(target) { choice=target; targetTouched=true; putStore(draftKey(),{text:field.value,choice}); },
  canEdit:()=>!sending, onDraftChange() {saveDraft();renderControls();},
  openThread, openTask(id) {const task=state.tasks.find(item=>item.id===id); if(task)openThread(task.threadId);},
  openNew, when
});
try{scene=createOfficeScene($('office-canvas'),{onSelect:selectEmployee,onLife:renderOfficeLife,onView:followSpeech});}catch(error){console.error('Office scene',error);$('selection-hint').textContent='可在下方選取團隊成員';}
var shop=mountOfficeShop({
  el, getSelected:()=>selected, getStaff:()=>workers(),
  onChange(){ if(view==='floor'||scene)renderTeams(); },
  onOpen(){ if(view!=='shop'){showView('shop');window.scrollTo({top:0});} },
  onReact(targets,item,lead,line){ const point=scene?.react?.(targets,item); showReaction(lead,line,point); previousProfileEconomy=''; renderTeams(); }
});
if('ResizeObserver' in window){
  new ResizeObserver(()=>positionOfficeDialogue(reaction?.speech||lifeFrame?.speech)).observe($('office-canvas'));
}
$('office-life-toggle').onclick=()=>{
  lifeEnabled=!lifeEnabled;
  putStore('office-life',lifeEnabled);
  renderLifeToggle();
  renderTeams();
};
function renderDaylight(){
  const labels={auto:'自動',day:'白天',night:'夜晚'};
  $('daylight-label').textContent=labels[daylight];
  $('daylight-toggle').dataset.mode=daylight;
  $('daylight-toggle').title={auto:'日夜：跟隨本機時間（晚上 7 點到早上 6 點是夜晚）',day:'日夜：固定白天',night:'日夜：固定夜晚'}[daylight];
}
$('daylight-toggle').onclick=()=>{
  daylight={auto:'day',day:'night',night:'auto'}[daylight];
  putStore('daylight',daylight);
  renderDaylight();
  renderTeams();
};
renderDaylight();
renderLifeToggle();
restoreDraft();renderState();openFromHash();
async function poll(){
  await refresh();
  const running=state.tasks.some(task=>active.has(task.status)||task.status==='queued');
  setTimeout(poll,document.hidden?7000:running?650:2200);
}
poll();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
