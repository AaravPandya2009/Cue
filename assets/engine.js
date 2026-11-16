export const rules = [
 {id:'secret',group:'requests',weight:34,title:'Sensitive information request',pattern:/\b(?:give|tell|send|share|read|provide|confirm)\b.{0,65}\b(?:password|passcode|pin|verification code|security code|one[ -]time (?:code|password)|social security|bank details|credit card number)\b/ig,why:'Requests for account secrets or sensitive details deserve independent verification.'},
 {id:'payment',group:'requests',weight:32,title:'Unusual payment method',pattern:/\b(?:gift cards?|wire transfer|bitcoin|cryptocurrency|crypto wallet)\b/ig,why:'Unusual or hard-to-reverse payment methods can be a warning sign.'},
 {id:'remote',group:'requests',weight:30,title:'Remote access or software installation',pattern:/\b(?:remote access|anydesk|teamviewer|install (?:this |the |an? )?(?:app|software|program))\b/ig,why:'Remote access or unfamiliar software can put a device and its accounts at risk.'},
 {id:'threat',group:'tone',weight:25,title:'Threatening language',pattern:/\b(?:arrest(?:ed)?|legal action|police.{0,25}(?:come|door)|account.{0,30}(?:suspended|frozen|closed)|warrant)\b/ig,why:'Threats and consequences can be used to pressure a quick decision.'},
 {id:'urgency',group:'tone',weight:15,title:'Pressure to act quickly',pattern:/\b(?:immediately|urgent(?:ly)?|right now|act now|last chance|within (?:\d+|ten|five|thirty) minutes|do not hang up|don't hang up)\b/ig,why:'Urgency can reduce the time available to check a caller’s claims.'},
 {id:'secrecy',group:'reliability',weight:28,title:'Discourages independent verification',pattern:/\b(?:do not|don't|must not) (?:tell|contact|call|speak to|discuss).{0,45}\b(?:anyone|bank|family|police|else)\b/ig,why:'Discouraging outside advice or verification is a strong warning sign.'},
 {id:'prize',group:'requests',weight:15,title:'Prize or guaranteed return claim',pattern:/\b(?:you(?:'ve| have)? won|guaranteed (?:profit|returns?)|claim your prize|lottery winner)\b/ig,why:'Unexpected rewards and guaranteed returns need independent checking.'},
 {id:'identity',group:'reliability',weight:0,title:'Authority claim — unverified',pattern:/\b(?:calling from|represent(?:ing)?|this is).{0,30}\b(?:bank|irs|government|microsoft|amazon|police|fraud department|social security)\b/ig,why:'A claimed organization is not proof of the caller’s identity.'}
];
export function assess(text,duration=null){
 const words=text.trim().split(/\s+/).filter(Boolean).length;
 const evidence=[];
 for(const rule of rules){
  rule.pattern.lastIndex=0;let match;const occurrences=[];
  while((match=rule.pattern.exec(text))){
   const before=text.slice(Math.max(0,match.index-60),match.index);
   if(/\b(?:never|do not|don't|won't|will not|not to)\s+(?:(?:ever|ask you to|ask for|use|pay with|buy|share|request|send|provide|your|any|using|with|a|the)\s+){0,6}$/i.test(before))continue;
   occurrences.push({start:match.index,end:match.index+match[0].length});
  }
  if(occurrences.length){const first=occurrences[0];evidence.push({...rule,pattern:undefined,matchStart:first.start,matchEnd:first.end,occurrences,quote:text.slice(Math.max(0,first.start-35),Math.min(text.length,first.end+45)).trim()});}
 }
 const score=Math.min(100,evidence.reduce((sum,e)=>sum+e.weight,0));
 const insufficient=words<12;
 return {score:insufficient?null:score,words,duration,wpm:duration?Math.round(words*60/duration):null,evidence,verdict:insufficient?'Not enough context':score>=60?'High concern':score>=25?'Worth a closer look':'Few warning signs',summary:insufficient?'Add a longer transcript to assess the conversation.':score>=60?'Several potentially suspicious patterns appear in this transcript.':score>=25?'Some language deserves a second look before you act.':'Few configured warning patterns were found. This does not verify the caller.',nextStep:score>=25?'Pause before sharing information or making payments. Verify the request using a contact method you already trust.':'Consider the context and independently verify unexpected requests. A familiar voice or a low score is not proof of identity.'};
}
