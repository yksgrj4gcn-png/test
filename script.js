"use strict";

// Fantasy RPG - Battle風の固定フレーム / ターン制コマンド入力
const PARTY_LIMIT = 4;
const BGM_VOLUME_MULTIPLIER = 1.5;
const SE_VOLUME_MULTIPLIER = 1.5;
const characters = [
  { id:"kotama", name:"コタマ", image:"assets/characters/kotama.png", hp:100,maxHp:100,attack:150,spAttack:100,defense:35,guardCut:.60,sp:60,maxSp:60,spSkills:[{id:"magic-bullet",name:"魔力弾",cost:15,target:"enemy",type:"spAttack"}] },
  { id:"knight", name:"騎士", image:"assets/characters/kishi.png", hp:120,maxHp:120,attack:20,spAttack:10,defense:60,guardCut:.80,sp:50,maxSp:50,spSkills:[{id:"taunt",name:"挑発",cost:5,target:"self",type:"taunt"}] },
  { id:"healer", name:"治癒士", image:"assets/characters/hi-ra-.png", hp:80,maxHp:80,attack:5,spAttack:90,defense:10,guardCut:.25,sp:120,maxSp:120,spSkills:[{id:"heal",name:"ヒール",cost:15,target:"ally",type:"heal"},{id:"revive",name:"死者蘇生",cost:30,target:"deadAlly",type:"revive"}] },
  { id:"warrior", name:"戦士", image:"assets/characters/sennshi.png", hp:130,maxHp:130,attack:50,spAttack:180,defense:20,guardCut:.50,sp:80,maxSp:80,spSkills:[{id:"charge",name:"突撃",cost:10,hpCost:20,target:"enemy",type:"charge"}] },
  { id:"mage", name:"魔術師", image:"assets/characters/mahoutukai.png", hp:70,maxHp:70,attack:2,spAttack:95,defense:5,guardCut:.20,sp:180,maxSp:180,spSkills:[{id:"fire",name:"ファイア",cost:15,target:"allEnemies",type:"fire"}] }
];
const unionSkills = {
  kotama:{id:"magic-bullet-union",name:"至高の魔弾",requiredHits:4,type:"stun",damage:300},
  knight:{id:"aegis-union",name:"イージスの大盾",requiredHits:3,type:"aegis"},
  healer:{id:"full-healing-union",name:"フルヒーリング",requiredHits:5,type:"full-heal"},
  warrior:{id:"cross-break-union",name:"クロスブレイク",requiredHits:4,type:"cross-break",requiredMembers:2},
  mage:{id:"meteor-union",name:"メテオ",requiredHits:5,type:"meteor",damage:666}
};
const state={screen:"home",gold:50,party:["kotama","knight","mage","healer"]};
const shopItems=[
  {id:"sword",name:"冒険者の剣",category:"weapon",icon:"SWORD",description:"扱いやすい基本の剣。",price:20,effect:"攻撃力 +5",attackBonus:5},
  {id:"great-sword",name:"炎の大剣",category:"weapon",icon:"SWORD",description:"炎の力を宿した大剣。",price:40,effect:"攻撃力 +12",attackBonus:12},
  {id:"leather-armor",name:"革の鎧",category:"armor",icon:"ARMOR",description:"軽く扱いやすい防具。",price:20,effect:"防御力 +5",defenseBonus:5},
  {id:"iron-armor",name:"鉄の鎧",category:"armor",icon:"ARMOR",description:"頑丈な防具。",price:40,effect:"防御力 +10",defenseBonus:10},
  {id:"potion",name:"回復薬",category:"healing",icon:"POTION",description:"味方1人のHPを30回復。",price:10,effect:"HP +30",kind:"heal",amount:30},
  {id:"high-potion",name:"上級回復薬",category:"healing",icon:"POTION",description:"味方1人のHPを70回復。",price:25,effect:"HP +70",kind:"heal",amount:70},
  {id:"ether",name:"SPエーテル",category:"healing",icon:"ETHER",description:"味方1人のSPを30回復。",price:15,effect:"SP +30",kind:"sp",amount:30}
];
const inventory={};
const equipment={};
characters.forEach(c=>equipment[c.id]={weapon:null,armor:null});
const enemyData=[
  {name:"スライム",hp:90,attack:12,defense:4,spDefense:35,physicalDamageRate:.18,gold:10,sprite:"slime",actionName:"粘液攻撃",image:"assets/monsters/suraimu.png"},
  {name:"ゴブリン",hp:180,attack:32,defense:10,gold:15,sprite:"goblin",actionName:"棍棒の一撃",image:"assets/monsters/goburinn.png"},
  {name:"オオカミ",hp:330,attack:30,defense:20,gold:20,sprite:"wolf",actionName:"鋭い牙",image:"assets/monsters/ookami.png"},
  {name:"ドラゴン",hp:800,attack:65,defense:40,spAttack:60,spDefense:20,gold:50,sprite:"dragon",actionName:"鋭い爪"},
  {name:"魔王",hp:1800,attack:70,spAttack:100,defense:100,gold:50,sprite:"maou",image:"assets/monsters/maou.png"}
];
const $=id=>document.getElementById(id);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getCharacter=id=>characters.find(c=>c.id===id);
const getParty=()=>state.party.map(getCharacter).filter(Boolean);
const itemById=id=>shopItems.find(i=>i.id===id);
let currentCategory="weapon", purchasePopupTimer, audioContext=null, bgmTimer=null, bossBgmAudio=null, victoryBgmAudio=null, previewAudio=null, previewTimer=null, bgmStep=0, currentBgmKey="", prioritySoundUntil=0, readyChimeKey="", maouOmenTimer=null, goblinCharging=false, burnedTurns={}, specialOmenShown={}, soundtrackPreviewActive=false;
let battleState={stage:1,maxStage:5,enemy:null,turnCount:0,busy:false,fast:false,turnOrder:[],currentActorIndex:0,actions:[],consumedActors:[],guarding:{},tauntTarget:null,enemyStunned:false,aegisActive:false,unionGauges:{kotama:0,knight:0,healer:0,warrior:0,mage:0},log:[],pending:null,menuMode:"main",targetIds:[],selectedEnemyId:null,stageFinished:false,lastRewardGold:0,bossBgmChoice:null,wolfEvasionTurns:0,wolfLastTargetId:null,wolfClone:null,wolfCloneTurns:0,wolfCloneLastTargetId:null};
let goblinTeamAttackUsed=false, defenseDownFresh=new Set(), lastEnemyAttackMissed=false;

