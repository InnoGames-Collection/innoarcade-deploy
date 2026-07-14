// Account screen + subscription flow + feedback survey.
//
// Self-contained like signin.ts / wallet.ts: injects its own markup and styles
// and speaks only to the subscription / auth / payments modules. Opened from the
// bottom-nav "Account" tab. Strings are inline EN/AM.

import { getLang } from '../i18n';
import { currentUser, signOut, type AuthUser } from '../platform/auth';
import { openSignIn } from './signin';
import {
  SUB_PLANS, currentSub, trialAvailable, subscribe, loadSubscription,
  isSubscribePending,
  type SubPeriod,
} from '../platform/subscription';
import { paymentMethodsEnabled } from '../platform/config';
import { PAY_METHOD_LABEL, type PayMethod } from '../platform/payments';
import { fetchReferral, redeemReferralRemote } from '../platform/backend';
import { balance } from '../platform/wallet';

const STR = {
  en: {
    account: 'Account', back: 'Close', signedOut: 'Not signed in', signIn: 'Sign in', signOut: 'Sign out',
    premium: 'Premium', expiresIn: 'Renews in', daysLeft: 'days left', notSub: "You're not subscribed yet",
    subscribeNow: 'Subscribe now', choosePlan: 'Choose your plan', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
    perDay: 'Charged once a day', perWeek: 'Charged once a week', perMonth: 'Charged once a month',
    freeTrial: '1-day free trial for first-time subscribers', subWith: 'Subscribe with', cancel: 'Cancel subscription',
    payVia: 'Pay with', confirm: 'Confirm', subbed: "You're subscribed!", general: 'General info',
    terms: 'Terms & conditions', faq: 'FAQ', feedback: 'Write your feedback', rateQ: 'How would you rate your experience?',
    submit: 'Submit', thanks: 'Thanks for your feedback!', close: 'Close', active: 'Active plan',
    myEntries: 'My draw entries', tickets: 'tickets', failed: "Couldn't complete. Try again.",
    invite: 'Invite friends', inviteSub: 'Share your code — you both get coins!', yourCode: 'Your code',
    copy: 'Copy', copied: 'Copied!', share: 'Share', haveCode: 'Have a friend’s code?',
    enterCode: 'Enter code', redeem: 'Redeem', refOk: '🎉 +10 coins! Your friend got 20.',
    refAlready: 'You’ve already redeemed a code.', refInvalid: 'That code isn’t valid.', refSelf: 'You can’t use your own code.',
  },
  am: {
    account: 'መለያ', back: 'ዝጋ', signedOut: 'አልገቡም', signIn: 'ግባ', signOut: 'ውጣ',
    premium: 'ፕሪሚየም', expiresIn: 'ይታደሳል በ', daysLeft: 'ቀናት ቀርተዋል', notSub: 'እስካሁን አልተመዘገቡም',
    subscribeNow: 'አሁን ይመዝገቡ', choosePlan: 'ዕቅድ ይምረጡ', daily: 'ዕለታዊ', weekly: 'ሳምንታዊ', monthly: 'ወርሃዊ',
    perDay: 'በቀን አንዴ ይከፈላል', perWeek: 'በሳምንት አንዴ ይከፈላል', perMonth: 'በወር አንዴ ይከፈላል',
    freeTrial: 'ለመጀመሪያ ጊዜ ለሚመዘገቡ የ1-ቀን ነጻ ሙከራ', subWith: 'ይመዝገቡ በ', cancel: 'ምዝገባ ሰርዝ',
    payVia: 'ይክፈሉ በ', confirm: 'አረጋግጥ', subbed: 'ተመዝግበዋል!', general: 'አጠቃላይ መረጃ',
    terms: 'ውሎች እና ሁኔታዎች', faq: 'ተደጋጋሚ ጥያቄዎች', feedback: 'አስተያየትዎን ይጻፉ', rateQ: 'ተሞክሮዎን እንዴት ይገመግሙታል?',
    submit: 'አስገባ', thanks: 'ስለ አስተያየትዎ እናመሰግናለን!', close: 'ዝጋ', active: 'ንቁ ዕቅድ',
    myEntries: 'የእኔ ዕጣ ግቤቶች', tickets: 'ቲኬቶች', failed: 'አልተጠናቀቀም። እንደገና ይሞክሩ።',
    invite: 'ጓደኞችን ይጋብዙ', inviteSub: 'ኮድዎን ያጋሩ — ሁለታችሁም ሳንቲም ታገኛላችሁ!', yourCode: 'የእርስዎ ኮድ',
    copy: 'ቅዳ', copied: 'ተቀድቷል!', share: 'አጋራ', haveCode: 'የጓደኛ ኮድ አለዎት?',
    enterCode: 'ኮድ ያስገቡ', redeem: 'ይቤዡ', refOk: '🎉 +10 ሳንቲም! ጓደኛዎ 20 አግኝቷል።',
    refAlready: 'ኮድ አስቀድመው ተቀብለዋል።', refInvalid: 'ይህ ኮድ ትክክል አይደለም።', refSelf: 'የራስዎን ኮድ መጠቀም አይችሉም።',
  },
};

// Full GoPlay Terms & Conditions. Legal copy is authoritative in English, so it
// renders the same in both UI languages. Authored HTML (no user input) — safe to
// inject. Per-game rules live under section 5; ⚠️ marks chance/high-risk games.
const G = (title: string, body: string): string =>
  `<h4 class="tc-game">${title}</h4>${body}`;
const UL = (items: string[]): string => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

