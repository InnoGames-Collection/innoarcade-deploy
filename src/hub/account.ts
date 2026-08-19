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
    account: 'Account', back: 'Back', signedOut: 'Not signed in', signIn: 'Sign in', signOut: 'Log Out',
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

const ABOUT_HTML = `
  <h3>About goPlay</h3>
  <p><strong>Welcome to goPlay</strong></p>
  <p>goPlay is a digital gaming and entertainment platform designed to bring engaging games, challenges, competitions and rewards together in one convenient experience.</p>
  <p>Whether you enjoy fast-paced arcade games, brain challenges, puzzles, trivia, logic games or competitive tournaments, goPlay provides a variety of gaming experiences for different interests and playing styles.</p>
  <p>goPlay is designed to provide customers with an enjoyable and interactive digital experience through games that challenge speed, accuracy, memory, logic, strategy and reflexes.</p>

  <h4>A Variety of Games</h4>
  <p>goPlay brings together a growing collection of games across multiple categories.</p>
  <p>Customers can enjoy arcade games such as Ball Shooter, Ethiorunner, Brick Blitz, Sky Hopper and Helix Jump.</p>
  <p>Puzzle and brain-game fans can play 2048, Sudoku, Target 24, Cross Sum, Logic Grid, Sequence, Water Sort, Block Blast, Tile Connect, Hexa Block, Ball Sort, Jewel Match and Slide Puzzle.</p>
  <p>Customers who enjoy words and knowledge can explore Ethiopian Quiz, Spell Trivia, Vocabulary and Rhyme Time.</p>
  <p>The platform also includes competitive games such as Fruit Slice and other games that may be introduced as the service develops.</p>

  <h4>Play Your Way</h4>
  <p>Each game provides its own gameplay experience.</p>
  <p>Some games reward:</p>
  <ul>
    <li>Speed</li>
    <li>Accuracy</li>
    <li>Timing</li>
    <li>Memory</li>
    <li>Logical thinking</li>
    <li>Strategic decisions</li>
    <li>Reflexes</li>
    <li>Problem-solving</li>
    <li>Consistency</li>
    <li>High scores</li>
  </ul>
  <p>This gives customers the opportunity to explore different types of games and develop their own preferred playing style.</p>

  <h4>goPlay Tournament</h4>
  <p>goPlay also provides a competitive tournament experience.</p>
  <p>The tournament game is changed periodically to provide customers with a fresh competitive challenge.</p>
  <p>The current tournament game is Fruit Slice (ፍሩት ስላይስ).</p>
  <p>The tournament is held weekly, while the designated tournament game is changed monthly.</p>
  <p>Players compete based on their recorded performance and final scores.</p>

  <h4>Tournament Rewards</h4>
  <p>The current weekly tournament rewards the top five ranked players:</p>
  <ul>
    <li>1st Place – 50,000 ETB</li>
    <li>2nd Place – 25,000 ETB</li>
    <li>3rd Place – 15,000 ETB</li>
    <li>4th Place – 10,000 ETB</li>
    <li>5th Place – 5,000 ETB</li>
  </ul>
  <p>The applicable prize structure may be updated for future tournaments or promotional periods.</p>

  <h4>Instant Rewards</h4>
  <p>goPlay may also provide instant prizes through applicable games and promotional activities.</p>
  <p>The availability and value of instant prizes depend on the applicable game, promotion and eligibility conditions.</p>

  <h4>Subscription Experience</h4>
  <p>Customers can choose from available goPlay subscription packages according to their preferred usage frequency.</p>
  <p>The current packages are:</p>
  <ul>
    <li>goPlay Daily – 5 ETB</li>
    <li>goPlay Weekly – 15 ETB</li>
    <li>goPlay Monthly – 35 ETB</li>
  </ul>
  <p>Subscription gives eligible customers access to the applicable goPlay service and its available features.</p>

  <h4>Built for Entertainment</h4>
  <p>goPlay is designed to make digital gaming simple, accessible and engaging.</p>
  <p>Customers can move between different games, discover new challenges and participate in competitive activities through one gaming environment.</p>
  <p>New games, features and tournament experiences may be introduced over time.</p>

  <h4>Our Goal</h4>
  <p>The goal of goPlay is to provide customers with a reliable, enjoyable and continuously evolving gaming experience while maintaining clear participation rules, transparent subscription information and fair competition.</p>
  <p><strong>goPlay – Play. Compete. Enjoy.</strong></p>
`;

