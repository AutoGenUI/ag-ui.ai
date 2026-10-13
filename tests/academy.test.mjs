import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { academyLessons, getAcademyLesson, localizeAcademyCourse, phaseCopy } from "../lib/academy/course.ts";

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

test("server course projection preserves both language paths without shipping retrieval data", () => {
  for (const locale of ["en", "zh"]) {
    const course = localizeAcademyCourse(locale);
    assert.deepEqual(course.lessons.map(({ id, order, phase }) => ({ id, order, phase })), academyLessons.map(({ id, order, phase }) => ({ id, order, phase })));
    for (const [index, lesson] of course.lessons.entries()) {
      const original = academyLessons[index];
      for (const field of ["title", "summary", "artifact", "starterPrompt"]) {
        assert.equal(lesson[field], original[field][locale]);
        assert.equal(typeof lesson[field], "string");
      }
      assert.deepEqual(lesson.outcomes, original.outcomes[locale]);
      assert.deepEqual(lesson.source, original.source);
      assert.equal(lesson.href, original.href ? `/${locale}${original.href}` : undefined);
      assert.equal("concepts" in lesson, false);
    }
    assert.deepEqual(Object.keys(course.phaseLabels), Object.keys(phaseCopy));
    for (const [phase, label] of Object.entries(course.phaseLabels)) assert.equal(label, phaseCopy[phase][locale]);
    // A consumer cannot mutate the server's retrieval corpus through view data.
    course.lessons[0].outcomes.push("client-only outcome");
    course.lessons[0].source.url = "https://example.test/client-only";
    assert.equal(academyLessons[0].outcomes[locale].length, 3);
    assert.equal(academyLessons[0].source.url, "https://docs.ag-ui.com/concepts/architecture");
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
