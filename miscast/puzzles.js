// ═══════════════════════════════════════════════════════════════
// MISCAST — Puzzle Data
// ═══════════════════════════════════════════════════════════════
// Errors stored as { wrong, right[] } — positions resolved at runtime
// by matching the wrong word in the tokenized text (each wrong word
// appears exactly once per passage).

const PUZZLES = {

  // ─── EASY: ~50 words, 3 errors, obvious homophones ───────────

  easy: [
    {
      id: "e1",
      theme: "Getting Started",
      text: "Starting a podcast is easier than most people think. You do not kneed expensive equipment or a fancy studio too get started. All you really need is a quiet room and a descent microphone.",
      errors: [
        { wrong: "kneed", right: ["need"] },
        { wrong: "too", right: ["to"] },
        { wrong: "descent", right: ["decent"] }
      ]
    },
    {
      id: "e2",
      theme: "Growing Your Show",
      text: "The best weigh to grow your audience is to create content people want to share. Quality always wins over quantity in the end, and listeners can tell when someone truly cares about there craft. That sincerity is what keeps people coming back every single weak.",
      errors: [
        { wrong: "weigh", right: ["way"] },
        { wrong: "there", right: ["their"] },
        { wrong: "weak", right: ["week"] }
      ]
    },
    {
      id: "e3",
      theme: "Stage Fright",
      text: "Public speaking is a skill anyone can develop. The biggest mistake beginners make is trying to memorize there entire speech word for word. It is much better too simply know your main points and let the rest flow naturally. Your audience will never no the difference.",
      errors: [
        { wrong: "there", right: ["their"] },
        { wrong: "too", right: ["to"] },
        { wrong: "no", right: ["know"] }
      ]
    },
    {
      id: "e4",
      theme: "The Reading Habit",
      text: "Reading is won of the best habits you can develop for long-term success. Even thirty minutes a day can make a huge difference over the coarse of a year. The key is to choose books that genuinely interest you rather than forcing yourself threw something boring.",
      errors: [
        { wrong: "won", right: ["one"] },
        { wrong: "coarse", right: ["course"] },
        { wrong: "threw", right: ["through"] }
      ]
    },
    {
      id: "e5",
      theme: "Rise and Shine",
      text: "A good mourning routine sets the tone for the rest of the day. Weather you prefer exercise or meditation, the key is doing something positive before checking your phone. Even a short walk can make a noticeable difference in you're mood and energy.",
      errors: [
        { wrong: "mourning", right: ["morning"] },
        { wrong: "Weather", right: ["whether"] },
        { wrong: "you're", right: ["your"] }
      ]
    },
    {
      id: "e6",
      theme: "Home Cooking",
      text: "Cooking at home is not only healthier but it also saves a surprising amount of money over thyme. You do not kneed to be a professional chef to make great meals. Start with simple recipes and build your skills from their.",
      errors: [
        { wrong: "thyme", right: ["time"] },
        { wrong: "kneed", right: ["need"] },
        { wrong: "their", right: ["there"] }
      ]
    },
    {
      id: "e7",
      theme: "Wanderlust",
      text: "Traveling opens your mind too new cultures and perspectives. The best trips are the ones wear you step outside your comfort zone and try something completely new. Even if things do not go exactly write, the memories you make are always worth it.",
      errors: [
        { wrong: "too", right: ["to"] },
        { wrong: "wear", right: ["where"] },
        { wrong: "write", right: ["right"] }
      ]
    }
  ],

  // ─── MEDIUM: ~80-100 words, 5 errors, moderate homophones ───

  medium: [
    {
      id: "m1",
      theme: "The Future of Podcasting",
      text: "Podcasting has scene tremendous growth in the passed few years, with new shows launching every weak. Industry experts say the medium continues to altar how people consume news and entertainment, making it perhaps the most personal and immersive manor of storytelling available today.",
      errors: [
        { wrong: "scene", right: ["seen"] },
        { wrong: "passed", right: ["past"] },
        { wrong: "weak", right: ["week"] },
        { wrong: "altar", right: ["alter"] },
        { wrong: "manor", right: ["manner"] }
      ]
    },
    {
      id: "m2",
      theme: "The Art of Conversation",
      text: "A grate interviewer knows that the best conversations require patients and a willingness to let moments breathe. The best episodes are those wear preparation meets spontaneity, creating something that feels entirely fresh. Striking the perfect cord between casual and professional is an art, and the rode from amateur to expert is long but rewarding.",
      errors: [
        { wrong: "grate", right: ["great"] },
        { wrong: "patients", right: ["patience"] },
        { wrong: "wear", right: ["where"] },
        { wrong: "cord", right: ["chord"] },
        { wrong: "rode", right: ["road"] }
      ]
    },
    {
      id: "m3",
      theme: "The Entrepreneur's Dilemma",
      text: "Every entrepreneur faces a moment where they must decide weather to keep going or walk away. The first year is always the hardest, as you poor your sole into something that might knot work. But those who push threw the doubt often find that persistence was the only ingredient that mattered.",
      errors: [
        { wrong: "weather", right: ["whether"] },
        { wrong: "poor", right: ["pour"] },
        { wrong: "sole", right: ["soul"] },
        { wrong: "knot", right: ["not"] },
        { wrong: "threw", right: ["through"] }
      ]
    },
    {
      id: "m4",
      theme: "The Science of Sound",
      text: "Sound travels through the heir at roughly three hundred and forty-three meters per second, depending on conditions. When we here music, our brains process complex weigh patterns, converting them into emotional responses almost instantly. This is why a well-produced podcast can move listeners to tears, even when the subject might seam entirely plane.",
      errors: [
        { wrong: "heir", right: ["air"] },
        { wrong: "here", right: ["hear"] },
        { wrong: "weigh", right: ["wave"] },
        { wrong: "seam", right: ["seem"] },
        { wrong: "plane", right: ["plain"] }
      ]
    },
    {
      id: "m5",
      theme: "Morning Routines",
      text: "Most successful creators will tell you that mourning routines are the foundation of productivity. Waking up at the same thyme each day gives your body a natural rhythm that aids focus. Some people right in a journal while others exercise, but the key is consistency. Even a brief brake for quiet reflection can set the tone for ours of focused creative work.",
      errors: [
        { wrong: "mourning", right: ["morning"] },
        { wrong: "thyme", right: ["time"] },
        { wrong: "right", right: ["write"] },
        { wrong: "brake", right: ["break"] },
        { wrong: "ours", right: ["hours"] }
      ]
    },
    {
      id: "m6",
      theme: "The Golden Age of Radio",
      text: "Before podcasts, their was radio, and it rained as the dominant medium for nearly a century. Families wood gather in the living room to listen to news, dramas, and comedy shows. The intimate connection between host and listener has always been its greatest feet. Today, that same bond lives on through podcasts, witch carry the flair of personal storytelling into the digital age.",
      errors: [
        { wrong: "their", right: ["there"] },
        { wrong: "rained", right: ["reigned"] },
        { wrong: "wood", right: ["would"] },
        { wrong: "feet", right: ["feat"] },
        { wrong: "witch", right: ["which"] }
      ]
    },
    {
      id: "m7",
      theme: "Creative Burnout",
      text: "Every creative professional will eventually meat the wall of burnout. The sighs are predictable but easy to ignore: declining output, racing thoughts, and a growing sense of board. The cure is rarely to work harder. Instead, most experts advise stepping away from your craft to fined perspective. Even a short paws can produce more insight than a month of grinding.",
      errors: [
        { wrong: "meat", right: ["meet"] },
        { wrong: "sighs", right: ["signs"] },
        { wrong: "board", right: ["bored"] },
        { wrong: "fined", right: ["find"] },
        { wrong: "paws", right: ["pause"] }
      ]
    },
    {
      id: "m8",
      theme: "The Power of Storytelling",
      text: "Humans have told stories since the very start, and the best storytellers no how to weave emotion into every seen. A compelling narrative can transport you to another place entirely. The affect of a great story on our sole is something neuroscience is only beginning to understand, and the latest studies have lead to fascinating insights about the human brain.",
      errors: [
        { wrong: "no", right: ["know"] },
        { wrong: "seen", right: ["scene"] },
        { wrong: "affect", right: ["effect"] },
        { wrong: "sole", right: ["soul"] },
        { wrong: "lead", right: ["led"] }
      ]
    },
    {
      id: "m9",
      theme: "The Editor's Craft",
      text: "A good editor knows that less is often moor when it comes to polishing content. Every unnecessary word should be throne out without mercy. The goal is to distill your message down to its purest form, where every sentence earns its plaice and nothing is waisted. Great editing requires patience and the courage to bee ruthless with your own words until only the essential remains.",
      errors: [
        { wrong: "moor", right: ["more"] },
        { wrong: "throne", right: ["thrown"] },
        { wrong: "plaice", right: ["place"] },
        { wrong: "waisted", right: ["wasted"] },
        { wrong: "bee", right: ["be"] }
      ]
    },
    {
      id: "m10",
      theme: "Building an Audience",
      text: "Growing a loyal audience is a long journey, but the willingness to show up every day, even when know one seems to be listening, is what separates lasting creators from those who simply fade from site. The key is to deliver value that resonates on a personnel level with your community. Your listeners can always tell when content is genuine, and once that trust is billed, your audience becomes you're greatest champion.",
      errors: [
        { wrong: "know", right: ["no"] },
        { wrong: "site", right: ["sight"] },
        { wrong: "personnel", right: ["personal"] },
        { wrong: "billed", right: ["built"] },
        { wrong: "you're", right: ["your"] }
      ]
    },
    {
      id: "m11",
      theme: "The Remote Revolution",
      text: "Remote work has fundamentally changed the professional landscape, and many companies now higher talented employees from across the globe. The flexibility to work from home has improved moral, but it has also blurred the boarders between personal and professional life. Those who succeed tend to set firm boundaries and treat there workspace as sacred, never letting casual habits creek into professional hours.",
      errors: [
        { wrong: "higher", right: ["hire"] },
        { wrong: "moral", right: ["morale"] },
        { wrong: "boarders", right: ["borders"] },
        { wrong: "there", right: ["their"] },
        { wrong: "creek", right: ["creep"] }
      ]
    },
    {
      id: "m12",
      theme: "Music and Memory",
      text: "Music has an extraordinary ability to unlock memories we thought were long gone. A single cord can transport you back to a specific moment in time, complete with the smells and feelings of that original seen. Neuroscientists believe this connection is routed in how the brain stores emotional experiences alongside sound. These links persist across a hole lifetime and reveal just how deeply art and science are tide together.",
      errors: [
        { wrong: "cord", right: ["chord"] },
        { wrong: "seen", right: ["scene"] },
        { wrong: "routed", right: ["rooted"] },
        { wrong: "hole", right: ["whole"] },
        { wrong: "tide", right: ["tied"] }
      ]
    },
    {
      id: "m13",
      theme: "The Perfect Interview",
      text: "Preparing for an important interview requires more than just going over a set of questions. The best interviewers develop a sixth cents for knowing when to push deeper and when to let the silence due the work. A well-timed pause can reveal more than any direct question. Understanding your guest on a deeper plain helps create an atmosphere where honest unguarded answers poor out almost effortlessly. The real difference between a forgettable interview and a great one often comes down to how well the host can reed the room.",
      errors: [
        { wrong: "cents", right: ["sense"] },
        { wrong: "due", right: ["do"] },
        { wrong: "plain", right: ["plane"] },
        { wrong: "poor", right: ["pour"] },
        { wrong: "reed", right: ["read"] }
      ]
    },
    {
      id: "m14",
      theme: "City Life",
      text: "Living in a major city means accepting a certain level of noise and chaos as part of your daily life. The constant bustle can be overwhelming, but it also creates a unique energy that many people find deeply addictive. From the vendors hawking there wears to the musicians playing on every corner, the urban landscape is a true feet for the senses. Finding piece in the middle of it all requires creativity, and most city dwellers learn to build quiet rituals that help them whether the storm of modern life.",
      errors: [
        { wrong: "there", right: ["their"] },
        { wrong: "wears", right: ["wares"] },
        { wrong: "feet", right: ["feat"] },
        { wrong: "piece", right: ["peace"] },
        { wrong: "whether", right: ["weather"] }
      ]
    }
  ],

  // ─── HARD: ~150+ words, 7 errors, tricky homophones ─────────

  hard: [
    {
      id: "h1",
      theme: "The Podcasting Boom",
      text: "The history of podcasting is a fascinating tail of technological innovation meeting creative ambition. What began as a niche hobby for tech enthusiasts has since become a global phenomenon, with millions of shows competing for attention across every conceivable genre. The barriers to entry have never been lower, witch means anyone with a microphone and an Internet connection can share their voice with the world. But this accessibility has also created an incredibly competitive landscape wear standing out requires more than just showing up. Successful podcasters understand that building an audience demands consistency, authenticity, and a willingness to adapt. Those who treat there show as a business rather than a casual past thyme tend to see the best results, often discovering that the patients required to grow a loyal following is the same quality that makes them grate hosts in the first place.",
      errors: [
        { wrong: "tail", right: ["tale"] },
        { wrong: "witch", right: ["which"] },
        { wrong: "wear", right: ["where"] },
        { wrong: "there", right: ["their"] },
        { wrong: "thyme", right: ["time"] },
        { wrong: "patients", right: ["patience"] },
        { wrong: "grate", right: ["great"] }
      ]
    },
    {
      id: "h2",
      theme: "Narrative Craft",
      text: "The art of storytelling has undergone a remarkable transformation in the digital age, with podcasts emerging as one of the most intimate mediums for narrative. Unlike television or film, a podcast relies entirely on the spoken word to paint pictures in the listener's mined, creating an experience that feels deeply personnel. The best storytellers understand that every episode should take the audience on a journey, beginning with a hook that seizes attention and ending with a resolution that leaves them wanting moor. Pacing is perhaps the most underrated element of good podcasting, and knowing when to speed up and when to let a moment breathe is a skill that takes years to hone. Many new creators make the mistake of trying to fill every second with dialogue, not realizing that strategic silence can bee just as powerful as any carefully chosen phrase. The affect of a well-placed pause on the emotional wait of a story cannot be overstated, and it is often the difference between a show that people here and one that truly resonates.",
      errors: [
        { wrong: "mined", right: ["mind"] },
        { wrong: "personnel", right: ["personal"] },
        { wrong: "moor", right: ["more"] },
        { wrong: "bee", right: ["be"] },
        { wrong: "affect", right: ["effect"] },
        { wrong: "wait", right: ["weight"] },
        { wrong: "here", right: ["hear"] }
      ]
    },
    {
      id: "h3",
      theme: "Remote Recording",
      text: "Remote collaboration has fundamentally changed the weigh creative teams operate, particularly in the podcasting industry where hosts and guests may be separated by thousands of miles. The technical challenges of recording across different locations have largely been solved by modern software, but the human element remains far more difficult to get write. Building genuine rapport through a screen requires a different skill set than sitting across from someone in a studio, and many interviewers struggle to create the same warmth and intimacy that comes naturally in person. The key is too invest time before each recording session getting to know your guest, finding common ground that can serve as a foundation for authentic conversation. Some producers have found that scheduling a brief casual call before the actual recording helps brake down barriers and puts both parties at ease. This extra step may seam like a waist of time, but the difference in quality is often immediately apparent to listeners who can intuitively since when a connection between two people is genuine versus when it is merely performed for the microphone.",
      errors: [
        { wrong: "weigh", right: ["way"] },
        { wrong: "write", right: ["right"] },
        { wrong: "too", right: ["to"] },
        { wrong: "brake", right: ["break"] },
        { wrong: "seam", right: ["seem"] },
        { wrong: "waist", right: ["waste"] },
        { wrong: "since", right: ["sense"] }
      ]
    },
    {
      id: "h4",
      theme: "The Creator Economy",
      text: "The economics of independent content creation have shifted dramatically over the passed decade, and nowhere is this moor apparent than in the world of podcasting. What was once a pursuit reserved for those with access to professional studios and expensive distribution networks has been democratized by affordable technology and open platforms. Yet while the cost of entry has plummeted, the challenge of building a sustainable business remains daunting. Revenue from adds alone is rarely enough to support a full-time creator, which has lead many podcasters to explore alternative streams such as premium subscriptions, merchandise, and live events. The most successful independent shows tend to be those that have cultivated a deeply engaged community rather than simply chasing large numbers. This principal of depth over breadth has proven remarkably affective across the industry, and it speaks to a fundamental truth about human connection: people will gladly support creators who make them feel herd and valued, even when free alternatives abound.",
      errors: [
        { wrong: "passed", right: ["past"] },
        { wrong: "moor", right: ["more"] },
        { wrong: "adds", right: ["ads"] },
        { wrong: "lead", right: ["led"] },
        { wrong: "principal", right: ["principle"] },
        { wrong: "affective", right: ["effective"] },
        { wrong: "herd", right: ["heard"] }
      ]
    },
    {
      id: "h5",
      theme: "AI and Creativity",
      text: "The relationship between technology and creativity in modern media is a complex won that continues to evolve at a breathtaking pace. Artificial intelligence has begun to play an increasingly prominent roll in content creation, from automated transcription services to sophisticated editing tools that can clean up recordings with remarkable precision. For podcasters, these advancements represent both an opportunity and a challenge, as the same tools that make production easier also altar the creative landscape in unpredictable ways. The most thoughtful creators have found ways to integrate AI into their workflows without sacrificing the personnel touch that makes their content unique. They use technology to handle mundane tasks like noise reduction and transcript generation, freeing themselves to focus on the creative decisions that truly matter. This complimentary relationship between human intuition and machine efficiency is likely to define the next chapter of digital media, and those who learn to strike the write balance will find themselves well positioned for whatever changes lye ahead.",
      errors: [
        { wrong: "won", right: ["one"] },
        { wrong: "roll", right: ["role"] },
        { wrong: "altar", right: ["alter"] },
        { wrong: "personnel", right: ["personal"] },
        { wrong: "complimentary", right: ["complementary"] },
        { wrong: "write", right: ["right"] },
        { wrong: "lye", right: ["lie"] }
      ]
    },
    {
      id: "h6",
      theme: "Audio Storytelling",
      text: "The evolution of audio storytelling from traditional radio dramas to modern narrative podcasts represents one of the most fascinating cultural shifts of the twenty-first century. In the early days of radio, families would gather around a single devise to listen to serialized dramas and comedies that formed the backbone of popular entertainment. The intimate nature of audio, with its ability to speak directly to the imagination, gave it a unique power that television could never quite replicate. Today, podcasts have inherited that same quality while adding the freedom of on-demand listening and virtually unlimited creative scope. The best narrative podcasts understand that this medium rewards patience and subtlety, allowing stories to unfold at a natural paste rather than rushing to satisfy shortened attention spans that video platforms have bread. Producers who have the patients and discipline to trust their audiences often find that their work resonates on a deeper plain, creating the kind of loyal passionate fan bass that every creator dreams of but few ever truly achieve. It is a medium that rewards those who poor their sole into it, and the results speak for themselves.",
      errors: [
        { wrong: "devise", right: ["device"] },
        { wrong: "paste", right: ["pace"] },
        { wrong: "bread", right: ["bred"] },
        { wrong: "patients", right: ["patience"] },
        { wrong: "plain", right: ["plane"] },
        { wrong: "bass", right: ["base"] },
        { wrong: "sole", right: ["soul"] }
      ]
    },
    {
      id: "h7",
      theme: "Building a Network",
      text: "Building a successful podcast network requires a unique combination of creative vision and business sense, and the rode to sustainability is never straightforward. The most effective network founders understand that there roll extends far beyond simply aggregating shows under a single banner. They must serve as mentors, negotiators, and strategic advisors to their roster of creators, all while managing the complex logistics of ad sales, cross-promotion, and content scheduling that keep everything running smoothly. The temptation to prioritize growth over quality is ever-present, and those who succumb to it often fined that rapid expansion leads to a dilution of brand identity that is extremely difficult to reverse. The networks that have stood the test of time tend to be those that maintained a clear editorial vision and were willing to turn away shows that did not fit, even when the short-term financial incentive was significant. This adherence to principal over profit creates a virtuous cycle wear quality attracts quality, and the reputation of the network itself becomes a powerful draw for both talented creators and discerning listeners who value substance over hype. In an era of unlimited content, thoughtful curation has become perhaps the most valuable service any network can offer, and those who master it reap the prophets for years to come.",
      errors: [
        { wrong: "rode", right: ["road"] },
        { wrong: "there", right: ["their"] },
        { wrong: "roll", right: ["role"] },
        { wrong: "fined", right: ["find"] },
        { wrong: "principal", right: ["principle"] },
        { wrong: "wear", right: ["where"] },
        { wrong: "prophets", right: ["profits"] }
      ]
    }
  ]
};