const PRICING_HTML = `
  <p class="acct-muted" style="margin-bottom:1rem;font-size:0.95rem;">Choose the goPlay package that best fits your gaming experience.</p>
  
  <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem;">Subscription Packages</h3>
  
  <div class="acct-card pricing-card fluid-btn" data-p="daily">
    <div class="pc-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
      <h4 class="pc-title" style="margin:0; font-size: 1.1rem; color: var(--accent);">goPlay Daily</h4>
      <div class="pc-price-block" style="text-align: right;">
        <span class="pc-price" style="display:block; font-weight:800; font-size:1.1rem;">5.00 ETB</span>
        <span class="pc-freq" style="color:#5f6368; font-size:0.8rem;">Daily</span>
      </div>
    </div>
    <p class="pc-desc" style="font-size:0.9rem; margin-bottom:1rem; color:#444;">The Daily package provides access to the applicable goPlay service according to the current service offering.</p>
    <div class="pc-action-row" style="background:#f5f6f8; border-radius:8px; padding:0.8rem; margin-bottom:0.8rem;">
      <div class="pc-action-col" style="display:flex; justify-content:space-between; margin-bottom: 0.4rem;">
        <span class="pc-label" style="font-size:0.85rem; color:#5f6368;">Subscribe via SMS</span>
        <span class="pc-value" style="font-size:0.9rem;">Send <strong>1</strong> to <strong>9402</strong></span>
      </div>
      <div class="pc-action-col" style="display:flex; justify-content:space-between;">
        <span class="pc-label" style="font-size:0.85rem; color:#5f6368;">Unsubscribe</span>
        <span class="pc-value" style="font-size:0.9rem;">Send <strong>STOP 1</strong> to <strong>9402</strong></span>
      </div>
    </div>
    <button class="btn-primary" style="width:100%; pointer-events: none;">Subscribe Now</button>
  </div>

  <div class="acct-card pricing-card fluid-btn" data-p="weekly">
    <div class="pc-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
      <h4 class="pc-title" style="margin:0; font-size: 1.1rem; color: var(--accent);">goPlay Weekly</h4>
      <div class="pc-price-block" style="text-align: right;">
        <span class="pc-price" style="display:block; font-weight:800; font-size:1.1rem;">15.00 ETB</span>
        <span class="pc-freq" style="color:#5f6368; font-size:0.8rem;">Weekly</span>
      </div>
    </div>
    <p class="pc-desc" style="font-size:0.9rem; margin-bottom:1rem; color:#444;">The Weekly package provides access to the applicable goPlay service according to the current service offering.</p>
    <div class="pc-action-row" style="background:#f5f6f8; border-radius:8px; padding:0.8rem; margin-bottom:0.8rem;">
      <div class="pc-action-col" style="display:flex; justify-content:space-between; margin-bottom: 0.4rem;">
        <span class="pc-label" style="font-size:0.85rem; color:#5f6368;">Subscribe via SMS</span>
        <span class="pc-value" style="font-size:0.9rem;">Send <strong>2</strong> to <strong>9402</strong></span>
      </div>
      <div class="pc-action-col" style="display:flex; justify-content:space-between;">
        <span class="pc-label" style="font-size:0.85rem; color:#5f6368;">Unsubscribe</span>
        <span class="pc-value" style="font-size:0.9rem;">Send <strong>STOP 2</strong> to <strong>9402</strong></span>
      </div>
    </div>
    <button class="btn-primary" style="width:100%; pointer-events: none;">Subscribe Now</button>
  </div>

  <div class="acct-card pricing-card fluid-btn" data-p="monthly">
    <div class="pc-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
      <h4 class="pc-title" style="margin:0; font-size: 1.1rem; color: var(--accent);">goPlay Monthly</h4>
      <div class="pc-price-block" style="text-align: right;">
        <span class="pc-price" style="display:block; font-weight:800; font-size:1.1rem;">35.00 ETB</span>
        <span class="pc-freq" style="color:#5f6368; font-size:0.8rem;">Monthly</span>
      </div>
    </div>
    <p class="pc-desc" style="font-size:0.9rem; margin-bottom:1rem; color:#444;">The Monthly package provides access to the applicable goPlay service according to the current service offering.</p>
    <div class="pc-action-row" style="background:#f5f6f8; border-radius:8px; padding:0.8rem; margin-bottom:0.8rem;">
      <div class="pc-action-col" style="display:flex; justify-content:space-between; margin-bottom: 0.4rem;">
        <span class="pc-label" style="font-size:0.85rem; color:#5f6368;">Subscribe via SMS</span>
        <span class="pc-value" style="font-size:0.9rem;">Send <strong>3</strong> to <strong>9402</strong></span>
      </div>
      <div class="pc-action-col" style="display:flex; justify-content:space-between;">
        <span class="pc-label" style="font-size:0.85rem; color:#5f6368;">Unsubscribe</span>
        <span class="pc-value" style="font-size:0.9rem;">Send <strong>STOP 3</strong> to <strong>9402</strong></span>
      </div>
    </div>
    <button class="btn-primary" style="width:100%; pointer-events: none;">Subscribe Now</button>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1rem;">Important Pricing Information</h3>
  <div class="acct-card info-body tc-body">
    <p>Subscription charges are based on the package selected by the customer.</p>
    <p>Customers should check the package name, price and frequency before confirming their subscription.</p>
    <p>Applicable mobile data or internet charges for accessing goPlay may be charged separately according to the customer's telecommunications package and usage.</p>
    <p>Pricing and package structures may be updated from time to time. Customers should refer to the latest information displayed on the official goPlay service channels.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1rem;">Tournament Prizes</h3>
  <div class="acct-card info-body tc-body">
    <p>The current weekly tournament prize structure is:</p>
    <div style="overflow-x:auto;">
      <table class="tc-table">
        <tr><th>Position</th><th>Prize</th></tr>
        <tr><td>1st</td><td>50,000 ETB</td></tr>
        <tr><td>2nd</td><td>25,000 ETB</td></tr>
        <tr><td>3rd</td><td>15,000 ETB</td></tr>
        <tr><td>4th</td><td>10,000 ETB</td></tr>
        <tr><td>5th</td><td>5,000 ETB</td></tr>
      </table>
    </div>
    <p>Tournament participation and prize eligibility are subject to the applicable goPlay Terms and Conditions.</p>
    <p><em>All prices are in Ethiopian Birr (ETB).</em></p>
  </div>
`;

