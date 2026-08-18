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
    account: 'Account', back: 'Back', signedOut: 'Not signed in', signIn: 'Sign in', signOut: 'Sign out',
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
    rewards: 'My Rewards / Awards', achievements: 'Achievements', notifs: 'Notifications', help: 'Help & Support', settings: 'Settings', legal: 'Terms & Privacy', profile: 'Profile',
    about: 'About', pricing: 'Pricing', subscription: 'Subscription', identity: 'Identity',
  },
  am: {
    account: 'መለያ', back: 'ተመለስ', signedOut: 'አልገቡም', signIn: 'ግባ', signOut: 'ውጣ',
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
    rewards: 'የእኔ ሽልማቶች', achievements: 'ስኬቶች', notifs: 'ማሳወቂያዎች', help: 'እገዛ እና ድጋፍ', settings: 'ቅንብሮች', legal: 'ውሎች እና ግላዊነት', profile: 'መገለጫ',
    about: 'ስለ እኛ', pricing: 'ዋጋ', subscription: 'ምዝገባ', identity: 'ማንነት',
  },
};


const TERMS_HTML = `
  <h3>goPlay – Terms and Conditions</h3>
  <p class="acct-muted">Service Provider: Ethio Telecom / Authorized goPlay Service Provider</p>

  <h4>1. Introduction</h4>
  <p>Welcome to goPlay, a digital gaming and entertainment service that provides customers with access to a variety of interactive games, skill-based challenges, puzzle games, arcade games, trivia games, tournaments and opportunities to receive prizes and rewards.</p>
  <p>These Terms and Conditions ("Terms") govern your access to and use of the goPlay service, including the goPlay website, games, subscription packages, tournaments, leaderboards, promotional activities, rewards and related services.</p>
  <p>By accessing, subscribing to, or using goPlay, you acknowledge that you have read, understood and agreed to these Terms and Conditions.</p>
  <p>If you do not agree with these Terms, please do not subscribe to or use the paid goPlay service.</p>

  <h4>2. About the goPlay Service</h4>
  <p>goPlay is designed to provide customers with an engaging digital gaming experience through a collection of games across different categories, including arcade, puzzle, brain, logic, trivia, casual and skill-based games.</p>
  <p>The available games may include:</p>
  <ul>
    <li>Ball Shooter (ቦል ሹተር)</li>
    <li>2048</li>
    <li>Ethiorunner (ኢትዮሯጭ)</li>
    <li>Brick Blitz (ብሪክ ብሊትዝ)</li>
    <li>Fruit Slice (ፍሩት ስላይስ)</li>
    <li>Sky Hopper (ስካይ ሆፐር)</li>
    <li>Bubble Pop (ባብል ፖፕ)</li>
    <li>Memory Match (ማች ማስታወሻ)</li>
    <li>Tap Game (ታፕ ጨዋታ)</li>
    <li>Candy Blast (ካንዲ ብላስት)</li>
    <li>Ethiopian Quiz (የኢትዮጵያ ጥያቄ)</li>
    <li>Sudoku (ሱዶኩ)</li>
    <li>Spell Trivia (ፊደል ጥያቄ)</li>
    <li>Vocabulary (መዝገበ ቃላት)</li>
    <li>Rhyme Time (ግጥም)</li>
    <li>Target 24 (ኢላማ 24)</li>
    <li>Cross Sum (ድምር)</li>
    <li>Logic Grid (ሎጂክ)</li>
    <li>Sequence (ቅደም ተከተል)</li>
    <li>Water Sort (ውሃ መደርደር)</li>
    <li>Block Blast</li>
    <li>Tile Connect</li>
    <li>Hexa Block</li>
    <li>Helix Jump</li>
    <li>Ball Sort</li>
    <li>Jewel Match</li>
    <li>Slide Puzzle</li>
  </ul>
  <p>The game portfolio may be updated, expanded, replaced or temporarily unavailable as goPlay continues to improve its service.</p>

  <h4>3. Eligibility</h4>
  <p>goPlay is intended for eligible Ethio Telecom customers who are able to access and use the service through the supported channels.</p>
  <p>Customers must provide accurate information where information is required for account management, prize verification or customer support.</p>
  <p>Where a prize requires identity verification, the winner may be required to provide valid identification and other information necessary to complete the prize-redeeming process.</p>
  <p>Ethio Telecom and/or the authorized service provider reserves the right to verify the eligibility of a participant before delivering a prize.</p>

  <h4>4. Customer Account</h4>
  <p>A customer's mobile number may be used as the identifier associated with their goPlay participation and subscription.</p>
  <p>Customers are responsible for maintaining control of their mobile number and for activities performed through their account or mobile number.</p>
  <p>Customers should immediately contact customer support if they believe that their account or service access has been used improperly.</p>

  <h4>5. Subscription Packages</h4>
  <p>goPlay provides subscription packages that allow customers to access the service according to the selected package.</p>
  <p>The current subscription packages are:</p>
  <div style="overflow-x:auto;">
    <table class="tc-table">
      <thead>
        <tr>
          <th>Package</th>
          <th>Subscribe</th>
          <th>Price</th>
          <th>Frequency</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>goPlay Daily</td>
          <td>SMS 1 to 9402</td>
          <td>5.00 ETB</td>
          <td>Daily</td>
        </tr>
        <tr>
          <td>goPlay Weekly</td>
          <td>SMS 2 to 9402</td>
          <td>15.00 ETB</td>
          <td>Weekly</td>
        </tr>
        <tr>
          <td>goPlay Monthly</td>
          <td>SMS 3 to 9402</td>
          <td>35.00 ETB</td>
          <td>Monthly</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>Subscription fees are charged according to the selected package and applicable Ethio Telecom charging procedures.</p>
  <p>Customers should ensure that sufficient balance is available for subscription or renewal.</p>

  <h4>6. Subscription and Renewal</h4>
  <p>A customer who subscribes to a goPlay package will receive access to the applicable service according to the selected package.</p>
  <p>Where a package is recurring, the applicable subscription fee may be charged according to the package's subscription frequency until the customer unsubscribes or the service is otherwise suspended or terminated.</p>
  <p>Subscription status and applicable service access may depend on successful processing of the subscription request.</p>

  <h4>7. Unsubscription</h4>
  <p>Customers may unsubscribe from their selected goPlay package using the applicable SMS unsubscription mechanism.</p>
  <div style="overflow-x:auto;">
    <table class="tc-table">
      <thead>
        <tr>
          <th>Package</th>
          <th>Unsubscribe</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>goPlay Daily</td>
          <td>Send STOP 1 to 9402</td>
        </tr>
        <tr>
          <td>goPlay Weekly</td>
          <td>Send STOP 2 to 9402</td>
        </tr>
        <tr>
          <td>goPlay Monthly</td>
          <td>Send STOP 3 to 9402</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>Customers should ensure that the correct unsubscription keyword is used for the applicable package.</p>
  <p>After successful unsubscription, the recurring subscription for the applicable package will be stopped in accordance with the service's subscription process.</p>

  <h4>8. Games</h4>
  <p>goPlay provides multiple games with different gameplay mechanics.</p>
  <p>Each game may have its own:</p>
  <ul>
    <li>Gameplay rules</li>
    <li>Time limits</li>
    <li>Scoring mechanism</li>
    <li>Number of attempts</li>
    <li>Levels</li>
    <li>Score calculation</li>
    <li>Leaderboard mechanism</li>
    <li>Tournament eligibility</li>
    <li>Reward conditions</li>
  </ul>
  <p>Customers must follow the instructions displayed within each game.</p>

  <h4>9. Skill-Based Games</h4>
  <p>Several goPlay games require customer skill, decision-making, timing, memory, logical reasoning, speed or accuracy.</p>
  <p>Examples include:</p>
  <ul>
    <li>Ball Shooter</li>
    <li>2048</li>
    <li>Ethiorunner</li>
    <li>Brick Blitz</li>
    <li>Sudoku</li>
    <li>Spell Trivia</li>
    <li>Vocabulary</li>
    <li>Rhyme Time</li>
    <li>Target 24</li>
    <li>Cross Sum</li>
    <li>Logic Grid</li>
    <li>Sequence</li>
    <li>Water Sort</li>
    <li>Block Blast</li>
    <li>Tile Connect</li>
    <li>Hexa Block</li>
    <li>Helix Jump</li>
    <li>Ball Sort</li>
    <li>Jewel Match</li>
    <li>Slide Puzzle</li>
  </ul>
  <p>The final score may depend on factors such as successful actions, time taken, levels completed, combinations, distance, accuracy, moves used, targets achieved or other game-specific scoring rules.</p>

  <h4>10. Tournament</h4>
  <p>goPlay provides a tournament experience where customers can compete through the designated tournament game.</p>
  <p>The current tournament game is:</p>
  <p><strong>Fruit Slice (ፍሩት ስላይስ)</strong></p>
  <p>The tournament is conducted on a weekly basis.</p>
  <p>The designated tournament game may be changed on a monthly basis.</p>
  <p>Customers participating in the tournament compete based on their game performance and applicable scoring rules.</p>

  <h4>11. Current Tournament – Fruit Slice</h4>
  <p>In Fruit Slice, customers slice fruits to earn points while avoiding bombs.</p>
  <p>The game may include:</p>
  <ul>
    <li>Points for successfully sliced fruits</li>
    <li>Combo bonuses</li>
    <li>Penalties for hitting bombs</li>
    <li>Combo resets</li>
    <li>Time-based scoring</li>
    <li>Survival-based scoring</li>
    <li>Elimination after missing the applicable number of fruits</li>
  </ul>
  <p>Tournament ranking is based on the applicable final score recorded by the goPlay system.</p>

  <h4>12. Tournament Prizes</h4>
  <p>The current weekly tournament prize structure is:</p>
  <div style="overflow-x:auto;">
    <table class="tc-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Prize</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1st Place</td>
          <td>50,000 ETB</td>
        </tr>
        <tr>
          <td>2nd Place</td>
          <td>25,000 ETB</td>
        </tr>
        <tr>
          <td>3rd Place</td>
          <td>15,000 ETB</td>
        </tr>
        <tr>
          <td>4th Place</td>
          <td>10,000 ETB</td>
        </tr>
        <tr>
          <td>5th Place</td>
          <td>5,000 ETB</td>
        </tr>
      </tbody>
    </table>
  </div>
  <p>The applicable tournament prize structure may be changed for future promotional periods subject to the applicable service terms and announcements.</p>

  <h4>13. Instant Prizes</h4>
  <p>goPlay may provide instant prizes to eligible customers through designated game or promotional mechanisms.</p>
  <p>The availability, type, value and eligibility conditions of an instant prize may vary depending on the applicable game, promotion and customer participation.</p>
  <p>Where an instant prize is offered, the relevant conditions will be communicated through the service.</p>

  <h4>14. Prize Eligibility and Verification</h4>
  <p>A customer who appears to qualify for a prize may be subject to verification before the prize is awarded.</p>
  <p>The verification process may include:</p>
  <ul>
    <li>Confirmation of the customer's mobile number</li>
    <li>Confirmation of participation</li>
    <li>Verification of the recorded score</li>
    <li>Verification of leaderboard position</li>
    <li>Identity verification</li>
    <li>Confirmation of other information reasonably required for prize processing</li>
  </ul>
  <p>Ethio Telecom and/or the authorized service provider may withhold prize delivery until the applicable verification process is successfully completed.</p>

  <h4>15. Winner Selection and Results</h4>
  <p>Tournament results are determined using the records maintained by the goPlay system and the applicable scoring and ranking rules.</p>
  <p>The system record will be used to determine the applicable ranking.</p>
  <p>Where two or more customers have identical or potentially identical scores, the applicable tie-breaking mechanism used by the service will determine the final ranking.</p>

  <h4>16. Fair Play</h4>
  <p>Customers must participate fairly and must not attempt to manipulate, interfere with, exploit or compromise the goPlay service.</p>
  <p>Prohibited activities may include:</p>
  <ul>
    <li>Use of automated tools or bots</li>
    <li>Manipulation of scores</li>
    <li>Exploitation of technical vulnerabilities</li>
    <li>Unauthorized modification of game data</li>
    <li>Interference with another customer's participation</li>
    <li>Use of unauthorized software or tools</li>
    <li>Any activity intended to obtain an unfair advantage</li>
    <li>Any activity that compromises the integrity or security of the service</li>
  </ul>
  <p>Ethio Telecom and/or the service provider may investigate unusual or suspicious activity.</p>

  <h4>17. Disqualification</h4>
  <p>A participant may be disqualified where the participant:</p>
  <ul>
    <li>Violates these Terms and Conditions</li>
    <li>Attempts to manipulate the service</li>
    <li>Uses unauthorized methods to obtain an advantage</li>
    <li>Provides false or misleading information</li>
    <li>Attempts to interfere with the tournament or leaderboard</li>
    <li>Fails applicable prize verification requirements</li>
    <li>Engages in conduct that compromises the integrity of the service</li>
  </ul>
  <p>Where a participant is disqualified, any associated prize may be cancelled or reassigned in accordance with the applicable rules.</p>

  <h4>18. Leaderboard</h4>
  <p>Where a leaderboard is provided, it displays rankings based on the applicable game or tournament scoring mechanism.</p>
  <p>Leaderboard information may be updated during or after gameplay.</p>
  <p>The final official ranking is based on the validated records maintained by the goPlay system.</p>

  <h4>19. Service Availability</h4>
  <p>goPlay is provided subject to network, platform, system and technical availability.</p>
  <p>Temporary interruption may occur because of:</p>
  <ul>
    <li>Planned maintenance</li>
    <li>System upgrades</li>
    <li>Network interruptions</li>
    <li>Technical problems</li>
    <li>Security activities</li>
    <li>Third-party service interruptions</li>
    <li>Circumstances outside the reasonable control of Ethio Telecom or the service provider</li>
  </ul>
  <p>Reasonable efforts will be made to restore the service as soon as practicable.</p>

  <h4>20. Game and Service Updates</h4>
  <p>goPlay may periodically introduce:</p>
  <ul>
    <li>New games</li>
    <li>New game versions</li>
    <li>New features</li>
    <li>New tournament games</li>
    <li>New promotional activities</li>
    <li>Improvements to gameplay</li>
    <li>Technical updates</li>
  </ul>
  <p>A game may also be temporarily removed, replaced or modified to maintain service quality and security.</p>

  <h4>21. Data and Privacy</h4>
  <p>Customer information may be processed as necessary to provide, administer, secure and support the goPlay service, including subscription management, gameplay administration, tournament management, customer support, prize verification and service improvement.</p>
  <p>Customer information will be handled in accordance with applicable laws, regulations and Ethio Telecom's applicable privacy and data-protection requirements.</p>

  <h4>22. Charges and Customer Responsibility</h4>
  <p>Customers are responsible for charges associated with their selected goPlay subscription package and any applicable telecommunications or data charges required to access the service.</p>
  <p>Customers should review the package price and frequency before subscribing.</p>

  <h4>23. Third-Party Network and Internet Charges</h4>
  <p>Accessing goPlay through an internet connection may consume mobile data or other internet resources.</p>
  <p>Any applicable data or internet charges are separate from the goPlay subscription fee unless explicitly stated otherwise.</p>

  <h4>24. Intellectual Property</h4>
  <p>The goPlay service, including its design, branding, content, software, graphics, interfaces, game presentation and other service materials, may be protected by applicable intellectual-property laws.</p>
  <p>Customers may use the service for personal use in accordance with these Terms.</p>
  <p>No customer may copy, reproduce, modify, distribute, reverse engineer or commercially exploit the service without appropriate authorization.</p>

  <h4>25. Limitation of Liability</h4>
  <p>Ethio Telecom and/or the authorized service provider will take reasonable measures to provide a reliable and secure service.</p>
  <p>However, the service may occasionally be affected by circumstances outside reasonable control, including telecommunications failures, internet interruptions, technical faults, maintenance, system upgrades and third-party service interruptions.</p>
  <p>Nothing in these Terms is intended to exclude or limit any liability that cannot legally be excluded or limited under applicable law.</p>

  <h4>26. Changes to These Terms</h4>
  <p>Ethio Telecom and/or the authorized service provider may update these Terms when necessary to reflect changes to the service, pricing, functionality, promotions, applicable requirements or operational processes.</p>
  <p>Updated Terms may be published through the applicable goPlay service channels.</p>
  <p>Customers should periodically review the Terms and Conditions.</p>

  <h4>27. Suspension or Termination</h4>
  <p>The goPlay service or any part of it may be temporarily suspended or permanently discontinued where necessary for operational, technical, security, regulatory or business reasons.</p>
  <p>Where reasonably practicable, relevant information concerning material service changes may be communicated through appropriate customer channels.</p>

  <h4>28. Complaints and Disputes</h4>
  <p>Customers who have questions, complaints or concerns regarding goPlay should first contact the designated customer support channel.</p>
  <p>Customers should provide sufficient information to allow the issue to be investigated, including where applicable:</p>
  <ul>
    <li>Mobile number</li>
    <li>Subscription package</li>
    <li>Date and time of the issue</li>
    <li>Game name</li>
    <li>Transaction or charging information</li>
    <li>Screenshot or other relevant information</li>
  </ul>
  <p>Complaints will be handled through the applicable Ethio Telecom customer-service and complaint-management procedures.</p>

  <h4>29. Governing Law</h4>
  <p>These Terms and the use of the goPlay service shall be subject to the applicable laws and regulations of the Federal Democratic Republic of Ethiopia.</p>

  <h4>30. Acceptance</h4>
  <p>By subscribing to or using goPlay, the customer confirms that they have read and accepted these Terms and Conditions.</p>
  <p>If the customer does not agree with these Terms, the customer should discontinue use of the applicable service and unsubscribe from any active paid package.</p>
  <p><strong>goPlay – Play. Compete. Enjoy.</strong></p>
`;

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

