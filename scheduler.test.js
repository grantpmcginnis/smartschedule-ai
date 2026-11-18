"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ss = require("./scheduler.js");

const CORE_SUBJECTS = ["Math", "ELA", "History", "Science"];
const COMPETITION = new Set(ss.academicCompetitionCourses);

function makeStudents(count) {
  const students = [];
  for (let i = 0; i < count; i++) {
    const rankings = [];
    for (let k = 0; k < 5; k++) {
      rankings.push(ss.allRequestCourses[(i * 5 + k * 3) % ss.allRequestCourses.length]);
    }
    students.push({
      name: "Student " + String(i).padStart(4, "0"),
      grade: [6, 7, 8][i % 3],
      peWaiver: i % 10 === 0,
      rankings
    });
  }
  return students;
}

function periodCourses(result) {
  const courses = [];
  for (let period = 1; period <= 7; period++) {
    const item = result.schedule[period];
    courses.push(item ? item.course : null);
  }
  return courses;
}

function assertTeacherPeriodsUnique(sections, label) {
  const seen = new Map();
  for (const list of Object.values(sections)) {
    for (const section of list) {
      const key = section.teacher + " @ period " + section.period;
      if (seen.has(key)) {
        assert.fail(
          (label || "Schedule") + ": " + key + " teaches both " +
          seen.get(key) + " and " + section.course
        );
      }
      seen.set(key, section.course);
    }
  }
}

function assertSeatAccounting(results, sections) {
  const used = {};
  for (const list of Object.values(sections)) {
    for (const section of list) {
      assert.ok(section.capacity > 0, section.id + " needs a positive capacity");
      assert.ok(section.seats >= 0, section.id + " has a negative seat count");
      assert.ok(section.seats <= section.capacity, section.id + " has more open seats than capacity");
      used[section.id] = 0;
    }
  }
  for (const result of results) {
    const seenSections = new Set();
    const seenPeriods = new Set();
    for (let period = 1; period <= 7; period++) {
      const item = result.schedule[period];
      if (!item) continue;
      assert.ok(!seenPeriods.has(period), result.student.name + " has two classes in period " + period);
      seenPeriods.add(period);
      assert.ok(item.sectionId, result.student.name + " is missing a section id");
      assert.ok(!seenSections.has(item.sectionId), result.student.name + " is in " + item.sectionId + " twice");
      seenSections.add(item.sectionId);
      const section = findSection(sections, item.sectionId);
      assert.ok(section, "Unknown section " + item.sectionId);
      assert.equal(section.course, item.course);
      assert.equal(section.teacher, item.teacher);
      assert.equal(section.period, period);
      used[item.sectionId] += 1;
    }
  }
  for (const list of Object.values(sections)) {
    for (const section of list) {
      assert.equal(
        section.seats + used[section.id],
        section.capacity,
        section.id + " lost track of seats"
      );
    }
  }
}

function findSection(sections, sectionId) {
  for (const list of Object.values(sections)) {
    for (const section of list) {
      if (section.id === sectionId) return section;
    }
  }
  return null;
}

function assertNoIllegalAutoPlacement(result) {
  const requested = new Set(result.student.rankings || []);
  for (const entry of result.receivedElectives || []) {
    if (entry.rank !== "Backup") continue;
    assert.equal(ss.isBackupEligible(entry.course), true, entry.course + " was used as a backup");
    assert.equal(COMPETITION.has(entry.course), false);
    assert.equal(/ [23]$/.test(entry.course), false);
  }
  for (let period = 1; period <= 7; period++) {
    const item = result.schedule[period];
    if (!item) continue;
    const advanced = / [23]$/.test(item.course) || COMPETITION.has(item.course);
    if (advanced) {
      assert.ok(
        requested.has(item.course),
        result.student.name + " was given " + item.course + " without requesting it"
      );
    }
  }
}

function assertCompleteStudent(result) {
  assert.equal(result.complete, true, result.student.name + " is partial: " + (result.notes || []).join(" "));
  assert.equal(result.status, "scheduled");
  const courses = periodCourses(result);
  assert.equal(courses.filter(Boolean).length, 7, result.student.name + " has an empty period");
  for (const subject of CORE_SUBJECTS) {
    assert.ok(
      courses.includes(result.student.grade + " " + subject),
      result.student.name + " is missing " + subject
    );
  }
  const peCourses = courses.filter(course => course && / PE$/.test(course));
  if (result.student.peWaiver) {
    assert.equal(peCourses.length, 0, result.student.name + " has a PE waiver but was given PE");
  } else {
    assert.deepEqual(peCourses, [result.student.grade + " PE"]);
  }
  const families = courses.map(course => ss.subjectFamily(course));
  assert.equal(new Set(families).size, families.length, result.student.name + " repeats a subject");
}