function sound(type="move",force=false){
  const toggle=$("se-toggle"); if(toggle&&!toggle.checked)return;
  if(!force&&performance.now()<prioritySoundUntil&&type!=="union")return;
  try{
    audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==="suspended")audioContext.resume();
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    const now=audioContext.currentTime;
    const settings={move:[610,.035,"square",.018],select:[980,.065,"square",.035],back:[520,.07,"triangle",.025],error:[260,.11,"square",.03],damage:[190,.16,"sawtooth",.052],guard:[285,.28,"triangle",.055],heal:[1120,.13,"sine",.03],union:[1320,.22,"square",.04],buy:[880,.12,"triangle",.03]};
    const [freq,dur,wave,baseVol]=settings[type]||settings.select;const vol=Math.min(.9,baseVol*2*SE_VOLUME_MULTIPLIER);
    osc.type=wave;osc.frequency.setValueAtTime(freq,now);if(type==="damage")osc.frequency.exponentialRampToValueAtTime(72,now+dur);if(type==="guard")osc.frequency.exponentialRampToValueAtTime(105,now+dur);
    gain.gain.setValueAtTime(vol,now);gain.gain.exponentialRampToValueAtTime(.0001,now+dur);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+dur);if(type==="guard"){const clang=audioContext.createOscillator(),cg=audioContext.createGain();clang.type="sine";clang.frequency.setValueAtTime(920,now);clang.frequency.exponentialRampToValueAtTime(420,now+.2);cg.gain.setValueAtTime(Math.min(.9,.05*SE_VOLUME_MULTIPLIER),now);cg.gain.exponentialRampToValueAtTime(.0001,now+.22);clang.connect(cg);cg.connect(audioContext.destination);clang.start(now);clang.stop(now+.23);}
  }catch(e){}
}
function currentBgmTrack(){
  if(state.screen==="home")return "home";
  if(state.screen==="battle"&&battleState.stageFinished)return "victory";
  if(state.screen==="clear")return "victory";
  return state.screen==="battle"&&battleState.enemy?.name==="魔王"?"boss":"normal";
}
function startBgm(){
  if(soundtrackPreviewActive)return;
  const toggle=$("bgm-toggle");
  if(toggle&&!toggle.checked){stopBgm();return;}
  const key=currentBgmTrack();

  // Keep the supplied MP3 playing through the Maou battle instead of restarting it on every click.
  if(key==="boss"&&currentBgmKey==="boss"&&bossBgmAudio){
    if(bossBgmAudio.paused)bossBgmAudio.play().catch(()=>{});
    return;
  }
  if(key==="victory"&&currentBgmKey==="victory"&&victoryBgmAudio){
    if(victoryBgmAudio.paused)victoryBgmAudio.play().catch(()=>{});
    return;
  }
  if(key!=="boss"&&key!=="victory"&&bgmTimer&&currentBgmKey===key){if(audioContext?.state==="suspended")audioContext.resume();return;}
  if(bgmTimer||bossBgmAudio||victoryBgmAudio||currentBgmKey)stopBgm();

  if(key==="victory"){
    try{
      victoryBgmAudio=new Audio("assets/music/March_for__delightful_future.mp3");
      victoryBgmAudio.loop=true;
      victoryBgmAudio.preload="auto";
      victoryBgmAudio.volume=Math.min(1,0.175*BGM_VOLUME_MULTIPLIER);
      victoryBgmAudio.onerror=()=>{console.error("勝利後BGMの読み込みに失敗しました: assets/music/March_for__delightful_future.mp3",victoryBgmAudio?.error);};
      currentBgmKey="victory";
      const playback=victoryBgmAudio.play();
      if(playback&&typeof playback.catch==="function")playback.catch(error=>console.warn("勝利後BGMを再生できませんでした。ブラウザの自動再生制限や音源パスを確認してください。",error));
    }catch(e){victoryBgmAudio=null;currentBgmKey="";console.error("勝利後BGMの再生を開始できませんでした。",e);}
    return;
  }

  if(key==="boss"){
    try{
      const bossTracks={arc:"assets/music/Final%20Battle%20Arc.mp3",overture:"assets/music/Final%20Battle%20Overture.mp3"};
      if(!battleState.bossBgmChoice)battleState.bossBgmChoice=Math.random()<.5?"arc":"overture";
      bossBgmAudio=new Audio(bossTracks[battleState.bossBgmChoice]||bossTracks.arc);
      bossBgmAudio.loop=true;
      bossBgmAudio.preload="auto";
      bossBgmAudio.volume=Math.min(1,0.175*BGM_VOLUME_MULTIPLIER);
      currentBgmKey="boss";
      const playback=bossBgmAudio.play();
      if(playback&&typeof playback.catch==="function")playback.catch(()=>{});
    }catch(e){bossBgmAudio=null;currentBgmKey="";}
    return;
  }

  try{
    audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==="suspended")audioContext.resume();
    const tracks={
      home:{notes:[261.63,329.63,392,329.63,293.66,349.23,440,392],wave:"sine",gain:.0175,interval:1100,duration:1.22},
      normal:{notes:[220,277.18,329.63,277.18,196,246.94,293.66,246.94],wave:"sine",gain:.02,interval:420,duration:.28}
    };
    const track=tracks[key]||tracks.normal;
    currentBgmKey=key;bgmStep=0;
    bgmTimer=setInterval(()=>{
      const liveToggle=$("bgm-toggle");
      if(liveToggle&&!liveToggle.checked){stopBgm();return;}
      if(currentBgmTrack()!==currentBgmKey){stopBgm();startBgm();return;}
      try{
        const o=audioContext.createOscillator(),g=audioContext.createGain(),now=audioContext.currentTime;
        o.type=track.wave;o.frequency.setValueAtTime(track.notes[bgmStep++%track.notes.length],now);
        g.gain.setValueAtTime(Math.min(.9,track.gain*BGM_VOLUME_MULTIPLIER),now);g.gain.exponentialRampToValueAtTime(.0001,now+track.duration);
        o.connect(g);g.connect(audioContext.destination);o.start(now);o.stop(now+track.duration+.01);
      }catch(e){}
    },track.interval);
  }catch(e){stopBgm();}
}
function playReadyChime(){
  const toggle=$("se-toggle");if(toggle&&!toggle.checked)return;
  try{audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==="suspended")audioContext.resume();
    const now=audioContext.currentTime;prioritySoundUntil=performance.now()+520;
    const o=audioContext.createOscillator(),g=audioContext.createGain();o.type="triangle";o.frequency.setValueAtTime(1050,now);o.frequency.exponentialRampToValueAtTime(1850,now+.16);o.frequency.setValueAtTime(1480,now+.2);g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(Math.min(.9,.024*SE_VOLUME_MULTIPLIER),now+.025);g.gain.exponentialRampToValueAtTime(.0001,now+.38);o.connect(g);g.connect(audioContext.destination);o.start(now);o.stop(now+.4);
    const o2=audioContext.createOscillator(),g2=audioContext.createGain();o2.type="sine";o2.frequency.setValueAtTime(2200,now+.12);g2.gain.setValueAtTime(.0001,now);g2.gain.setValueAtTime(Math.min(.9,.012*SE_VOLUME_MULTIPLIER),now+.12);g2.gain.exponentialRampToValueAtTime(.0001,now+.3);o2.connect(g2);g2.connect(audioContext.destination);o2.start(now);o2.stop(now+.31);
  }catch(e){}
}
function stopBgm(){if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null;}if(bossBgmAudio){bossBgmAudio.pause();try{bossBgmAudio.currentTime=0;}catch(e){}bossBgmAudio=null;}if(victoryBgmAudio){victoryBgmAudio.pause();try{victoryBgmAudio.currentTime=0;}catch(e){}victoryBgmAudio=null;}currentBgmKey="";}
function effectiveStats(c){const eq=equipment[c.id]||{};const w=itemById(eq.weapon),a=itemById(eq.armor);const defense=Math.max(0,c.defense+(a?.defenseBonus||0)-(c._defenseDownTurns>0?(c._defenseDown||0):0));return {...c,attack:c.attack+(w?.attackBonus||0),defense,spDefense:Number.isFinite(c.spDefense)?c.spDefense:Math.floor(defense/2)};}
function effectiveAttackPower(c){const stats=effectiveStats(c);return burnedTurns[c.id]>0?Math.floor(stats.attack/2):stats.attack;}
function effectiveSpAttackPower(c){return burnedTurns[c.id]>0?Math.floor(c.spAttack/2):c.spAttack;}
function getEquippedName(c,slot){const item=itemById(equipment[c.id]?.[slot]);return item?item.name:"なし";}
function statWithBonus(base,bonus){return `${base}${bonus?` <b class="stat-bonus">+${bonus}</b>`:""}`;}
function showScreen(name){const el=$(name);if(!el||!el.classList.contains("screen"))return;document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s===el));if(name!=="settings")stopPreview(false);state.screen=name;document.body.dataset.screen=name;if($("bgm-toggle")?.checked)startBgm();else stopBgm();document.querySelectorAll(".main-nav [data-screen]").forEach(b=>b.toggleAttribute("aria-current",b.dataset.screen===name));renderAll();window.scrollTo({top:0,behavior:"auto"});}
function getCharacterImage(c){return c.image?`<img src="${esc(c.image)}" alt="${esc(c.name)}" onerror="this.style.display='none';if(!this.parentElement.querySelector('.image-fallback')){const f=document.createElement('span');f.className='image-fallback';f.textContent='画像未配置';this.parentElement.appendChild(f)}">`:`<span class="image-fallback">画像準備中</span>`;}
function renderGold(){if($("gold"))$("gold").textContent=state.gold;}
function renderHome(){const box=$("home-party");if(!box)return;box.innerHTML=getParty().map(c=>`<article class="character-card home-character"><div class="character-art">${getCharacterImage(c)}</div><h3>${esc(c.name)}</h3><p>HP ${c.maxHp}　SP ${c.maxSp}</p><p>武器：${esc(getEquippedName(c,"weapon"))}</p><p>防具：${esc(getEquippedName(c,"armor"))}</p></article>`).join("");}
function renderAll(){renderHome();renderGold();renderFormation();renderShop();renderClearSummary();}
function renderClearSummary(){const summary=$("clear-gold-summary");if(!summary)return;const reward=Number(battleState.lastRewardGold)||0;summary.textContent=`魔王討伐報酬：${reward}G ／ 現在の所持金：${state.gold}G`; }
function renderFormation(){const selected=$("selected-party"),roster=$("character-roster"),count=$("party-count");if(!selected||!roster)return;if(count)count.textContent=`${state.party.length} / ${PARTY_LIMIT}`;
  selected.innerHTML=getParty().map(c=>{const s=effectiveStats(c),w=itemById(equipment[c.id].weapon),a=itemById(equipment[c.id].armor);return `<article class="character-card selected-character"><div class="character-art">${getCharacterImage(c)}</div><h3>${esc(c.name)}</h3><div class="character-stats"><span>HP ${c.maxHp}</span><span>攻撃 ${c.attack}${w?.attackBonus?` <b class="stat-bonus">+${w.attackBonus}</b>`:""}</span><span>SP攻撃 ${c.spAttack}</span><span>防御 ${c.defense}${a?.defenseBonus?` <b class="stat-bonus">+${a.defenseBonus}</b>`:""}</span><span>ガード ${Math.round(c.guardCut*100)}%</span><span>最大SP ${c.maxSp}</span></div><label class="equip-row">武器<select data-equip="weapon" data-character="${c.id}">${equipmentOptions("weapon",c.id)}</select></label><label class="equip-row">防具<select data-equip="armor" data-character="${c.id}">${equipmentOptions("armor",c.id)}</select></label><button class="secondary-button" data-remove-character="${c.id}">編成から外す</button></article>`;}).join("")||"<p>仲間候補からメンバーを選んでください。</p>";
  roster.innerHTML=characters.map(c=>{const chosen=state.party.includes(c.id),full=state.party.length>=PARTY_LIMIT;return `<article class="character-card selectable ${chosen?"selected":""}"><div class="character-art">${getCharacterImage(c)}</div><h3>${esc(c.name)}</h3><div class="character-stats"><span>HP ${c.maxHp}</span><span>攻撃 ${effectiveStats(c).attack}</span><span>防御 ${effectiveStats(c).defense}</span></div><button class="${chosen?"secondary-button":"primary-button"}" data-toggle-character="${c.id}" ${!chosen&&full?"disabled":""}>${chosen?"選択中":"編成に加える"}</button></article>`;}).join("");
  selected.querySelectorAll("[data-remove-character]").forEach(b=>b.onclick=()=>removeCharacter(b.dataset.removeCharacter));roster.querySelectorAll("[data-toggle-character]").forEach(b=>b.onclick=()=>toggleCharacter(b.dataset.toggleCharacter));selected.querySelectorAll("[data-equip]").forEach(sel=>sel.onchange=()=>equipItem(sel.dataset.character,sel.dataset.equip,sel.value));}
