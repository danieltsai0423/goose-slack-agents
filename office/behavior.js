// Per-person ambient behaviour for the 2.5D office. Everyone runs their own little schedule at the same time:
// small things at the desk (look around, check the phone, sip, think, doze when tired, spin the chair) and,
// now and then, an errand: walking to a spot in the office or to a colleague's desk and coming back. Facilities for
// two or three (ping-pong, karaoke…) are group errands: whoever goes invites free colleagues, everyone walks to their
// own spot, play starts once the last one arrives, and they all head back together.
// Pure and clock-driven so tests can step it; the scene turns these acts into poses.

// [action, weight, emote]. Emotes are the little bubbles drawn above the head.
const fidgets = {
  idle: [['look', 4], ['phone', 3], ['sip', 2], ['think', 2, 'dots'], ['type', 2], ['stretch', 1], ['yawn', 1], ['spin', 1], ['groove', 1, 'note'], ['read', 1]],
  tired: [['doze', 5, 'zz'], ['yawn', 3], ['sip', 2], ['phone', 1], ['look', 1]],
  happy: [['groove', 3, 'note'], ['spin', 2], ['look', 2], ['phone', 2], ['sip', 1], ['stretch', 1]],
  working: [['think', 3, 'dots'], ['sip', 2], ['read', 1], ['idea', 1, 'idea'], ['stretch', 1]]
};
const lengths = { look: [2400, 4200], phone: [3500, 6500], sip: [2000, 3200], think: [2600, 4800], type: [3000, 6000], stretch: [1400, 2000],
  yawn: [1600, 2200], spin: [1800, 2400], groove: [3200, 5600], read: [3500, 6500], doze: [5000, 9000], idea: [1500, 2200] };

function pick(list, random) {
  const total = list.reduce((sum, entry) => sum + entry[1], 0);
  let roll = random() * total;
  for (const entry of list) if ((roll -= entry[1]) < 0) return entry;
  return list.at(-1);
}
const between = (random, [low, high]) => low + random() * (high - low);