const SUB_INFO_HTML = `
  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">What Happens After Subscription?</h3>
  <div class="acct-card info-body tc-body">
    <p>After a successful subscription request, the customer receives access to the applicable goPlay service according to the selected package.</p>
    <p>Customers can explore the available games and participate in applicable gaming activities.</p>
    <p>The available service features may include:</p>
    <ul>
      <li>Access to available games</li>
      <li>Competitive gaming</li>
      <li>Tournament participation where applicable</li>
      <li>Instant-prize opportunities where applicable</li>
      <li>Access to new games and features introduced to the platform</li>
    </ul>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Subscription Renewal</h3>
  <div class="acct-card info-body tc-body">
    <p>Where the selected package is recurring, the subscription may renew according to its applicable frequency.</p>
    <p>The applicable subscription fee will be charged according to the selected package and the applicable Ethio Telecom charging process.</p>
    <p>Customers should maintain sufficient balance for successful renewal.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">How to Unsubscribe</h3>
  <div class="acct-card info-body tc-body">
    <p>Customers can stop their applicable subscription using the corresponding SMS command.</p>
    <p>Daily: Send <strong>STOP 1</strong> to <strong>9402</strong></p>
    <p>Weekly: Send <strong>STOP 2</strong> to <strong>9402</strong></p>
    <p>Monthly: Send <strong>STOP 3</strong> to <strong>9402</strong></p>
    <p>Customers should use the unsubscription command corresponding to their active package.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">If You Have a Subscription Problem</h3>
  <div class="acct-card info-body tc-body">
    <p>If you subscribed but cannot access goPlay, first verify that:</p>
    <ul>
      <li>Your subscription request was successfully processed.</li>
      <li>You are using the mobile number associated with the subscription.</li>
      <li>Your service has not been unsubscribed or suspended.</li>
      <li>Your internet connection is working properly.</li>
      <li>The game or service is not temporarily unavailable.</li>
    </ul>
    <p>If the problem continues, contact goPlay customer support and provide your mobile number, subscription package, approximate subscription time and details of the problem.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Important Information</h3>
  <div class="acct-card info-body tc-body">
    <p>The subscription fee is separate from any applicable mobile-data or internet charges required to access the goPlay platform.</p>
    <p>Subscription packages, prices, features and promotional benefits may be changed in accordance with the applicable service terms.</p>
    <p>For the latest package information, always refer to the official goPlay portal.</p>
  </div>
`;

const HELP_SUB_HTML = `
  <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem;">Subscription Support</h3>
  <div class="acct-card info-body tc-body">
    <h4>I subscribed but cannot access goPlay</h4>
    <p>Please check that:</p>
    <ul>
      <li>Your subscription was successfully completed.</li>
      <li>You are accessing goPlay using the mobile number associated with your subscription.</li>
      <li>Your subscription has not been cancelled.</li>
      <li>Your internet connection is working.</li>
      <li>The service is currently available.</li>
    </ul>
    <p>If the problem continues, contact support.</p>
    
    <h4 style="margin-top:1.5rem;">I want to unsubscribe</h4>
    <p>Use the applicable SMS command:</p>
    <ul>
      <li>goPlay Daily: Send <strong>STOP 1</strong> to <strong>9402</strong></li>
      <li>goPlay Weekly: Send <strong>STOP 2</strong> to <strong>9402</strong></li>
      <li>goPlay Monthly: Send <strong>STOP 3</strong> to <strong>9402</strong></li>
    </ul>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Charging Support</h3>
  <div class="acct-card info-body tc-body">
    <h4>I was charged unexpectedly</h4>
    <p>If you believe that you were charged incorrectly, contact support and provide:</p>
    <ul>
      <li>Your mobile number</li>
      <li>Subscription package</li>
      <li>Date and approximate time of the charge</li>
      <li>Charged amount</li>
      <li>Any available SMS confirmation</li>
      <li>Description of the issue</li>
    </ul>
    <p>The transaction and subscription information can then be reviewed through the applicable support process.</p>
    
    <h4 style="margin-top:1.5rem;">My subscription did not renew</h4>
    <p>Please check whether sufficient balance was available at the time of renewal.</p>
    <p>If sufficient balance was available but the subscription was not renewed correctly, contact support for investigation.</p>
  </div>
`;