function equipmentOptions(slot,charId){
  const current=equipment[charId]?.[slot]||"";
  const category=slot;
  // Equipped items are removed from inventory, so always include the current item
  // in this character's selector even when its remaining inventory count is zero.
  const owned=shopItems.filter(i=>i.category===category&&(inventory[i.id]>0||i.id===current));
  return `<option value="" ${!current?"selected":""}>なし</option>`+owned.map(i=>`<option value="${i.id}" ${current===i.id?"selected":""}>${esc(i.name)}</option>`).join("");
}
function equipItem(charId,slot,newId){const c=getCharacter(charId);if(!c)return;const old=equipment[charId][slot];if(old===newId)return;if(newId&&!(inventory[newId]>0)){sound("error");return;}if(old)inventory[old]=(inventory[old]||0)+1;if(newId){inventory[newId]--;if(inventory[newId]<=0)delete inventory[newId];}equipment[charId][slot]=newId||null;renderAll();sound("select");}
function toggleCharacter(id){if(state.party.includes(id)){removeCharacter(id);return;}if(state.party.length>=PARTY_LIMIT){sound("error");return;}state.party.push(id);renderAll();sound("select");}
function removeCharacter(id){state.party=state.party.filter(x=>x!==id);renderAll();sound("back");}
function renderShop(){const box=$("shop-items");if(!box)return;const items=shopItems.filter(i=>i.category===currentCategory);box.innerHTML=items.map(i=>`<article class="shop-item"><div class="item-icon">${i.icon}</div><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><p>${esc(i.effect)}</p><p>所持数：${inventory[i.id]||0}</p><p class="price">${i.price} GOLD</p><button class="primary-button" data-buy-item="${i.id}" ${state.gold<i.price?"disabled":""}>購入する</button></article>`).join("");box.querySelectorAll("[data-buy-item]").forEach(b=>b.onclick=()=>buyItem(b.dataset.buyItem));document.querySelectorAll("[data-category]").forEach(b=>b.classList.toggle("active",b.dataset.category===currentCategory));}
function buyItem(id){const i=itemById(id);if(!i)return;if(state.gold<i.price){setSystemMessage("ゴールドが足りません。");sound("error");return;}state.gold-=i.price;inventory[id]=(inventory[id]||0)+1;renderAll();showPurchasePopup(`${i.name}を購入しました。`);sound("buy");}
function showPurchasePopup(message){const p=$("purchase-popup"),m=$("purchase-popup-message");if(!p||!m)return;clearTimeout(purchasePopupTimer);m.textContent=message;p.hidden=false;purchasePopupTimer=setTimeout(()=>p.hidden=true,2200);}
function setSystemMessage(m){if($("system-message"))$("system-message").textContent=m;}
function stopPreview(resumeBgm=true){
  const wasActive=soundtrackPreviewActive;
  soundtrackPreviewActive=false;
  if(previewAudio){previewAudio.pause();try{previewAudio.currentTime=0;}catch(e){}previewAudio=null;}
  if(previewTimer){clearInterval(previewTimer);previewTimer=null;}
  document.querySelectorAll(".track-preview").forEach(x=>{if(x.checked)x.checked=false;});
  if(resumeBgm&&wasActive&&state.screen==="settings"&&$("bgm-toggle")?.checked)startBgm();
}
function previewTrack(key){
  stopPreview(false);
  stopBgm(); // A soundtrack preview always has exclusive audio ownership.
  const toggle=document.querySelector(`.track-preview[data-track="${key}"]`);
  if(toggle)toggle.checked=true;
  soundtrackPreviewActive=true;
  if(key==="arc"||key==="overture"){
    const path=key==="arc"?"assets/music/Final%20Battle%20Arc.mp3":"assets/music/Final%20Battle%20Overture.mp3";
    previewAudio=new Audio(path);previewAudio.loop=true;previewAudio.preload="auto";previewAudio.volume=Math.min(1,.4375*BGM_VOLUME_MULTIPLIER);
    previewAudio.play().catch(()=>{if(toggle)toggle.checked=false;stopPreview(true);});
    return;
  }
  try{
    audioContext=audioContext||new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==="suspended")audioContext.resume();
    const tracks={home:{notes:[261.63,329.63,392,329.63,293.66,349.23,440,392],interval:1100,duration:1.22},normal:{notes:[220,277.18,329.63,277.18,196,246.94,293.66,246.94],interval:420,duration:.28}};
    const t=tracks[key];if(!t){stopPreview(true);return;}
    let i=0;
    previewTimer=setInterval(()=>{
      if(!toggle?.checked||!soundtrackPreviewActive){stopPreview(true);return;}
      const o=audioContext.createOscillator(),g=audioContext.createGain(),now=audioContext.currentTime;
      o.type="sine";o.frequency.setValueAtTime(t.notes[i++%t.notes.length],now);
      g.gain.setValueAtTime(Math.min(.9,(key==="home"?.04375:.05)*BGM_VOLUME_MULTIPLIER),now);g.gain.exponentialRampToValueAtTime(.0001,now+t.duration);
      o.connect(g);g.connect(audioContext.destination);o.start(now);o.stop(now+t.duration+.01);
    },t.interval);
  }catch(e){if(toggle)toggle.checked=false;stopPreview(true);}
}
function setupNavigation(){document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();showScreen(b.dataset.screen);}));document.querySelectorAll("[data-category]").forEach(b=>b.addEventListener("click",()=>{currentCategory=b.dataset.category;renderShop();sound("select");}));$("formation-done")?.addEventListener("click",()=>{if(state.party.length!==PARTY_LIMIT){setSystemMessage("仲間を4人選んでください。");sound("error");return;}showScreen("home");});$("start-button")?.addEventListener("click",()=>{if(state.party.length!==PARTY_LIMIT){$("start-warning").textContent="戦闘を始めるには仲間を4人編成してください。";sound("error");return;}startBattle();});$("se-toggle")?.addEventListener("change",()=>sound("select"));$("bgm-toggle")?.addEventListener("change",()=>{$("bgm-toggle").checked?startBgm():stopBgm();});document.querySelectorAll(".track-preview").forEach(ch=>ch.addEventListener("change",()=>{if(ch.checked)previewTrack(ch.dataset.track);else if(soundtrackPreviewActive)stopPreview(true);}));$("save-button")?.addEventListener("click",saveGame);$("load-button")?.addEventListener("click",loadGame);$("skip-button")?.addEventListener("click",()=>{battleState.fast=!battleState.fast;$("skip-button").textContent=battleState.fast?"戦闘速度：速い":"戦闘速度：通常";$("skip-button").setAttribute("aria-pressed",String(battleState.fast));setSystemMessage(battleState.fast?"戦闘演出を高速化しました。":"戦闘速度を通常に戻しました。");});$("menu-button")?.addEventListener("click",()=>showScreen("home"));$("back-button")?.addEventListener("click",()=>showScreen(state.screen==="battle"?"home":"home"));$("close-button")?.addEventListener("click",()=>setSystemMessage("ゲーム画面は閉じずに続行できます。"));}
function saveGame(){try{localStorage.setItem("fantasyRpgSave",JSON.stringify({state:{gold:state.gold,party:state.party},inventory,equipment,audioSettings:{bgmEnabled:$("bgm-toggle")?.checked??true,seEnabled:$("se-toggle")?.checked??true}}));setSystemMessage("セーブしました。");sound("select");}catch(e){setSystemMessage("セーブできませんでした。");}}
function loadGame(){try{const d=JSON.parse(localStorage.getItem("fantasyRpgSave")||"null");if(!d||!d.state||!Number.isFinite(d.state.gold)||!Array.isArray(d.state.party)||d.state.party.some(id=>!characters.some(c=>c.id===id))||d.state.party.length>PARTY_LIMIT)throw new Error("invalid save");state.gold=d.state.gold;state.party=d.state.party.slice();Object.keys(inventory).forEach(k=>delete inventory[k]);if(d.inventory&&typeof d.inventory==="object")for(const [id,count] of Object.entries(d.inventory)){if(shopItems.some(i=>i.id===id)&&Number.isFinite(count)&&count>0)inventory[id]=Math.floor(count);}Object.keys(equipment).forEach(id=>equipment[id]={weapon:null,armor:null});if(d.equipment&&typeof d.equipment==="object")for(const id of characters.map(c=>c.id)){const saved=d.equipment[id];if(!saved)continue;for(const slot of ["weapon","armor"]){const item=saved[slot];if(item&&shopItems.some(i=>i.id===item&&i.category===slot))equipment[id][slot]=item;}}if(d.audioSettings){if($("bgm-toggle")&&typeof d.audioSettings.bgmEnabled==="boolean")$("bgm-toggle").checked=d.audioSettings.bgmEnabled;if($("se-toggle")&&typeof d.audioSettings.seEnabled==="boolean")$("se-toggle").checked=d.audioSettings.seEnabled;}if($("bgm-toggle")?.checked)startBgm();else stopBgm();renderAll();setSystemMessage("ロードしました。");sound("select");}catch(e){setSystemMessage("セーブデータが不正か、存在しません。");sound("error");}}
function createEnemy(stage){
  const d=enemyData[stage-1];
  if(stage===2){
    const count=3+Math.floor(Math.random()*3);
    const members=Array.from({length:count},(_,i)=>({id:`goblin-${i+1}`,name:"ゴブリン",hp:d.hp,maxHp:d.hp,attack:d.attack,defense:d.defense,spDefense:Math.floor(d.defense/2),gold:d.gold,sprite:d.sprite,image:d.image,actionName:d.actionName,alive:true}));
    return {...d,spDefense:Math.floor(d.defense/2),members,hp:count*d.hp,maxHp:count*d.hp,gold:count*d.gold,memberCount:count};
  }
  return {...d,spDefense:Number.isFinite(d.spDefense)?d.spDefense:Math.floor(d.defense/2),hp:d.hp,maxHp:d.hp};
}
function resetTransientBattleState(){
  burnedTurns={};goblinCharging=false;goblinTeamAttackUsed=false;defenseDownFresh=new Set();lastEnemyAttackMissed=false;specialOmenShown={};
  for(const c of characters){c._defenseDown=0;c._defenseDownTurns=0;for(const key of ["_stunTurns","stunTurns","_actionDisabledTurns","actionDisabledTurns"])if(key in c)c[key]=0;for(const key of ["_stunned","stunned","actionDisabled"])if(key in c)c[key]=false;}
  battleState.wolfEvasionTurns=0;battleState.wolfLastTargetId=null;battleState.wolfClone=null;battleState.wolfCloneTurns=0;battleState.wolfCloneLastTargetId=null;battleState.tauntTarget=null;battleState.enemyStunned=false;battleState.aegisActive=false;battleState.bossBgmChoice=null;
}
function startBattle(){resetTransientBattleState();battleState.stage=1;battleState.unionGauges={kotama:0,knight:0,healer:0,warrior:0,mage:0};getParty().forEach(c=>{c.hp=c.maxHp;c.sp=c.maxSp;});beginStage();}
async function beginStage(){
  battleState.enemy=createEnemy(battleState.stage);battleState.selectedEnemyId=null;goblinCharging=false;goblinTeamAttackUsed=false;burnedTurns={};specialOmenShown={};battleState.wolfEvasionTurns=0;battleState.wolfLastTargetId=null;battleState.wolfClone=null;battleState.wolfCloneTurns=0;battleState.wolfCloneLastTargetId=null;if(battleState.stage===5)battleState.bossBgmChoice=Math.random()<.5?"arc":"overture";
  battleState.turnCount=0;
  battleState.busy=true;
  battleState.actions=[];
  battleState.consumedActors=[];
  battleState.guarding={};
  battleState.tauntTarget=null;
  battleState.enemyStunned=false;
  battleState.aegisActive=false;
  battleState.log=[];
  battleState.stageFinished=false;
  battleState.lastRewardGold=0;
  battleState.turnOrder=getParty().filter(c=>c.hp>0).map(c=>c.id);
  battleState.currentActorIndex=0;
  readyChimeKey="";
  $("battle-bottom")?.classList.remove("result-shown");
  $("battle-support").hidden=false;
  $("event-log").replaceChildren();
  $("stage-title").textContent=`STAGE ${battleState.stage} / ${battleState.maxStage}`;
  $("battle-result").hidden=true;
  $("battle-commands").hidden=false;
  $("next-stage-button").textContent="次へ";

  const arena=document.querySelector(".battle-arena");
  const isMaouStage=battleState.stage===5;
  arena?.classList.remove("maou-awaiting","maou-arrival","enemy-defeating","enemy-defeated","stage-arrival-pending");
  arena?.classList.add("stage-arrival-pending");
  if(isMaouStage)arena?.classList.add("maou-awaiting");

  showScreen("battle");
  renderBattle();
  if(battleState.stage===1)pushEvent("スライムは物理攻撃が効きにくいようだ……SP攻撃を試そう！");
  const overlay=$("stage-transition");
  if(overlay){
    const title=$("stage-transition-title");
    title.textContent=isMaouStage?"第５ステージ":`第${battleState.stage}ステージ`;
    title.dataset.text=title.textContent;
    overlay.classList.remove("playing","maou-stage","maou-clear");
    overlay.classList.toggle("maou-stage",isMaouStage);
    overlay.hidden=false;
    overlay.setAttribute("aria-hidden","false");
    void overlay.offsetWidth;
    createStageParticles(isMaouStage?"maou-stage":"stage");
    overlay.classList.add("playing");
    await new Promise(resolve=>setTimeout(resolve,isMaouStage?4600:4000));
    overlay.hidden=true;
    overlay.setAttribute("aria-hidden","true");
    overlay.classList.remove("playing","maou-stage");
  }
  if(isMaouStage&&arena){
    arena.classList.remove("stage-arrival-pending","maou-awaiting");
    arena.classList.add("maou-arrival");
    await wait(1500);
    arena.classList.remove("maou-arrival");
  }else{
    arena?.classList.remove("stage-arrival-pending");
  }
  battleState.busy=false;
  // showScreen() already selected the correct track. Do not restart it here:
  // restarting the boss MP3 after the stage intro caused the audible dip.
  $("battle-support").textContent="コマンドを選ぶと説明がここに表示されます。全員の選択後、行動が順番に再生されます。";
  pushEvent(`${battleState.enemy.name}が現れた！`);
  if(battleState.stage===4){
    await wait(1500);
    if(battleState.enemy?.name==="ドラゴン"&&!battleState.stageFinished){
      pushEvent("ドラゴンの周囲に不穏な炎が渦巻いている……！");
      specialOmenShown.dragonStart=true;
    }
  }
  renderBattle();
  renderActionMenu();
}
function createStageParticles(mode="stage"){
  const particles=$("stage-particles");
  if(!particles)return;
  particles.replaceChildren();
  const count=mode==="maou-clear"?54:mode==="maou-stage"?52:48;
  for(let i=0;i<count;i++){
    const dot=document.createElement("i");
    if(mode==="maou-stage"){
      dot.style.setProperty("--x",`${Math.random()*100}vw`);
      dot.style.setProperty("--y",`${Math.random()*100}vh`);
      dot.style.setProperty("--delay",`${Math.random()*.7}s`);
    }else if(mode==="maou-clear"){
      dot.style.setProperty("--x","50%");
      dot.style.setProperty("--y","50%");
      dot.style.setProperty("--dx",`${(Math.random()-.5)*560}px`);
      dot.style.setProperty("--dy",`${(Math.random()-.5)*460}px`);
      dot.style.setProperty("--delay",`${Math.random()*.35}s`);
    }else{
      const titleRect=$("stage-transition-title")?.getBoundingClientRect();
      const hasTitle=!!titleRect&&titleRect.width>0&&titleRect.height>0;
      const x=hasTitle?titleRect.left+Math.random()*titleRect.width:window.innerWidth*(.2+Math.random()*.6);
      const y=hasTitle?titleRect.top+Math.random()*titleRect.height:window.innerHeight*(.35+Math.random()*.3);
      // Start at the title, then send each particle to a different point across the full viewport.
      const targetX=Math.random()*window.innerWidth;
      const targetY=Math.random()*window.innerHeight;
      dot.style.setProperty("--x",`${x}px`);
      dot.style.setProperty("--y",`${y}px`);
      dot.style.setProperty("--dx",`${targetX-x}px`);
      dot.style.setProperty("--dy",`${targetY-y}px`);
      dot.style.setProperty("--delay",`${2.35+Math.random()*.35}s`);
    }
    particles.appendChild(dot);
  }
}
async function playMaouClearAnimation(){
  const overlay=$("stage-transition");
  if(!overlay)return;
  const title=$("stage-transition-title");
  title.textContent="魔王討伐";
  title.dataset.text=title.textContent;
  overlay.classList.remove("playing","maou-stage");
  overlay.classList.add("maou-clear");
  overlay.hidden=false;
  overlay.setAttribute("aria-hidden","false");
  void overlay.offsetWidth;
  createStageParticles("maou-clear");
  overlay.classList.add("playing");
  await new Promise(resolve=>setTimeout(resolve,3300));
  overlay.hidden=true;
  overlay.setAttribute("aria-hidden","true");
  overlay.classList.remove("playing","maou-clear");
}
function refreshBattleLog(){
  const currentTurn=battleState.turnCount+1;
  battleState.log=battleState.log.filter(entry=>entry.turn>=currentTurn-1&&entry.turn<=currentTurn);
  const box=$("battle-log");
  if(box){box.innerHTML=battleState.log.map(entry=>`<p>${esc(entry.message)}</p>`).join("");box.scrollTop=box.scrollHeight;}
}
function pushLog(message){
  const turn=battleState.turnCount+1;
  const last=battleState.log[battleState.log.length-1];
  if(!last||last.message!==message||last.turn!==turn)battleState.log.push({turn,message});
  refreshBattleLog();
  const m=$("battle-message");if(m)m.textContent=message;
}
function pushEvent(message,variant=""){
  const box=$("event-log");
  if(box){const p=document.createElement("p");if(variant)p.className=`event-${variant}`;p.textContent=message;box.replaceChildren(p);box.scrollTop=0;}
  pushLog(message);
}
function animateEnemyAttack(){const display=$("battle-enemy");if(!display)return;display.classList.remove("enemy-attacking");void display.offsetWidth;display.classList.add("enemy-attacking");setTimeout(()=>display.classList.remove("enemy-attacking"),700);}
function showEnemyOmen(kind="generic"){
  const lines={
    generic:["何かが起こりそうな気配がする……","不穏な空気が辺りを包む……","敵の様子が変わった……","嫌な予感がする……","周囲の空気が張り詰める……","敵から異様な気配が漂う……"],
    maou:["魔王の周囲に不気味な力が集まり始めた……","魔王の気配が、さらに禍々しくなる……","魔王の魔力が大きく揺らいでいる……","魔王の周囲に、暗い気配が渦巻く……","魔王は静かに力を蓄えている……"],
    dragon:["ドラゴンの体から熱気が立ち上る……","ドラゴンの喉元が不気味に輝き始めた……","ドラゴンの周囲に熱風が吹き荒れる……","ドラゴンが大きく息を吸い込んだ……","ドラゴンの口元に、赤い光がちらつく……"]
  };
  const list=lines[kind]||lines.generic;
  const message=list[Math.floor(Math.random()*list.length)];
  pushEvent(message,"warning");
  const display=$("battle-enemy");if(!display)return;
  const cls=kind==="maou"?"maou-ominous":"enemy-ominous";
  display.classList.remove("maou-ominous","enemy-ominous");void display.offsetWidth;display.classList.add(cls);
  clearTimeout(maouOmenTimer);maouOmenTimer=setTimeout(()=>display.classList.remove(cls),3200);
}
function showMaouOmen(){showEnemyOmen("maou");}
function displayEnemyNode(){return $("battle-enemy");}
function combatNumber(target,text,kind="damage"){const node=typeof target==="string"?document.querySelector(`[data-party-id="${target}"]`):target;if(!node)return;const n=document.createElement("span");n.className=`combat-number ${kind}`;n.textContent=text;node.appendChild(n);setTimeout(()=>n.remove(),1350);}
function flashEnemyDamage(){
  const target=$("battle-enemy")?.querySelector(".enemy-image,.enemy-placeholder");
  if(!target)return;
  target.classList.remove("damage-flash");void target.offsetWidth;target.classList.add("damage-flash");
  setTimeout(()=>target.classList.remove("damage-flash"),300);
}
async function applyPartyDamageAnimated(character,damage){
  const requested=Math.max(0,Math.floor(Number(damage)||0));
  if(!character||requested<=0||character.hp<=0)return 0;
  const previousHp=character.hp, amount=Math.min(character.hp,requested);
  character._hpBeforeDamage=previousHp;
  clearTimeout(character._hpPreviewTimer);
  character.hp=Math.max(0,character.hp-amount);
  renderBattle();
  character._hpPreviewTimer=setTimeout(()=>{delete character._hpBeforeDamage;renderBattle();},battleState.fast?0:720);
  const card=document.querySelector(`.battle-member[data-party-id="${character.id}"]`);
  const portrait=card?.querySelector(".battle-portrait");
  if(portrait){portrait.classList.remove("damage-flash");void portrait.offsetWidth;portrait.classList.add("damage-flash");setTimeout(()=>portrait.classList.remove("damage-flash"),300);}
  combatNumber(character.id,`-${amount}`,"damage");
  await wait(720);
  return amount;
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,battleState.fast?0:ms));}
function calcDamage(attack,defense,guarding=false){
  const atk=Math.max(0,Math.floor(Number(attack)||0));
  const def=Math.max(0,Math.floor(Number(defense)||0));
  const raw=atk-def;
  if(raw>0)return raw;
  if(guarding||atk<=0)return 0;
  return Math.max(1,Math.floor(atk*.1));
}
function calcPhysical(attack,defense,guarding=false){return calcDamage(attack,defense,guarding);}
function beginEnemyDamagePreview(enemy){if(!enemy)return;enemy._hpBeforeDamage=enemy.hp;clearTimeout(enemy._hpPreviewTimer);enemy._hpPreviewTimer=setTimeout(()=>{delete enemy._hpBeforeDamage;renderBattle();},battleState.fast?0:720);}
function livingEnemyMembers(enemy){return enemy?.members?enemy.members.filter(m=>m.hp>0):[];}
function getEnemyTarget(enemy,targetId=null){
  if(!enemy)return null;
  if(enemy.members){
    const living=livingEnemyMembers(enemy);
    if(targetId)return living.find(m=>m.id===targetId)||null;
    return living[0]||null;
  }
  if(enemy.name==="オオカミ"&&targetId==="wolf-clone")return battleState.wolfClone&&battleState.wolfClone.hp>0?{...battleState.wolfClone,id:"wolf-clone",name:"オオカミの分身",attack:enemy.attack,defense:enemy.defense,spDefense:Math.floor(enemy.defense/2)}:null;
  return enemy.hp>0?enemy:null;
}
function calcEnemyPhysicalDamage(enemy,attack,targetId=null){
  const target=getEnemyTarget(enemy,targetId)||enemy;
  const base=calcPhysical(attack,target.defense);
  if(target.name!=="スライム")return base;
  return base>0?Math.max(1,Math.floor(base*(target.physicalDamageRate??enemy.physicalDamageRate??.18))):0;
}
function enemyHpTotal(enemy){if(!enemy)return 0;if(enemy.members)return enemy.members.reduce((n,m)=>n+Math.max(0,m.hp),0);return Math.max(0,enemy.hp);}
function applyDamageToEnemy(enemy,amount,targetId=null,ignoreEvasion=false){
  if(!enemy||amount<=0)return 0;
  lastEnemyAttackMissed=false;
  if(enemy.members){
    const target=getEnemyTarget(enemy,targetId);if(!target)return 0;
    const dealt=Math.min(target.hp,Math.max(0,Math.floor(amount)));
    target.hp=Math.max(0,target.hp-dealt);
    target.alive=target.hp>0;
    if(target.hp<=0&&!target.defeatAnimating){
      target.defeatAnimating=true;
      setTimeout(()=>{target.defeatAnimating=false;renderBattle();},650);
    }
    enemy.hp=enemy.members.reduce((n,m)=>n+Math.max(0,m.hp),0);
    return dealt;
  }
  if(enemy.name==="オオカミ"&&targetId==="wolf-clone"){
    const clone=battleState.wolfClone;if(!clone||clone.hp<=0)return 0;
    const dealt=Math.min(clone.hp,Math.max(0,Math.floor(amount)));clone.hp=Math.max(0,clone.hp-dealt);
    if(clone.hp<=0){pushEvent("オオカミの幻影が撃破され、霧の中へ消えた！");battleState.wolfClone=null;battleState.wolfCloneTurns=0;}
    return dealt;
  }
  if(!ignoreEvasion&&enemy.name==="オオカミ"&&battleState.wolfEvasionTurns>0&&Math.random()<.85){lastEnemyAttackMissed=true;combatNumber(displayEnemyNode(),"MISS","miss");return 0;}
  const dealt=Math.min(enemy.hp,Math.max(0,Math.floor(amount)));enemy.hp=Math.max(0,enemy.hp-dealt);if(enemy.name==="オオカミ"&&enemy.hp<=0){battleState.wolfClone=null;battleState.wolfCloneTurns=0;}return dealt;
}
function calcSp(spAttack,spDefense,guarding=false){return calcDamage(spAttack,spDefense,guarding);}
function effectiveSpDefense(c){const s=effectiveStats(c);return s.spDefense;}
function currentActor(){return getCharacter(battleState.turnOrder[battleState.currentActorIndex]);}
function livingParty(){return getParty().filter(c=>c.hp>0);}
function chargeGauge(c,n=1){const u=unionSkills[c.id];if(u)battleState.unionGauges[c.id]=Math.min(u.requiredHits,(battleState.unionGauges[c.id]||0)+n);}
function renderBattle(){const e=battleState.enemy;if(!e)return;$("turn-counter").innerHTML=`第<span class="turn-number">${battleState.turnCount+1}</span>ターン　${battleState.busy?"行動処理中":"行動選択"}`;$("enemy-name").textContent=e.name;$("enemy-hp-text").textContent=`HP ${enemyHpTotal(e)} / ${e.maxHp}`;const enemyCurrentPct=enemyHpTotal(e)/e.maxHp*100;
  const aggregateHpHidden=!!e.members;$("enemy-hp-text").hidden=aggregateHpHidden;$("enemy-hp-bar").parentElement.hidden=aggregateHpHidden;
  const enemyBar=$("enemy-hp-bar");enemyBar.style.width=`${enemyCurrentPct}%`;
  let enemyTrack=enemyBar.parentElement;let enemyLoss=enemyTrack.querySelector(".hp-loss-preview");if(!enemyLoss){enemyLoss=document.createElement("div");enemyLoss.className="hp-loss-preview";enemyTrack.appendChild(enemyLoss);}const enemyBefore=Number(e._hpBeforeDamage);if(Number.isFinite(enemyBefore)&&enemyBefore>e.hp){enemyLoss.style.left=`${Math.max(0,e.hp)/e.maxHp*100}%`;enemyLoss.style.width=`${(Math.min(e.maxHp,enemyBefore)-Math.max(0,e.hp))/e.maxHp*100}%`;enemyLoss.hidden=false;}else enemyLoss.hidden=true;
  const display=$("battle-enemy"),placeholder=display.querySelector(".enemy-placeholder");
  let img=display.querySelector(".enemy-image");
  if(e.members){
    img?.remove();placeholder.hidden=true;
    let group=display.querySelector(".enemy-group");if(!group){group=document.createElement("div");group.className="enemy-group";display.prepend(group);}
    group.innerHTML=e.members.map(m=>(m.hp>0||m.defeatAnimating)?`<button type="button" class="enemy-group-unit ${m.hp<=0?"enemy-unit-defeating":""} ${battleState.selectedEnemyId===m.id?"target-selected":""} ${battleState.menuMode==="target"&&m.hp>0?"target-available":""}" data-enemy-id="${esc(m.id)}" aria-label="${esc(m.name)} ${esc(m.id.replace("goblin-",""))} HP ${m.hp}/${m.maxHp}" ${m.hp<=0?"disabled":""}><img src="${esc(m.image)}" alt="${esc(m.name)}"><span>${esc(m.id.replace("goblin-","ゴブリン "))}</span><span class="enemy-unit-hp">HP ${Math.max(0,m.hp)}/${m.maxHp}</span><span class="enemy-unit-hp-track"><i style="width:${Math.max(0,m.hp)/m.maxHp*100}%"></i></span></button>`:"").join("");
    group.querySelectorAll("[data-enemy-id]").forEach(unit=>unit.addEventListener("click",()=>{if(battleState.busy||battleState.menuMode!=="target")return;const id=unit.dataset.enemyId;if(!getEnemyTarget(e,id))return;battleState.selectedEnemyId=id;const box=$("battle-commands");const targetButton=box.querySelector(`[data-target="${id}"]`);if(targetButton)targetButton.click();else renderBattle();}));
  }else{
    display.querySelector(".enemy-group")?.remove();
    if(e.image){
      if(!img||img.dataset.enemyImage!==e.image){img?.remove();img=document.createElement("img");img.className="enemy-image";img.dataset.enemyImage=e.image;img.src=e.image;img.alt=e.name;img.onerror=()=>{img.remove();if(placeholder){placeholder.hidden=false;placeholder.textContent=({slime:"SLIME",goblin:"GOBLIN",wolf:"WOLF",dragon:"DRAGON",maou:"MAOU"})[e.sprite]||"MONSTER";};};display.prepend(img);}else img.alt=e.name;
      if(placeholder)placeholder.hidden=true;
    }else{img?.remove();if(placeholder){placeholder.hidden=false;placeholder.textContent=({slime:"SLIME",goblin:"GOBLIN",wolf:"WOLF",dragon:"DRAGON",maou:"MAOU"})[e.sprite]||"MONSTER";}}
    let clone=display.querySelector(".wolf-clone");if(e.name==="オオカミ"&&battleState.wolfClone&&battleState.wolfClone.hp>0){if(!clone){clone=document.createElement("button");clone.type="button";clone.className="wolf-clone enemy-group-unit";clone.dataset.enemyId="wolf-clone";clone.innerHTML=`<img src="${esc(e.image)}" alt="オオカミの分身"><span>オオカミの分身</span><span class="enemy-unit-hp">HP ${battleState.wolfClone.hp}/${battleState.wolfClone.maxHp}</span><span class="enemy-unit-hp-track"><i></i></span>`;display.prepend(clone);}clone.classList.toggle("target-selected",battleState.selectedEnemyId==="wolf-clone");clone.classList.toggle("target-available",battleState.menuMode==="target");clone.querySelector(".enemy-unit-hp").textContent=`HP ${battleState.wolfClone.hp}/${battleState.wolfClone.maxHp}`;clone.querySelector(".enemy-unit-hp-track i").style.width=`${battleState.wolfClone.hp/battleState.wolfClone.maxHp*100}%`;clone.onclick=()=>{if(battleState.busy||battleState.menuMode!=="target")return;const b=$("battle-commands").querySelector('[data-target="wolf-clone"]');if(b)b.click();};}else clone?.remove();
  }
  $("battle-party").innerHTML=getParty().map(c=>{const u=unionSkills[c.id],g=battleState.unionGauges[c.id]||0,ready=!!u&&g>=u.requiredHits,active=c.id===currentActor()?.id;return `<article class="battle-member ${active&&!battleState.busy?"active-turn":""} ${c.hp<=0?"dead":""} ${ready?"union-ready":""}" data-party-id="${c.id}"><div class="battle-portrait ${c.id==="healer"?"healer-portrait":c.id==="mage"?"mage-portrait":""}"><img src="${esc(c.image)}" alt="${esc(c.name)}" onerror="this.parentElement.classList.add('portrait-missing');this.remove()"></div><div class="member-head"><strong>${esc(c.name)}${burnedTurns[c.id]>0?' <span class="status-burn" title="火傷：残り'+burnedTurns[c.id]+'ターン">🔥火傷 '+burnedTurns[c.id]+'</span>':""}${c._defenseDownTurns>0?' <span class="status-down" title="防御力低下：残り'+c._defenseDownTurns+'ターン">▼防御↓ '+c._defenseDownTurns+'</span>':""}</strong><span>${c.hp<=0?"戦闘不能":active&&!battleState.busy?"> 行動選択中":""}</span></div><div class="stat-line"><span>HP ${Math.max(0,c.hp)}/${c.maxHp}</span><span>SP ${c.sp}/${c.maxSp}</span></div><div class="hp-track"><div class="hp-fill" style="width:${Math.max(0,c.hp)/c.maxHp*100}%"></div><div class="hp-loss-preview" style="left:${Math.max(0,c.hp)/c.maxHp*100}%;width:${Number.isFinite(c._hpBeforeDamage)&&c._hpBeforeDamage>c.hp?(Math.min(c.maxHp,c._hpBeforeDamage)-Math.max(0,c.hp))/c.maxHp*100:0}%" ${Number.isFinite(c._hpBeforeDamage)&&c._hpBeforeDamage>c.hp?"":"hidden"}></div></div><div class="sp-track"><div class="sp-fill" style="width:${c.sp/c.maxSp*100}%"></div></div><div class="union-mini">UNION ${g}/${u.requiredHits}<div class="union-track"><i style="width:${g/u.requiredHits*100}%"></i></div></div></article>`;}).join("");}
