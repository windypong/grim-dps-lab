(function(root){
const SLOTS=[['main','주무기','신화적인 서약운반자','Mythical Oathbearer'],['off','보조 무기','신화적인 서약운반자','Mythical Oathbearer'],['head','머리','풀려버린 운명의 시선','Gaze of Fates Unwound'],['chest','가슴','신화적인 코르보란의 흉갑',"Mythical Korvoran’s Chestguard"],['shoulders','어깨','빈의 견갑','Vinn’s Pauldrons'],['gloves','장갑','역병보호 장갑','Plagueguard Grips'],['pants','바지','솔라엘 교파 다리보호대','Solael-Sect Legguards'],['boots','신발','용기의 전쟁부츠','Intrepid Warboots'],['belt','허리','신화적인 의심스러운 수단의 꾸러미','Mythical Pack of Treacherous Means'],['amulet','목걸이','실바리아의 뿌리','Sylvarria’s Root'],['ring1','반지 1','칼날 비트는 자의 인장','Bladetwister Signet'],['ring2','반지 2','신화적인 돌의 테인의 인장','Mythical Sigil of the Stone Thane'],['medal','메달','신화적인 무서운 늑대의 문장','Mythical Direwolf Crest'],['relic','유물','평온','Serenity']];
const PARTS=[['item','본체'],['prefix','접두사'],['suffix','접미사'],['component','컴포넌트'],['augment','증강제'],['ascension','승천 옵션']];
const FIELDS=[
 ['공격 기반', [['flat_physical','물리 기본 피해'],['flat_pierce','관통 기본 피해'],['flat_fire','화염 기본 피해'],['flat_cold','냉기 기본 피해'],['flat_lightning','번개 기본 피해'],['flat_elemental','원소 기본 피해 (3등분)'],['flat_acid','산성 기본 피해'],['flat_vitality','생명력 기본 피해'],['flat_aether','에테르 기본 피해'],['flat_chaos','카오스 기본 피해']]],
 ['피해 증가 · 능력', [['inc_pierce','관통 피해 +%'],['incAll','모든 피해 +%'],['incElemental','원소 피해 +%'],['oa','공격 능력 +'],['oaPct','공격 능력 +%'],['crit','치명타 피해 +%p'],['attackSpeed','공격 속도 +%p'],['da','방어 능력 +'],['daPct','방어 능력 +%'],['hp','체력 +'],['hpPct','체력 +%']]],
 ['관통 전환 · 스킬 계수', [['conv_elemental','원소 → 관통 %'],['conv_cold','냉기 → 관통 %'],['conv_lightning','번개 → 관통 %'],['conv_fire','화염 → 관통 %'],['conv_physical','물리 → 관통 %'],['armorPiercing','무기 자체 Armor Piercing %'],['armorPiercingPct','Armor Piercing 증가 +%'],['darWD','맹공격 무기 피해 +%p'],['wd_storm','폭풍 분사 무기 피해 +%p'],['wd_cold','냉각성 탄환 무기 피해 +%p'],['wd_fang','피의 송곳니 무기 피해 +%p'],['wd_burst','폭발성 탄환 무기 피해 +%p'],['chance_storm','폭풍 분사 발동률 +%p'],['chance_cold','냉각성 탄환 발동률 +%p'],['chance_fang','피의 송곳니 발동률 +%p'],['chance_burst','폭발성 탄환 발동률 +%p']]],
 ['그 외 피해 증가', [['inc_physical','물리 피해 +%'],['inc_fire','화염 피해 +%'],['inc_cold','냉기 피해 +%'],['inc_lightning','번개 피해 +%'],['inc_acid','산성 피해 +%'],['inc_vitality','생명력 피해 +%'],['inc_aether','에테르 피해 +%'],['inc_chaos','카오스 피해 +%'],['conv_acid','산성 → 관통 %'],['conv_vitality','생명력 → 관통 %'],['conv_aether','에테르 → 관통 %'],['conv_chaos','카오스 → 관통 %']]]
];
const FIELD_LABELS=Object.fromEntries(FIELDS.flatMap(g=>g[1]));
const SOURCES=[
 ['아이템 공개 추출 DB','첫 실행에 내려받는 장비·접사·부품·증강제·유물 데이터','https://github.com/tednaleid/grimdawn-devotions'],
 ['아이템 데이터 스키마','원본 옵션, 적용 부위, 피해 전환, 스킬 보너스 테이블 설명','https://github.com/tednaleid/grimdawn-devotions/blob/main/docs/item-schema.md'],
 ['Crate 공식 전투 가이드','OA·DA, 치명타 구간, 무기별 고정 피해, 전환, 흡수 처리 순서','https://www.grimdawn.com/guide/gameplay/combat/'],
 ['DPYes 제작자 설명 · 17k','누적 피해, JSON 기록, 약 5초 평균에 대한 설명','https://forums.crateentertainment.com/t/tool-dpyes-player-pet-dps-meter-misc-util/133378/571'],
 ['DPYes 제작자 · 경감 전/후','Track damage after mitigation 설정의 의미','https://forums.crateentertainment.com/t/tool-dpyes-player-pet-dps-meter-misc-util/133378?page=27'],
 ['발동 사격 계산 · 커뮤니티 실험','기본 공격 대체기와 발동 사격의 계수·발동 비중 모델','https://forums.crateentertainment.com/t/turbo-charge-your-auto-attacks-with-default-attack-replacers-and-wps/49376'],
 ['전투 동작 검증 · 1.3.0.8','공격별 동작 시간은 같지 않습니다. 실제 시간으로 보정하세요.','https://forums.crateentertainment.com/t/1-3-0-8-fangs-of-asterkarn-in-depth-mechanics-testing/159559'],
 ['GrimTools','실제 장비 옵션과 패치별 수치의 수동 확인','https://www.grimtools.com/db/ko/']
];
function blankPart(name=''){return {name,enabled:true,stats:{}};}
function equipment(){const out={};for(const [id,,name]of SLOTS)out[id]={enabled:true,reviewed:false,notes:'',parts:Object.fromEntries(PARTS.map(([p])=>[p,blankPart(p==='item'?name:'')]))};return out;}
function state(demo=true){
 const s={schema:'grim-dps-lab/v1',meta:{name:demo?'서약운반자 실험 · 데모':'서약운반자 · 내 장비',demo,gameVersion:'직접 확인 필요',note:''},base:{},equipment:equipment(),buffs:[],combat:{dual:true,darName:'맹공격',darWD:220,darFlat:{flat_cold:188},skillConversion:{conv_cold:100},totalDamageModifier:0,basicCycleMs:333,referenceSpeed:200,speedCap:200,timingMode:'cycles',measuredAPS:2.5,uptime:85},target:{name:'사용자 지정 단일 대상',da:3000,daReduction:0,resistMode:'final',resists:{physical:20,pierce:-70,fire:50,cold:50,lightning:50,acid:50,vitality:50,aether:50,chaos:50,bleed:30},rr:[],armor:0,armorAbsorption:70,absorption:0,flatAbsorption:0,avoidance:0},wps:[
 {id:'fang',name:'피의 송곳니',enabled:true,chance:26,wd:90,hitsMain:2,hitsOff:2,cycleMs:390,flat:{flat_pierce:100},conversion:{}},
 {id:'cold',name:'냉각성 탄환',enabled:true,chance:21,wd:75,hitsMain:2,hitsOff:2,cycleMs:460,flat:{flat_cold:110},conversion:{}},
 {id:'storm',name:'폭풍 분사',enabled:true,chance:23,wd:43,hitsMain:3,hitsOff:3,cycleMs:410,flat:{flat_lightning:120},conversion:{}},
 {id:'burst',name:'폭발성 탄환',enabled:true,chance:22,wd:125,hitsMain:1,hitsOff:1,cycleMs:370,flat:{flat_fire:170},conversion:{}}
 ],extras:[],duration:60,seed:37};
 if(demo){
  s.base={flat_pierce:300,inc_pierce:2200,oa:3400,crit:71,attackSpeed:100,conv_elemental:100,da:3200,hp:20000};
  for(const [id]of SLOTS){s.equipment[id].parts.item.name='';s.equipment[id].reviewed=true;}
  for(const h of ['main','off']){s.equipment[h].parts.item={name:'예제 권총 '+(h==='main'?'A':'B'),enabled:true,stats:{flat_physical:110,armorPiercing:100}};}
  s.meta.note='기초 피해 410, 관통 증가 2200%, 공격 능력 3400을 가정한 작동 예제. 실제 서약운반자 아이템 데이터가 아닙니다.';
 }else{
  s.base={oa:1};s.combat.darWD=210;s.combat.skillConversion={};
  const comp=['칼날의 문장','칼날의 문장','무지개빛 다이아몬드','살아있는 갑옷','신성한 판금','봉헌된 천','비늘달린 통가죽','모그드로젠의 표식','우그덴늪 가죽','섬멸의 문장','피에 물든 크리스탈','피에 물든 크리스탈','룬새겨진 토파즈',''];
  SLOTS.forEach(([id],i)=>{s.equipment[id].parts.component.name=comp[i];});
  for(const h of ['main','off'])s.equipment[h].parts.augment.name='래비저의 눈동자';
  for(const h of ['amulet','ring1','ring2'])s.equipment[h].parts.augment.name='제련 부산물 가루';
  const aff={shoulders:['무자비한','드란구울의'],gloves:['무자비한','아마라스타의 날렵함의'],pants:['가공할','생명력의'],boots:['벼락맞은','왕의'],amulet:['잔인성의','완비의']};
  for(const[h,v]of Object.entries(aff)){s.equipment[h].parts.prefix.name=v[0];s.equipment[h].parts.suffix.name=v[1];}
  s.meta.note='이름만 채워진 입력 템플릿입니다. 장비·버프·스킬의 실제 수치를 확인해야 합니다. 아래 공격 계수도 예제 참조값입니다.';
 }
 return s;
}
const LIBRARY=SLOTS.map(([slot,,name,en],i)=>({id:'template-'+i,name,en,part:'item',slots:slot.startsWith('ring')?['ring1','ring2']:slot==='main'||slot==='off'?['main','off']:[slot],stats:{},status:'이름 템플릿 · 수치 미입력',note:'실제 롤·스킬 변경을 확인해 직접 입력하세요. 전체 게임 DB 자동 연동이 아닙니다.'}));
for(const [name,part]of [['칼날의 문장','component'],['평온','item'],['아마라스타의 날렵함의','suffix'],['왕의','suffix'],['생명력의','suffix'],['완비의','suffix'],['무자비한','prefix'],['가공할','prefix'],['벼락맞은','prefix'],['잔인성의','prefix'],['래비저의 눈동자','augment']])LIBRARY.push({id:'named-'+LIBRARY.length,name,en:'',part,slots:[],stats:{},status:'이름 템플릿 · 수치 미입력',note:'패치별 실제 수치를 입력하여 개인 라이브러리에 저장하세요.'});
LIBRARY.push({id:'powder-ref',name:'제련 부산물 가루',en:'Steelbloom Powder',part:'augment',slots:['amulet','ring1','ring2'],stats:{flat_pierce:10,inc_pierce:50,da:70},status:'공격 관련 참조값 · 현재 롤 확인',note:'관통 10 / 관통 증가 50% / 방어 능력 70. 일부 지원 수치만 포함한 참조 항목입니다. 다른 효과·현재 패치는 직접 확인하세요.',url:'https://forums.crateentertainment.com/t/grim-dawn-version-1-1-3-0/82956'});
root.DATA={SLOTS,PARTS,FIELDS,FIELD_LABELS,SOURCES,LIBRARY,state,blankPart};
if(typeof module!=='undefined'&&module.exports)module.exports=root.DATA;
})(typeof globalThis!=='undefined'?globalThis:this);
