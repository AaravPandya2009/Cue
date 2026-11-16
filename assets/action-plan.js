const stepsBySituation = {
  code: [
    {id:'code-contact', title:'Contact the account provider', detail:'Use its official support channel. Explain that you shared a sign-in code and ask for help securing the account.'},
    {id:'review-activity', title:'Review account activity', detail:'Check for unfamiliar sign-ins, transactions, or account changes and report them to the provider.'}
  ],
  password: [
    {id:'password-change', title:'Change exposed passwords', detail:'Use the account’s official website or app. Change the shared password and any other accounts that reuse it.'},
    {id:'password-protect', title:'Turn on two-factor authentication', detail:'Enable it in the account’s security settings. If you cannot sign in, use the provider’s official account-recovery process.'},
    {id:'review-activity', title:'Review account activity', detail:'Check for unfamiliar sign-ins, transactions, or account changes and report them to the provider.'}
  ],
  money: [
    {id:'money-contact', title:'Contact the payment provider promptly', detail:'Tell your bank, payment service, or gift-card issuer what happened. Ask about a reversal or refund; getting the money back is not guaranteed.'},
    {id:'money-records', title:'Keep payment records', detail:'Keep receipts, transaction details, and any gift cards to help the provider investigate.'}
  ],
  access: [
    {id:'device-check', title:'Get help checking your device', detail:'Use a trusted technician. Update and run your security software to check for unwanted software.'},
    {id:'review-activity', title:'Review account activity', detail:'Check for unfamiliar sign-ins, transactions, or account changes and report them to the provider.'}
  ]
};

export function buildActionPlan(selected = []) {
  const steps = new Map();
  for (const situation of selected) for (const step of stepsBySituation[situation] || []) steps.set(step.id, step);
  return [...steps.values()];
}