function renderActionMenu(){if(battleState.busy)return;const actor=currentActor(),box=$("battle-commands");if(!actor){executeTurn();return;}const uReady=unionSkills[actor.id]&&(battleState.unionGauges[actor.id]||0)>=unionSkills[actor.id].requiredHits;const chimeKey=`${battleState.stage}:${battleState.turnCount}:${actor.id}`;if(uReady&&readyChimeKey!==chimeKey){readyChimeKey=chimeKey;playReadyChime();}$("command-title").textContent=`${actor.name}　どうする？`;box.hidden=false;battleState.menuMode="main";box.innerHTML=`<button class="command-option" data-action="attack">攻撃</button><button class="command-option" data-action="skill">SPスキル</button><button class="command-option" data-action="guard">防御</button><button class="command-option" data-action="item">道具</button><div class="union-panel"><div class="window-title">ユニオンスキル</div><div class="union-list">${unionOption(actor)}</div></div>${battleState.currentActorIndex>0?'<button class="command-option back-option" data-action="back">前のキャラへ戻る</button>':''}`;
  box.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>{sound("select");const a=b.dataset.action;if(a==="attack")targetEnemy({type:"attack",actor:actor.id});else if(a==="guard")commitAction({type:"guard",actor:actor.id});else if(a==="skill")renderSkillMenu(actor);else if(a==="item")renderItemMenu(actor);else if(a==="back")undoPrevious();}));box.querySelectorAll("[data-union]").forEach(b=>b.addEventListener("click",()=>{sound("select",true);const type=b.dataset.union;if(type==="cross-break")renderPartnerMenu(actor);else commitAction({type:"union",actor:actor.id});}));$("command-hint").textContent=`${actor.name}の行動を選択してください。全員の選択後、行動が順番に再生されます。`;}