const TERMS_HTML = `
  <h3>GoPlay Terms &amp; Conditions</h3>

  <h4>1. Acceptance of Terms</h4>
  <p>By accessing or using the GoPlay platform, including all games, features, and services, the user agrees to be bound by these Terms &amp; Conditions. If the user does not agree, they must stop using the platform immediately.</p>

  <h4>2. Eligibility</h4>
  ${UL([
    'Users must meet the minimum legal age required in their jurisdiction (or have guardian consent where applicable).',
    'The platform may restrict access to certain games based on age, region, or compliance requirements.',
    'Users are responsible for ensuring their use is legally permitted in their location.',
  ])}

  <h4>3. Account Registration &amp; Security</h4>
  ${UL([
    'Users must provide accurate and complete information during registration.',
    'Each user is responsible for maintaining confidentiality of account credentials.',
    'Any activity under an account is considered the responsibility of the account holder.',
    'GoPlay is not liable for losses due to unauthorized account access caused by user negligence.',
  ])}

  <h4>4. License to Use Platform</h4>
  <p>GoPlay grants users a limited, non-transferable, non-exclusive license to access and use the platform for personal entertainment purposes only. Users are prohibited from:</p>
  ${UL([
    'Copying, modifying, or reverse engineering any part of the platform',
    'Using bots, scripts, or automation tools',
    'Exploiting bugs or vulnerabilities for advantage',
  ])}

  <h4>5. Games and Gameplay Rules</h4>
  ${UL([
    'Each game has its own mechanics, scoring system, and rules which must be followed.',
    'GoPlay reserves the right to modify game rules, features, or availability at any time.',
    'Abuse of gameplay systems (including exploitation of glitches) may result in penalties or account suspension.',
  ])}

  ${G('5.1 Candy Blast', `
    <p>Users shall require five (5) Coins to initiate a single Candy Blast game session. Upon successful deduction of Coins, the user shall participate in a match-3 puzzle gameplay session. The objective is to strategically match three or more identical candies, form combinations, and achieve the highest possible score within the limited number of moves.</p>
    <p><strong>5.1.1 Scoring Mechanism.</strong> The final score is automatically computed based on: (a) number of candies matched; (b) special candy combinations created; (c) cascading chain reactions; (d) remaining moves; (e) bonus multipliers and in-game achievements. The computed score is final and system authoritative.</p>
    <p><strong>5.1.2 Rewards.</strong> Rewards may be granted based on performance tiers, including bonus Coins, airtime packages, and data bundles. Reward allocation is system-controlled and may be adjusted.</p>
    <p><strong>5.1.3 Tournament Mode.</strong> Periodic tournaments may be conducted (daily/weekly/monthly). Rankings are determined by highest valid score per user during the tournament period.</p>
    <p><strong>5.1.4 Prize Distribution.</strong> Tournament rewards may include telecom rewards and physical prizes. Winners are selected based on ranking or randomized draw mechanisms defined per campaign.</p>`)}

  ${G('5.2 Temple Run', `<p>An endless runner survival game; avoid obstacles by jumping, sliding, and lane switching. The objective is to survive as long as possible while accumulating distance-based score. Scoring is based on distance traveled, obstacles avoided, coin collection, and a survival-time multiplier. No guaranteed rewards are issued; rewards (if enabled) are performance-based and subject to campaign rules.</p>`)}

  ${G('5.3 Ball Shooter', `<p>Fire projectiles at rotating or moving targets by timing shots accurately. Scoring depends on targets hit, accuracy percentage, combo streaks, and a level-completion bonus. Rewards, if enabled, follow predefined performance tiers and may include bonus coins or promotional prizes.</p>`)}

  ${G('5.4 Lucky Slot <span class="tc-risk">⚠️ HIGH RISK</span>', `
    <p>Users initiate a spin session by consuming Coins. The slot machine generates outcomes based on a predefined probability model, determined by a Random Number Generator (RNG) system.</p>
    <p><strong>5.4.1 Outcome Types:</strong> no win; coin win; bonus reward; jackpot event (rare, probability-controlled).</p>
    <p><strong>5.4.2 Compliance Note.</strong> All probabilities must be pre-defined, auditable, and non-modifiable per session. Failure to enforce this constitutes a gambling-classification risk.</p>`)}

  ${G('5.5 2048', `<p>Slide numbered tiles on a grid; matching tiles merge into higher values. The objective is to reach the target tile (e.g., 2048 or higher). Scoring depends on highest tile achieved, total merges, and move efficiency.</p>`)}

  ${G('5.6 Metro Rush', `<p>Control a character running through a track filled with obstacles and trains. Scoring is based on distance covered, obstacles avoided, and coin collection.</p>`)}

  ${G('5.7 Memory Match', `<p>Flip cards to find matching pairs within limited moves. Scoring depends on the number of moves used, completion time, and accuracy efficiency.</p>`)}

  ${G('5.8 Dice Roll', `<p>Roll virtual dice to generate outcomes. Scoring depends on matching pairs (doubles, triples), total roll outcomes, and bonus combinations. <span class="tc-risk">⚠️</span> If rewards are attached, this becomes a chance-based system and must be carefully controlled.</p>`)}

  ${G('5.9 Lucky Box <span class="tc-risk">⚠️ HIGH RISK</span>', `<p>Select a closed box to reveal a hidden outcome. Outcomes are pre-defined reward tiers controlled by system probability distribution.</p>`)}

  ${G('5.10 Spin Wheel <span class="tc-risk">⚠️ HIGH RISK</span>', `<p>Spin a wheel to determine outcomes. Wheel segments correspond to predefined reward probabilities. The system must ensure fixed probability mapping and no dynamic manipulation per user behavior.</p>`)}

  ${G('5.11 Ethiopian Quiz', `<p>Answer multiple-choice questions related to general knowledge. Scoring: correct answers; optional speed bonus; difficulty multiplier.</p>`)}

  ${G('5.12 Sudoku', `<p>Classic number-placement puzzle ensuring no repetition across rows, columns, and subgrids. Scoring based on completion time, hint usage, and error rate.</p>`)}

  ${G('5.13 Fruit Slice', `<p>Swipe to slice objects while avoiding bombs. Scoring based on objects sliced, combo streaks, and bomb-avoidance accuracy.</p>`)}

  ${G('5.14 Target 24', `<p>Combine numbers using arithmetic operators to reach the value 24. Scoring based on correct solutions, time efficiency, and attempt count.</p>`)}

  ${G('5.15 Candy Saga', `<p>Match-3 puzzle similar to Candy Blast but with level-based objectives.</p>`)}

  ${G('5.16 Dot Link', `<p>Connect same-colored dots without crossing paths. Scoring based on completion efficiency and move optimization.</p>`)}

  ${G('5.17 Brick Blitz', `<p>Classic paddle-and-ball brick breaker. Scoring based on bricks destroyed, combo rebounds, and survival time.</p>`)}

  ${G('5.18 Sky Hopper', `<p>Vertical platform-jumping survival game. Scoring: height reached, platforms landed, survival duration.</p>`)}

  ${G('5.19 Tap Game', `<p>Tap rapidly within a time limit. Scoring: tap count, accuracy rate, speed consistency.</p>`)}

  ${G('5.20 Spell Quiz', `<p>Spell words correctly from clues. Scoring: accuracy and time efficiency.</p>`)}

  ${G('5.21 Vocabulary Trivia', `<p>Select correct word meanings. Scoring: correct answers and difficulty multiplier.</p>`)}

  ${G('5.22 Rhyme Time', `<p>Identify rhyming words.</p>`)}

  ${G('5.23 Cross Sum', `<p>Fill the grid so rows and columns match target sums.</p>`)}

  ${G('5.24 Logic Grid', `<p>Deductive-reasoning puzzle using clues to solve grid relationships.</p>`)}

  ${G('5.25 Sequence', `<p>Identify the next item in a pattern sequence.</p>`)}

  ${G('5.26 Scratch Card <span class="tc-risk">⚠️ HIGH RISK</span>', `<p>Scratch a virtual card to reveal hidden outcomes. The outcome must be pre-generated, probability-controlled, and not dynamically influenced.</p>`)}

  ${G('5.27 Bubble Pop', `<p>Bubble-shooter mechanics requiring grouping of same colors.</p>`)}

  <h4>6. Virtual Currency &amp; Rewards</h4>
  ${UL([
    'The platform may include virtual currency, points, or rewards.',
    'Virtual items have no real-world monetary value unless explicitly stated.',
    'GoPlay may adjust, reset, or remove virtual balances in cases of fraud, abuse, or system errors.',
    'Rewards are non-transferable unless explicitly allowed.',
  ])}

  <h4>7. Payments &amp; Purchases (if applicable)</h4>
  ${UL([
    'All purchases are final unless otherwise required by law.',
    'Pricing may change without prior notice.',
    'Refunds are not guaranteed and are subject to review in cases of technical errors or unauthorized transactions.',
    'Third-party payment processors may apply their own terms.',
  ])}

  <h4>8. Fair Use &amp; Prohibited Behavior</h4>
  <p>Users must not:</p>
  ${UL([
    'Engage in cheating, hacking, or manipulation of game outcomes',
    'Use multiple accounts to exploit rewards or promotions',
    'Participate in fraud, collusion, or coordinated abuse',
    'Interfere with system integrity or other users’ experience',
  ])}
  <p>Violation may lead to suspension or permanent account termination.</p>

  <h4>9. Fraud Prevention &amp; Monitoring</h4>
  <p>GoPlay may monitor user activity to detect fraud, abuse, or suspicious behavior; prevent system manipulation; and ensure fair gameplay across all users. Automated and manual review systems may be used. Decisions may include temporary restriction or permanent banning of accounts.</p>

  <h4>10. Suspension &amp; Termination</h4>
  <p>GoPlay reserves the right to:</p>
  ${UL([
    'Suspend or terminate accounts without prior notice in cases of abuse, fraud, or violation',
    'Restrict access to specific games or features',
    'Remove rewards obtained through illegitimate means',
  ])}
  <p>Users may lose access to all associated data and rewards upon termination.</p>

  <h4>11. Intellectual Property</h4>
  ${UL([
    'All content, including games, graphics, logos, and code, belongs to GoPlay or its licensors.',
    'Users may not reproduce or distribute platform content without permission.',
  ])}

  <h4>12. Limitation of Liability</h4>
  <p>GoPlay is not responsible for loss of data, rewards, or virtual items due to technical failures; service interruptions or downtime; or indirect or consequential damages arising from platform use. Use of the platform is at the user’s own risk.</p>

  <h4>13. Privacy</h4>
  <p>User data is collected and processed in accordance with GoPlay’s Privacy Policy. By using the platform, users consent to such data handling.</p>

  <h4>14. Changes to Terms</h4>
  <p>GoPlay may update these Terms &amp; Conditions at any time. Continued use of the platform after changes means acceptance of the updated terms.</p>

  <h4>15. Governing Law</h4>
  <p>These Terms shall be governed by the applicable laws of the jurisdiction in which GoPlay operates, unless otherwise specified.</p>

  <h4>16. Contact</h4>
  <p>For support or disputes, users may contact the GoPlay support team via the official communication channels provided in the platform.</p>`;