function assertRunIsTrustworthy(results, sections, options) {
  const allowPartial = options && options.allowPartial;
  assertTeacherPeriodsUnique(sections);
  assertSeatAccounting(results, sections);
  let partials = 0;
  for (const result of results) {
    assertNoIllegalAutoPlacement(result);
    const html = ss.createScheduleHtml(result);
    assert.equal(typeof html, "string");
    assert.ok(html.includes(ss.escapeHtml(result.student.name)));
    if (result.complete === false) {
      partials += 1;
      assert.ok(result.notes && result.notes.length > 0, "A partial student needs a reason");
      assert.ok(html.includes("Partial schedule"));
      assert.ok(html.includes(ss.escapeHtml(result.notes[0])));
    } else {
      assertCompleteStudent(result);
      assert.ok(!html.includes("Partial schedule"));
    }
  }
  if (!allowPartial) {
    assert.equal(partials, 0, partials + " students were only partly scheduled");
  }
  return partials;
}

function project(results) {
  return results.map(result => ({
    name: result.student.name,
    grade: result.student.grade,
    waiver: result.student.peWaiver,
    complete: result.complete,
    notes: result.notes,
    periods: periodCourses(result).map((course, index) => {
      const item = result.schedule[index + 1];
      return course ? course + "@" + item.teacher : null;
    })
  }));
}

function snapshotSeats(sections) {
  const snap = {};
  for (const [course, list] of Object.entries(sections)) {
    snap[course] = list.map(section => ({ id: section.id, seats: section.seats, period: section.period }));
  }
  return snap;
}

test("master schedule seats a few hundred students per grade without double-booking a teacher", () => {
  const built = ss.buildMasterSchedule(ss.defaultTeacherNames());
  assert.deepEqual(built.warnings, []);
  assertTeacherPeriodsUnique(built.sections, "Master schedule");

  for (const grade of [6, 7, 8]) {
    for (const subject of CORE_SUBJECTS.concat(["PE"])) {
      const course = grade + " " + subject;
      const seats = built.sections[course].reduce((sum, section) => sum + section.capacity, 0);
      assert.ok(seats >= 300, course + " only has " + seats + " seats");
    }
  }

  for (const course of ss.allRequestCourses) {
    assert.ok(built.sections[course] && built.sections[course].length > 0, course + " has no section");
  }

  const backupSeatsByPeriod = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const course of ss.electiveCourses) {
    if (!ss.isBackupEligible(course)) continue;
    for (const section of built.sections[course]) {
      backupSeatsByPeriod[section.period] += section.capacity;
    }
  }
  for (const period of [1, 2, 3, 4, 5, 6, 7]) {
    assert.ok(
      backupSeatsByPeriod[period] >= 180,
      "Period " + period + " only has " + backupSeatsByPeriod[period] + " backup seats"
    );
  }
});

test("master schedule is deterministic and uses the typed teacher name", () => {
  const first = ss.buildMasterSchedule(ss.defaultTeacherNames());
  const second = ss.buildMasterSchedule(ss.defaultTeacherNames());
  assert.deepEqual(first.sections, second.sections);

  const names = ss.defaultTeacherNames();
  names[6].Math = "Dr. Grant";
  const custom = ss.buildMasterSchedule(names);
  const teachers = new Set(custom.sections["6 Math"].map(section => section.teacher));
  assert.ok(teachers.has("Dr. Grant"));
  assert.ok(teachers.has(ss.assistantTeachers[6].Math));
  assert.equal(custom.warnings.length, 0);
});

test("the same teacher name cannot be booked twice even if it is typed into two boxes", () => {
  const names = ss.defaultTeacherNames();
  names[6].Math = "Mr. Ellison";
  names[7].Math = "Mr. Ellison";
  const built = ss.buildMasterSchedule(names);
  assertTeacherPeriodsUnique(built.sections, "Colliding names");
  const ellisonPeriods = new Set();
  for (const list of Object.values(built.sections)) {
    for (const section of list) {
      if (section.teacher !== "Mr. Ellison") continue;
      assert.ok(!ellisonPeriods.has(section.period));
      ellisonPeriods.add(section.period);
    }
  }
});