let acctModal: HTMLElement | null = null;
let acctUser: AuthUser | null = null;
let acctRef: { code: string; redeemed: boolean } | null = null;

function renderAcctStack(pageId: string | null): void {
  if (!acctModal) return;
  const stack = acctModal.querySelector('.acct-stack')!;
  
  if (!pageId) {
    stack.innerHTML = `
      <div class="acct-nav-sec">ACCOUNT</div>
      <nav class="acct-menu-list">
        ${accountRowHtml('aIdentity', '👤', t('identity'))}
        ${accountRowHtml('aRewards', '🎁', t('rewards'))}
        ${acctUser ? accountRowHtml('aInvite', '💌', t('invite')) : ''}
      </nav>
      
      <div class="acct-nav-sec">SUPPORT</div>
      <nav class="acct-menu-list">
        ${accountRowHtml('aHelp', '❓', t('help'))}
        ${accountRowHtml('aFaq', '💬', t('faq'))}
      </nav>

      <div class="acct-nav-sec">SERVICE</div>
      <nav class="acct-menu-list">
        ${accountRowHtml('aPricing', '🏷️', t('pricing'))}
        ${accountRowHtml('aSubscription', '🔄', t('subscription'))}
      </nav>

      <div class="acct-nav-sec">INFORMATION</div>
      <nav class="acct-menu-list">
        ${accountRowHtml('aAbout', 'ℹ️', t('about'))}
        ${accountRowHtml('aTerms', '📄', t('terms'))}
      </nav>

      <div class="acct-nav-sec">SETTINGS</div>
      <nav class="acct-menu-list">
        ${accountRowHtml('aSettings', '⚙️', t('settings'))}
      </nav>
    `;
    wireAccount();
  } else if (pageId === 'identity') {
    stack.innerHTML = `
      <h2 class="acct-title">👤 ${t('identity')}</h2>
      ${!acctUser ? `
        <div class="acct-card profile-details" style="text-align:center; padding: 2.4rem 1rem;">
          <p class="acct-muted" style="margin-bottom: 1.5rem;">${t('signedOut')}</p>
          <button class="btn-primary" id="subIdSignIn">${t('signIn')}</button>
        </div>` 
      : `
        ${accountCardHtml(acctUser)}
        <nav class="acct-menu-list" style="margin-top: 1.2rem;">
          ${accountRowHtml('subIdSignOut', '🚪', t('signOut'), true, true)}
        </nav>`}
    `;
    stack.querySelector('#subIdSignIn')?.addEventListener('click', () => { acctModal?.remove(); acctModal = null; openSignIn(); });
    stack.querySelector('#subIdSignOut')?.addEventListener('click', async () => { await signOut(); history.back(); setTimeout(() => openAccount(), 500); });
  } else if (pageId === 'invite') {
    stack.innerHTML = `<h2 class="acct-title">💌 ${t('invite')}</h2>` + referralHtml(acctRef);
    wireReferral();
  } else if (pageId === 'about') {
    stack.innerHTML = `<h2 class="acct-title">ℹ️ ${t('about')}</h2>
      <div class="acct-card info-body tc-body">
        <h3>InnoArcade</h3>
        <p>InnoArcade is a premium HTML5 gaming platform delivering instant, high-quality games.</p>
        <p>Built with modern web technologies, it provides a seamless, app-like experience directly in the browser.</p>
        <p>Version: 1.0.0<br/>© 2026 InnoArcade. All rights reserved.</p>
      </div>`;
  } else if (pageId === 'help') {
    stack.innerHTML = `<h2 class="acct-title">❓ ${t('help')}</h2>
      <div class="acct-card info-body">
        <p>For support, please use the "Write your feedback" button in Settings, or contact the GoPlay support team via the official channels.</p>
      </div>`;
  } else if (pageId === 'faq') {
    const am = getLang() === 'am';
    stack.innerHTML = `<h2 class="acct-title">💬 ${t('faq')}</h2>
      <div class="acct-card info-body faq-body">
        ${FAQ.map((f) => `<div class="faq-item"><p class="faq-q">${esc(am ? f.q.am : f.q.en)}</p><p class="faq-a">${esc(am ? f.a.am : f.a.en)}</p></div>`).join('')}
      </div>`;
  } else if (pageId === 'terms') {
    stack.innerHTML = `<h2 class="acct-title">📄 ${t('terms')}</h2>
      <div class="acct-card info-body tc-body">${TERMS_HTML}</div>`;
  } else if (pageId === 'pricing' || pageId === 'subscription') {
    stack.innerHTML = `
      <h2 class="acct-title">${t('choosePlan')}</h2>
      <div class="plan-list" id="acctPlanList"></div>
      ${trialAvailable() ? `<p class="plan-trial">🎁 ${t('freeTrial')}</p>` : ''}
      <button class="btn-primary" id="planNext">${t('subscribeNow')}</button>
    `;
    let chosen: SubPeriod = 'daily';
    const list = stack.querySelector('#acctPlanList')!;
    list.innerHTML = SUB_PLANS.map((p, i) => `
      <button class="plan${i === 0 ? ' sel' : ''}" data-p="${p.period}">
        <span class="plan-name">${periodLabel(p.period)}</span>
        <span class="plan-price">ETB ${p.priceEtb}</span>
        <span class="plan-sub">${t(SUB_KEY[p.period])}</span>
        <span class="plan-radio"></span>
      </button>`).join('');
    
    list.querySelectorAll<HTMLButtonElement>('.plan').forEach((b) => {
      b.addEventListener('click', () => {
        list.querySelectorAll('.plan').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        chosen = b.dataset.p as SubPeriod;
      });
    });
    stack.querySelector('#planNext')!.addEventListener('click', () => openSubPay(chosen));
  } else if (pageId === 'rewards') {
    stack.innerHTML = `
      <div class="acct-success" style="padding-top:2rem;">
        <div class="as-burst">🚧</div>
        <h2 class="acct-title">${t('rewards')}</h2>
        <p class="acct-muted" style="margin-top: 0.5rem; margin-bottom: 2rem;">${getLang() === 'am' ? 'በቅርብ ቀን!' : 'Coming Soon!'}</p>
      </div>
    `;
  }
}