const HELP_GAME_HTML = `
  <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem;">Game Support</h3>
  <div class="acct-card info-body tc-body">
    <h4>The game is not loading</h4>
    <p>Please try the following:</p>
    <ul>
      <li>Check your mobile internet connection.</li>
      <li>Refresh the goPlay page.</li>
      <li>Close and reopen the browser.</li>
      <li>Try again after a short period.</li>
      <li>If the issue continues, contact support.</li>
    </ul>

    <h4 style="margin-top:1.5rem;">My game stopped during play</h4>
    <p>If a game stops unexpectedly, record the approximate time, game name and any available error message or screenshot.</p>
    <p>Contact support with these details so the issue can be investigated.</p>

    <h4 style="margin-top:1.5rem;">My score is incorrect</h4>
    <p>If you believe that your score has been incorrectly recorded:</p>
    <ul>
      <li>Note the game name.</li>
      <li>Note the approximate time you played.</li>
      <li>Keep any screenshot available.</li>
      <li>Provide your mobile number.</li>
      <li>Contact support.</li>
    </ul>
    <p>The applicable system records will be reviewed according to the service process.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Tournament & Prize Support</h3>
  <div class="acct-card info-body tc-body">
    <h4>I participated in the tournament but my score is not showing</h4>
    <p>Please provide:</p>
    <ul>
      <li>Mobile number</li>
      <li>Tournament game</li>
      <li>Approximate gameplay time</li>
      <li>Screenshot of the score, if available</li>
      <li>Any relevant error message</li>
    </ul>
    <p>Support will review the issue through the applicable tournament and system records.</p>

    <h4 style="margin-top:1.5rem;">I believe the leaderboard is incorrect</h4>
    <p>The official tournament ranking is based on validated system records.</p>
    <p>If you believe there is an error, contact support with your mobile number, game name, score and relevant evidence.</p>

    <h4 style="margin-top:1.5rem;">I believe I won a prize</h4>
    <p>Prize winners may be subject to eligibility and identity verification before the prize is delivered.</p>
    <p>If you believe you are an eligible winner but have not received the relevant communication, contact support.</p>

    <h4 style="margin-top:1.5rem;">What information should I provide for prize support?</h4>
    <p>Please provide:</p>
    <ul>
      <li>Mobile number used for goPlay</li>
      <li>Game or tournament name</li>
      <li>Date of participation</li>
      <li>Approximate time of participation</li>
      <li>Rank or score, if available</li>
      <li>Any winner notification received</li>
    </ul>
    <p><strong>Note:</strong> Do not share passwords, PINs or other confidential security credentials with anyone claiming to provide goPlay support.</p>
  </div>
`;

const HELP_TECH_HTML = `
  <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem;">Technical Support</h3>
  <div class="acct-card info-body tc-body">
    <p>If you experience a technical problem, please provide as much information as possible:</p>
    <ul>
      <li>Mobile number</li>
      <li>Device type</li>
      <li>Browser used</li>
      <li>Game name</li>
      <li>Date and time of the problem</li>
      <li>Description of the issue</li>
      <li>Screenshot, if available</li>
      <li>Error message, if displayed</li>
    </ul>
    <p>Providing complete information helps the support team investigate the issue more efficiently.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Account and Security</h3>
  <div class="acct-card info-body tc-body">
    <p>Customers should keep their mobile number and account access secure.</p>
    <p>Do not share:</p>
    <ul>
      <li>Account passwords</li>
      <li>One-time passwords (OTP)</li>
      <li>PINs</li>
      <li>Authentication codes</li>
      <li>Other confidential security information</li>
    </ul>
    <p>Official support personnel will not require customers to disclose confidential authentication credentials unnecessarily.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Service Issues</h3>
  <div class="acct-card info-body tc-body">
    <p>Some problems may be caused by temporary network interruptions, scheduled maintenance, system updates or circumstances outside the direct control of the service provider.</p>
    <p>Where a technical interruption occurs, reasonable efforts will be made to restore service as soon as practicable.</p>
  </div>
`;

const HELP_CONTACT_HTML = `
  <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem;">Contact Support</h3>
  <div class="acct-card info-body tc-body" style="text-align:center;">
    <p style="font-size:1.1rem; color:#14271a; margin-bottom:1rem;">For goPlay assistance, please use the official customer-support channel:</p>
    <div style="background:#f5f6f8; border-radius:8px; padding:1.5rem; margin-bottom:1rem;">
      <span style="display:block; font-size:0.9rem; color:#5f6368; text-transform:uppercase; font-weight:800; letter-spacing:0.05em; margin-bottom:0.5rem;">Customer Support</span>
      <strong style="font-size:2.5rem; color:var(--accent);">9090</strong>
    </div>
    <p style="font-size:0.9rem; color:#5f6368;">When contacting support, please provide accurate information so your request can be identified and investigated.</p>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Before Contacting Support</h3>
  <div class="acct-card info-body tc-body">
    <p>To help resolve your issue quickly, please have the following information ready:</p>
    <ol>
      <li>Your mobile number</li>
      <li>Your goPlay package</li>
      <li>Game name</li>
      <li>Date and approximate time of the issue</li>
      <li>Description of the problem</li>
      <li>Screenshot or error message, if available</li>
    </ol>
  </div>

  <h3 class="acct-title" style="font-size:1.15rem; margin-top:1.5rem;">Important Security Notice</h3>
  <div class="acct-card info-body tc-body" style="border-left:4px solid #ea4335;">
    <p><strong>Never provide your password, OTP, PIN or other confidential authentication information to another person.</strong></p>
    <p>If you receive a suspicious message or communication claiming to be from goPlay or Ethio Telecom, do not share confidential information and report the matter through the official customer-support channel.</p>
  </div>
`;