function unionOption(c){const u=unionSkills[c.id],g=battleState.unionGauges[c.id]||0;if(!u)return "";const ready=g>=u.requiredHits;return `<button class="command-option union-command ${ready?"union-command-ready":""}" data-union="${u.type}" ${ready?"":"disabled"}>${esc(u.name)} <small>${g}/${u.requiredHits}</small></button>`;}
function renderSkillMenu(actor){battleState.menuMode="skill";const box=$("battle-commands");$("command-title").textContent=`${actor.name}のSPスキル`;box.innerHTML=actor.spSkills.map(s=>`<button class="command-option" data-skill="${s.id}" ${(actor.sp<s.cost||(s.hpCost&&actor.hp<=s.hpCost))?"disabled":""}>>${esc(s.name)} <small>SP ${s.cost}${s.hpCost?` / HP ${s.hpCost}`:""}</small></button>`).join("")+`<button class="command-option back-option" data-action="back">戻る</button>`;box.querySelectorAll("[data-skill]").forEach(b=>b.onclick=()=>{const s=actor.spSkills.find(x=>x.id===b.dataset.skill);if(!s)return;sound("select");if(s.target==="enemy")targetEnemy({type:"skill",actor:actor.id,skillId:s.id});else if(s.target==="allEnemies")commitAction({type:"skill",actor:actor.id,skillId:s.id});else if(s.target==="ally"||s.target==="deadAlly")renderAllyMenu(actor,s);else commitAction({type:"skill",actor:actor.id,skillId:s.id});});box.querySelector("[data-action=back]").onclick=()=>renderActionMenu();}
function renderItemMenu(actor){battleState.menuMode="item";const owned=shopItems.filter(i=>i.kind&&(inventory[i.id]||0)>0);const box=$("battle-commands");$("command-title").textContent=`${actor.name}の道具`;if(!owned.length){box.innerHTML='<p class="empty-note">使用できるアイテムがありません。</p><button class="command-option" data-action="back">戻る</button>';box.querySelector("[data-action=back]").onclick=renderActionMenu;return;}box.innerHTML=owned.map(i=>`<button class="command-option" data-item="${i.id}">>${esc(i.name)} <small>×${inventory[i.id]}</small></button>`).join("")+`<button class="command-option" data-action="back">戻る</button>`;box.querySelectorAll("[data-item]").forEach(b=>b.onclick=()=>{const item=itemById(b.dataset.item);renderAllyMenu(actor,item,{item:true});});box.querySelector("[data-action=back]").onclick=renderActionMenu;}
function renderAllyMenu(actor,skillOrItem,opts={}){const isItem=!!opts.item;const type=isItem?skillOrItem.kind:skillOrItem.type;let targets=getParty().filter(c=>type==="revive"?c.hp<=0:type==="heal"?c.hp>0&&c.hp<c.maxHp:type==="sp"?c.hp>0&&c.sp<c.maxSp:c.hp>0);if(!targets.length){pushLog("対象にできる味方がいません。");isItem?renderItemMenu(actor):renderSkillMenu(actor);return;}const box=$("battle-commands");$("command-title").textContent=isItem?`${skillOrItem.name}：対象を選択`:`${skillOrItem.name}：対象を選択`;box.innerHTML=targets.map(c=>`<button class="command-option" data-target="${c.id}">>${esc(c.name)} <small>HP ${Math.max(0,c.hp)}/${c.maxHp}　SP ${c.sp}/${c.maxSp}</small></button>`).join("")+`<button class="command-option" data-action="back">戻る</button>`;box.querySelectorAll("[data-target]").forEach(b=>b.onclick=()=>{sound("select");commitAction(isItem?{type:"item",actor:actor.id,itemId:skillOrItem.id,target:b.dataset.target}:{type:"skill",actor:actor.id,skillId:skillOrItem.id,target:b.dataset.target});});box.querySelector("[data-action=back]").onclick=()=>isItem?renderItemMenu(actor):renderSkillMenu(actor);}
function targetEnemy(action){
  const e=battleState.enemy,box=$("battle-commands"),targets=e?.members?livingEnemyMembers(e):e?[...(e.hp>0?[e]:[]),...(e.name==="オオカミ"&&battleState.wolfClone?.hp>0?[{...battleState.wolfClone,id:"wolf-clone",name:"オオカミの分身"}]:[])]:[];
  battleState.menuMode="target";
  renderBattle();
  if(!targets.length){battleState.menuMode="main";renderActionMenu();return;}
  if(!battleState.selectedEnemyId||!targets.some(m=>m.id===battleState.selectedEnemyId))battleState.selectedEnemyId=targets[0].id||"enemy";
  document.querySelectorAll(".enemy-group-unit[data-enemy-id], .wolf-clone[data-enemy-id]").forEach(unit=>unit.classList.toggle("target-selected",unit.dataset.enemyId===battleState.selectedEnemyId));
  $("command-title").textContent="攻撃対象を選択";
  box.innerHTML=targets.map((m)=>{const id=m.id||"enemy";const label=e.members?` ${Number(String(id).match(/(\d+)$/)?.[1]||0)}`:"";return `<button class="command-option ${battleState.selectedEnemyId===id?"target-option-selected":""}" data-target="${esc(id)}">>${esc(m.name)}${label}　HP ${m.hp}/${m.maxHp}</button>`;}).join("")+`<button class="command-option" data-action="back">戻る</button>`;
  const syncTargetSelection=id=>{
    battleState.selectedEnemyId=id;
    box.querySelectorAll("[data-target]").forEach(btn=>btn.classList.toggle("target-option-selected",btn.dataset.target===id));
    document.querySelectorAll(".enemy-group-unit[data-enemy-id], .wolf-clone[data-enemy-id]").forEach(unit=>unit.classList.toggle("target-selected",unit.dataset.enemyId===id));
  };
  box.querySelectorAll("[data-target]").forEach(b=>{
    b.addEventListener("mouseenter",()=>syncTargetSelection(b.dataset.target));
    b.addEventListener("focus",()=>syncTargetSelection(b.dataset.target));
    b.onclick=()=>{const id=b.dataset.target;const target=getEnemyTarget(e,id==="enemy"?null:id);if(!target)return;syncTargetSelection(target.id||"enemy");commitAction({...action,targetId:target.id||null});};
  });
  box.querySelector("[data-action=back]").onclick=()=>{battleState.menuMode="main";renderActionMenu();};
}
function renderPartnerMenu(actor){const candidates=getParty().filter(c=>c.id!==actor.id&&c.hp>0&&unionSkills[c.id]&&(battleState.unionGauges[c.id]||0)>=unionSkills[c.id].requiredHits);const box=$("battle-commands");$("command-title").textContent="クロスブレイク：協力者";if(!candidates.length){box.innerHTML='<p class="empty-note">ユニオンゲージが満タンの協力者がいません。</p><button class="command-option" data-action="back">戻る</button>';box.querySelector("[data-action=back]").onclick=renderActionMenu;return;}box.innerHTML=candidates.map(c=>`<button class="command-option" data-partner="${c.id}">>${esc(c.name)}と連携</button>`).join("")+`<button class="command-option" data-action="back">戻る</button>`;box.querySelectorAll("[data-partner]").forEach(b=>b.onclick=()=>{sound("select",true);commitAction({type:"union",actor:actor.id,partner:b.dataset.partner});});box.querySelector("[data-action=back]").onclick=renderActionMenu;}
function commitAction(action){if(battleState.busy)return;battleState.menuMode="main";battleState.selectedEnemyId=null;const actor=getCharacter(action.actor);if(!actor||actor.hp<=0)return;battleState.actions[battleState.currentActorIndex]=action;if(action.type==="union"&&action.partner){battleState.consumedActors.push(action.partner);const pi=battleState.turnOrder.indexOf(action.partner);if(pi>=0)battleState.actions[pi]=null;}$("battle-support").textContent=`${actor.name}は「${actionLabel(action)}」を選択しました。`;battleState.currentActorIndex++;while(battleState.currentActorIndex<battleState.turnOrder.length&&(getCharacter(battleState.turnOrder[battleState.currentActorIndex])?.hp<=0||battleState.consumedActors.includes(battleState.turnOrder[battleState.currentActorIndex])))battleState.currentActorIndex++;if(battleState.currentActorIndex>=battleState.turnOrder.length){battleState.busy=true;renderBattle();$("command-title").textContent="行動を実行中…";$("battle-commands").innerHTML='<p class="command-option">味方全員の行動を開始します。</p>';setTimeout(executeTurn,250);}else{renderBattle();renderActionMenu();}}
function actionLabel(a){if(a.type==="attack")return "攻撃";if(a.type==="guard")return "防御";if(a.type==="skill")return getCharacter(a.actor).spSkills.find(s=>s.id===a.skillId)?.name||"スキル";if(a.type==="item")return `${itemById(a.itemId)?.name||"道具"} → ${getCharacter(a.target)?.name||"味方"}`;if(a.type==="union")return unionSkills[a.actor].name;return "行動";}
function undoPrevious(){if(battleState.currentActorIndex<=0)return;const idx=battleState.currentActorIndex-1;const prev=battleState.actions[idx];if(!prev)return;battleState.actions.splice(idx);battleState.currentActorIndex=idx;pushLog(`${getCharacter(prev.actor).name}の行動選択を取り消しました。`);renderBattle();renderActionMenu();sound("back");}
async function executeTurn(){
  if(!battleState.enemy){battleState.busy=false;return;}
  if(enemyHpTotal(battleState.enemy)<=0){await finishStage();return;}
  const order=battleState.actions.filter(Boolean).map((action,index)=>({action,index})).sort((a,b)=>(a.action.type==="union"?0:1)-(b.action.type==="union"?0:1)||a.index-b.index).map(x=>x.action);
  for(const action of order){
    if(enemyHpTotal(battleState.enemy)<=0)break;
    const actor=getCharacter(action.actor);
    if(!actor||actor.hp<=0||battleState.consumedActors.includes(action.actor))continue;
    await executeAction(action);
    renderBattle();
    await wait(1180);
    if(enemyHpTotal(battleState.enemy)<=0)break;
  }
  if(enemyHpTotal(battleState.enemy)<=0){await finishStage();return;}
  const resolvedTurn=battleState.turnCount+1;
  await enemyTurn();
  renderBattle();
  await wait(950);
  if(battleState.stage===5&&battleState.enemy?.name==="魔王"&&resolvedTurn===3&&!specialOmenShown.maou){showEnemyOmen("maou");specialOmenShown.maou=true;}
  const nextTurn=resolvedTurn+1;
  if(battleState.enemy?.name==="ドラゴン"&&nextTurn%3===0&&enemyHpTotal(battleState.enemy)>0&&specialOmenShown.dragonBreathTurn!==nextTurn){
    pushEvent("ドラゴンが大きく息を吸い込んでいる……！");
    specialOmenShown.dragonBreathTurn=nextTurn;
  }

  if(livingParty().length===0){finishDefeat();return;}
  battleState.turnCount++;
  refreshBattleLog();
  battleState.actions=[];
  battleState.consumedActors=[];
  battleState.turnOrder=livingParty().map(c=>c.id);
  battleState.currentActorIndex=0;
  battleState.busy=false;
  battleState.guarding={};
  renderBattle();
  renderActionMenu();
}
function showHitEffect(kind="slash",duration=520){
  const display=displayEnemyNode();if(!display)return;const fx=document.createElement("div");fx.className=`hit-effect hit-${kind}`;fx.textContent=kind==="slash"?"╱╲":kind==="flame"?"🔥":"✦";fx.style.animationDuration=`${duration}ms`;display.appendChild(fx);setTimeout(()=>fx.remove(),duration);
}
async function executeAction(a){const actor=getCharacter(a.actor),enemy=battleState.enemy;if(!actor||actor.hp<=0)return;const stats=effectiveStats(actor);if(a.type==="guard"){battleState.guarding[actor.id]=actor.guardCut;pushLog(`${actor.name}は防御の構えを取った。`);return;}if(a.type==="attack"){const target=getEnemyTarget(enemy,a.targetId);if(!target)return;const d=calcEnemyPhysicalDamage(enemy,effectiveAttackPower(actor),a.targetId);beginEnemyDamagePreview(enemy);const dealt=applyDamageToEnemy(enemy,d,a.targetId);chargeGauge(actor);if(lastEnemyAttackMissed){pushLog(`${target.name}は攻撃を回避した！`);}else{pushLog(`${actor.name}の攻撃！ ${target.name}${enemy.members?`（${target.id.replace("goblin-","") }）`:""}に${dealt}ダメージ。`);combatNumber(enemy.members?document.querySelector(`[data-enemy-id="${target.id}"]`):displayEnemyNode(),`-${dealt}`,"damage");showHitEffect("slash",actor.id==="mage"?1040:520);flashEnemyDamage();}sound("damage",true);return;}if(a.type==="skill"){const skill=actor.spSkills.find(s=>s.id===a.skillId);if(!skill||actor.sp<skill.cost||(skill.hpCost&&actor.hp<=skill.hpCost)){pushLog(`${actor.name}はスキルを使えなかった。`);return;}actor.sp-=skill.cost;if(skill.hpCost)actor.hp-=skill.hpCost;
  if(skill.type==="taunt"){battleState.tauntTarget=actor.id;chargeGauge(actor);pushLog(`${actor.name}は挑発！ 敵の攻撃を引きつける。`);return;}
  if(skill.type==="heal"){const target=getCharacter(a.target);if(!target||target.hp<=0){pushLog("回復対象がいません。");return;}const before=target.hp;target.hp=Math.min(target.maxHp,target.hp+actor.spAttack);chargeGauge(actor);pushLog(`${actor.name}のヒール！ ${target.name}のHPが${target.hp-before}回復。`);combatNumber(target.id,`+${target.hp-before}`,"heal");sound("heal");return;}
  if(skill.type==="revive"){const target=getCharacter(a.target);if(!target||target.hp>0){pushLog("蘇生対象がいません。");return;}target.hp=Math.min(50,target.maxHp);chargeGauge(actor);chargeGauge(target);pushLog(`${actor.name}の死者蘇生！ ${target.name}がHP${target.hp}で復活。`);sound("heal");return;}
  if(skill.type==="spAttack"||skill.type==="charge"){const target=getEnemyTarget(enemy,a.targetId);if(!target)return;const d=calcSp(effectiveSpAttackPower(actor),Number.isFinite(target.spDefense)?target.spDefense:Math.floor(target.defense/2));beginEnemyDamagePreview(enemy);const dealt=applyDamageToEnemy(enemy,d,a.targetId);chargeGauge(actor);if(lastEnemyAttackMissed){pushLog(`${target.name}は攻撃を回避した！`);}else{pushLog(`${actor.name}の${skill.name}！ ${target.name}${enemy.members?`（${target.id.replace("goblin-","")}）`:""}に${dealt}ダメージ。`);combatNumber(enemy.members?document.querySelector(`[data-enemy-id="${target.id}"]`):displayEnemyNode(),`-${dealt}`,"damage");showHitEffect("magic",actor.id==="mage"?1040:520);flashEnemyDamage();}sound("damage",true);return;}
  if(skill.type==="fire"){const targets=enemy.members?livingEnemyMembers(enemy):[...(enemy.hp>0?[enemy]:[]),...(enemy.name==="オオカミ"&&battleState.wolfClone?.hp>0?[{...battleState.wolfClone,id:"wolf-clone",name:"オオカミの分身",defense:enemy.defense,spDefense:Math.floor(enemy.defense/2)}]:[])];beginEnemyDamagePreview(enemy);let total=0;for(const target of targets){if(target.id==="wolf-clone"?!(battleState.wolfClone?.hp>0):target.hp<=0)continue;const d=calcSp(effectiveSpAttackPower(actor),Number.isFinite(target.spDefense)?target.spDefense:Math.floor(target.defense/2));total+=applyDamageToEnemy(enemy,d,target.id||null);combatNumber(target.id?document.querySelector(`[data-enemy-id="${target.id}"]`):displayEnemyNode(),`-${d}`,"damage");await wait(180);}chargeGauge(actor);pushLog(`${actor.name}のファイア！ 生存している敵に合計${total}ダメージ。`);showHitEffect("flame");flashEnemyDamage();sound("damage",true);return;}}
 if(a.type==="item"){const it=itemById(a.itemId),target=getCharacter(a.target);if(!it||!target||!(inventory[a.itemId]>0)||target.hp<=0){pushLog("アイテムを使用できませんでした。");return;}inventory[a.itemId]--;if(inventory[a.itemId]<=0)delete inventory[a.itemId];if(it.kind==="heal"){const before=target.hp;target.hp=Math.min(target.maxHp,target.hp+it.amount);pushLog(`${actor.name}は${it.name}を使用。${target.name}のHPが${target.hp-before}回復。`);combatNumber(target.id,`+${target.hp-before}`,"heal");sound("heal");}else{const before=target.sp;target.sp=Math.min(target.maxSp,target.sp+it.amount);pushLog(`${actor.name}は${it.name}を使用。${target.name}のSPが${target.sp-before}回復。`);combatNumber(target.id,`SP +${target.sp-before}`,"sp");sound("heal");}renderAll();return;}
 if(a.type==="union"){await executeUnion(a);}}