// FAQ entries (EN/AM). Rendered as question/answer blocks.
const FAQ: Array<{ q: { en: string; am: string }; a: { en: string; am: string } }> = [
  {
    q: { en: 'What are Coins and what are Points?', am: 'ሳንቲም እና ነጥብ ምንድን ናቸው?' },
    a: { en: 'Coins are the entry currency — you spend them to play and can buy more or earn free ones. Points are earned by playing well; they raise your level and your global leaderboard rank and have no cash value.',
      am: 'ሳንቲም የመግቢያ ገንዘብ ነው — ለመጫወት ያውሉታል፣ መግዛት ወይም በነጻ ማግኘት ይችላሉ። ነጥብ በጥሩ አጨዋወት ይገኛል፤ ደረጃዎንና በዓለም አቀፍ ሰንጠረዥ ያለዎትን ቦታ ያሳድጋል፣ የገንዘብ ዋጋ የለውም።' },
  },
  {
    q: { en: 'How much does it cost to play?', am: 'ለመጫወት ስንት ያስከፍላል?' },
    a: { en: 'Each attempt costs a small number of Coins (shown on every game and on its intro screen). New players receive free starter Coins, and you can top up any time from the Buy Coins button.',
      am: 'እያንዳንዱ ሙከራ ጥቂት ሳንቲም ያስከፍላል (በእያንዳንዱ ጨዋታና በመግቢያ ገጹ ይታያል)። አዲስ ተጫዋቾች ነጻ ሳንቲም ያገኛሉ፣ በማንኛውም ጊዜ “ሳንቲም ይግዙ” ቁልፍ መሙላት ይችላሉ።' },
  },
  {
    q: { en: 'How is my score turned into Points?', am: 'ውጤቴ እንዴት ወደ ነጥብ ይቀየራል?' },
    a: { en: 'The server computes Points from your performance, the game’s difficulty, and (for timed games) your speed. Scoring is uniform across games and calculated server-side, so it can’t be tampered with.',
      am: 'አገልጋዩ ነጥብን ከአፈጻጸምዎ፣ ከጨዋታው አስቸጋሪነት እና (ለጊዜ-ተኮር ጨዋታዎች) ከፍጥነትዎ ያሰላል። ስሌቱ ለሁሉም ጨዋታዎች ተመሳሳይ ሆኖ በአገልጋዩ በኩል ስለሚሰራ ሊጭበረበር አይችልም።' },
  },
  {
    q: { en: 'How do tournaments work?', am: 'ውድድሮች እንዴት ይሰራሉ?' },
    a: { en: 'Each tournament game runs on a fixed schedule — EthioRunner daily, Memory Match weekly, Fruit Slice monthly. Windows reset automatically when the period ends. Your best score in the current window is ranked by RP on the live leaderboard. The Winners tab shows top finishers from the previous completed window.',
      am: 'እያንዳንዱ የውድድር ጨዋታ በተወሰነ ጊዜ ይከናወናል — EthioRunner ዕለታዊ፣ Memory Match ሳምንታዊ፣ Fruit Slice ወርሃዊ። ጊዜው ሲያልቅ በራሱ ይታደሳል። በአሁኑ ጊዜ ምርጥ ውጤትዎ በ RP በቀጥታ ደረጃ ጠረጴዛ ላይ ይደረድራል። Winners ትር የቀድሞው የተጠናቀቀ ጊዜ 10 ከፍተኛ ያሳያል።' },
  },
  {
    q: { en: 'What is my level and how do I level up?', am: 'ደረጃዬ ምንድን ነው፣ እንዴት እጨምራለሁ?' },
    a: { en: 'Your level is based on your lifetime Points, which only ever go up. Keep playing and winning to raise it — higher levels unlock more games.',
      am: 'ደረጃዎ በጠቅላላ ዕድሜ ነጥብዎ ላይ የተመሰረተ ሲሆን ሁልጊዜ ይጨምራል እንጂ አይቀንስም። እየተጫወቱና እያሸነፉ ያሳድጉት — ከፍ ያሉ ደረጃዎች ተጨማሪ ጨዋታዎችን ይከፍታሉ።' },
  },
  {
    q: { en: 'Some games are locked. How do I unlock them?', am: 'አንዳንድ ጨዋታዎች ተቆልፈዋል። እንዴት እከፍታለሁ?' },
    a: { en: 'Reach the required level to unlock a gated game for free, or unlock it early by spending Coins from the game’s unlock dialog.',
      am: 'የተፈለገውን ደረጃ ሲደርሱ የተቆለፈ ጨዋታ በነጻ ይከፈታል፣ ወይም ከጨዋታው የመክፈቻ መስኮት ሳንቲም በማውጣት ቀድመው ይክፈቱት።' },
  },
  {
    q: { en: 'How do referral rewards work?', am: 'የግብዣ ሽልማት እንዴት ይሰራል?' },
    a: { en: 'Share your referral code from Account → Invite friends. When a friend redeems it, you both get bonus Coins. A code can be redeemed once per new player.',
      am: 'ከመለያ → ጓደኞችን ይጋብዙ ላይ የግብዣ ኮድዎን ያጋሩ። ጓደኛዎ ሲጠቀምበት ሁለታችሁም ተጨማሪ ሳንቲም ታገኛላችሁ። አንድ ኮድ ለእያንዳንዱ አዲስ ተጫዋች አንዴ ብቻ ይሰራል።' },
  },
  {
    q: { en: 'Do my Coins or rewards have real-world value?', am: 'ሳንቲሞቼ ወይም ሽልማቶቼ የገንዘብ ዋጋ አላቸው?' },
    a: { en: 'Virtual items have no real-world monetary value unless explicitly stated. Rewards are non-transferable unless allowed, and balances may be adjusted in cases of fraud, abuse, or system errors.',
      am: 'ቨርቹዋል እቃዎች በግልጽ ካልተገለጸ በስተቀር የገንዘብ ዋጋ የላቸውም። ሽልማቶች ካልተፈቀደ በስተቀር አይተላለፉም፣ በማጭበርበር ወይም በስርዓት ስህተት ጊዜ ሒሳቦች ሊስተካከሉ ይችላሉ።' },
  },
  {
    q: { en: 'Why was my account restricted?', am: 'መለያዬ ለምን ተገደበ?' },
    a: { en: 'Cheating, using bots or multiple accounts, exploiting glitches, or other abuse can lead to restriction or a permanent ban, and rewards gained illegitimately may be removed. See the Terms & Conditions for details.',
      am: 'ማጭበርበር፣ ቦቶችን ወይም ብዙ መለያዎችን መጠቀም፣ ስህተቶችን መበዝበዝ ወይም ሌላ አላግባብ መጠቀም ወደ ገደብ ወይም ቋሚ እገዳ ሊያመራ ይችላል፣ ባልተገባ መንገድ የተገኙ ሽልማቶችም ሊወገዱ ይችላሉ። ዝርዝሩን በውሎችና ሁኔታዎች ይመልከቱ።' },
  },
  {
    q: { en: 'I need help or want to report a problem.', am: 'እገዛ እፈልጋለሁ ወይም ችግር ማሳወቅ እፈልጋለሁ።' },
    a: { en: 'Use “Write your feedback” in your Account, or contact the GoPlay support team via the official channels listed in the platform.',
      am: 'በመለያዎ “አስተያየትዎን ይጻፉ” ይጠቀሙ፣ ወይም በመድረኩ ውስጥ በተዘረዘሩ ይፋዊ መንገዶች የGoPlay ድጋፍ ቡድንን ያግኙ።' },
  },
];
const t = (k: keyof typeof STR.en): string => (STR[getLang()] ?? STR.en)[k];
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const periodLabel = (p: SubPeriod): string => t(p);