test("10, 100, and 500 students meet every hard constraint", () => {
  for (const count of [10, 100, 500]) {
    const output = ss.generateSchedules(makeStudents(count));
    assert.equal(output.results.length, count);
    assert.equal(output.warnings.length, 0);
    const partials = assertRunIsTrustworthy(output.results, output.sections);
    assert.equal(partials, 0, count + " student run had partial schedules");
  }
});

test("the same students always get the same schedule", () => {
  const students = makeStudents(100);
  const first = ss.generateSchedules(students);
  const second = ss.generateSchedules(students);
  assert.deepEqual(project(first.results), project(second.results));
  assert.equal(JSON.stringify(first.results.map(result => result.schedule)), JSON.stringify(second.results.map(result => result.schedule)));
});

test("a PE waiver student gets three electives, and a student with no requests still fills the day", () => {
  const built = ss.buildMasterSchedule(ss.defaultTeacherNames());
  const waiver = ss.buildStudentSchedule(
    { name: "Waiver Kid", grade: 8, peWaiver: true, rankings: [] },
    built.sections,
    0
  );
  assertCompleteStudent(waiver);
  const backups = waiver.receivedElectives.filter(entry => entry.rank === "Backup");
  assert.equal(backups.length, 3);
  assert.ok(backups.every(entry => ss.isBackupEligible(entry.course)));

  const regular = ss.buildStudentSchedule(
    { name: "Regular Kid", grade: 6, peWaiver: false, rankings: [] },
    built.sections,
    1
  );
  assertCompleteStudent(regular);
  assert.equal(regular.receivedElectives.filter(entry => entry.rank === "Backup").length, 2);
});

test("a requested level 2 can be placed, but it is never invented as a backup", () => {
  const students = [
    {
      name: "Wants Chess 2",
      grade: 7,
      peWaiver: false,
      rankings: ["Chess 2"]
    }
  ];
  const output = ss.generateSchedules(students);
  assertRunIsTrustworthy(output.results, output.sections);
  const courses = periodCourses(output.results[0]);
  assert.ok(courses.includes("Chess 2"));
  const backups = output.results[0].receivedElectives.filter(entry => entry.rank === "Backup");
  assert.equal(backups.length, 1);
  assert.ok(backups.every(entry => ss.isBackupEligible(entry.course)));
  assert.equal(courses.filter(course => / [23]$/.test(course)).length, 1);
});

test("an over-full grade is marked partial with a reason and the page HTML still renders", () => {
  const students = [];
  for (let i = 0; i < 450; i++) {
    students.push({
      name: "Grade6 Student " + String(i).padStart(4, "0"),
      grade: 6,
      peWaiver: i % 10 === 0,
      rankings: ["Spanish 1", "M/J Theatre 1", "Japanese 1", "French 1", "M/J Chorus 1"]
    });
  }
  const output = ss.generateSchedules(students);
  const partials = assertRunIsTrustworthy(output.results, output.sections, { allowPartial: true });
  assert.ok(partials > 0, "450 students in one grade should not all fit");
  assert.ok(output.results.some(result => result.complete), "the seats that exist should still be used");
  const summary = ss.createSummaryHtml(output.results, "Too many 6th graders", output.warnings);
  assert.ok(summary.includes("Partial"));
  assert.ok(!summary.includes("undefined"));
});

test("a student who cannot be placed does not crash the result card, and the name is escaped", () => {
  const built = ss.buildMasterSchedule(ss.defaultTeacherNames());
  delete built.sections["8 Math"];
  const result = ss.buildStudentSchedule({
    name: 'Broken <b>Kid</b> & Co',
    grade: 8,
    peWaiver: false,
    rankings: []
  }, built.sections, 0);
  assert.equal(result.complete, false);
  assert.ok(result.notes.some(note => note.includes("8 Math")));
  const html = ss.createScheduleHtml(result);
  assert.ok(html.includes("Partial schedule"));
  assert.ok(html.includes("Missing required class: 8 Math."));
  assert.ok(html.includes("Broken &lt;b&gt;Kid&lt;/b&gt; &amp; Co"));
  assert.equal(html.includes("<b>Kid</b>"), false);

  const odd = ss.generateSchedules([{ name: "Ninth <script>", grade: 9, peWaiver: false, rankings: ["Quiz Bowl"] }]);
  assert.equal(odd.results[0].complete, false);
  const oddHtml = ss.createScheduleHtml(odd.results[0]);
  assert.ok(oddHtml.includes("Partial schedule"));
  assert.equal(oddHtml.includes("<script>"), false);
  assert.ok(oddHtml.includes("&lt;script&gt;"));
});