function clearNegativeStatuses(character){
  if(!character)return;
  // Current negative effects are managed in these existing stores.
  delete burnedTurns[character.id];
  character._defenseDown=0;
  character._defenseDownTurns=0;
  // Clear conventional per-character incapacitation counters if a future
  // status implementation adds them; no base stats or equipment are changed.
  for(const key of ["_stunTurns","stunTurns","_actionDisabledTurns","actionDisabledTurns"])if(key in character)character[key]=0;
  for(const key of ["_stunned","stunned","actionDisabled"])if(key in character)character[key]=false;
  // Keep this compatible with an optional structured status list if future
  // ailments use it; explicitly beneficial effects are never removed.
  if(Array.isArray(character.statusEffects)){
    character.statusEffects=character.statusEffects.filter(effect=>!(effect?.beneficial===false||effect?.isBeneficial===false||effect?.negative===true));
  }
  if(character.negativeStatuses&&typeof character.negativeStatuses==="object"){
    Object.keys(character.negativeStatuses).forEach(key=>delete character.negativeStatuses[key]);
  }
}
const unionPortraitFiles={kotama:"kotama.png",knight:"kishi.png",warrior:"sennshi.png",healer:"hi-ra-.png",mage:"mahoutukai.png"};
async function showUnionCutin(skill, participants){
  const layer=document.getElementById("union-cutin-layer")||document.createElement("div");
  layer.id="union-cutin-layer";
  layer.className="union-cutin-layer";
  layer.setAttribute("aria-hidden","false");
  const cards=participants.map((c,i)=>{
    const file=unionPortraitFiles[c.id];
    const portrait=file?`<img class="union-cutin-portrait" src="assets/characters/${file}" alt="">`:"";
    return `<div class="union-cutin-member" style="--member-index:${i}">${portrait}<span>${esc(c.name)}</span></div>`;
  }).join("");
  layer.innerHTML=`<div class="union-cutin-swipe"><div class="union-cutin-topline"></div><div class="union-cutin-label">UNION SKILL</div><div class="union-cutin-members">${cards}</div><div class="union-cutin-skill">${esc(skill.name)}</div><div class="union-cutin-bottomline"></div></div>`;
  if(!layer.isConnected)document.body.appendChild(layer);
  // Re-trigger animation on each use; participants appear together.
  layer.classList.remove("is-active","is-exiting");
  void layer.offsetWidth;
  layer.classList.add("is-active");
  sound("union",true);
  await wait(280);
  await wait(800);
  layer.classList.remove("is-active");
  layer.classList.add("is-exiting");
  await wait(280);
  layer.classList.remove("is-exiting");
  layer.setAttribute("aria-hidden","true");
  layer.innerHTML="";
}
async function executeUnion(a){const actor=getCharacter(a.actor),u=unionSkills[a.actor],e=battleState.enemy;if(!actor||!u||(battleState.unionGauges[actor.id]||0)<u.requiredHits){pushLog("ユニオンゲージが足りません。");return;}const participants=[actor];if(u.type==="cross-break"){const partner=getCharacter(a.partner);if(!partner||partner.hp<=0||(battleState.unionGauges[partner.id]||0)<unionSkills[partner.id].requiredHits){pushLog("協力者のユニオンゲージが不足しています。");return;}participants.push(partner);}await showUnionCutin(u,participants);if(!battleState.enemy||enemyHpTotal(battleState.enemy)<=0)return;await wait(160);if(u.type==="stun"){beginEnemyDamagePreview(e);battleState.unionGauges[actor.id]=0;applyDamageToEnemy(e,u.damage,null,true);if(lastEnemyAttackMissed){pushLog(`${e.name}は「${u.name}」を回避した！`);renderBattle();return;}battleState.enemyStunned=true;pushLog(`${actor.name}の「${u.name}」！ 確定${u.damage}ダメージ。敵の次の行動を妨害！`);combatNumber(displayEnemyNode(),`-${u.damage}`,"damage");flashEnemyDamage();sound("damage",true);}else if(u.type==="meteor"){beginEnemyDamagePreview(e);battleState.unionGauges[actor.id]=0;applyDamageToEnemy(e,u.damage,null,true);if(lastEnemyAttackMissed){pushLog(`${e.name}は「${u.name}」を回避した！`);renderBattle();return;}pushLog(`${actor.name}の「${u.name}」！ 確定${u.damage}ダメージ！`);combatNumber(displayEnemyNode(),`-${u.damage}`,"damage");flashEnemyDamage();sound("damage",true);}else if(u.type==="aegis"){battleState.aegisActive=true;battleState.unionGauges[actor.id]=0;for(const c of livingParty())c.hp=c.maxHp;pushLog(`${actor.name}の「${u.name}」！ 生存中の味方全員を全回復し、次の敵ターンを無効化！`);sound("heal");}else if(u.type==="full-heal"){
  let sp=0,revived=0;
  for(const c of getParty()){
    const wasDead=c.hp<=0, before=c.hp, beforeSp=c.sp;
    if(wasDead){c.hp=Math.max(1,Math.floor(c.maxHp*.5));revived++;}
    else c.hp=c.maxHp;
    if(c.id!==actor.id)c.sp=Math.min(c.maxSp,c.sp+40);
    const recovered=c.hp-before;
    if(c.id!==actor.id)sp+=c.sp-beforeSp;
    if(recovered>0)combatNumber(c.id,`+${recovered}`,"heal");
    clearNegativeStatuses(c);
  }
  battleState.unionGauges[actor.id]=0;
  pushLog(`${actor.name}の「${u.name}」！ 生存者のHP全回復、${revived}人蘇生、SP合計${sp}回復。状態異常も解除した！`);
  sound("heal");
}else if(u.type==="cross-break"){const partner=getCharacter(a.partner);beginEnemyDamagePreview(e);let total=0;for(let i=0;i<2;i++){const d=Math.max(1,actor.spAttack);total+=applyDamageToEnemy(e,d,null,true);if(enemyHpTotal(e)<=0)break;}if(enemyHpTotal(e)>0){const attack=effectiveStats(partner).attack;const d=calcEnemyPhysicalDamage(e,attack);for(let i=0;i<2;i++){total+=applyDamageToEnemy(e,d,null,true);if(enemyHpTotal(e)<=0)break;}}battleState.unionGauges[actor.id]=0;battleState.unionGauges[partner.id]=0;pushLog(`${actor.name}と${partner.name}の「${u.name}」！ 合計${total}ダメージ！`);combatNumber(displayEnemyNode(),`-${total}`,"damage");sound("damage",true);}
 renderBattle();}