function shell(inner: string): HTMLElement {
  document.querySelector('.acct-modal')?.remove();
  const m = document.createElement('div');
  m.className = 'acct-modal';
  m.innerHTML = `
    <div class="acct-topbar">
      <img class="acct-logo" src="/brand/ethio-e.png" alt="Ethio Telecom" />
      <button class="acct-back" aria-label="${t('back')}">✕</button>
    </div>
    <div class="acct-stack">${inner}</div>`;
  document.body.appendChild(m);
  m.querySelector('.acct-back')!.addEventListener('click', () => m.remove());
  return m;
}

export async function openAccount(): Promise<void> {
  injectStyles();
  const user = await currentUser();
  await loadSubscription();
  const sub = currentSub();
  const ref = user ? await fetchReferral() : null;
  void sub;
  shell(`
    ${accountCardHtml(user)}
    ${referralHtml(ref)}
    <nav class="acct-nav">
      <div class="acct-nav-sec">SUPPORT &amp; LEGAL</div>
      <button class="acct-nav-row" id="aTerms"><span class="acct-nav-ico">📋</span><span class="acct-nav-label">${t('terms')}</span></button>
      <button class="acct-nav-row" id="aFaq"><span class="acct-nav-ico">❓</span><span class="acct-nav-label">FAQ</span></button>
      <button class="acct-nav-row" id="aFeedback"><span class="acct-nav-ico">💬</span><span class="acct-nav-label">${t('feedback')}</span></button>
    </nav>`);
  wireAccount(user);
}

