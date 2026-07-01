// Convert LexiQuest MCQ banks into the shared free-quiz item format.

import type { FreeQuizItem } from '../../platform/freeQuizShell';
import {
  SPELL, VOCAB, LOGIC, RHYME,
  type SpellItem, type VocabItem, type LogicItem,
} from '../_lq/data';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fourChoices(correct: string, wrong: string[]): FreeQuizItem {
  const choices = [correct, ...wrong.slice(0, 3)] as [string, string, string, string];
  return { prompt: '', choices, answer: 0 };
}

export function spellBank(): FreeQuizItem[] {
  return SPELL.map((item: SpellItem) => ({
    ...fourChoices(item.a, item.wrong.map((w) => w.trim())),
    prompt: `Which spelling is correct?\n"${item.def}"`,
  }));
}

export function vocabBank(): FreeQuizItem[] {
  return VOCAB.map((item: VocabItem) => ({
    ...fourChoices(item.a, item.wrong),
    prompt: `What does "${item.q}" mean?`,
  }));
}

export function logicBank(): FreeQuizItem[] {
  return LOGIC.map((item: LogicItem) => ({
    ...fourChoices(item.a, item.wrong),
    prompt: item.q,
  }));
}

export function rhymeBank(): FreeQuizItem[] {
  const pairs = RHYME.map((item) => ({
    item,
    label: `${item.w1.toUpperCase()} ${item.w2.toUpperCase()}`,
  }));
  return pairs.map(({ item, label }) => {
    const distractors = shuffle(pairs.filter((p) => p.item !== item))
      .slice(0, 3)
      .map((p) => p.label);
    return {
      ...fourChoices(label, distractors),
      prompt: `"${item.clue}"`,
    };
  });
}