test("teacher names typed by the user are escaped before they reach the page", () => {
  const names = ss.defaultTeacherNames();
  names[6].Math = "Ms. <Math>";
  const output = ss.generateSchedules([
    { name: "Ann", grade: 6, peWaiver: false, rankings: ["Spanish 1"] }
  ], names);
  const html = ss.createScheduleHtml(output.results[0]);
  assert.ok(html.includes("Ms. &lt;Math&gt;"));
  assert.equal(html.includes("Ms. <Math>"), false);
});

test("CSV import reports bad rows and does not guess a course", () => {
  const quiz = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nAva,6,No,Quiz Bowl\n");
  assert.equal(quiz.students.length, 0);
  assert.match(quiz.errors[0].message, /Quiz Bowl 1/);
  assert.match(quiz.errors[0].message, /Quiz Bowl 2/);
  assert.match(quiz.errors[0].message, /Quiz Bowl 3/);

  const chess = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nBen,7,No,Chess\n");
  assert.equal(chess.students.length, 0);
  assert.match(chess.errors[0].message, /more than one course/);

  const spanish = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nCara,8,Yes,Spanish\n");
  assert.equal(spanish.students.length, 0);
  assert.match(spanish.errors[0].message, /Spanish 1/);
  assert.match(spanish.errors[0].message, /Spanish 2/);

  const exact = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nCara,8,Yes,spanish 1\n");
  assert.equal(exact.errors.length, 0);
  assert.deepEqual(exact.students[0].rankings, ["Spanish 1"]);
  assert.equal(exact.students[0].peWaiver, true);

  const unknown = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nDee,6,No,Basket Weaving\n");
  assert.equal(unknown.students.length, 0);
  assert.match(unknown.errors[0].message, /Unknown course/);

  const grade = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nKid Nine,9,No,Chess 1\n");
  assert.equal(grade.students.length, 0);
  assert.match(grade.errors[0].message, /not supported/);
  assert.doesNotThrow(() => ss.formatImportReport(grade.errors, 0));

  const short = ss.parseStudentCsv("Name,Grade,PE Waiver,Choice 1\nOnlyName\nAlso,6\n");
  assert.equal(short.students.length, 0);
  assert.equal(short.errors.length, 2);
  assert.match(short.errors[0].message, /missing/i);
  assert.match(short.errors[1].message, /missing/i);

  const mixed = ss.parseStudentCsv([
    "Name,Grade,PE Waiver,Choice 1,Choice 2",
    "Good Kid,7,No,Spanish 1,French 1",
    "Short",
    "Kid Nine,9,No,Chess 1",
    "Good Kid,6,No,Japanese 1",
    "Maybe,8,Maybe,Spanish 1",
    "Fine,6th,No,Info and Comm Tech 1"
  ].join("\n"));
  assert.deepEqual(mixed.students.map(student => student.name), ["Good Kid", "Fine"]);
  assert.equal(mixed.students[0].grade, 7);
  assert.deepEqual(mixed.students[0].rankings, ["Spanish 1", "French 1"]);
  assert.equal(mixed.students[1].grade, 6);
  assert.deepEqual(mixed.students[1].rankings, ["Info & Comm Tech 1"]);
  assert.ok(mixed.errors.some(error => /missing/i.test(error.message)));
  assert.ok(mixed.errors.some(error => /not supported/.test(error.message)));
  assert.ok(mixed.errors.some(error => /Duplicate student name/.test(error.message)));
  assert.ok(mixed.errors.some(error => /Yes or No/.test(error.message)));

  const report = ss.formatImportReport(
    [{ message: 'Line 2: Duplicate student name "<img src=x>" (first used on line 1).' }],
    1
  );
  assert.ok(report.includes("&lt;img src=x&gt;"));
  assert.equal(report.includes("<img"), false);
  assert.ok(report.includes("Import problems"));
});