function accountCardHtml(user: AuthUser | null): string {
  if (!user) {
    return `<div class="acct-card">
      <div class="acct-row"><span class="acct-muted">${t('signedOut')}</span>
      <button class="acct-btn" id="aSignIn">${t('signIn')}</button></div></div>`;
  }
  return `<div class="acct-card">
    <div class="acct-row"><span class="acct-user">👤 ${esc(user.name || user.phone)}</span>
    <button class="acct-btn ghost" id="aSignOut">${t('signOut')}</button></div></div>`;
}

// Invite-friends card: the player's own shareable code + (if not yet redeemed)
// a field to enter a friend's code. Hidden entirely when signed out.
function referralHtml(ref: { code: string; redeemed: boolean } | null): string {
  if (!ref || !ref.code) return '';
  const redeemBox = ref.redeemed ? '' : `
    <div class="ref-redeem">
      <span class="acct-muted">${t('haveCode')}</span>
      <div class="ref-redeem-row">
        <input id="refInput" class="ref-input" placeholder="${t('enterCode')}" maxlength="6" autocomplete="off" />
        <button class="acct-btn" id="refRedeem">${t('redeem')}</button>
      </div>
      <p class="ref-msg" id="refMsg"></p>
    </div>`;
  return `<div class="acct-card ref-card">
    <div class="ref-head"><span class="ref-gift">🎁</span>
      <div><strong>${t('invite')}</strong><div class="acct-muted">${t('inviteSub')}</div></div></div>
    <div class="ref-code-row">
      <span class="acct-muted">${t('yourCode')}</span>
      <code class="ref-code" id="refCode">${esc(ref.code)}</code>
      <button class="acct-btn ghost" id="refCopy">${t('copy')}</button>
      <button class="acct-btn" id="refShare">${t('share')}</button>
    </div>
    ${redeemBox}
  </div>`;
}