export function createBehaviors(random = Math.random) {
  const people = new Map();
  const person = (id, now) => {
    if (!people.has(id)) people.set(id, { act: null, nextAt: now + 600 + random() * 3200 });
    return people.get(id);
  };

  // Turn back early: from wherever they are on the way out, or straight away if they have arrived.
  function interrupt(act, now) {
    if (act.backAt <= now) return;
    const out = (now - act.start) / act.walk;
    act.backFrom = out < 1 ? 1 - Math.max(0, out) : 0;
    act.backAt = now;
    act.endsAt = now + act.walk * (1 - act.backFrom);
  }
  // A game ends for everyone when one player has to leave.
  function stop(act, now) {
    for (const id of act.group?.members || []) { const other = people.get(id)?.act; if (other?.group === act.group) interrupt(other, now); }
    interrupt(act, now);
  }
  function shuffled(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  }

  return {
    // ctx: ids, working/tired/happy (Sets), blocked (Set: people a scripted scene is using), enabled,
    // maxWalkers, errands(id, working) → [{ key, ... }], measure(id, dest) → walk ms or null.
    step(now, { ids, working = new Set(), tired = new Set(), happy = new Set(), blocked = new Set(), enabled = true,
      maxWalkers = 2, errands = () => [], measure = () => null }) {
      const acts = new Map();
      if (!enabled) { people.clear(); return acts; }
      for (const id of people.keys()) if (!ids.includes(id)) people.delete(id);
      const taken = new Set();
      let walkers = 0;
      for (const id of ids) {
        const act = person(id, now).act;
        if (act?.kind === 'errand') { walkers++; taken.add(act.dest.groupKey ?? act.dest.key); }
      }
      const away = id => people.get(id)?.act?.kind === 'errand';

      for (const id of ids) {
        const me = person(id, now);
        const busy = working.has(id);
        let act = me.act;
        if (act?.kind === 'errand') {
          // A new task, or the colleague being visited leaving, sends them back to their desk.
          const visitGone = act.dest.visit && (blocked.has(act.dest.visit) || people.get(act.dest.visit)?.act?.kind === 'errand');
          if ((busy && !act.work) || visitGone || blocked.has(id)) stop(act, now);
          if (now >= act.endsAt) { me.act = act = null; me.nextAt = now + between(random, busy ? [5000, 10000] : [1500, 4500]); walkers--; }
        } else if (act && (now >= act.until || blocked.has(id) || act.working !== busy)) {
          me.act = act = null;
          me.nextAt = now + between(random, busy ? [4000, 9000] : [1200, 4200]);
        }
        if (!act && !blocked.has(id) && now >= me.nextAt) {
          let chosen = null;
          const roll = random();
          if (walkers < maxWalkers && roll < (busy ? 0.3 : 0.32)) {
            const options = errands(id, busy).filter(dest => !taken.has(dest.key));
            for (let tries = 0; tries < 3 && options.length && !chosen; tries++) {
              const dest = options.splice(Math.floor(random() * options.length), 1)[0];
              if (dest.group) {
                // Invite whoever is free (not working, not out, not in a scene) to fill the other spots.
                const free = shuffled(ids.filter(other => other !== id && !working.has(other) && !blocked.has(other) && !away(other)));
                const partners = free.slice(0, dest.group.length - 1);
                const members = [id, ...partners];
                if (members.length < (dest.min ?? dest.group.length) || walkers + members.length > maxWalkers + 2) continue;
                const walks = members.map((member, i) => measure(member, dest.group[i]));
                if (walks.some(walk => !walk)) continue;
                const longest = Math.max(...walks), stay = between(random, [7000, 12000]);
                const group = { key: dest.key, members };
                members.forEach((member, i) => {
                  people.get(member).act = { kind: 'errand', dest: { ...dest.group[i], groupKey: dest.key, index: i }, group, work: false,
                    action: dest.group[i].action, emote: dest.group[i].emote, start: now, walk: walks[i], playAt: now + longest,
                    backAt: now + longest + stay, backFrom: 0, endsAt: now + longest + stay + walks[i] };
                });
                taken.add(dest.key); walkers += members.length;
                chosen = people.get(id).act;
                break;
              }
              const walk = measure(id, dest);
              if (!walk) continue;
              const stay = between(random, dest.visit ? [4500, 7500] : [3500, 7000]);
              chosen = { kind: 'errand', dest, work: busy, action: dest.action, emote: dest.emote, start: now, walk, playAt: now + walk,
                backAt: now + walk + stay, backFrom: 0, endsAt: now + 2 * walk + stay };
              taken.add(dest.key); walkers++;
            }
          }
          if (!chosen && (!busy || roll < 0.75)) {
            const mood = busy ? 'working' : tired.has(id) ? 'tired' : happy.has(id) ? 'happy' : 'idle';
            const [action, , emote] = pick(fidgets[mood], random);
            chosen = { kind: 'fidget', action, emote, start: now, until: now + between(random, lengths[action]), working: busy, seed: random() };
          }
          if (chosen) me.act = chosen;
          else me.nextAt = now + between(random, [5000, 10000]);
        }
      }
      for (const id of ids) if (people.get(id).act) acts.set(id, people.get(id).act);
      return acts;
    },
    reset() { people.clear(); }
  };
}

// Where an errand is in its timeline: walking out, there, or walking back (with progress along the route).
export function errandPhase(act, now) {
  if (now < act.start + act.walk && now < act.backAt) return { phase: 'out', progress: Math.max(0, (now - act.start) / act.walk) };
  if (now < act.backAt) return { phase: 'stay' };
  const span = act.endsAt - act.backAt;
  const progress = span > 0 ? act.backFrom + (1 - act.backFrom) * Math.min(1, (now - act.backAt) / span) : 1;
  return { phase: 'back', progress };
}