test("the paste box accepts everyday wording and asks when a name is ambiguous", () => {
  function only(text) {
    const parsed = ss.parseStudentCsv(text);
    assert.equal(parsed.errors.length, 0, parsed.errors.map(error => error.message).join("\n"));
    assert.equal(parsed.questions.length, 0);
    assert.equal(parsed.students.length, 1);
    return parsed;
  }

  const spanishOne = only("Name,Grade,PE Waiver,Choice 1\nAva,6,No,span one\n");
  assert.deepEqual(spanishOne.students[0].rankings, ["Spanish 1"]);
  assert.match(spanishOne.notes[0].message, /Read "span one" as Spanish 1\./);

  const span = only("Ava,7th,yeah,Span 1");
  assert.equal(span.students[0].grade, 7);
  assert.equal(span.students[0].peWaiver, true);
  assert.deepEqual(span.students[0].rankings, ["Spanish 1"]);

  const roman = only("Ava Brooks 8th grade span I");
  assert.equal(roman.students[0].name, "Ava Brooks");
  assert.equal(roman.students[0].grade, 8);
  assert.equal(roman.students[0].peWaiver, false);
  assert.deepEqual(roman.students[0].rankings, ["Spanish 1"]);
  assert.ok(roman.notes.some(note => /still takes PE/.test(note.message)));

  const robotics = only("Sam,seventh,nope,robotics 2");
  assert.equal(robotics.students[0].grade, 7);
  assert.equal(robotics.students[0].peWaiver, false);
  assert.deepEqual(robotics.students[0].rankings, ["FIRST Lego League Robotics 2"]);

  const fll = only("Sam\tgrade 7\twaived\tFLL 1");
  assert.equal(fll.students[0].peWaiver, true);
  assert.deepEqual(fll.students[0].rankings, ["FIRST Lego League Robotics 1"]);

  const info = only("Sam, 6, no, info tech 1");
  assert.deepEqual(info.students[0].rankings, ["Info & Comm Tech 1"]);

  const several = only("Sam ,  8th , no ,  photo 1 , art 1 , debate 1");
  assert.deepEqual(several.students[0].rankings, [
    "M/J Creative Photography 1",
    "M/J 2-D Studio Art 1",
    "M/J Speech-Debate 1"
  ]);

  const typo = only("Ava,6,0,spanih 1");
  assert.equal(typo.students[0].peWaiver, false);
  assert.deepEqual(typo.students[0].rankings, ["Spanish 1"]);
  assert.match(typo.notes.map(note => note.message).join(" "), /spanih 1/);

  const blank = only("Sam,6,,span one");
  assert.equal(blank.students[0].peWaiver, false);
  assert.ok(blank.notes.some(note => /blank PE waiver/.test(note.message)));

  const words = ss.parseStudentCsv("A,6,yep,french 1\nB,eighth,false,band\nC,grade 8,1,japan 1");
  assert.deepEqual(words.students.map(student => [student.grade, student.peWaiver, student.rankings[0]]), [
    [6, true, "French 1"],
    [8, false, "M/J Instrumental Ensemble"],
    [8, true, "Japanese 1"]
  ]);

  const free = only("Ava Brooks 7th no span one art 1");
  assert.deepEqual(free.students[0].rankings, ["Spanish 1", "M/J 2-D Studio Art 1"]);

  const ambiguous = ss.parseStudentCsv("Ava,6,no,spanih");
  assert.equal(ambiguous.students.length, 0);
  assert.equal(ambiguous.questions.length, 1);
  assert.deepEqual(ambiguous.questions[0].pending[0].options, ["Spanish 1", "Spanish 2"]);
  const picked = ss.answerImportQuestion(ambiguous.questions[0], "Spanish 2");
  assert.equal(picked.done, true);
  assert.deepEqual(picked.student.rankings, ["Spanish 2"]);
  assert.match(picked.notes.join(" "), /Read "spanih" as Spanish 2\./);

  const quiz = ss.parseStudentCsv("Sam,6,yes,span one,Quiz Bowl");
  assert.equal(quiz.students.length, 0);
  assert.deepEqual(quiz.questions[0].resolved, ["Spanish 1"]);
  assert.deepEqual(quiz.questions[0].pending[0].options, ["Quiz Bowl 1", "Quiz Bowl 2", "Quiz Bowl 3"]);
  const quizPick = ss.answerImportQuestion(quiz.questions[0], "Quiz Bowl 1");
  assert.deepEqual(quizPick.student.rankings, ["Spanish 1", "Quiz Bowl 1"]);

  assert.deepEqual(ss.searchCourses("span"), ["Spanish 1", "Spanish 2"]);
  assert.ok(ss.searchCourses("fll").every(course => course.indexOf("Robotics") !== -1));
  assert.deepEqual(ss.searchCourses("photo"), ["M/J Creative Photography 1"]);
});