function wireReferral(): void {
  const codeEl = document.querySelector('#refCode');
  const code = codeEl?.textContent ?? '';
  const link = `${location.origin}${location.pathname}?ref=${encodeURIComponent(code)}`;
  document.querySelector('#refCopy')?.addEventListener('click', () => {
    void navigator.clipboard?.writeText(code);
    const b = document.querySelector('#refCopy')!; const o = b.textContent; b.textContent = t('copied');
    setTimeout(() => { b.textContent = o; }, 1400);
  });
  document.querySelector('#refShare')?.addEventListener('click', () => {
    const msg = `${t('inviteSub')} ${code}\n${link}`;
    if (navigator.share) void navigator.share({ title: 'GoPlay', text: msg, url: link }).catch(() => {});
    else void navigator.clipboard?.writeText(msg);
  });
  // Prefill the redeem box from a ?ref=CODE invite link.
  const incoming = new URLSearchParams(location.search).get('ref');
  const input0 = document.querySelector<HTMLInputElement>('#refInput');
  if (incoming && input0 && !input0.value) input0.value = incoming.trim().toUpperCase().slice(0, 6);
  const btn = document.querySelector<HTMLButtonElement>('#refRedeem');
  btn?.addEventListener('click', async () => {
    const input = document.querySelector<HTMLInputElement>('#refInput')!;
    const msg = document.querySelector('#refMsg')!;
    const val = input.value.trim().toUpperCase();
    if (!val) return;
    btn.disabled = true;
    try {
      const res = await redeemReferralRemote(val);
      const key = ({ ok: 'refOk', already: 'refAlready', invalid: 'refInvalid', self: 'refSelf' } as const)[res.status] ?? 'failed';
      msg.textContent = t(key);
      msg.className = `ref-msg ${res.status === 'ok' ? 'ok' : 'err'}`;
      if (res.status === 'ok') { void balance(); setTimeout(() => void openAccount(), 1200); }
      else btn.disabled = false;
    } catch { msg.textContent = t('failed'); msg.className = 'ref-msg err'; btn.disabled = false; }
  });
}

function wireAccount(user: AuthUser | null): void {
  document.querySelector('#aSignIn')?.addEventListener('click', () => openSignIn());
  document.querySelector('#aSignOut')?.addEventListener('click', async () => { await signOut(); void openAccount(); });
  // In-app subscribe plans remain for demo / shortcode CTA; cancel is portal-only (STOP / grace).
  document.querySelector('#aSubscribe')?.addEventListener('click', () => openPlans());
  document.querySelector('#aFeedback')?.addEventListener('click', () => openFeedback());
  document.querySelector('#aTerms')?.addEventListener('click', () => openInfo('terms'));
  document.querySelector('#aFaq')?.addEventListener('click', () => openInfo('faq'));
  wireReferral();
  void user;
}

const SUB_KEY: Record<SubPeriod, keyof typeof STR.en> = { daily: 'perDay', weekly: 'perWeek', monthly: 'perMonth' };

function openPlans(): void {
  let chosen: SubPeriod = 'daily';
  const m = shell(`
    <h2 class="acct-title">${t('choosePlan')}</h2>
    <div class="plan-list">
      ${SUB_PLANS.map((p, i) => `
        <button class="plan${i === 0 ? ' sel' : ''}" data-p="${p.period}">
          <span class="plan-name">${periodLabel(p.period)}</span>
          <span class="plan-price">ETB ${p.priceEtb}</span>
          <span class="plan-sub">${t(SUB_KEY[p.period])}</span>
          <span class="plan-radio"></span>
        </button>`).join('')}
    </div>
    ${trialAvailable() ? `<p class="plan-trial">🎁 ${t('freeTrial')}</p>` : ''}
    <button class="acct-primary" id="planNext">${t('subscribeNow')}</button>`);
  m.querySelectorAll<HTMLButtonElement>('.plan').forEach((b) => {
    b.addEventListener('click', () => {
      m.querySelectorAll('.plan').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      chosen = b.dataset.p as SubPeriod;
    });
  });
  m.querySelector('#planNext')!.addEventListener('click', () => openSubPay(chosen));
}

function openSubPay(period: SubPeriod): void {
  const methods = paymentMethodsEnabled();
  const avail = (['telebirr', 'topup'] as PayMethod[]).filter((mth) => methods[mth]);
  let chosen: PayMethod = avail[0] ?? 'telebirr';
  const plan = SUB_PLANS.find((p) => p.period === period)!;
  const m = shell(`
    <h2 class="acct-title">${t('payVia')}</h2>
    <div class="acct-card"><div class="acct-row"><span>${periodLabel(period)}</span><strong>ETB ${plan.priceEtb}</strong></div></div>
    <div class="method-list">
      ${avail.map((mth, i) => {
        const lab = PAY_METHOD_LABEL[mth];
        return `<button class="method${i === 0 ? ' sel' : ''}" data-m="${mth}"><span class="m-icon">${lab.icon}</span><span>${getLang() === 'am' ? lab.am : lab.en}</span></button>`;
      }).join('')}
    </div>
    <button class="acct-primary" id="subPay">${t('subWith')} ${getLang() === 'am' ? PAY_METHOD_LABEL[chosen].am : PAY_METHOD_LABEL[chosen].en}</button>`);
  const payBtn = m.querySelector<HTMLButtonElement>('#subPay')!;
  m.querySelectorAll<HTMLButtonElement>('.method').forEach((b) => {
    b.addEventListener('click', () => {
      m.querySelectorAll('.method').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      chosen = b.dataset.m as PayMethod;
      payBtn.textContent = `${t('subWith')} ${getLang() === 'am' ? PAY_METHOD_LABEL[chosen].am : PAY_METHOD_LABEL[chosen].en}`;
    });
  });
  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    try {
      const result = await subscribe(period, chosen);
      if (isSubscribePending(result)) {
        const pendingEn = result.message
          ?? 'Text OK to the service shortcode to activate. Your plan starts after confirmation.';
        const pendingAm = 'ወደ አገልግሎቱ አጭር ኮድ OK በመላክ ይመዝገቡ። ከማረጋገጫ በኋላ ዕቅድዎ ይጀምራል።';
        m.querySelector('.acct-stack')!.innerHTML = `
          <div class="acct-success"><div class="as-burst">⏳</div>
          <h2 class="acct-title">${getLang() === 'am' ? 'በመጠባበቅ ላይ' : 'Text OK to subscribe'}</h2>
          <p class="acct-muted">${getLang() === 'am' ? pendingAm : pendingEn}</p>
          <button class="acct-primary" id="subDone">${t('close')}</button></div>`;
      } else {
        m.querySelector('.acct-stack')!.innerHTML = `
          <div class="acct-success"><div class="as-burst">🎉</div><h2 class="acct-title">${t('subbed')}</h2>
          <button class="acct-primary" id="subDone">${t('close')}</button></div>`;
      }
    } catch {
      payBtn.disabled = false;
      payBtn.textContent = t('failed');
      return;
    }
    m.querySelector('#subDone')!.addEventListener('click', () => { m.remove(); void openAccount(); });
  });
}