// ─── Difficulty config ──────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   emoji: "🟢", errors: 3, takes: 4, description: "3 imposters · shorter passage" },
  medium: { label: "Medium", emoji: "🟡", errors: 5, takes: 5, description: "5 imposters · moderate passage" },
  hard:   { label: "Hard",   emoji: "🔴", errors: 7, takes: 5, description: "7 imposters · longer passage" }
};

// ─── Puzzle selection ───────────────────────────────────────────

const EPOCH = new Date(2026, 1, 18); // Feb 18, 2026

function getPuzzleDay() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - EPOCH) / (1000 * 60 * 60 * 24)));
}

function getTodaysPuzzle(difficulty) {
  const day = getPuzzleDay();
  const pool = PUZZLES[difficulty];
  const puzzle = pool[day % pool.length];
  return { puzzle, number: day + 1 };
}

function getTodayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

// ─── Vault fetch (with embedded fallback) ───────────────────────

let _vaultCache = {};

async function fetchVaultPuzzle(difficulty) {
  const dateStr = getTodayDateStr();
  if (!_vaultCache[dateStr]) {
    try {
      const resp = await fetch(`vault/${dateStr}.json`);
      if (resp.ok) {
        _vaultCache[dateStr] = await resp.json();
      }
    } catch (e) {
      // Vault not available — use embedded fallback
    }
  }
  if (_vaultCache[dateStr] && _vaultCache[dateStr][difficulty]) {
    return { puzzle: _vaultCache[dateStr][difficulty], number: getPuzzleDay() + 1 };
  }
  // Fallback to embedded
  return getTodaysPuzzle(difficulty);
}