test("the sample import on the page schedules three students", () => {
  const sample = [
    "Name,Grade,PE Waiver,Choice 1,Choice 2,Choice 3,Choice 4,Choice 5",
    'Student A,6,No,"M/J 2-D Studio Art 1","Info & Comm Tech 1","M/J Creative Writing 1","M/J Theatre 1","Spanish 1"',
    'Student B,7,No,"FIRST Lego League Robotics 1","Digital Information Technology","App Creators/Automation & Robotics","Quiz Bowl 1","Japanese 1"',
    'Student C,8,Yes,"M/J Speech-Debate 1","M/J Creative Photography 1","French 1","M/J Intro to Personal Financial Literacy","Chess 1"'
  ].join("\n");
  const parsed = ss.parseStudentCsv(sample);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.students.length, 3);
  assert.equal(parsed.students[2].peWaiver, true);
  const output = ss.generateSchedules(parsed.students);
  assertRunIsTrustworthy(output.results, output.sections);
  const html = output.results.map(ss.createScheduleHtml).join("");
  assert.ok(html.includes("Student A"));
  assert.ok(html.includes("PE Waiver Recorded"));
});

function copyCourses(result) {
  const courses = {};
  for (let period = 1; period <= 7; period++) courses[period] = result.schedule[period].course;
  return courses;
}

function electivePeriods(result) {
  const periods = [];
  for (let period = 1; period <= 7; period++) {
    if (!/^[678] (Math|ELA|History|Science|PE)$/.test(result.schedule[period].course)) periods.push(period);
  }
  return periods;
}

function courseNotOnSchedule(result) {
  const presentFamilies = new Set();
  for (let period = 1; period <= 7; period++) {
    presentFamilies.add(ss.subjectFamily(result.schedule[period].course));
  }
  // These meet every period, so a full-class check is about seats, not about the course being missing.
  const alwaysOffered = [
    "M/J Creative Photography 1",
    "M/J Instrumental Ensemble",
    "M/J Theatre 1",
    "Fundamentals of Visual & Perf Arts",
    "Digital Information Technology",
    "App Creators/Automation & Robotics",
    "Japanese 1",
    "M/J Intro to Personal Financial Literacy"
  ];
  return alwaysOffered.find(course => !presentFamilies.has(ss.subjectFamily(course)));
}

test("manual override blocks dropping a required class, full classes, and duplicate subjects", () => {
  const output = ss.generateSchedules([{
    name: "Override Kid",
    grade: 6,
    peWaiver: false,
    rankings: ["Spanish 1", "French 1"]
  }]);
  const result = output.results[0];
  const before = JSON.stringify(result.schedule);
  const seatsBefore = snapshotSeats(output.sections);
  const mathPeriod = periodCourses(result).indexOf("6 Math") + 1;
  const electives = electivePeriods(result);
  assert.equal(electives.length, 2);

  const filler = courseNotOnSchedule(result);
  const withoutMath = copyCourses(result);
  withoutMath[mathPeriod] = filler;
  const removed = ss.applyManualOverride(result, withoutMath, output.sections);
  assert.equal(removed.ok, false);
  assert.match(removed.error, /Cannot remove required class: Math/);
  assert.equal(JSON.stringify(result.schedule), before);
  assert.deepEqual(snapshotSeats(output.sections), seatsBefore);

  const duplicate = copyCourses(result);
  duplicate[electives[0]] = "Spanish 1";
  duplicate[electives[1]] = "Spanish 2";
  const duplicated = ss.applyManualOverride(result, duplicate, output.sections);
  assert.equal(duplicated.ok, false);
  assert.match(duplicated.error, /Duplicate schedule problem/);
  assert.equal(JSON.stringify(result.schedule), before);
  assert.deepEqual(snapshotSeats(output.sections), seatsBefore);

  const blockedCourse = courseNotOnSchedule(result);
  for (const section of output.sections[blockedCourse]) {
    if (section.period === electives[0]) section.seats = 0;
  }
  const crowded = copyCourses(result);
  crowded[electives[0]] = blockedCourse;
  const full = ss.applyManualOverride(result, crowded, output.sections);
  assert.equal(full.ok, false);
  assert.match(full.error, /No open seat in Period/);
  assert.equal(JSON.stringify(result.schedule), before);
  for (const section of output.sections[blockedCourse]) {
    if (section.period === electives[0]) assert.equal(section.seats, 0);
  }
});