function handleAcctPopState(e: PopStateEvent): void {
  if (!acctModal) return;
  const pageId = e.state?.acctPage || null;
  renderAcctStack(pageId);
}

function pushAcctPage(pageId: string): void {
  history.pushState({ acctPage: pageId }, '', location.href);
  renderAcctStack(pageId);
}

function shell(inner?: string): HTMLElement {
  document.querySelector('.acct-modal')?.remove();
  acctModal = document.createElement('div');
  acctModal.className = 'acct-modal';
  acctModal.innerHTML = `
    <div class="acct-topbar">
      <button class="btn-secondary" aria-label="${t('back')}" id="closeAcctBtn">← ${t('back')}</button>
      <img class="acct-logo" src="/brand/ethio-e.png" alt="Ethio Telecom" />
    </div>
    <div class="acct-stack">${inner ?? ''}</div>`;
  document.body.appendChild(acctModal);
  
  window.addEventListener('popstate', handleAcctPopState);
  
  acctModal.querySelector('#closeAcctBtn')!.addEventListener('click', () => {
    if (history.state?.acctPage) {
      history.back();
    } else {
      window.removeEventListener('popstate', handleAcctPopState);
      acctModal?.remove();
      acctModal = null;
    }
  });
  return acctModal;
}

function accountRowHtml(id: string, icon: string, label: string, isDanger: boolean = false, isAction: boolean = false): string {
  return `<button class="acct-menu-row ${isDanger ? 'danger' : ''}" id="${id}">
    <div class="acct-menu-ico-wrap"><span class="acct-menu-ico">${icon}</span></div>
    <span class="acct-menu-lbl">${label}</span>
    ${!isAction ? `<svg class="acct-menu-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>` : ''}
  </button>`;
}

export async function openAccount(): Promise<void> {
  injectStyles();
  acctUser = await currentUser();
  await loadSubscription();
  const sub = currentSub();
  acctRef = acctUser ? await fetchReferral() : null;
  void sub;
  
  shell();
  renderAcctStack(null);
}

function accountCardHtml(user: AuthUser | null): string {
  if (!user) return '';
  return `<div class="acct-card profile-details">
    <div class="acct-row" style="flex-direction:column; align-items:flex-start; gap:0.2rem;">
      <span class="acct-user" style="font-weight:600; font-size:1.1rem;">${esc(user.name || user.phone)}</span>
      <span class="acct-muted" style="font-size:0.85rem;">Status: Active Player</span>
    </div>
  </div>`;
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
        <button class="btn-primary" id="refRedeem">${t('redeem')}</button>
      </div>
      <p class="ref-msg" id="refMsg"></p>
    </div>`;
  return `<div class="acct-card ref-card">
    <div class="ref-head"><span class="ref-gift">🎁</span>
      <div><strong>${t('invite')}</strong><div class="acct-muted">${t('inviteSub')}</div></div></div>
    <div class="ref-code-row">
      <span class="acct-muted">${t('yourCode')}</span>
      <code class="ref-code" id="refCode">${esc(ref.code)}</code>
      <button class="btn-secondary" id="refCopy">${t('copy')}</button>
      <button class="btn-primary" id="refShare">${t('share')}</button>
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


function wireAccount(): void {
  const m = acctModal;
  if (!m) return;
  
  m.querySelector('#aIdentity')?.addEventListener('click', () => pushAcctPage('identity'));
  m.querySelector('#aRewards')?.addEventListener('click', () => pushAcctPage('rewards'));
  m.querySelector('#aInvite')?.addEventListener('click', () => pushAcctPage('invite'));
  m.querySelector('#aHelp')?.addEventListener('click', () => pushAcctPage('help'));
  m.querySelector('#aFaq')?.addEventListener('click', () => pushAcctPage('faq'));
  m.querySelector('#aPricing')?.addEventListener('click', () => pushAcctPage('pricing'));
  m.querySelector('#aSubscription')?.addEventListener('click', () => pushAcctPage('subscription'));
  m.querySelector('#aAbout')?.addEventListener('click', () => pushAcctPage('about'));
  m.querySelector('#aTerms')?.addEventListener('click', () => pushAcctPage('terms'));
  
  m.querySelector('#aSettings')?.addEventListener('click', () => { 
    const btn = document.querySelector<HTMLButtonElement>('#settingsBtn');
    if (btn) btn.click();
  });
}

const SUB_KEY: Record<SubPeriod, keyof typeof STR.en> = { daily: 'perDay', weekly: 'perWeek', monthly: 'perMonth' };

export function openPlans(): void {
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
    <button class="btn-primary" id="planNext">${t('subscribeNow')}</button>`);
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
    <button class="btn-primary" id="subPay">${t('subWith')} ${getLang() === 'am' ? PAY_METHOD_LABEL[chosen].am : PAY_METHOD_LABEL[chosen].en}</button>`);
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
          <button class="btn-primary" id="subDone">${t('close')}</button></div>`;
      } else {
        m.querySelector('.acct-stack')!.innerHTML = `
          <div class="acct-success"><div class="as-burst">🎉</div><h2 class="acct-title">${t('subbed')}</h2>
          <button class="btn-primary" id="subDone">${t('close')}</button></div>`;
      }
    } catch {
      payBtn.disabled = false;
      payBtn.textContent = t('failed');
      return;
    }
    m.querySelector('#subDone')!.addEventListener('click', () => { m.remove(); void openAccount(); });
  });
}