// FAQ entries (EN/AM). Rendered as question/answer blocks.
const FAQ: Array<{ q: string; a: string }> = [
  { q: '1. What is goPlay?', a: '<p>goPlay is a digital gaming and entertainment platform offering a variety of arcade, puzzle, brain, trivia, logic, casual and competitive games.</p>' },
  { q: '2. Who can use goPlay?', a: '<p>Eligible Ethio Telecom customers who can access the supported goPlay service channels can use the service, subject to the applicable Terms and Conditions.</p>' },
  { q: '3. What games are available on goPlay?', a: '<p>goPlay offers a variety of games, including:</p><p>Ball Shooter, 2048, Ethiorunner, Brick Blitz, Fruit Slice, Sky Hopper, Bubble Pop, Memory Match, Tap Game, Candy Blast, Ethiopian Quiz, Sudoku, Spell Trivia, Vocabulary, Rhyme Time, Target 24, Cross Sum, Logic Grid, Sequence, Water Sort, Block Blast, Tile Connect, Hexa Block, Helix Jump, Ball Sort, Jewel Match and Slide Puzzle.</p><p>The available game list may change as new games are introduced or existing games are updated.</p>' },
  { q: '4. Is goPlay available through a subscription?', a: '<p>Yes. Customers can subscribe to available goPlay packages.</p><p>The current packages are:</p><ul><li>Daily – 5 ETB</li><li>Weekly – 15 ETB</li><li>Monthly – 35 ETB</li></ul>' },
  { q: '5. How do I subscribe to goPlay Daily?', a: '<p>Send:</p><p>1 to 9402</p><p>The Daily package costs 5 ETB.</p>' },
  { q: '6. How do I subscribe to goPlay Weekly?', a: '<p>Send:</p><p>2 to 9402</p><p>The Weekly package costs 15 ETB.</p>' },
  { q: '7. How do I subscribe to goPlay Monthly?', a: '<p>Send:</p><p>3 to 9402</p><p>The Monthly package costs 35 ETB.</p>' },
  { q: '8. How do I unsubscribe from goPlay Daily?', a: '<p>Send:</p><p>STOP 1 to 9402</p>' },
  { q: '9. How do I unsubscribe from goPlay Weekly?', a: '<p>Send:</p><p>STOP 2 to 9402</p>' },
  { q: '10. How do I unsubscribe from goPlay Monthly?', a: '<p>Send:</p><p>STOP 3 to 9402</p>' },
  { q: '11. Is the subscription recurring?', a: '<p>The applicable subscription package may renew according to its defined frequency until the customer unsubscribes or the service is otherwise stopped.</p>' },
  { q: '12. What happens if I do not have enough balance?', a: '<p>A subscription or renewal may not be successfully processed if the required subscription amount is not available.</p><p>If you experience an unexpected charging or subscription issue, contact customer support for assistance.</p>' },
  { q: '13. What is the goPlay tournament?', a: '<p>The goPlay tournament is a competitive gaming activity in which eligible players compete based on their performance and final scores.</p>' },
  { q: '14. How often is the tournament held?', a: '<p>The tournament is held weekly.</p>' },
  { q: '15. Which game is currently used for the tournament?', a: '<p>The current tournament game is:</p><p>Fruit Slice (ፍሩት ስላይስ)</p><p>The tournament game is planned to change on a monthly basis.</p>' },
  { q: '16. What are the tournament prizes?', a: '<p>The current weekly tournament prizes are:</p><ul><li>1st Place – 50,000 ETB</li><li>2nd Place – 25,000 ETB</li><li>3rd Place – 15,000 ETB</li><li>4th Place – 10,000 ETB</li><li>5th Place – 5,000 ETB</li></ul>' },
  { q: '17. How is the tournament winner determined?', a: '<p>Players are ranked according to the applicable final score recorded by the goPlay system.</p><p>The official ranking is based on validated system records and the applicable game and tournament rules.</p>' },
  { q: '18. Can I play Fruit Slice without joining the tournament?', a: '<p>Game availability and tournament eligibility depend on the applicable goPlay service configuration.</p><p>The game may be available for normal gameplay while the tournament uses the designated tournament rules.</p>' },
  { q: '19. What are instant prizes?', a: '<p>Instant prizes are rewards that may be awarded through applicable games or promotional activities without waiting for the end of a tournament.</p><p>Availability and prize types depend on the applicable promotion and service rules.</p>' },
  { q: '20. How will I know if I win a prize?', a: '<p>Eligible winners may be contacted through the mobile number associated with their participation.</p><p>Additional verification may be required before prize delivery.</p>' },
  { q: '21. What information may be required to claim a prize?', a: '<p>Depending on the prize, customers may be required to provide identification or other information necessary to verify their eligibility and process the prize.</p>' },
  { q: '22. Can another person claim my prize?', a: '<p>Prize-claim procedures depend on the applicable prize and verification requirements.</p><p>Where representation by another person is permitted, appropriate authorization and identification may be required.</p>' },
  { q: '23. Can prizes be transferred to another customer?', a: '<p>Unless explicitly permitted under the applicable prize rules, prizes should not be assumed to be transferable.</p>' },
  { q: '24. What happens if there is an error in my score?', a: '<p>If you believe your score has not been recorded correctly, contact customer support as soon as possible.</p><p>Provide your mobile number, game name, approximate playing time and any available screenshot or relevant information.</p>' },
  { q: '25. What should I do if the game stops working?', a: '<p>Check your internet connection and try accessing the game again.</p><p>If the problem continues, contact support and provide details of your device, game name and the issue you experienced.</p>' },
  { q: '26. What should I do if I was charged but cannot access goPlay?', a: '<p>Contact customer support and provide:</p><ul><li>Your mobile number</li><li>Package subscribed to</li><li>Approximate subscription time</li><li>Charging information, if available</li><li>Description of the problem</li></ul><p>The issue can then be investigated through the applicable support process.</p>' },
  { q: '27. Does playing goPlay use mobile data?', a: '<p>Accessing the online goPlay platform may consume mobile data.</p><p>Any applicable data charges are separate from the goPlay subscription fee unless otherwise stated.</p>' },
  { q: '28. Can the games change?', a: '<p>Yes. goPlay may add new games, update existing games, replace games or temporarily remove games as part of service improvement.</p>' },
  { q: '29. Can the tournament game change?', a: '<p>Yes. The tournament game is planned to change on a monthly basis.</p>' },
  { q: '30. What happens if the service is temporarily unavailable?', a: '<p>Temporary interruptions may occur because of maintenance, upgrades, network issues or other technical circumstances.</p><p>The service will be restored as soon as reasonably practicable.</p>' },
  { q: '31. How can I unsubscribe?', a: '<p>Use the corresponding SMS command:</p><p>Daily: STOP 1 to 9402</p><p>Weekly: STOP 2 to 9402</p><p>Monthly: STOP 3 to 9402</p>' },
  { q: '32. Where can I get help?', a: '<p>For assistance with subscription, charging, games, tournament participation, scores, prizes or technical problems, contact goPlay customer support through the official support channel provided on the portal.</p>' },
  { q: '33. Where can I find the Terms and Conditions?', a: '<p>The current Terms and Conditions are available through the goPlay portal.</p><p>Customers are encouraged to review them before subscribing or participating in promotional activities.</p>' },
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
      ${acctUser ? `
      <div class="acct-nav-sec">SESSION</div>
      <nav class="acct-menu-list">
        ${accountRowHtml('aLogout', '🚪', t('signOut'), true, true)}
      </nav>` : ''}
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
    stack.querySelector('#subIdSignOut')?.addEventListener('click', () => pushAcctPage('logout'));
  } else if (pageId === 'invite') {
    stack.innerHTML = `<h2 class="acct-title">💌 ${t('invite')}</h2>` + referralHtml(acctRef);
    wireReferral();
  } else if (pageId === 'about') {
    stack.innerHTML = `<h2 class="acct-title">ℹ️ ${t('about')}</h2>
      <div class="acct-card info-body tc-body">${ABOUT_HTML}</div>`;
  } else if (pageId === 'help') {
    stack.innerHTML = `
      <h2 class="acct-title">Help & Support</h2>
      <p class="acct-muted" style="margin-bottom:1.5rem;font-size:0.95rem;">We're here to help. Our support service is available to assist customers with questions and issues.</p>
      
      <div class="support-hub">
        <button class="support-card support-card-primary" id="sFAQ">
          <div class="support-icon">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          </div>
          <div class="support-content">
            <h3 class="support-title">FAQ</h3>
            <p class="support-desc">Find quick answers to common questions about goPlay.</p>
          </div>
          <span class="support-chev">›</span>
        </button>
        
        <button class="support-card" id="sSubHelp">
          <div class="support-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div class="support-content">
            <h3 class="support-title">Subscription Help</h3>
            <p class="support-desc">Help with renewals, packages, and billing.</p>
          </div>
          <span class="support-chev">›</span>
        </button>
        
        <button class="support-card" id="sGameHelp">
          <div class="support-icon">
            <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" opacity="0"></path><rect x="2" y="6" width="20" height="12" rx="2" ry="2"></rect><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"></path></svg>
          </div>
          <div class="support-content">
            <h3 class="support-title">Game Help</h3>
            <p class="support-desc">Tournaments, leaderboards, and game issues.</p>
          </div>
          <span class="support-chev">›</span>
        </button>
        
        <button class="support-card" id="sTechHelp">
          <div class="support-icon">
            <svg viewBox="0 0 24 24"><path d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"></path><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path></svg>
          </div>
          <div class="support-content">
            <h3 class="support-title">Account Help</h3>
            <p class="support-desc">Account settings, login issues, and technical support.</p>
          </div>
          <span class="support-chev">›</span>
        </button>
        
        <button class="support-card" id="sContact">
          <div class="support-icon">
            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          </div>
          <div class="support-content">
            <h3 class="support-title">Contact Support</h3>
            <p class="support-desc">Get in touch with our customer service team.</p>
          </div>
          <span class="support-chev">›</span>
        </button>
      </div>
    `;
    stack.querySelector('#sFAQ')!.addEventListener('click', () => pushAcctPage('faq'));
    stack.querySelector('#sSubHelp')!.addEventListener('click', () => pushAcctPage('help_sub'));
    stack.querySelector('#sGameHelp')!.addEventListener('click', () => pushAcctPage('help_game'));
    stack.querySelector('#sTechHelp')!.addEventListener('click', () => pushAcctPage('help_tech'));
    stack.querySelector('#sContact')!.addEventListener('click', () => pushAcctPage('help_contact'));
  } else if (pageId === 'help_sub') {
    stack.innerHTML = `<h2 class="acct-title">💳 Subscription Help</h2>
      <div class="help-body">${HELP_SUB_HTML}</div>`;
  } else if (pageId === 'help_game') {
    stack.innerHTML = `<h2 class="acct-title">🎮 Game Help</h2>
      <div class="help-body">${HELP_GAME_HTML}</div>`;
  } else if (pageId === 'help_tech') {
    stack.innerHTML = `<h2 class="acct-title">⚙️ Technical Help</h2>
      <div class="help-body">${HELP_TECH_HTML}</div>`;
  } else if (pageId === 'help_contact') {
    stack.innerHTML = `<h2 class="acct-title">📞 Contact Support</h2>
      <div class="help-body">${HELP_CONTACT_HTML}</div>`;
  } else if (pageId === 'faq') {
    stack.innerHTML = `<h2 class="acct-title">💬 ${t('faq')}</h2>
      <div class="faq-body">
        ${FAQ.map((f) => `
          <div class="faq-item">
            <button class="faq-q-btn">
              <span class="faq-q-text">${f.q}</span>
              <span class="faq-q-icon">＋</span>
            </button>
            <div class="faq-a-content">
              <div class="faq-a-wrapper">
                <div class="faq-a-inner">${f.a}</div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
    stack.querySelectorAll<HTMLButtonElement>('.faq-q-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item')!;
        const isOpen = item.classList.contains('open');
        
        if (!isOpen) {
          item.classList.add('open');
          btn.querySelector('.faq-q-icon')!.textContent = '−';
          if (!history.state?.faqOpen) {
            history.pushState({ acctModalOpen: true, acctPage: 'faq', faqOpen: true }, '', location.href);
          }
        } else {
          item.classList.remove('open');
          btn.querySelector('.faq-q-icon')!.textContent = '＋';
          const anyOpen = stack.querySelectorAll('.faq-item.open').length > 0;
          if (!anyOpen && history.state?.faqOpen) {
            history.back(); // Triggers popstate to cleanly unwind the stack
          }
        }
      });
    });

  } else if (pageId === 'terms') {
    stack.innerHTML = `<h2 class="acct-title">📄 ${t('terms')}</h2>
      <div class="acct-card info-body tc-body">${TERMS_HTML}</div>`;
  } else if (pageId === 'pricing') {
    stack.innerHTML = `<h2 class="acct-title">🏷️ Pricing</h2>
      <div class="pricing-body">${PRICING_HTML}</div>`;
    stack.querySelectorAll<HTMLElement>('.pricing-card').forEach((card) => {
      card.addEventListener('click', () => {
        const p = card.dataset.p as SubPeriod;
        openSubPay(p);
      });
    });
  } else if (pageId === 'subscription') {
    const sub = currentSub();
    let subStatusHtml = '';

    if (sub) {
      const plan = SUB_PLANS.find(p => p.period === sub.period);
      const price = plan ? plan.priceEtb : 0;
      subStatusHtml = `
        <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem; margin-bottom:0.8rem;">Current Subscription</h3>
        <div class="acct-card" style="border-left: 4px solid var(--accent); margin-bottom: 1.5rem;">
          <div class="acct-row" style="margin-bottom:0.5rem;">
            <span style="font-weight:800; font-size:1.1rem; color:var(--text, #14271a);">goPlay ${periodLabel(sub.period)}</span>
            <span style="color:var(--accent); font-weight:800; font-size:0.85rem; text-transform:uppercase; background:rgba(0,186,81,0.1); padding:0.2rem 0.6rem; border-radius:6px; letter-spacing:0.05em;">Active</span>
          </div>
          <p style="font-size:0.95rem; color:#444; margin:0 0 0.4rem 0;">Price: <strong>${price} ETB</strong></p>
          <p style="font-size:0.95rem; color:#444; margin:0 0 0.8rem 0;">Expires: <strong>${new Date(sub.expiresAt).toLocaleDateString()}</strong></p>
          <p style="font-size:0.9rem; color:#5f6368; line-height:1.4; margin:0; padding-top:0.6rem; border-top:1px solid #f0f1f3;">Enjoy full access to all premium games, leaderboards, and tournament eligibility.</p>
        </div>
      `;
    }

    stack.innerHTML = `
      <h2 class="acct-title" style="margin-bottom:1rem;">⭐ Subscription</h2>
      ${subStatusHtml}
      
      <h3 class="acct-title" style="font-size:1.15rem; margin-top:0.5rem;">Available Subscriptions</h3>
      <p class="acct-muted" style="margin-bottom:1rem; font-size:0.95rem; line-height:1.4;">Choose the package that matches your preferred subscription frequency and follow the corresponding SMS instruction.</p>
      <div class="plan-list" id="acctPlanList"></div>
      ${trialAvailable() ? `<p class="plan-trial">🎁 ${t('freeTrial')}</p>` : ''}
      <button class="btn-primary" id="planNext" style="margin-top:0.8rem; width:100%;">${t('subscribeNow')}</button>
      
      ${SUB_INFO_HTML}
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
    
    const nextBtn = stack.querySelector<HTMLButtonElement>('#planNext')!;
    nextBtn.addEventListener('click', () => {
      // Add a subtle loading/processing effect as required by the interaction rules
      const origText = nextBtn.textContent;
      nextBtn.innerHTML = '<span class="spinner" style="border-color:currentColor; border-right-color:transparent; width:1rem; height:1rem; display:inline-block; vertical-align:middle; margin-right:0.5rem;"></span>Processing...';
      nextBtn.disabled = true;
      nextBtn.style.opacity = '0.8';
      
      // Delay slightly for effect, then open real payment modal
      setTimeout(() => {
        openSubPay(chosen);
        nextBtn.textContent = origText;
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
      }, 150);
    });
  } else if (pageId === 'logout') {
    stack.innerHTML = `
      <h2 class="acct-title">🚪 ${t('signOut')}?</h2>
      <p class="acct-muted" style="margin-top: 0.5rem; margin-bottom: 2rem;">${getLang() === 'am' ? 'እርግጠኛ ነዎት ከመለያዎ መውጣት ይፈልጋሉ?' : 'Are you sure you want to log out of your account?'}</p>
      <div style="display: flex; gap: 1rem;">
        <button class="btn-secondary" id="logoutCancel" style="flex: 1;">${getLang() === 'am' ? 'ሰርዝ' : 'Cancel'}</button>
        <button class="btn-primary" id="logoutConfirm" style="flex: 1; background: #dc3545; color: white; border-color: #dc3545;">${t('signOut')}</button>
      </div>
      <p class="ref-msg err" id="logoutErr" style="display:none; margin-top:1rem;"></p>
    `;
    stack.querySelector('#logoutCancel')?.addEventListener('click', () => history.back());
    stack.querySelector('#logoutConfirm')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await signOut();
        location.replace('/');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = t('signOut');
        const errEl = stack.querySelector('#logoutErr') as HTMLElement;
        errEl.style.display = 'block';
        errEl.textContent = getLang() === 'am' ? 'መውጣት አልተሳካም። እባክዎ ግንኙነትዎን ያረጋግጡና እንደገና ይሞክሩ።' : 'Logout failed. Please check your connection and try again.';
      }
    });
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

  // Did we pop all the way out of the modal flow?
  if (!e.state?.acctModalOpen) {
    window.removeEventListener('popstate', handleAcctPopState);
    acctModal.remove();
    acctModal = null;
    return;
  }

  const newPage = e.state.acctPage || null;
  const currentPage = acctModal.dataset.pageId || null;

  // Transient state handler for FAQ
  if (newPage === 'faq' && currentPage === 'faq') {
    if (!e.state.faqOpen) {
      acctModal.querySelectorAll('.faq-item.open').forEach(f => f.classList.remove('open'));
      acctModal.querySelectorAll('.faq-q-icon').forEach(i => i.textContent = '＋');
    }
    return; // Skip re-rendering to preserve scroll position
  }

  renderAcctStack(newPage);
}

function pushAcctPage(pageId: string): void {
  history.pushState({ acctModalOpen: true, acctPage: pageId }, '', location.href);
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
  
  // Ensure we don't bind multiple times if shell is re-invoked
  window.removeEventListener('popstate', handleAcctPopState);
  window.addEventListener('popstate', handleAcctPopState);
  
  acctModal.querySelector('#closeAcctBtn')!.addEventListener('click', () => {
    // We always have a history state pushed when shell is used, so history.back() is perfectly safe.
    history.back();
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
  
  history.pushState({ acctModalOpen: true, acctPage: null }, '', location.href);
  shell();
  renderAcctStack(null);
}

export function openPublicAccountPage(pageId: string): void {
  injectStyles();
  shell();
  pushAcctPage(pageId);
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
  m.querySelector('#aLogout')?.addEventListener('click', () => pushAcctPage('logout'));
}

const SUB_KEY: Record<SubPeriod, keyof typeof STR.en> = { daily: 'perDay', weekly: 'perWeek', monthly: 'perMonth' };

export function openPlans(): void {
  history.pushState({ acctModalOpen: true, acctPage: null }, '', location.href);
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
  history.pushState({ acctModalOpen: true, acctPage: null }, '', location.href);
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
  history.pushState({ acctModalOpen: true, acctPage: null }, '', location.href);
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
    .pricing-card { cursor: pointer; transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s; -webkit-tap-highlight-color: transparent; }
    .pricing-card:active { transform: scale(0.98); box-shadow: 0 1px 4px rgba(0,0,0,.05); }
    .faq-body { padding: 0; width: 100%; }
    .faq-item { background: #fff; border-radius: 16px; margin-bottom: 0.6rem; border: 1px solid #e8eaed; box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow: hidden; }
    .faq-q-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.8rem; padding: 1rem 1.1rem; background: transparent; border: none; font: inherit; color: var(--text, #14271a); font-weight: 800; font-size: 1.05rem; text-align: left; cursor: pointer; transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s; -webkit-tap-highlight-color: transparent; position: relative; }
    .faq-q-btn:active { transform: scale(0.98); background: #f9f9f9; }
    .faq-q-icon { font-size: 1.4rem; font-weight: 400; color: var(--accent); flex-shrink: 0; }
    .faq-a-content { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
    .faq-a-wrapper { overflow: hidden; }
    .faq-a-inner { padding: 0 1.1rem 1rem; color: #5f6368; font-size: 0.95rem; line-height: 1.5; }
    .faq-a-inner p, .faq-a-inner ul { margin: 0 0 0.8rem; }
    .faq-a-inner ul { padding-left: 1.2rem; }
    .faq-a-inner p:last-child, .faq-a-inner ul:last-child { margin-bottom: 0; }
    .faq-item.open .faq-a-content { grid-template-rows: 1fr; }
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
