"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");
const ss = require("./scheduler.js");
const catalog = require("./school-data.js");
const ui = require("./preview-ui.js");

test("the catalog is the same course list the scheduler already uses", () => {
  const ids = catalog.courses.map(course => course.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate course id");
  assert.deepEqual(ids.slice().sort(), ss.allRequestCourses.slice().sort());
  catalog.courses.forEach(course => {
    assert.equal(course.description, "");
    assert.equal(course.competition, ss.academicCompetitionCourses.includes(course.id));
    assert.equal(typeof course.sampleTeacher, "string");
    assert.ok(course.sampleTeacher.length > 0);
  });
});

test("sample core teachers match the scheduler placeholders", () => {
  const defaults = ss.defaultTeacherNames();
  for (const grade of [6, 7, 8]) {
    for (const subject of ["Math", "ELA", "History", "Science", "PE"]) {
      assert.equal(catalog.sampleTeachers.grades[grade][subject].primary, defaults[grade][subject]);
      assert.equal(catalog.sampleTeachers.grades[grade][subject].assistant, ss.assistantTeachers[grade][subject]);
    }
  }
  assert.deepEqual(ui.emptyTeacherNames(), defaults);
});

test("each elective sample teacher is the teacher the scheduler actually assigns", () => {
  const built = ss.buildMasterSchedule(ss.defaultTeacherNames());
  for (const course of catalog.courses) {
    const teachers = new Set((built.sections[course.id] || []).map(section => section.teacher));
    assert.equal(teachers.has(course.sampleTeacher), true, course.id + " / " + course.sampleTeacher);
  }
});

test("only the four public 2025-26 languages are marked confirmed", () => {
  const confirmed = catalog.courses
    .filter(course => course.publicStatus === "confirmed-language")
    .map(course => course.displayName)
    .sort();
  assert.deepEqual(confirmed, ["French I", "French II", "Japanese I", "Spanish I"]);
  const spanish2 = catalog.courses.find(course => course.id === "Spanish 2");
  assert.equal(spanish2.publicStatus, "not-on-language-list");
  assert.equal(spanish2.displayName, "Spanish 2");
  assert.match(spanish2.publicNote, /Spanish I/);
});

test("the catalog does not add real staff names", () => {
  const blob = JSON.stringify(catalog);
  ["Maguire", "Crandell", "Hillary", "Lawson", "Carolyn"].forEach(name => {
    assert.equal(blob.includes(name), false, name);
  });
});

test("ranking helpers block a second level and keep choice order", () => {
  const first = ui.addRanking([], "Spanish 1");
  assert.equal(first.ok, true);
  const second = ui.addRanking(first.rankings, "Spanish 2");
  assert.equal(second.ok, false);
  assert.match(second.error, /Spanish/);
  const art = ui.addRanking(first.rankings, "M/J 2-D Studio Art 1");
  assert.deepEqual(art.rankings, ["Spanish 1", "M/J 2-D Studio Art 1"]);
  assert.deepEqual(ui.moveRanking(art.rankings, 1, -1), ["M/J 2-D Studio Art 1", "Spanish 1"]);
  assert.deepEqual(ui.removeRanking(art.rankings, "Spanish 1"), ["M/J 2-D Studio Art 1"]);
  const full = ui.addRanking(["Chess 1", "Chess 2", "Quiz Bowl 1", "French 1", "Japanese 1"], "M/J Theatre 1");
  assert.equal(full.ok, false);
  assert.match(full.error, /5/);
});

test("override choices are grouped and searched", () => {
  const options = [
    { course: "7 Math", enabled: true, reason: "" },
    { course: "6 Math", enabled: true, reason: "" },
    { course: "Spanish 2", enabled: false, reason: "Already have Spanish" },
    { course: "Spanish 1", enabled: true, reason: "" },
    { course: "M/J Chorus 1", enabled: true, reason: "" }
  ];
  const grouped = ui.groupPeriodOptions(options, 7, "");
  const thisGrade = grouped.find(group => group.id === "this-grade");
  const other = grouped.find(group => group.id === "other-grades");
  assert.deepEqual(thisGrade.items.map(item => item.course), ["7 Math"]);
  assert.deepEqual(other.items.map(item => item.course), ["6 Math"]);
  const spanish = ui.groupPeriodOptions(options, 7, "span");
  assert.deepEqual(spanish.map(group => group.id), ["Languages"]);
  assert.deepEqual(spanish[0].items.map(item => item.course), ["Spanish 1", "Spanish 2"]);
  assert.equal(spanish[0].items[0].enabled, true);
  assert.equal(spanish[0].items[1].enabled, false);
});

test("a schedule is explained in plain language", () => {
  const output = ss.generateSchedules([{
    name: "Test Kid",
    grade: 7,
    peWaiver: false,
    rankings: ["Spanish 1", "M/J Theatre 1"]
  }]);
  const result = output.results[0];
  const day = ui.dayPlan(result);
  assert.equal(day.filter(row => row.type === "class").length, 7);
  const lunchAt = day.findIndex(row => row.type === "lunch");
  const period5 = day.findIndex(row => row.type === "class" && row.period === 5);
  assert.equal(lunchAt, period5 + 1);
  const lines = ui.explainPlacement(result);
  assert.ok(lines.some(line => line.text.includes("Spanish I")));
  const summary = ui.summarizeResult(result);
  assert.equal(summary.name, "Test Kid");
  assert.equal(summary.status, "Ready");
  assert.match(ui.labelTeacher("Mrs. Langford"), /^Sample teacher:/);
  assert.equal(ui.labelTeacher("A Real Teacher"), "Teacher: A Real Teacher");
  assert.equal(ui.plainNote("Missing required class: 7 Math."), "Missing 7th grade math.");
  assert.equal(ui.electiveSlots(false), 2);
  assert.equal(ui.electiveSlots(true), 3);
  const identity = ui.validateIdentity({ name: "  ", grade: 7 });
  assert.equal(identity.ok, false);
  assert.equal(ui.validateIdentity({ name: "Ari", grade: 9 }).ok, false);
  assert.equal(ui.validateIdentity({ name: "Ari", grade: 6 }).ok, true);
});

test("the preview page has a viewport and does not claim to learn", () => {
  const files = ["index.html", "app.js", "preview-ui.js", "school-data.js", "preview.css"];
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<script src="scheduler\.js"><\/script>/);
  assert.match(html, /id="importMessage"/);
  assert.match(html, /school-data\.js/);
  const blob = files.map(file => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");
  assert.equal(/math\.random/i.test(blob), false);
  assert.equal(/machine learning/i.test(blob), false);
  assert.equal(/artificial intelligence/i.test(blob), false);
  assert.equal(/AI learning/i.test(blob), false);
});
