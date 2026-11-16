// Advice is selected from matched cues; it does not establish that a caller is fraudulent.
export function recommendActions(result) {
  const flags = new Set(result.evidence.map(item => item.id));
  const actions = [];
  const recovery = [];
  const add = (title, detail) => actions.push({title, detail});

  if (result.score === null) {
    add('Get more context', 'Review the audio and correct the transcript, or add a longer excerpt before drawing conclusions.');
  } else if (result.evidence.some(item => item.weight > 0)) {
    add('Pause before you act', 'If you’re still on a call that feels suspicious, hang up. Don’t let urgency decide for you.');
  } else {
    add('Keep the result in perspective', 'A low score is not proof of safety. Check unexpected requests even when no warning patterns match.');
  }

  add('Verify independently', 'Call the organization using its official website or the number on your card, not a number the caller provides.');

  if (flags.has('secret')) {
    add('Keep passwords and codes private', 'Don’t read out a password, PIN, or sign-in code to an unexpected caller.');
    recovery.push('If you shared a password, change it and any reused passwords. If you shared a code, contact the account provider through its official support channel.');
  }
  if (flags.has('payment') || flags.has('prize')) {
    add('Stop and check payment requests', 'Don’t send money or gift-card codes to resolve an unexpected demand or collect a prize.');
    recovery.push('If you paid, promptly contact the bank, payment service, or gift-card issuer. Explain what happened and ask about reversal or refund options; recovery is not guaranteed.');
  }
  if (flags.has('remote')) {
    add('Decline remote access', 'Don’t install software or grant device access at an unexpected caller’s request.');
    recovery.push('If you granted device access, seek help from a trusted technician and update and run your security software. Review your accounts for unauthorized activity.');
  }
  if (flags.has('scheme-pyramid')) {
    add('Check where earnings come from', 'Pause joining payments and recruitment. Ask whether earnings come from sales to customers or fees paid by new members, and independently check the business.');
  }
  if (flags.has('scheme-ponzi') || flags.has('scheme-investment')) {
    add('Research the investment independently', 'Verify the seller and investment using official regulator resources. Do not rely on guaranteed-return claims.');
  }
  if (flags.has('scheme-advance-fee')) {
    add('Verify the offer before paying a fee', 'Independently confirm the promised loan, job, or reward before sending money.');
  }
  if (flags.has('secrecy')) {
    add('Get a second opinion', 'Talk to someone you trust before acting on a request to keep the call secret.');
  }
  return {actions, recovery, guidanceSources: [...(result.classification?.schemes||[]).map(s=>s.source), 'https://consumer.ftc.gov/articles/phone-scams', 'https://consumer.ftc.gov/articles/what-do-if-you-were-scammed']};
}