test("manual override allows a cross-grade core and updates seat counts", () => {
  const output = ss.generateSchedules(makeStudents(12));
  const result = output.results.find(item => item.student.grade === 6 && !item.student.peWaiver);
  let mathPeriod = 0;
  for (let period = 1; period <= 7; period++) {
    if (result.schedule[period].course === "6 Math") mathPeriod = period;
  }
  const oldSection = findSection(output.sections, result.schedule[mathPeriod].sectionId);
  const oldSeats = oldSection.seats;
  const seventhSeats = output.sections["7 Math"]
    .filter(section => section.period === mathPeriod)
    .reduce((sum, section) => sum + section.seats, 0);

  const courses = {};
  for (let period = 1; period <= 7; period++) courses[period] = result.schedule[period].course;
  courses[mathPeriod] = "7 Math";
  const saved = ss.applyManualOverride(result, courses, output.sections);
  assert.equal(saved.ok, true, saved.error);
  assert.equal(result.manual, true);
  assert.equal(result.complete, true);
  assert.equal(result.schedule[mathPeriod].course, "7 Math");
  assert.equal(findSection(output.sections, oldSection.id).seats, oldSeats + 1);
  const seventhSeatsAfter = output.sections["7 Math"]
    .filter(section => section.period === mathPeriod)
    .reduce((sum, section) => sum + section.seats, 0);
  assert.equal(seventhSeatsAfter, seventhSeats - 1);

  const html = ss.createScheduleHtml(result);
  assert.ok(html.includes("Manually Edited"));
  assert.ok(html.includes("7 Math"));
  assert.ok(!html.includes("Partial schedule"));
});

test("a failed override does not give away the seat the student already holds", () => {
  const output = ss.generateSchedules(makeStudents(8));
  const result = output.results[0];
  let electivePeriod = 0;
  for (let period = 1; period <= 7; period++) {
    const course = result.schedule[period].course;
    if (!/^[678] (Math|ELA|History|Science|PE)$/.test(course)) electivePeriod = period;
  }
  const held = findSection(output.sections, result.schedule[electivePeriod].sectionId);
  const heldBefore = held.seats;
  const blockedCourse = courseNotOnSchedule(result);
  for (const section of output.sections[blockedCourse]) section.seats = 0;
  const courses = {};
  for (let period = 1; period <= 7; period++) courses[period] = result.schedule[period].course;
  courses[electivePeriod] = blockedCourse;
  const outcome = ss.applyManualOverride(result, courses, output.sections);
  assert.equal(outcome.ok, false);
  assert.equal(held.seats, heldBefore);
  assert.equal(result.schedule[electivePeriod].sectionId, held.id);
});

test("demo students are stable and fully scheduled", () => {
  const first = ss.generateSchedules(ss.createDemoStudents());
  const second = ss.generateSchedules(ss.createDemoStudents());
  assert.equal(first.results.length, 10);
  assertRunIsTrustworthy(first.results, first.sections);
  assert.deepEqual(project(first.results), project(second.results));
  const mia = first.results.find(result => result.student.name === "Mia Collins");
  assert.equal(mia.student.peWaiver, true);
  assert.ok(!periodCourses(mia).some(course => course && / PE$/.test(course)));
});

function assertFixKeepsHardRules(beforeSections, afterResult, afterSections) {
  const families = new Set();
  const sectionIds = new Set();
  for (let period = 1; period <= 7; period++) {
    const item = afterResult.schedule[period];
    if (!item) continue;
    const family = ss.subjectFamily(item.course);
    assert.equal(families.has(family), false, item.course + " repeats " + family);
    families.add(family);
    assert.equal(sectionIds.has(item.sectionId), false);
    sectionIds.add(item.sectionId);
    const section = findSection(afterSections, item.sectionId);
    assert.ok(section, "missing section " + item.sectionId);
    assert.equal(section.course, item.course);
    assert.equal(Number(section.period), period);
    assert.equal(section.teacher, item.teacher);
  }
  for (const list of Object.values(afterSections)) {
    for (const section of list) {
      assert.ok(section.seats >= 0 && section.seats <= section.capacity, section.id);
      const before = findSection(beforeSections, section.id);
      assert.ok(Math.abs(before.seats - section.seats) <= 2);
    }
  }
  assertTeacherPeriodsUnique(afterSections);
}

