import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { academyLessons, getAcademyLesson } from "../lib/academy/course.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("academy is a complete, ordered, bilingual learning path", () => {
  assert.equal(academyLessons.length, 16);
  assert.deepEqual(academyLessons.map(({ order }) => order), Array.from({ length: 16 }, (_, index) => index + 1));
  assert.equal(new Set(academyLessons.map(({ id }) => id)).size, academyLessons.length);
  for (const lesson of academyLessons) {
    assert.ok(lesson.title.en && lesson.title.zh, `${lesson.id} needs bilingual titles`);
    assert.ok(lesson.summary.en && lesson.summary.zh, `${lesson.id} needs bilingual summaries`);
    assert.equal(lesson.outcomes.en.length, 3);
    assert.equal(lesson.outcomes.zh.length, 3);
    assert.match(lesson.source.url, /^https:\/\//);
  }
  assert.equal(getAcademyLesson("ag-ui").id, "ag-ui");
  assert.equal(getAcademyLesson("missing"), undefined);
});

test("curriculum covers the requested Generative UI stack", () => {
  const corpus = academyLessons.flatMap((lesson) => [lesson.id, ...lesson.concepts]).join(" ").toLowerCase();
  for (const concept of ["ag-ui", "shadcn", "tailwind", "json-render", "openui", "a2ui", "skills", "acp", "mcp", "mcp-ui", "rag", "prompts", "agent", "llm", "byok"]) {
    assert.ok(corpus.includes(concept), `missing curriculum concept: ${concept}`);
  }
});

test("the repository ships the tutor prompt, architecture and reusable build skill", async () => {
  const [prompt, architecture, skill, acceptance] = await Promise.all([
    read("prompts/academy-tutor.md"),
    read("docs/architecture/conversational-academy.md"),
    read(".agents/skills/build-generative-ui/SKILL.md"),
    read(".agents/skills/build-generative-ui/references/acceptance.md"),
  ]);
  assert.match(prompt, /Ground explanations/i);
  assert.match(architecture, /AG-UI|Supabase/);
  assert.match(skill, /^---[\s\S]+name: build-generative-ui/m);
  assert.match(acceptance, /event|事件/i);
});
