import {assess as assessRules} from './engine.js';

export const pyramidExample = `Caller: We have a private income opportunity for you. Pay $500 to join our membership program.
Recipient: What would I need to sell?
Caller: There are no products to sell. You earn commissions by recruiting new members.
Caller: Recruit three friends, then have each of them recruit three more people. Your income comes from their joining fees.
Recipient: So the money depends on bringing in more people?
Caller: Exactly. Sign up today and keep recruiting to grow your income.`;

export function splitTurns(text) {
  const turns = [];
  for (const line of text.matchAll(/[^\n]+/g)) {
    const label = line[0].match(/^\s*(Caller|Recipient|Unknown)\s*:\s*/i);
    const speaker = label ? label[1].toLowerCase() : 'unknown';
    const from = label?.[0].length || 0;
    let cursor = from;
    const remainder = line[0].slice(from);
    const boundaries = [...remainder.matchAll(/[.!?](?=\s|$)/g)].map(m => from + m.index + 1);
    boundaries.push(line[0].length);
    for (const end of boundaries) {
      const raw = line[0].slice(cursor,end), leading = raw.length - raw.trimStart().length;
      if (raw.trim()) turns.push({id:`turn-${line.index+cursor+leading}`,start:line.index+cursor+leading,end:line.index+end,speaker});
      cursor = end;
    }
  }
  return turns;
}

export function speakerMask(text, turns) {
  const chars = Array(text.length).fill('\n');
  for (const turn of turns) if (turn.speaker !== 'recipient') {
    for (let i = turn.start; i < Math.min(turn.end,text.length); i++) chars[i] = text[i];
  }
  return chars.join('');
}

function hits(text, pattern, title) {
  const found = [];
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0,match.index-65),match.index);
    const lineStart = text.lastIndexOf('\n',match.index) + 1;
    const lineEnd = text.indexOf('\n',match.index);
    const line = text.slice(lineStart,lineEnd < 0 ? text.length : lineEnd);
    if (/\b(?:never|do not|don't|not to|no|not)\s+(?:(?:ever|need to|have to|ask you to|pay|buy|use|share|your|any|a|the)\s+){0,5}$/i.test(before)) continue;
    if (/\b(?:beware of|watch out for|avoid (?:any |these |a )?(?:scams?|schemes?)|lesson about|warning about)\b/i.test(line)) continue;
    found.push({start:match.index,end:match.index+match[0].length,text:match[0],title});
  }
  return found;
}