export function openFeedback(): void {
  let rating = 0;
  const m = shell(`
    <h2 class="acct-title">${t('feedback')}</h2>
    <p class="acct-muted">${t('rateQ')}</p>
    <div class="rate-row" id="rateRow">${[1, 2, 3, 4, 5].map((n) => `<button class="rate-star" data-n="${n}">★</button>`).join('')}</div>
    <button class="btn-primary" id="fbSubmit">${t('submit')}</button>`);
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
      <button class="btn-primary" id="fbDone">${t('close')}</button></div>`;
    m.querySelector('#fbDone')!.addEventListener('click', () => m.remove());
  });
}


function injectStyles(): void {
  if (document.getElementById('acct-styles')) return;
  const s = document.createElement('style');
  s.id = 'acct-styles';
  s.textContent = `
    .acct-modal { position: fixed; inset: 0; z-index: 9992; display: flex; flex-direction: column; align-items: center;
      justify-content: flex-start; overflow-y: auto; background: #f5f6f8; }
    .acct-topbar { width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 0.8rem 1rem; background: transparent; flex-shrink: 0; }
    .acct-logo { height: 1.6rem; object-fit: contain; }
    .acct-stack { width: min(440px, 100%); display: flex; flex-direction: column; gap: 0; padding: 0.8rem 1rem 2rem; }
    .acct-title { color: var(--text, #14271a); font-size: 1.3rem; margin: 0 0 0.6rem; }
    .acct-card { background: #fff; color: var(--text, #14271a); border-radius: 16px; padding: 1rem 1.1rem; box-shadow: 0 2px 8px rgba(0,0,0,.08);
      border: 1px solid #e8eaed; font: inherit; text-align: left; width: 100%; margin-bottom: 0.6rem; }
    .tc-table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
    .tc-table th, .tc-table td { border: 1px solid #e8eaed; padding: 0.6rem; text-align: left; }
    .tc-table th { background: #f5f6f8; font-weight: 800; color: #5f6368; }
    .acct-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .acct-muted { color: #5f6368; font-size: .88rem; }
    .acct-user { font-weight: 800; }
    .sub-off { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .sub-cart { width: 2.4rem; height: 2.4rem; display: grid; place-items: center; background: var(--accent); color: #fff; border-radius: 50%; font-size: 1.1rem; }
    .sub-cta { display: block; font-size: 1.05rem; color: var(--accent); }
    .sub-on .sub-badge { display: inline-block; background: var(--gold); color: #5a3d00; font-weight: 900; font-size: .8rem; padding: .12rem .6rem; border-radius: 999px; margin-bottom: 4px; }
    .acct-sec { color: rgba(255,255,255,.92); font-weight: 800; font-size: .82rem; text-transform: uppercase; letter-spacing: .08em; margin-top: 4px; }
    .acct-menu-list { background: #fff; border-radius: 16px; border: 1px solid #e8eaed; box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow: hidden; margin-bottom: 1.2rem; width: 100%; display: flex; flex-direction: column; }
    
    .acct-menu-row { display: flex; align-items: center; gap: 0.8rem; width: 100%; height: 3.2rem; padding: 0 1.1rem; border: none; background: #fff; font: inherit; font-size: 0.98rem; color: var(--text, #14271a); cursor: pointer; text-align: left; border-top: 1px solid #f0f1f3; position: relative; overflow: hidden; transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1); -webkit-tap-highlight-color: transparent; }
    .acct-menu-row:first-of-type { border-top: none; }
    
    .acct-menu-row::after { content: ""; position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; padding-top: 100%; background: rgba(0, 0, 0, 0.08); border-radius: 50%; transform: translate(-50%, -50%) scale(0); opacity: 0; transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease; pointer-events: none; }
    .acct-menu-row:active { transform: scale(0.97); transition-duration: 0.1s; }
    .acct-menu-row:active::after { transform: translate(-50%, -50%) scale(1.5); opacity: 1; transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.1s ease; }
    
    .acct-menu-row.danger { color: #d64545; }
    .acct-menu-row.danger .acct-menu-ico-wrap { background: rgba(214,69,69,0.1); color: #d64545; }
    
    .acct-menu-ico-wrap { width: 2rem; height: 2rem; background: #f5f6f8; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; }
    .acct-menu-ico { font-size: 1.1rem; }
    .acct-menu-lbl { font-weight: 600; flex: 1; }
    .acct-menu-chev { flex-shrink: 0; color: #a1a5ab; }
    
    .acct-nav-sec { padding: 0 0 0.4rem 0.6rem; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #8e949a; background: transparent; border: none; margin-top: 0.4rem; }
    
    .acct-expand { width: 100%; background: #f8f9fa; border-top: 1px solid #f0f1f3; padding: 0; }
    .acct-expand .acct-card { margin: 0; border: none; box-shadow: none; border-radius: 0; background: transparent; }
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