function openFeedback(): void {
  let rating = 0;
  const m = shell(`
    <h2 class="acct-title">${t('feedback')}</h2>
    <p class="acct-muted">${t('rateQ')}</p>
    <div class="rate-row" id="rateRow">${[1, 2, 3, 4, 5].map((n) => `<button class="rate-star" data-n="${n}">★</button>`).join('')}</div>
    <button class="acct-primary" id="fbSubmit">${t('submit')}</button>`);
  m.querySelectorAll<HTMLButtonElement>('.rate-star').forEach((b) => {
    b.addEventListener('click', () => {
      rating = Number(b.dataset.n);
      m.querySelectorAll<HTMLButtonElement>('.rate-star').forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= rating));
    });
  });
  m.querySelector('#fbSubmit')!.addEventListener('click', () => {
    try { localStorage.setItem('innoarcade.feedback.v1', JSON.stringify({ rating, at: Date.now() })); } catch { /* ignore */ }
    m.querySelector('.acct-stack')!.innerHTML = `
      <div class="acct-success"><div class="as-burst">🙏</div><h2 class="acct-title">${t('thanks')}</h2>
      <button class="acct-primary" id="fbDone">${t('close')}</button></div>`;
    m.querySelector('#fbDone')!.addEventListener('click', () => m.remove());
  });
}

function openInfo(kind: 'terms' | 'faq'): void {
  const title = kind === 'terms' ? t('terms') : t('faq');
  const am = getLang() === 'am';
  const body = kind === 'terms'
    ? TERMS_HTML
    : FAQ.map((f) => `<div class="faq-item"><p class="faq-q">${esc(am ? f.q.am : f.q.en)}</p><p class="faq-a">${esc(am ? f.a.am : f.a.en)}</p></div>`).join('');
  const m = shell(`<h2 class="acct-title">${esc(title)}</h2>
    <div class="acct-card info-body ${kind === 'terms' ? 'tc-body' : 'faq-body'}">${body}</div>
    <button class="acct-primary" id="infoDone">${t('close')}</button>`);
  m.querySelector('#infoDone')!.addEventListener('click', () => m.remove());
}