test("dropdowns block duplicate subjects, full classes, and teacher conflicts", () => {
  assert.equal(ss.choiceBlockReason("French 1", ["Spanish 1"]), "");
  assert.match(ss.choiceBlockReason("Spanish 2", ["Spanish 1"]), /Already have Spanish/);
  assert.match(ss.choiceBlockReason("Spanish 1", ["Spanish 1"]), /Already picked/);

  const built = ss.buildMasterSchedule(ss.defaultTeacherNames());
  built.sections["French 1"].forEach(section => { section.seats = 0; });
  assert.match(ss.choiceBlockReason("French 1", [], built.sections), /No seats left/);
  assert.equal(ss.choiceBlockReason("French 1", [], built.sections, ["French 1"]), "");

  const chessPeriod = built.sections["Chess 1"][0].period;
  const student = { name: "Pat", grade: 7, peWaiver: false, rankings: [] };
  const proposed = {};
  const cores = ["7 Math", "7 ELA", "7 History", "7 Science", "7 PE", "Spanish 1"];
  let coreIndex = 0;
  for (let period = 1; period <= 7; period++) {
    proposed[period] = period === chessPeriod ? "Japanese 1" : cores[coreIndex++];
  }
  const teacherReason = ss.periodBlockReason("Chess 2", chessPeriod, student, proposed, built.sections, {});
  assert.match(teacherReason, /already teaches/);

  proposed[chessPeriod === 7 ? 6 : 7] = "Spanish 1";
  const duplicateReason = ss.periodBlockReason("Spanish 2", chessPeriod, student, proposed, built.sections, {});
  assert.match(duplicateReason, /Already have Spanish/);

  const fullPeriod = built.sections["Japanese 1"][0].period;
  built.sections["Japanese 1"].forEach(section => {
    if (section.period === fullPeriod) section.seats = 0;
  });
  const saved = {};
  for (let period = 1; period <= 7; period++) saved[period] = null;
  const fullReason = ss.periodBlockReason("Japanese 1", fullPeriod, student, proposed, built.sections, saved);
  assert.match(fullReason, /No seats left|already teaches|Not offered|Already have|Can't drop/);
});

test("fix suggestions never produce an invalid schedule", () => {
  function tryAll(result, sections, proposal) {
    const beforeSchedule = JSON.stringify(result.schedule);
    const suggestions = ss.suggestFixes(result, sections, proposal);
    assert.equal(JSON.stringify(result.schedule), beforeSchedule);
    assert.ok(suggestions.length >= 2 && suggestions.length <= 4, suggestions.map(item => item.label).join(" | "));
    const labels = new Set(suggestions.map(item => item.label));
    assert.equal(labels.size, suggestions.length);
    for (const suggestion of suggestions) {
      const trial = JSON.parse(JSON.stringify(result));
      const trialSections = JSON.parse(JSON.stringify(sections));
      const outcome = ss.applySuggestion(trial, trialSections, suggestion);
      assert.equal(outcome.ok, true, suggestion.label + " " + (outcome.error || ""));
      assertFixKeepsHardRules(sections, trial, trialSections);
      if (suggestion.kind === "flag") {
        assert.equal(trial.flaggedForAdmin, true);
        assert.match(trial.notes.join(" "), /Flagged for an admin/);
      }
    }
  }

  const output = ss.generateSchedules([{
    name: "Partial Pat",
    grade: 6,
    peWaiver: false,
    rankings: ["Spanish 1", "M/J Chorus 1", "M/J Theatre 1", "Japanese 1", "French 1"]
  }]);
  const result = output.results[0];
  let mathPeriod = 0;
  for (let period = 1; period <= 7; period++) {
    if (result.schedule[period] && result.schedule[period].course === "6 Math") mathPeriod = period;
  }
  result.schedule[mathPeriod] = null;
  output.sections["6 Math"].forEach(section => { section.seats = 0; });
  result.complete = false;
  result.notes = ["Missing required class: 6 Math.", "Period " + mathPeriod + " has no class."];
  tryAll(result, output.sections);

  const healthy = ss.generateSchedules([{
    name: "Full Fran",
    grade: 8,
    peWaiver: true,
    rankings: ["Spanish 1", "M/J Chorus 1", "Chess 1"]
  }]);
  const proposal = {};
  let electivePeriod = 0;
  for (let period = 1; period <= 7; period++) {
    proposal[period] = healthy.results[0].schedule[period].course;
    if (!/^[678] (Math|ELA|History|Science|PE)$/.test(proposal[period])) electivePeriod = period;
  }
  proposal[electivePeriod] = "";
  tryAll(healthy.results[0], healthy.sections, proposal);
  assert.equal(healthy.results[0].complete, true);
});

test("the page loads the scheduler file and does not shuffle with Math.random", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  const scheduler = fs.readFileSync(path.join(__dirname, "scheduler.js"), "utf8");
  assert.match(html, /<script src="scheduler\.js"><\/script>/);
  assert.equal(html.includes("Math.random"), false);
  assert.equal(scheduler.includes("Math.random"), false);
  assert.match(html, /id="importMessage"/);
});