async function applyEnemyTurnStatuses(){
  for(const c of getParty()){
    if(burnedTurns[c.id]>0){
      if(c.hp>0){
        const dealt=await applyPartyDamageAnimated(c,10);
        if(dealt>0)pushEvent(`${c.name}は火傷で${dealt}ダメージを受けた！`);
        if(c.hp<=0)pushEvent(`${c.name}は戦闘不能になった！`);
      }
      burnedTurns[c.id]--;if(burnedTurns[c.id]<=0){delete burnedTurns[c.id];pushEvent(`${c.name}の火傷が治まった。`);}
    }
    if(defenseDownFresh.has(c.id)){defenseDownFresh.delete(c.id);}else if(c._defenseDownTurns>0)c._defenseDownTurns--;
    if(c._defenseDownTurns<=0){c._defenseDown=0;c._defenseDownTurns=0;}
  }
  renderBattle();
}
function describeEnemyAction(e,turn){
  if(e?.name==="ドラゴン"&&(turn===1||turn%3===0))return "ドラゴンブレス";
  if(e?.name==="ゴブリン"&&goblinCharging)return "強打";
  if(e?.name==="魔王"&&turn===15)return "破滅の光";
  if(e?.name==="魔王"&&[4,8,12].includes(turn))return "瘴気の黒炎";
  return e?.actionName||"通常攻撃";
}
async function enemyTurn(){
  const e=battleState.enemy;
  if(!e)return;
  pushEvent("―― 敵のターン ――");
  if(battleState.enemyStunned){battleState.enemyStunned=false;pushEvent(e.name==="魔王"?"魔王はスタンして行動できなかった！":`${e.name}はスタンして行動できなかった！`);await applyEnemyTurnStatuses();return;}
  if(battleState.aegisActive){battleState.aegisActive=false;pushEvent(`${e.name}は「${describeEnemyAction(e,battleState.turnCount+1)}」を仕掛けた！`);pushEvent("イージスの盾が攻撃を防いだ！");sound("guard",true);await applyEnemyTurnStatuses();return;}
  const alive=livingParty();
  if(!alive.length)return;
  const turn=battleState.turnCount+1;
  if(e.name==="ゴブリン"&&e.members){
    const living=e.members.filter(m=>m.hp>0);
    if(living.length>=3&&!goblinTeamAttackUsed&&Math.random()<.70){
      goblinTeamAttackUsed=true;pushEvent("ゴブリンたちは連携攻撃を仕掛けた！");sound("damage",true);
      const totals={};let attacks=0;
      for(let i=0;i<living.length*3;i++){
        const targets=livingParty();if(!targets.length)break;
        const target=targets[Math.floor(Math.random()*targets.length)];
        const raw=calcPhysical(e.attack,effectiveStats(target).defense,false);
        const d=Math.floor(raw*(1-(battleState.guarding[target.id]||0)));
        const dealt=await applyPartyDamageAnimated(target,d);totals[target.name]=(totals[target.name]||0)+dealt;attacks++;
        await wait(160);
      }
      pushEvent(`連携攻撃 ${attacks}回。`);for(const [name,total] of Object.entries(totals))if(total>0)pushEvent(`${name}は合計${total}ダメージを受けた！`);
      await applyEnemyTurnStatuses();return;
    }
    goblinTeamAttackUsed=false;
  }
  if(e.name==="オオカミ"){
    if(turn===1){battleState.wolfEvasionTurns=2;pushEvent("オオカミは「警鐘」を鳴らした！ 2ターンの間、攻撃を回避しやすくなった！");await applyEnemyTurnStatuses();return;}
    if(turn>1&&battleState.wolfEvasionTurns<=0&&Math.random()<.80){battleState.wolfEvasionTurns=2;pushEvent("オオカミは再び「警鐘」を鳴らした！");await applyEnemyTurnStatuses();return;}
    if(turn===2&&!battleState.wolfClone){const cloneMaxHp=Math.max(1,Math.floor(e.hp/2));battleState.wolfClone={hp:cloneMaxHp,maxHp:cloneMaxHp,name:"幻影",id:"wolf-clone"};battleState.wolfCloneTurns=3;const arena=document.querySelector(".battle-arena");arena?.classList.add("wolf-mist");await wait(620);arena?.classList.remove("wolf-mist");pushEvent("霧の中からオオカミの幻影が現れた！");renderBattle();}
  }
  if(e.name==="ドラゴン"&&(turn===1||turn%3===0)){
    animateEnemyAttack();document.querySelector(".battle-arena")?.classList.add("dragon-breath");setTimeout(()=>document.querySelector(".battle-arena")?.classList.remove("dragon-breath"),850);pushEvent("ドラゴンは「ドラゴンブレス」を吐いた！");
    sound("damage",true);
    const targets=alive.slice();
    for(const c of targets){
      if(c.hp<=0)continue;
      const d=Math.floor(calcSp(e.spAttack||60,effectiveSpDefense(c),!!battleState.guarding[c.id])*(1-(battleState.guarding[c.id]||0)));
      await applyPartyDamageAnimated(c,d);
      if(c.hp>0&&Math.random()<.30){burnedTurns[c.id]=2;pushEvent(`${c.name}は火傷状態になった！`);renderBattle();}
    }
    await applyEnemyTurnStatuses();return;
  }
  if(e.name==="ゴブリン"&&goblinCharging){const target=alive.find(c=>c.id===battleState.tauntTarget)||alive[Math.floor(Math.random()*alive.length)];const stats=effectiveStats(target);const d=Math.floor(calcPhysical(e.attack*2.8,stats.defense,false)*(1-(battleState.guarding[target.id]||0)));goblinCharging=false;animateEnemyAttack();pushEvent(`ゴブリンの「強打」！ ${target.name}に${d}ダメージ。`);sound("damage",true);await applyPartyDamageAnimated(target,d);await applyEnemyTurnStatuses();return;}
  if(e.name==="ゴブリン"){goblinCharging=true;pushEvent("ゴブリンは棍棒を振り上げた！ 次のターンに強打が来る！");await applyEnemyTurnStatuses();return;}
  if(e.name==="魔王"&&turn===15){
    animateEnemyAttack();document.querySelector(".battle-arena")?.classList.add("maou-dark-flames");setTimeout(()=>document.querySelector(".battle-arena")?.classList.remove("maou-dark-flames"),850);
    pushEvent("魔王は「破滅の光」を放った！");sound("damage",true);
    for(const c of alive.slice())await applyPartyDamageAnimated(c,c.hp);
    pushEvent("味方全員が倒れた……。");
    await applyEnemyTurnStatuses();return;
  }
  if(e.name==="魔王"&&[4,8,12].includes(turn)){
    animateEnemyAttack();document.querySelector(".battle-arena")?.classList.add("maou-dark-flames");setTimeout(()=>document.querySelector(".battle-arena")?.classList.remove("maou-dark-flames"),850);
    pushEvent("魔王は「瘴気の黒炎」を放った！");sound("damage",true);
    for(const c of alive.slice()){
      if(c.hp<=0)continue;
      let d=calcSp(60,effectiveSpDefense(c),!!battleState.guarding[c.id]);d=Math.floor(d*(1-(battleState.guarding[c.id]||0)));
      await applyPartyDamageAnimated(c,d);
    }
    await applyEnemyTurnStatuses();return;
  }
  const taunt=alive.find(c=>c.id===battleState.tauntTarget);
  const rearIds=new Set(["mage","healer"]);
  const rear=alive.filter(c=>rearIds.has(c.id));
  let target=taunt||(e.name==="オオカミ"?(alive.find(c=>c.id===battleState.wolfLastTargetId)||rear[Math.floor(Math.random()*Math.max(1,rear.length))]||alive[Math.floor(Math.random()*alive.length)]):alive[Math.floor(Math.random()*alive.length)]);
  const stats=effectiveStats(target);
  const sp=(e.name==="魔王"&&Math.random()>=.7);
  let damage=sp?calcSp(e.spAttack||0,e.spDefense??Math.floor(e.defense/2),!!battleState.guarding[target.id]):calcPhysical(e.attack,stats.defense,!!battleState.guarding[target.id]);
  if(e.name==="オオカミ"&&battleState.wolfLastTargetId===target.id)damage*=2;
  damage=Math.floor(damage*(1-(battleState.guarding[target.id]||0)));
  animateEnemyAttack();pushEvent(`${e.name}は「${sp?"ダーククロー":(e.actionName||"攻撃")}」で攻撃した！ ${target.name}に${damage}ダメージ。`);sound("damage",true);await applyPartyDamageAnimated(target,damage);if(e.name==="スライム"&&target.hp>0){target._defenseDownTurns=5;target._defenseDown=5;defenseDownFresh.add(target.id);pushEvent(`${target.name}の防御力が下がった！`);}if(e.name==="オオカミ")battleState.wolfLastTargetId=target.hp>0?target.id:null;
  if(e.name==="オオカミ"&&battleState.wolfClone&&battleState.wolfClone.hp>0){
    battleState.wolfEvasionTurns=Math.max(battleState.wolfEvasionTurns,2);
    pushEvent("オオカミの幻影は本体に「警鐘」を響かせた！");
    const cloneTarget=livingParty().find(c=>c.id===battleState.wolfLastTargetId)||livingParty().filter(c=>rearIds.has(c.id))[0]||livingParty()[0];
    if(cloneTarget){let cd=calcPhysical(e.attack,effectiveStats(cloneTarget).defense,false);if(battleState.wolfLastTargetId===cloneTarget.id||battleState.wolfCloneLastTargetId===cloneTarget.id)cd*=2;cd=Math.floor(cd*(1-(battleState.guarding[cloneTarget.id]||0)));pushEvent(`オオカミの幻影が${cloneTarget.name}を攻撃！ ${cd}ダメージ。`);await applyPartyDamageAnimated(cloneTarget,cd);battleState.wolfCloneLastTargetId=cloneTarget.hp>0?cloneTarget.id:null;}
    battleState.wolfCloneTurns--;if(battleState.wolfCloneTurns<=0){battleState.wolfClone=null;pushEvent("オオカミの幻影は霧の中へ消えた。");}
  }
  if(battleState.wolfEvasionTurns>0)battleState.wolfEvasionTurns--;
  battleState.tauntTarget=null;
  await applyEnemyTurnStatuses();
}
async function playEnemyDefeatAnimation(){
  const arena=document.querySelector(".battle-arena"),display=$("battle-enemy"),enemy=battleState.enemy;
  if(!arena||!display)return;
  arena.classList.remove("enemy-defeating","enemy-defeated","enemy-pixel-defeating");void arena.offsetWidth;
  if(enemy?.name!=="魔王"){
    arena.classList.add("enemy-pixel-defeating");await wait(620);arena.classList.remove("enemy-pixel-defeating");arena.classList.add("enemy-defeated");
  }else{arena.classList.add("enemy-defeating");await wait(900);arena.classList.remove("enemy-defeating");arena.classList.add("enemy-defeated");}
}
async function finishStage(){
  if(battleState.stageFinished)return;
  const e=battleState.enemy;
  if(!e)return;
  battleState.stageFinished=true;
  battleState.busy=true;
  await playEnemyDefeatAnimation();
  battleState.lastRewardGold=e.gold;
  state.gold+=e.gold;
  renderGold();
  renderClearSummary();
  if(battleState.stage>=battleState.maxStage){
    await playMaouClearAnimation();
  }
  $("battle-commands").hidden=true;
  $("battle-bottom")?.classList.add("result-shown");
  $("battle-support").hidden=true;
  $("battle-result").hidden=false;
  if(battleState.stage>=battleState.maxStage){
    $("result-title").textContent="GAME CLEAR!";
    $("result-message").textContent=`魔王を倒した！ ${e.gold}Gを獲得！`;
    $("next-stage-button").hidden=false;
    $("next-stage-button").textContent="ENDINGへ";
  }else{
    $("result-title").textContent="STAGE CLEAR!";
    $("result-message").textContent=`${e.name}を倒した！ ${e.gold}Gを獲得！`;
    $("next-stage-button").hidden=false;
    $("next-stage-button").textContent="次へ";
  }
  pushLog(`${e.name}を倒した！ ${e.gold}G獲得。`);
  if($("bgm-toggle")?.checked)startBgm();
}
function finishDefeat(){
  battleState.busy=true;
  $("battle-commands").hidden=true;
  $("battle-bottom")?.classList.add("result-shown");
  $("battle-support").hidden=true;
  $("battle-result").hidden=false;
  $("result-title").textContent="DEFEAT…";
  $("result-message").textContent="仲間が全員倒れてしまった。";
  $("next-stage-button").hidden=true;
} 
function nextStage(){if(battleState.stage>=battleState.maxStage){showScreen("clear");return;}battleState.stage++;beginStage();}
function setupBattleButtons(){$("next-stage-button")?.addEventListener("click",nextStage);$("return-home-button")?.addEventListener("click",()=>showScreen("home"));}
function describeCommand(button){const hint=$("command-hint");if(!hint||!button)return;const action=button.dataset.action,skillId=button.dataset.skill,itemId=button.dataset.item,unionType=button.dataset.union,target=button.dataset.target,partner=button.dataset.partner;let text="コマンドを選択してください。";
 if(action==="attack")text="敵単体を攻撃します。基本の一撃でユニオンゲージも上昇します。";
 else if(action==="guard")text="身構えて、次に受ける攻撃のダメージを軽減します。";
 else if(action==="skill")text="SPを消費して、キャラクター固有の技を使用します。";
 else if(action==="item")text="所持している回復アイテムを使用します。";
 else if(action==="back")text="ひとつ前の選択へ戻ります。";
 else if(skillId){const actor=currentActor(),sk=actor?.spSkills.find(x=>x.id===skillId);if(sk)text=({taunt:"敵の攻撃を引きつけ、仲間を守ります。",heal:"SP攻撃力をもとに、味方1人のHPを回復します。",revive:"倒れた味方1人をHP少量で蘇生します。",spAttack:"魔力を弾丸に変え、敵単体へダメージを与えます。",charge:"HPとSPを代償に、強烈な一撃を放ちます。",fire:"炎の魔法で敵にダメージを与えます。"})[sk.type]||sk.name;}
 else if(itemId){const it=itemById(itemId);if(it)text=it.description;}
 else if(unionType){const actor=currentActor(),u=actor&&unionSkills[actor.id];if(u)text=({stun:"至高の魔弾。敵を貫き、次の行動を封じる必殺の一撃。",aegis:"イージスの大盾。仲間を全快させ、敵の次の攻撃を防ぎます。","full-heal":"フルヒーリング。仲間全員を癒やし、SPも回復します。","cross-break":"クロスブレイク。仲間と連携して連続攻撃を放ちます。",meteor:"メテオ。天より隕石を呼び、666の固定ダメージを与えます。"})[u.type]||u.name;}
 else if(target){const c=getCharacter(target);if(c)text=`${c.name}を対象に選びます。HP ${Math.max(0,c.hp)}/${c.maxHp}、SP ${c.sp}/${c.maxSp}。`;}
 else if(partner){const c=getCharacter(partner);if(c)text=`${c.name}と連携します。協力者のユニオンゲージも消費します。`;}
 hint.textContent=text;
}
let lastHoveredCommand=null, mouseFocusedCommand=null;
document.addEventListener("pointerover",e=>{
  const b=e.target.closest("#battle-commands .command-option");
  if(!b||b.disabled)return;
  if(lastHoveredCommand!==b){sound("move");lastHoveredCommand=b;}
  mouseFocusedCommand=b;
  const opts=[...($("battle-commands")?.querySelectorAll(".command-option")||[])];
  opts.forEach((x,i)=>{
    x.classList.toggle("mouse-focus",x===b);
    if(x!==b)x.classList.remove("keyboard-focus");
    else keyboardCursor=i;
  });
  describeCommand(b);
});
document.addEventListener("pointerout",e=>{
  if(!e.relatedTarget?.closest("#battle-commands .command-option")){
    lastHoveredCommand=null;
    mouseFocusedCommand=null;
    document.querySelectorAll("#battle-commands .command-option.mouse-focus").forEach(x=>x.classList.remove("mouse-focus"));
  }
});
document.addEventListener("focusin",e=>{const b=e.target.closest("#battle-commands .command-option");if(b&&!b.disabled){document.querySelectorAll("#battle-commands .command-option").forEach(x=>x.classList.toggle("keyboard-focus",x===b));describeCommand(b);}});
// Keyboard: battle commands and the post-battle confirmation buttons.
let keyboardCursor=0;
document.addEventListener("keydown",e=>{
  if(state.screen==="clear"){
    const clearButtons=[...($("clear")?.querySelectorAll("button:not(:disabled):not([hidden])")||[])];
    if((e.key==="Enter"||e.key===" ")&&clearButtons.length){
      const active=document.activeElement;
      if(active===document.body||!clearButtons.includes(active)){e.preventDefault();clearButtons[0].focus();clearButtons[0].click();}
      return;
    }
    if(["ArrowDown","ArrowUp","ArrowRight","ArrowLeft"].includes(e.key)&&clearButtons.length){
      e.preventDefault();const idx=clearButtons.indexOf(document.activeElement);clearButtons[(idx<0?0:(idx+1)%clearButtons.length)].focus();return;
    }
    return;
  }
  if(state.screen!=="battle")return;

  // The result dialog is displayed while battleState.busy remains true;
  // handle its buttons before the regular battle-input lock.
  const result=$("battle-result");
  if(result&&!result.hidden){
    const resultButtons=[...result.querySelectorAll("button:not(:disabled):not([hidden])")];
    if(!resultButtons.length)return;
    const focusedIndex=resultButtons.indexOf(document.activeElement);
    if(["ArrowDown","ArrowUp","ArrowRight","ArrowLeft"].includes(e.key)){
      e.preventDefault();
      const direction=(e.key==="ArrowDown"||e.key==="ArrowRight")?1:-1;
      const nextIndex=focusedIndex<0?0:(focusedIndex+direction+resultButtons.length)%resultButtons.length;
      resultButtons[nextIndex].focus();
      sound("move");
      return;
    }
    if(e.key==="Enter"||e.key===" "){
      e.preventDefault();
      const button=focusedIndex>=0?resultButtons[focusedIndex]:resultButtons[0];
      button.focus();
      button.click();
      return;
    }
    return;
  }

  if(battleState.busy)return;
  const opts=[...($("battle-commands")?.querySelectorAll("button:not(:disabled)")||[])];
  if(!opts.length)return;
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){
    e.preventDefault();
    keyboardCursor=(keyboardCursor+(e.key==="ArrowDown"?1:-1)+opts.length)%opts.length;
    opts.forEach((b,i)=>b.classList.toggle("keyboard-focus",i===keyboardCursor));
    sound("move");
  }else if(e.key==="Enter"||e.key===" "){
    // Always route Enter/Space to the visibly selected command. Mouse hover takes
    // priority so a stale keyboard focus cannot activate a different command.
    e.preventDefault();
    const hovered=opts.includes(mouseFocusedCommand)&&!mouseFocusedCommand.disabled?mouseFocusedCommand:null;
    const focused=document.activeElement?.closest?.("#battle-commands .command-option");
    const keyboardMarked=opts.find(b=>b.classList.contains("keyboard-focus"));
    const button=hovered||(opts.includes(focused)&&!focused.disabled?focused:null)||(keyboardMarked&&!keyboardMarked.disabled?keyboardMarked:null)||opts[keyboardCursor];
    if(button&&!button.disabled){
      keyboardCursor=opts.indexOf(button);
      opts.forEach((b,i)=>b.classList.toggle("keyboard-focus",i===keyboardCursor));
      button.click();
    }
  }else if(e.key==="Escape"){
    e.preventDefault();
    if(battleState.currentActorIndex>0)undoPrevious();else showScreen("home");
  }
});
document.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.disabled)return;if(!b.dataset.silentSound&&!b.matches("[data-action],[data-skill],[data-item],[data-target],[data-partner],[data-union]"))sound("select");if($("bgm-toggle")?.checked)startBgm();});
document.addEventListener("DOMContentLoaded",()=>{setupNavigation();setupBattleButtons();showScreen("home");renderAll();});