function injectStyles(): void {
  if (document.getElementById('acct-styles')) return;
  const s = document.createElement('style');
  s.id = 'acct-styles';
  s.textContent = `
    .acct-modal { position: fixed; inset: 0; z-index: 9992; display: flex; flex-direction: column; align-items: center;
      justify-content: flex-start; overflow-y: auto; background: #f5f6f8; }
    .acct-topbar { width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 0.8rem 1rem; background: #fff; border-bottom: 1px solid #e8eaed; flex-shrink: 0; }
    .acct-logo { height: 1.6rem; object-fit: contain; }
    .acct-back { width: 2.2rem; height: 2.2rem; border-radius: 999px;
      border: 1px solid #e8eaed; background: #fff; color: #5f6368; font-size: 1rem; cursor: pointer;
      display: grid; place-items: center; }
    .acct-back:hover { background: #f0f0f0; }
    .acct-stack { width: min(440px, 100%); display: flex; flex-direction: column; gap: 0; padding: 0.8rem 1rem 2rem; }
    .acct-title { color: var(--text, #14271a); font-size: 1.3rem; margin: 0 0 0.6rem; }
    .acct-card { background: #fff; color: var(--text, #14271a); border-radius: 16px; padding: 1rem 1.1rem; box-shadow: 0 2px 8px rgba(0,0,0,.08);
      border: 1px solid #e8eaed; font: inherit; text-align: left; width: 100%; margin-bottom: 0.6rem; }
    .acct-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .acct-muted { color: #5f6368; font-size: .88rem; }
    .acct-user { font-weight: 800; }
    .acct-btn { border: 1px solid var(--accent, #4f9e16); background: var(--accent, #4f9e16); color: #fff; border-radius: 999px; padding: .42rem 1rem; font: inherit; font-weight: 800; cursor: pointer; }
    .acct-btn.ghost { background: #fff; color: #5f6368; border-color: #e8eaed; }
    .sub-off { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .sub-cart { width: 2.4rem; height: 2.4rem; display: grid; place-items: center; background: var(--accent); color: #fff; border-radius: 50%; font-size: 1.1rem; }
    .sub-cta { display: block; font-size: 1.05rem; color: var(--accent); }
    .sub-on .sub-badge { display: inline-block; background: var(--gold); color: #5a3d00; font-weight: 900; font-size: .8rem; padding: .12rem .6rem; border-radius: 999px; margin-bottom: 4px; }
    .acct-sec { color: rgba(255,255,255,.92); font-weight: 800; font-size: .82rem; text-transform: uppercase; letter-spacing: .08em; margin-top: 4px; }
    .acct-nav { background: #fff; border-radius: 16px; border: 1px solid #e8eaed; box-shadow: 0 2px 8px rgba(0,0,0,.08);
      overflow: hidden; margin-top: 0.6rem; }
    .acct-nav-sec { padding: 0.7rem 1rem 0.35rem; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.1em;
      text-transform: uppercase; color: #5f6368; }
    .acct-nav-row { display: flex; align-items: center; gap: 0.7rem; width: 100%; padding: 0.75rem 1rem;
      border: none; background: none; font: inherit; font-size: 0.95rem; color: var(--text, #14271a);
      cursor: pointer; text-align: left; border-top: 1px solid #f0f1f3; }
    .acct-nav-row:first-of-type { border-top: none; }
    .acct-nav-row:hover { background: #f8f9fa; }
    .acct-nav-row:active { background: #f0f1f3; }
    .acct-nav-ico { font-size: 1.1rem; flex-shrink: 0; width: 1.4rem; text-align: center; }
    .acct-nav-label { font-weight: 600; }
    .acct-primary { background: var(--accent, #4f9e16); color: #fff; border: none; border-radius: 12px; padding: .85rem; font: inherit; font-weight: 800; cursor: pointer; width: 100%; margin-top: 0.5rem; }
    .plan-list { display: flex; flex-direction: column; gap: 10px; }
    .plan { position: relative; display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; background: #fff; border: 2px solid var(--line);
      border-radius: 14px; padding: .9rem 2.4rem .9rem 1rem; font: inherit; text-align: left; cursor: pointer; }
    .plan.sel { border-color: var(--accent); }
    .plan-name { font-weight: 800; }
    .plan-price { font-weight: 900; }
    .plan-sub { grid-column: 1 / -1; color: var(--muted); font-size: .82rem; }
    .plan-radio { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line); }
    .plan.sel .plan-radio { border-color: var(--accent); background: radial-gradient(circle, var(--accent) 0 6px, #fff 7px); }
    .plan-trial { color: #fff; font-size: .88rem; text-align: center; margin: 0; }
    .method-list { display: flex; flex-direction: column; gap: 8px; }
    .method { display: flex; align-items: center; gap: 10px; padding: .7rem .8rem; border: 2px solid var(--line); border-radius: 12px; background: #fff; font: inherit; font-weight: 700; cursor: pointer; color: var(--text); }
    .method.sel { border-color: var(--accent); }
    .m-icon { font-size: 1.2rem; }
    .acct-success { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding-top: 1rem; }
    .as-burst { font-size: 3rem; }
    .rate-row { display: flex; gap: 8px; justify-content: center; }
    .rate-star { background: none; border: none; font-size: 2.2rem; color: #d8e0cf; cursor: pointer; line-height: 1; }
    .rate-star.on { color: var(--gold); }
    .info-body { display: flex; flex-direction: column; gap: 10px; max-height: 70vh; overflow-y: auto; }
    .info-body p { font-size: .9rem; color: var(--text); line-height: 1.55; margin: 0; }
    .tc-body h3 { font-size: 1.1rem; margin: .2rem 0 .4rem; }
    .tc-body h4 { font-size: .96rem; margin: .7rem 0 .2rem; color: var(--text); }
    .tc-body h4.tc-game { margin-top: 1rem; padding-top: .7rem; border-top: 1px solid var(--line); color: var(--accent); }
    .tc-body ul { margin: .2rem 0 .2rem 1.1rem; padding: 0; display: flex; flex-direction: column; gap: .3rem; }
    .tc-body li { font-size: .88rem; line-height: 1.5; color: var(--text); }
    .tc-body p strong { font-weight: 800; }
    .tc-risk { display: inline-block; font-size: .72rem; font-weight: 800; color: #b3261e;
      background: rgba(179,38,30,.1); padding: .04rem .4rem; border-radius: 6px; margin-left: .3rem; white-space: nowrap; }
    .faq-body { gap: 14px; }
    .faq-item { display: flex; flex-direction: column; gap: 3px; }
    .faq-q { font-weight: 800; font-size: .92rem; }
    .faq-a { color: var(--muted); }
    .entry-rows { display: flex; flex-direction: column; gap: 8px; }
    .entry-rows .acct-row span { font-size: .88rem; }
    .ref-card { display: flex; flex-direction: column; gap: 12px; }
    .ref-head { display: flex; align-items: center; gap: 10px; }
    .ref-gift { font-size: 1.7rem; }
    .ref-code-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ref-code { font-family: ui-monospace, monospace; font-weight: 900; font-size: 1.15rem; letter-spacing: .15em;
      background: var(--soft, #f1f5ea); color: var(--accent); padding: .35rem .7rem; border-radius: 10px; flex: 1; text-align: center; }
    .ref-redeem { border-top: 1px solid var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    .ref-redeem-row { display: flex; gap: 8px; }
    .ref-input { flex: 1; border: 2px solid var(--line); border-radius: 10px; padding: .55rem .7rem; font: inherit;
      font-weight: 800; text-transform: uppercase; letter-spacing: .12em; }
    .ref-input:focus { outline: none; border-color: var(--accent); }
    .ref-msg { margin: 0; font-size: .85rem; font-weight: 700; }
    .ref-msg.ok { color: var(--accent); }
    .ref-msg.err { color: #c0392b; }`;
  document.head.appendChild(s);
}