export function classifySchemes(text, baseEvidence = []) {
  const recruitment = hits(text,/\b(?:recruit(?:ing)?|bring in|sign up|enroll|invite)\b[^.!?\n]{0,55}\b(?:people|members|friends|participants|recruits|others)\b/gi,'Recruiting new participants');
  const recruitmentPay = hits(text,/\b(?:earn|paid|income|commissions?|money|profit)\b[^.!?\n]{0,65}\b(?:recruit(?:ing|ment|s)?|new members|new participants|joining fees)\b/gi,'Income tied to recruitment');
  const entryFee = hits(text,/\b(?:pay|buy|purchase)\b[^.!?\n]{0,50}\b(?:join|membership|starter kit|entry|sign up)\b|\b(?:joining|membership|entry) fees?\b/gi,'Payment to join');
  const noSales = hits(text,/\b(?:no products? to sell|no need to sell|not from product sales|rather than product sales)\b/gi,'No product sales described');
  const guaranteed = hits(text,/\b(?:guaranteed (?:profit|returns?|income)|risk[ -]free|no risk|double your money)\b/gi,'Guaranteed or risk-free returns');
  const investment = hits(text,/\b(?:invest(?:ment|ing|or)?s?|trading|deposit|crypto(?:currency)?)\b/gi,'Investment context');
  const newMoney = hits(text,/\b(?:money|deposits?|payments?) from new investors\b|\bnew investors['’]? (?:money|deposits?|payments?)\b/gi,'Money from new investors');
  const oldReturns = hits(text,/\b(?:pay|fund|cover)\b[^.!?\n]{0,40}\b(?:earlier|existing|previous|old) investors\b/gi,'Payments to earlier investors');
  const upfront = hits(text,/\b(?:upfront|advance|processing|release) fee\b|\b(?:pay|send)\b[^.!?\n]{0,40}\b(?:fee|payment)\b[^.!?\n]{0,30}\b(?:before|first)\b/gi,'Payment required first');
  const reward = hits(text,/\b(?:loan|job offer|prize|lottery|inheritance)\b/gi,'Promised benefit');
  const evidenceById = new Map(baseEvidence.map(e=>[e.id,e]));
  const fromBase = id => { const e=evidenceById.get(id); return e ? [{start:e.matchStart,end:e.matchEnd,text:text.slice(e.matchStart,e.matchEnd),title:e.title}] : []; };
  const schemes = [];
  const add = (id,label,description,why,cues,weight,source) => {
    const unique = [...new Map(cues.map(c=>[`${c.start}:${c.end}`,c])).values()].sort((a,b)=>a.start-b.start);
    schemes.push({id,label,description,why,cues:unique,weight,source});
  };
  if (recruitment.length && recruitmentPay.length && (entryFee.length || noSales.length)) {
    add('pyramid','Possible pyramid scheme','Earnings appear to depend on recruiting paying participants.','Recruitment-linked earnings plus a joining payment or absence of product sales.',[...recruitment,...recruitmentPay,...entryFee,...noSales],65,'https://www.investor.gov/protect-your-investments/fraud/types-fraud/pyramid-schemes');
  }
  if (newMoney.length && oldReturns.length) add('ponzi','Possible Ponzi scheme','The pitch describes using new investors’ money to pay earlier investors.','Both the source of new funds and payments to existing investors are stated.',[...newMoney,...oldReturns],65,'https://www.investor.gov/protect-your-investments/fraud/types-fraud/ponzi-scheme');
  if (investment.length && guaranteed.length) add('investment','Possible investment-return scam','The investment pitch makes guaranteed or risk-free return claims.','Investment language is paired with a guaranteed-return or no-risk promise.',[...investment,...guaranteed],30,'https://www.investor.gov/protect-your-investments/fraud/how-avoid-fraud/what-you-can-do-avoid-investment-fraud');
  if (upfront.length && reward.length) add('advance-fee','Possible advance-fee scheme','A fee is requested before a promised benefit arrives.','An upfront payment condition appears alongside a loan, job, prize, or inheritance.',[...upfront,...reward],30,'https://consumer.ftc.gov/articles/phone-scams');
  const identity=fromBase('identity'), secret=fromBase('secret'), payment=fromBase('payment'), threat=fromBase('threat'), remote=fromBase('remote'), prize=fromBase('prize');
  if (identity.some(c=>/bank|fraud department/i.test(c.text)) && (secret.length || payment.length || threat.length)) add('bank','Possible bank impersonation','A claimed bank identity is paired with a suspicious request or threat.','A bank claim and sensitive-information, payment, or threat language occur together.',[...identity,...secret,...payment,...threat],0,'https://consumer.ftc.gov/articles/phone-scams');
  const tech=hits(text,/\b(?:technical support|tech support|microsoft|virus|computer problem)\b/gi,'Technical-support claim');
  if (tech.length && remote.length) add('tech','Possible tech-support scam','A support claim accompanies a request for device access.','Technical-support language and a remote-access or installation request occur together.',[...tech,...remote],0,'https://consumer.ftc.gov/articles/how-spot-avoid-and-report-tech-support-scams');
  if (prize.length && (payment.length || upfront.length) && /prize|won|lottery/i.test(prize[0].text)) add('prize','Possible prize scam','A claimed prize accompanies a payment request.','Prize language is combined with a payment method or upfront fee.',[...prize,...payment,...upfront],0,'https://consumer.ftc.gov/articles/phone-scams');
  const type = schemes.some(s=>['pyramid','ponzi','investment'].includes(s.id)) ? 'Business / investment pitch' : schemes.some(s=>s.id==='bank') ? 'Account / bank-security claim' : schemes.some(s=>s.id==='tech') ? 'Technical-support claim' : schemes.some(s=>s.id==='prize') ? 'Prize / reward offer' : upfront.length&&reward.length ? 'Offer requiring an upfront payment' : secret.length ? 'Sensitive-information request' : 'Unclassified call';
  return {type,schemes};
}

export function analyzeCall(text,duration=null,turns=splitTurns(text)) {
  const masked = speakerMask(text,turns);
  const base = assessRules(masked,duration);
  const classification=classifySchemes(masked,base.evidence);
  const added = classification.schemes.filter(s=>s.weight>0).map(s=>({id:`scheme-${s.id}`,group:'scheme',weight:s.weight,title:s.label,why:s.why,matchStart:s.cues[0].start,matchEnd:s.cues[0].end,occurrences:s.cues.map(c=>({start:c.start,end:c.end})),quote:s.cues.map(c=>`“${text.slice(c.start,c.end)}”`).join(' · ')}));
  const evidence=[...base.evidence.map(e=>({...e,quote:text.slice(Math.max(0,e.matchStart-30),Math.min(text.length,e.matchEnd+45)).trim()})),...added].map(e=>({...e,speaker:turns.find(t=>e.matchStart>=t.start&&e.matchStart<t.end)?.speaker||'unknown'}));
  const score=base.score===null ? null : Math.min(100,evidence.reduce((sum,e)=>sum+e.weight,0));
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  return {...base,score,words,analyzedWords:base.words,wpm:duration?Math.round(words*60/duration):null,evidence,classification,excludedRecipientTurns:turns.filter(t=>t.speaker==='recipient'&&t.start<text.length).length,
    verdict:score===null?'Not enough caller context':score>=60?'High concern':score>=25?'Worth a closer look':'Few warning signs',
    summary:score===null?'Add more caller speech or review the speaker labels.':classification.schemes.length?'The transcript matches one or more configured scam patterns. Review the evidence and context.':base.summary,
    nextStep:score>=25?'Pause before sharing information or making payments. Independently verify the claims and the source of any promised earnings.':base.nextStep};
}

export function highlightRanges(evidence,textLength) {
  const matches=evidence.flatMap(e=>(e.occurrences||[{start:e.matchStart,end:e.matchEnd}]).map(r=>({...r,id:e.id,group:e.group}))).filter(r=>Number.isInteger(r.start)&&r.end>r.start&&r.start<textLength).map(r=>({...r,end:Math.min(r.end,textLength)}));
  const boundaries=[...new Set(matches.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b);
  const ranges=[];
  for(let i=0;i<boundaries.length-1;i++){
    const start=boundaries[i],end=boundaries[i+1],active=matches.filter(r=>r.start<end&&r.end>start);
    if(active.length)ranges.push({start,end,ids:[...new Set(active.map(r=>r.id))],group:active.some(r=>r.group==='scheme')?'scheme':active[0].group});
  }
  return ranges;
}
