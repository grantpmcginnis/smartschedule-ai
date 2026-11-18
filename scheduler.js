/*
 * SmartSchedule scheduler
 * -----------------------
 * This is a greedy, rule-based scheduler. It follows a fixed list of rules.
 * It does not use machine learning, and it does not learn from past runs.
 *
 * The browser page (index.html) and the Node tests both use this file.
 * Nothing here reads or stores real student records. All names are fictional
 * and live only in memory.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root !== "undefined") {
    root.SmartSchedule = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Academic competition courses are application-only. A student can be placed
  // in one when they request it and a seat is open. They are never used as a
  // backup filler.
  var academicCompetitionCourses = [
    "Odyssey of the Mind 1",
    "Odyssey of the Mind 2",
    "Odyssey of the Mind 3",
    "FIRST Lego League Robotics 1",
    "FIRST Lego League Robotics 2",
    "FIRST Lego League Robotics 3",
    "Science Olympiad 1",
    "Science Olympiad 2",
    "Science Olympiad 3",
    "Chess 1",
    "Chess 2",
    "Chess 3",
    "Quiz Bowl 1",
    "Quiz Bowl 2",
    "Quiz Bowl 3",
    "Advanced Academics, Future Business Leaders of America 2",
    "Advanced Academics, Future Business Leaders of America 3",
    "M/J Speech-Debate 1",
    "M/J Speech-Debate 2",
    "M/J Speech-Debate 3"
  ];

  var electiveCourses = [
    "M/J 2-D Studio Art 1",
    "M/J 2-D Studio Art 2",
    "M/J Creative Photography 1",
    "M/J Instrumental Ensemble",
    "M/J Chorus 1",
    "M/J Chorus 2",
    "M/J Chorus 3",
    "M/J Theatre 1",
    "M/J Creative Writing 1",
    "M/J Creative Writing 2",
    "M/J Creative Writing 3",
    "Fundamentals of Visual & Perf Arts",
    "Info & Comm Tech 1",
    "Info & Comm Tech 2",
    "Digital Information Technology",
    "App Creators/Automation & Robotics",
    "French 1",
    "French 2",
    "Spanish 1",
    "Spanish 2",
    "Japanese 1",
    "Advanced Academics, Future Business Leaders of America 1",
    "M/J Intro to Personal Financial Literacy"
  ];

  var allRequestCourses = academicCompetitionCourses.concat(electiveCourses);

  // Class sizes live in one place so they can be changed without hunting
  // through the placement code. Core and PE capacity is
  // 2 teachers x 7 periods x section size.
  var SCHEDULE_DEFAULTS = {
    periods: [1, 2, 3, 4, 5, 6, 7],
    grades: [6, 7, 8],
    coreSectionSize: 30,
    peSectionSize: 40
  };

  // One person cannot teach two sections in the same period. The name typed
  // into the page is the first teacher. A second fictional teacher shares the
  // subject so two sections can meet at once (about 420 core seats per grade).
  var ASSISTANT_TEACHERS = {
    6: {
      Math: "Mr. Hale",
      ELA: "Mrs. Okonkwo",
      History: "Ms. Feldman",
      Science: "Mr. Iqbal",
      PE: "Coach Diaz"
    },
    7: {
      Math: "Mrs. Kowalski",
      ELA: "Mr. Adeyemi",
      History: "Ms. Cho",
      Science: "Mrs. Vasquez",
      PE: "Coach Brennan"
    },
    8: {
      Math: "Mr. Okada",
      ELA: "Mrs. Ibrahim",
      History: "Ms. Porter",
      Science: "Mr. Nilsson",
      PE: "Coach Alvarez"
    }
  };

  function defaultTeacherNames() {
    return {
      6: {
        Math: "Mrs. Waters",
        ELA: "Ms. Kendall",
        History: "Mrs. Patel",
        Science: "Mr. Emerson",
        PE: "Coach Ramirez"
      },
      7: {
        Math: "Mr. Johnson",
        ELA: "Mrs. Langford",
        History: "Mr. Holloway",
        Science: "Dr. Bennett",
        PE: "Coach Whitaker"
      },
      8: {
        Math: "Ms. Rivera",
        ELA: "Mr. Carlisle",
        History: "Mr. Brooks",
        Science: "Mrs. Donovan",
        PE: "Coach Morgan"
      }
    };
  }

  var competitionSet = objectSet(academicCompetitionCourses);
  var electiveSet = objectSet(electiveCourses);
  var requestSet = objectSet(allRequestCourses);

  function objectSet(list) {
    var set = {};
    for (var i = 0; i < list.length; i++) set[list[i]] = true;
    return set;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/m\/j/g, "mj")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function compareText(a, b) {
    var left = String(a);
    var right = String(b);
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  }

  function subjectFamily(course) {
    var name = String(course || "");
    if (name.indexOf("Science Olympiad") !== -1) return "Science Olympiad";
    if (name.indexOf("Math") !== -1) return "Math";
    if (name.indexOf("ELA") !== -1) return "ELA";
    if (name.indexOf("History") !== -1) return "History";
    if (name.indexOf("Science") !== -1) return "Science";
    if (/(^| )PE($| )/.test(name)) return "PE";
    return name.replace(/ [123]$/, "");
  }

  function courseLevel(course) {
    var match = String(course || "").match(/ ([123])$/);
    return match ? Number(match[1]) : 0;
  }

  function isCompetitionCourse(course) {
    return !!competitionSet[course];
  }

  // Backups may be level 1, or a course that has no level number.
  // Level 2, level 3, and application-only competitions are not backups.
  function isBackupEligible(course) {
    if (!electiveSet[course]) return false;
    if (isCompetitionCourse(course)) return false;
    var level = courseLevel(course);
    return level !== 2 && level !== 3;
  }

  function backupCourseList() {
    var list = [];
    for (var i = 0; i < electiveCourses.length; i++) {
      if (isBackupEligible(electiveCourses[i])) list.push(electiveCourses[i]);
    }
    list.sort(compareText);
    return list;
  }

  function requiredCoursesForGrade(student) {
    var grade = student.grade;
    var courses = [
      grade + " Math",
      grade + " ELA",
      grade + " History",
      grade + " Science"
    ];
    if (!student.peWaiver) courses.push(grade + " PE");
    return courses;
  }

  function requiredFamilies(student) {
    var families = ["Math", "ELA", "History", "Science"];
    if (!student.peWaiver) families.push("PE");
    return families;
  }

  function gradePriority(grade) {
    if (grade === 8) return 1;
    if (grade === 7) return 2;
    if (grade === 6) return 3;
    return 4;
  }

  function getLunchAfterPeriod(grade) {
    return Number(grade) === 6 ? 4 : 5;
  }

  function createEmptySchedule() {
    var schedule = {};
    for (var period = 1; period <= 7; period++) schedule[period] = null;
    return schedule;
  }

  function periodSearchOrder(preferred) {
    var start = preferred >= 1 && preferred <= 7 ? preferred : 1;
    var order = [];
    for (var i = 0; i < 7; i++) order.push(((start - 1 + i) % 7) + 1);
    return order;
  }

  function resolveConfig(config) {
    var source = config || {};
    return {
      periods: source.periods || SCHEDULE_DEFAULTS.periods.slice(),
      grades: source.grades || SCHEDULE_DEFAULTS.grades.slice(),
      coreSectionSize: source.coreSectionSize || SCHEDULE_DEFAULTS.coreSectionSize,
      peSectionSize: source.peSectionSize || SCHEDULE_DEFAULTS.peSectionSize
    };
  }

  function resolveTeacherNames(input) {
    var defaults = defaultTeacherNames();
    var names = {};
    var grades = [6, 7, 8];
    var subjects = ["Math", "ELA", "History", "Science", "PE"];
    for (var g = 0; g < grades.length; g++) {
      var grade = grades[g];
      names[grade] = {};
      for (var s = 0; s < subjects.length; s++) {
        var subject = subjects[s];
        var typed = input && input[grade] && input[grade][subject];
        var trimmed = String(typed == null ? "" : typed).trim();
        names[grade][subject] = trimmed || defaults[grade][subject];
      }
    }
    return names;
  }

  // Elective sections. Periods for one teacher never repeat.
  // Exclusive teachers (one course only) teach that course every period so a
  // backup seat exists no matter which period a student still has open.
  function electiveSectionPlans() {
    var plans = [];

    function add(course, teacher, period, seats) {
      plans.push({ course: course, teacher: teacher, period: period, seats: seats });
    }

    function addPeriods(course, teacher, periods, seats) {
      for (var i = 0; i < periods.length; i++) add(course, teacher, periods[i], seats);
    }

    var exclusive = [
      ["M/J Creative Photography 1", "Mr. Ellison", 24],
      ["M/J Instrumental Ensemble", "Mr. Navarro", 24],
      ["M/J Theatre 1", "Ms. Harrington", 24],
      ["Fundamentals of Visual & Perf Arts", "Mrs. Sato", 24],
      ["Digital Information Technology", "Mr. Carver", 24],
      ["App Creators/Automation & Robotics", "Mrs. Lennox", 22],
      ["Japanese 1", "Mr. Yamamoto", 20],
      ["M/J Intro to Personal Financial Literacy", "Mr. Grayson", 24]
    ];
    for (var e = 0; e < exclusive.length; e++) {
      for (var period = 1; period <= 7; period++) {
        add(exclusive[e][0], exclusive[e][1], period, exclusive[e][2]);
      }
    }

    var listed = [
      ["M/J 2-D Studio Art 1", "Ms. Marquez", [1, 3, 4, 6, 7], 28],
      ["M/J 2-D Studio Art 2", "Ms. Marquez", [2, 5], 20],
      ["M/J Chorus 1", "Mrs. Bellamy", [1, 3, 5, 6, 7], 26],
      ["M/J Chorus 2", "Mrs. Bellamy", [2], 18],
      ["M/J Chorus 3", "Mrs. Bellamy", [4], 16],
      ["M/J Creative Writing 1", "Mr. Fletcher", [1, 3, 4, 6, 7], 26],
      ["M/J Creative Writing 2", "Mr. Fletcher", [2], 18],
      ["M/J Creative Writing 3", "Mr. Fletcher", [5], 16],
      ["Info & Comm Tech 1", "Ms. Nguyen", [1, 2, 4, 5, 7], 24],
      ["Info & Comm Tech 2", "Ms. Nguyen", [3, 6], 18],
      ["French 1", "Madame Laurent", [1, 3, 4, 5, 7], 24],
      ["French 2", "Madame Laurent", [2, 6], 18],
      ["Spanish 1", "Señora Cruz", [1, 2, 4, 5, 6], 28],
      ["Spanish 2", "Señora Cruz", [3, 7], 20],
      ["Advanced Academics, Future Business Leaders of America 1", "Ms. Caldwell", [1, 2, 4, 6, 7], 24],
      ["Advanced Academics, Future Business Leaders of America 2", "Ms. Caldwell", [3], 16],
      ["Advanced Academics, Future Business Leaders of America 3", "Ms. Caldwell", [5], 14],
      ["Odyssey of the Mind 1", "Ms. Aldridge", [1, 5], 16],
      ["Odyssey of the Mind 2", "Ms. Aldridge", [3], 12],
      ["Odyssey of the Mind 3", "Ms. Aldridge", [7], 12],
      ["FIRST Lego League Robotics 1", "Mr. Tanaka", [2, 6], 16],
      ["FIRST Lego League Robotics 2", "Mr. Tanaka", [4], 12],
      ["FIRST Lego League Robotics 3", "Mr. Tanaka", [7], 12],
      ["Science Olympiad 1", "Mrs. Whitfield", [1, 4], 16],
      ["Science Olympiad 2", "Mrs. Whitfield", [6], 12],
      ["Science Olympiad 3", "Mrs. Whitfield", [3], 12],
      ["Chess 1", "Mr. Stein", [2, 5], 16],
      ["Chess 2", "Mr. Stein", [7], 12],
      ["Chess 3", "Mr. Stein", [4], 12],
      ["Quiz Bowl 1", "Dr. Mercer", [3, 6], 16],
      ["Quiz Bowl 2", "Dr. Mercer", [1], 12],
      ["Quiz Bowl 3", "Dr. Mercer", [5], 12],
      ["M/J Speech-Debate 1", "Mrs. Sinclair", [4, 7], 16],
      ["M/J Speech-Debate 2", "Mrs. Sinclair", [2], 12],
      ["M/J Speech-Debate 3", "Mrs. Sinclair", [6], 12]
    ];
    for (var n = 0; n < listed.length; n++) {
      addPeriods(listed[n][0], listed[n][1], listed[n][2], listed[n][3]);
    }
    return plans;
  }

  function buildMasterSchedule(teacherNames, config) {
    var settings = resolveConfig(config);
    var names = resolveTeacherNames(teacherNames);
    var sections = {};
    var busy = {};
    var warnings = [];

    function teacherFree(teacher, period) {
      return !busy[teacher] || !busy[teacher][period];
    }

    function addSection(course, teacher, period, seats, priority) {
      if (!sections[course]) sections[course] = [];
      var section = {
        id: course + "|p" + period + "|" + teacher,
        course: course,
        period: period,
        teacher: teacher,
        seats: seats,
        capacity: seats,
        // 0 is the teacher typed on the page. 1 is the second teacher.
        // When both sections have the same number of open seats, use 0 first.
        priority: priority || 0
      };
      sections[course].push(section);
      if (!busy[teacher]) busy[teacher] = {};
      busy[teacher][period] = course;
    }

    // Prefer the requested period. If that teacher is already busy then, try
    // the other periods in order. If every period is taken, skip the section.
    function placeSection(course, teacher, period, seats, priority) {
      var order = periodSearchOrder(period);
      for (var i = 0; i < order.length; i++) {
        var candidate = order[i];
        if (!teacherFree(teacher, candidate)) continue;
        addSection(course, teacher, candidate, seats, priority);
        if (candidate !== period) {
          warnings.push(
            teacher + " already teaches a class in period " + period +
            ", so " + course + " was moved to period " + candidate + "."
          );
        }
        return true;
      }
      warnings.push(
        teacher + " is already teaching every period, so one section of " +
        course + " was not added."
      );
      return false;
    }

    var subjects = ["Math", "ELA", "History", "Science"];
    for (var g = 0; g < settings.grades.length; g++) {
      var grade = settings.grades[g];
      for (var s = 0; s < subjects.length; s++) {
        var subject = subjects[s];
        var course = grade + " " + subject;
        var primary = names[grade][subject];
        var assistant = ASSISTANT_TEACHERS[grade][subject];
        for (var p = 0; p < settings.periods.length; p++) {
          var period = settings.periods[p];
          placeSection(course, primary, period, settings.coreSectionSize, 0);
          placeSection(course, assistant, period, settings.coreSectionSize, 1);
        }
      }
      var peCourse = grade + " PE";
      for (var pe = 0; pe < settings.periods.length; pe++) {
        var pePeriod = settings.periods[pe];
        placeSection(peCourse, names[grade].PE, pePeriod, settings.peSectionSize, 0);
        placeSection(peCourse, ASSISTANT_TEACHERS[grade].PE, pePeriod, settings.peSectionSize, 1);
      }
    }

    var electives = electiveSectionPlans();
    for (var i = 0; i < electives.length; i++) {
      var plan = electives[i];
      placeSection(plan.course, plan.teacher, plan.period, plan.seats);
    }

    for (var c = 0; c < allRequestCourses.length; c++) {
      var requestCourse = allRequestCourses[c];
      if (!sections[requestCourse] || sections[requestCourse].length === 0) {
        warnings.push("No section was created for " + requestCourse + ".");
      }
    }

    return { sections: sections, warnings: warnings, teacherNames: names, config: settings };
  }

  function compareOpenSections(a, b) {
    if (b.seats !== a.seats) return b.seats - a.seats;
    var priorityA = a.priority || 0;
    var priorityB = b.priority || 0;
    if (priorityA !== priorityB) return priorityA - priorityB;
    return compareText(a.id, b.id);
  }

  function placeInPeriod(schedule, sections, course, period) {
    if (schedule[period]) return null;
    var list = sections[course];
    if (!list || list.length === 0) return null;
    var options = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].period === period && list[i].seats > 0) options.push(list[i]);
    }
    if (options.length === 0) return null;
    options.sort(compareOpenSections);
    var chosen = options[0];
    chosen.seats -= 1;
    var item = { course: course, teacher: chosen.teacher, sectionId: chosen.id };
    schedule[period] = item;
    return item;
  }

  function placeInFirstOpen(schedule, sections, course, periods) {
    for (var i = 0; i < periods.length; i++) {
      var placed = placeInPeriod(schedule, sections, course, periods[i]);
      if (placed) return placed;
    }
    return null;
  }

  function familyTaken(schedule, course) {
    var family = subjectFamily(course);
    for (var period = 1; period <= 7; period++) {
      if (schedule[period] && subjectFamily(schedule[period].course) === family) return true;
    }
    return false;
  }

  function scheduleHasFamily(schedule, family) {
    for (var period = 1; period <= 7; period++) {
      if (schedule[period] && subjectFamily(schedule[period].course) === family) return true;
    }
    return false;
  }

  function openPeriods(schedule) {
    var open = [];
    for (var period = 1; period <= 7; period++) {
      if (!schedule[period]) open.push(period);
    }
    return open;
  }

  function uniquePeriods(list) {
    var seen = {};
    var result = [];
    for (var i = 0; i < list.length; i++) {
      var period = list[i];
      if (!seen[period]) {
        seen[period] = true;
        result.push(period);
      }
    }
    return result;
  }

  function collectReasons(student, schedule) {
    var reasons = [];
    var required = requiredCoursesForGrade(student);
    for (var i = 0; i < required.length; i++) {
      if (!scheduleHasFamily(schedule, subjectFamily(required[i]))) {
        reasons.push("Missing required class: " + required[i] + ".");
      }
    }
    for (var period = 1; period <= 7; period++) {
      if (!schedule[period]) reasons.push("Period " + period + " has no class.");
    }
    return reasons;
  }

  // indexInGrade spreads students across periods so they do not all want the
  // same core section. 0 means period pattern A, 1 means the next rotation.
  function buildStudentSchedule(student, sections, indexInGrade) {
    var schedule = createEmptySchedule();
    var received = [];
    var missed = [];
    var rotation = (indexInGrade || 0) % 7;

    function preferred(offset) {
      return ((offset + rotation) % 7) + 1;
    }

    var coreSubjects = ["Math", "ELA", "History", "Science"];
    for (var c = 0; c < coreSubjects.length; c++) {
      var coreCourse = student.grade + " " + coreSubjects[c];
      placeInFirstOpen(schedule, sections, coreCourse, periodSearchOrder(preferred(c)));
    }

    if (!student.peWaiver) {
      placeInFirstOpen(
        schedule,
        sections,
        student.grade + " PE",
        periodSearchOrder(preferred(4))
      );
    }

    var rankings = Array.isArray(student.rankings) ? student.rankings : [];
    for (var r = 0; r < rankings.length; r++) {
      if (openPeriods(schedule).length === 0) break;
      var requested = rankings[r];
      if (!requested) continue;
      if (!requestSet[requested] || familyTaken(schedule, requested)) {
        missed.push({ course: requested, rank: r + 1 });
        continue;
      }
      var electiveOrder = uniquePeriods(
        [preferred(5), preferred(6), preferred(4)].concat(periodSearchOrder(preferred(5)))
      );
      var placedRequest = placeInFirstOpen(schedule, sections, requested, electiveOrder);
      if (placedRequest) received.push({ course: requested, rank: r + 1 });
      else missed.push({ course: requested, rank: r + 1 });
    }

    var backups = backupCourseList();
    var cursor = backups.length ? (indexInGrade || 0) % backups.length : 0;
    var empties = openPeriods(schedule);
    for (var e = 0; e < empties.length; e++) {
      var period = empties[e];
      var filled = false;
      for (var t = 0; t < backups.length; t++) {
        var backup = backups[(cursor + t) % backups.length];
        if (familyTaken(schedule, backup)) continue;
        if (placeInPeriod(schedule, sections, backup, period)) {
          received.push({ course: backup, rank: "Backup" });
          cursor = (cursor + t + 1) % backups.length;
          filled = true;
          break;
        }
      }
      if (!filled) {
        // collectReasons adds the empty-period sentence. Nothing else to do.
      }
    }

    var reasons = collectReasons(student, schedule);
    var complete = reasons.length === 0;
    return {
      student: student,
      schedule: schedule,
      notes: reasons,
      reasons: reasons,
      receivedElectives: received,
      missedElectives: missed,
      manual: false,
      complete: complete,
      status: complete ? "scheduled" : "partial"
    };
  }

  function generateSchedules(students, teacherNames, config) {
    var built = buildMasterSchedule(teacherNames, config);
    var list = Array.isArray(students) ? students.slice() : [];
    var ordered = list.map(function (student, index) {
      return { student: student, index: index };
    });
    ordered.sort(function (a, b) {
      var byGrade = gradePriority(a.student.grade) - gradePriority(b.student.grade);
      if (byGrade) return byGrade;
      var byName = compareText(a.student.name || "", b.student.name || "");
      if (byName) return byName;
      return a.index - b.index;
    });

    var counters = {};
    var results = ordered.map(function (entry) {
      var grade = entry.student.grade;
      var indexInGrade = counters[grade] || 0;
      counters[grade] = indexInGrade + 1;
      return buildStudentSchedule(entry.student, built.sections, indexInGrade);
    });

    return {
      results: results,
      sections: built.sections,
      warnings: built.warnings
    };
  }

  function createDemoStudents() {
    var names = [
      "Ava Brooks",
      "Liam Carter",
      "Sophia Lane",
      "Noah Bennett",
      "Mia Collins",
      "Ethan Parker",
      "Olivia Stone",
      "Lucas Reed"
    ];
    var students = [];
    for (var i = 0; i < names.length; i++) {
      var rankings = [];
      for (var k = 0; k < 5; k++) {
        rankings.push(allRequestCourses[(i * 7 + k * 5) % allRequestCourses.length]);
      }
      students.push({
        name: names[i],
        grade: [6, 7, 8][i % 3],
        peWaiver: i === 4,
        rankings: rankings
      });
    }
    students.push({
      name: "Preference Example A",
      grade: 6,
      peWaiver: false,
      rankings: [
        "M/J 2-D Studio Art 1",
        "Spanish 1",
        "M/J Chorus 1",
        "M/J Theatre 1",
        "M/J Creative Writing 1"
      ]
    });
    students.push({
      name: "Preference Example B",
      grade: 8,
      peWaiver: false,
      rankings: [
        "Spanish 1",
        "M/J Chorus 1",
        "M/J Theatre 1",
        "M/J Creative Writing 1",
        "M/J 2-D Studio Art 1"
      ]
    });
    return students;
  }

  function splitFields(line) {
    var result = [];
    var current = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes && (char === "," || char === "\t" || char === ";")) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  function lineHasSeparator(line) {
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && (char === "," || char === "\t" || char === ";")) return true;
    }
    return false;
  }

  function foldNumbers(key) {
    var words = { one: "1", two: "2", three: "3", i: "1", ii: "2", iii: "3" };
    return String(key || "").split(" ").map(function (token) {
      return words[token] || token;
    }).join(" ");
  }

  function courseKey(text) {
    return foldNumbers(normalizeKey(text));
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    var prev = new Array(b.length + 1);
    var curr = new Array(b.length + 1);
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      curr[0] = i;
      var leftCode = a.charCodeAt(i - 1);
      for (j = 1; j <= b.length; j++) {
        var cost = leftCode === b.charCodeAt(j - 1) ? 0 : 1;
        var del = prev[j] + 1;
        var ins = curr[j - 1] + 1;
        var sub = prev[j - 1] + cost;
        var best = del < ins ? del : ins;
        curr[j] = best < sub ? best : sub;
      }
      var swap = prev;
      prev = curr;
      curr = swap;
    }
    return prev[b.length];
  }

  function maxTypoDistance(length) {
    if (length < 6) return 0;
    if (length < 12) return 1;
    return 2;
  }

  var courseByKey = {};
  var aliasMap = {};
  var searchKeys = [];

  function rememberKey(key, course) {
    if (!key || key.length < 2 || /^[123]$/.test(key)) return;
    searchKeys.push({ key: key, course: course });
    if (!aliasMap[key]) aliasMap[key] = [];
    if (aliasMap[key].indexOf(course) === -1) aliasMap[key].push(course);
  }

  function addAlias(alias, course) {
    rememberKey(courseKey(alias), course);
  }

  function linkLevels(bases, courseForLevel, levels) {
    for (var n = 0; n < levels.length; n++) {
      var level = levels[n];
      var course = courseForLevel(level);
      var word = level === 1 ? "one" : level === 2 ? "two" : "three";
      var roman = level === 1 ? "i" : level === 2 ? "ii" : "iii";
      for (var b = 0; b < bases.length; b++) {
        addAlias(bases[b], course);
        addAlias(bases[b] + " " + level, course);
        addAlias(bases[b] + " " + word, course);
        addAlias(bases[b] + " " + roman, course);
      }
    }
  }

  (function buildCourseAliases() {
    for (var i = 0; i < allRequestCourses.length; i++) {
      var official = allRequestCourses[i];
      courseByKey[courseKey(official)] = official;
      rememberKey(courseKey(official), official);
      var withoutMj = official.replace(/^M\/J\s+/i, "");
      if (withoutMj !== official) addAlias(withoutMj, official);
    }

    function numbered(prefix, levels) {
      var names = {};
      for (var n = 0; n < levels.length; n++) names[levels[n]] = prefix + " " + levels[n];
      return function (level) { return names[level]; };
    }

    linkLevels(["odyssey", "odyssey of the mind", "ootm"], numbered("Odyssey of the Mind", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["fll", "robotics", "lego", "lego robotics", "first lego", "first lego league robotics"], numbered("FIRST Lego League Robotics", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["science olympiad", "sci oly", "olympiad"], numbered("Science Olympiad", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["chess"], numbered("Chess", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["quiz bowl", "quizbowl", "qb"], numbered("Quiz Bowl", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["fbla", "future business leaders", "future business leaders of america"], function (level) {
      return "Advanced Academics, Future Business Leaders of America " + level;
    }, [1, 2, 3]);
    linkLevels(["debate", "speech", "speech debate", "speech and debate"], numbered("M/J Speech-Debate", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["art", "studio art", "2d art", "2 d art", "2d studio art"], numbered("M/J 2-D Studio Art", [1, 2]), [1, 2]);
    linkLevels(["chorus", "choir"], numbered("M/J Chorus", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["creative writing", "writing"], numbered("M/J Creative Writing", [1, 2, 3]), [1, 2, 3]);
    linkLevels(["info tech", "ict", "info and comm tech", "info comm tech"], numbered("Info & Comm Tech", [1, 2]), [1, 2]);
    linkLevels(["french"], numbered("French", [1, 2]), [1, 2]);
    linkLevels(["spanish", "span"], numbered("Spanish", [1, 2]), [1, 2]);
    linkLevels(["photo", "photography", "creative photography"], function () {
      return "M/J Creative Photography 1";
    }, [1]);
    linkLevels(["theatre", "theater", "drama"], function () { return "M/J Theatre 1"; }, [1]);
    linkLevels(["japanese", "japan"], function () { return "Japanese 1"; }, [1]);
    addAlias("band", "M/J Instrumental Ensemble");
    addAlias("instrumental", "M/J Instrumental Ensemble");
    addAlias("instrumental ensemble", "M/J Instrumental Ensemble");
    addAlias("orchestra", "M/J Instrumental Ensemble");
    addAlias("fundamentals", "Fundamentals of Visual & Perf Arts");
    addAlias("visual arts", "Fundamentals of Visual & Perf Arts");
    addAlias("perf arts", "Fundamentals of Visual & Perf Arts");
    addAlias("dit", "Digital Information Technology");
    addAlias("digital it", "Digital Information Technology");
    addAlias("digital information technology", "Digital Information Technology");
    addAlias("app creators", "App Creators/Automation & Robotics");
    addAlias("apps", "App Creators/Automation & Robotics");
    addAlias("automation", "App Creators/Automation & Robotics");
    addAlias("automation and robotics", "App Creators/Automation & Robotics");
    addAlias("robotics", "App Creators/Automation & Robotics");
    addAlias("financial literacy", "M/J Intro to Personal Financial Literacy");
    addAlias("personal finance", "M/J Intro to Personal Financial Literacy");
    addAlias("finance", "M/J Intro to Personal Financial Literacy");
    addAlias("personal financial literacy", "M/J Intro to Personal Financial Literacy");
  })();

  function sortCourseList(list) {
    var order = {};
    for (var i = 0; i < allRequestCourses.length; i++) order[allRequestCourses[i]] = i;
    return list.slice().sort(function (a, b) {
      return (order[a] || 0) - (order[b] || 0);
    });
  }

  function finishCourseMatch(course, typed) {
    var note = "";
    if (normalizeKey(typed) !== normalizeKey(course)) {
      note = 'Read "' + String(typed).trim() + '" as ' + course + ".";
    }
    return { ok: true, course: course, note: note };
  }

  function ambiguousCourseMatch(options, typed) {
    return { ok: false, kind: "ambiguous", options: sortCourseList(options), typed: typed };
  }

  function fuzzyCourses(key) {
    var allowed = maxTypoDistance(key.length);
    if (!allowed) return { kind: "none" };
    var stripped = key.replace(/ /g, "");
    var bestByCourse = {};
    for (var i = 0; i < searchKeys.length; i++) {
      var target = searchKeys[i].key;
      var course = searchKeys[i].course;
      if (!target || target === key) continue;
      var targetStripped = target.replace(/ /g, "");
      if (Math.abs(target.length - key.length) > allowed && Math.abs(targetStripped.length - stripped.length) > allowed) {
        continue;
      }
      var distance = levenshtein(key, target);
      var strippedDistance = levenshtein(stripped, targetStripped);
      if (strippedDistance < distance) distance = strippedDistance;
      if (distance > allowed) continue;
      if (bestByCourse[course] == null || distance < bestByCourse[course]) bestByCourse[course] = distance;
    }
    var courses = Object.keys(bestByCourse);
    if (!courses.length) return { kind: "none" };
    courses.sort(function (a, b) {
      if (bestByCourse[a] !== bestByCourse[b]) return bestByCourse[a] - bestByCourse[b];
      return compareText(a, b);
    });
    var best = bestByCourse[courses[0]];
    var winners = [];
    for (var c = 0; c < courses.length; c++) {
      if (bestByCourse[courses[c]] === best) winners.push(courses[c]);
    }
    if (winners.length === 1) return { kind: "one", course: winners[0] };
    return { kind: "many", courses: sortCourseList(winners) };
  }

  function classifyCourse(input) {
    var typed = String(input || "").trim();
    var key = courseKey(typed);
    if (!key) return { ok: true, course: "", note: "" };
    if (courseByKey[key]) return finishCourseMatch(courseByKey[key], typed);

    var aliasHits = aliasMap[key] || [];
    if (aliasHits.length === 1) return finishCourseMatch(aliasHits[0], typed);
    if (aliasHits.length > 1) return ambiguousCourseMatch(aliasHits, typed);

    if (key.length >= 5) {
      var contained = [];
      for (var i = 0; i < allRequestCourses.length; i++) {
        var official = courseKey(allRequestCourses[i]);
        if (official.indexOf(key) !== -1) contained.push(allRequestCourses[i]);
      }
      if (contained.length === 1) return finishCourseMatch(contained[0], typed);
      if (contained.length > 1) return ambiguousCourseMatch(contained, typed);
    }

    var fuzzy = fuzzyCourses(key);
    if (fuzzy.kind === "one") return finishCourseMatch(fuzzy.course, typed);
    if (fuzzy.kind === "many") return ambiguousCourseMatch(fuzzy.courses, typed);
    return { ok: false, kind: "unknown", typed: typed };
  }

  function searchCourses(query) {
    var key = courseKey(query);
    if (!key) return allRequestCourses.slice();
    var seen = {};
    var found = [];
    function add(course) {
      if (course && !seen[course]) {
        seen[course] = true;
        found.push(course);
      }
    }
    for (var i = 0; i < allRequestCourses.length; i++) {
      if (courseKey(allRequestCourses[i]).indexOf(key) !== -1) add(allRequestCourses[i]);
    }
    for (var s = 0; s < searchKeys.length; s++) {
      if (searchKeys[s].key.indexOf(key) !== -1) add(searchKeys[s].course);
    }
    return sortCourseList(found);
  }

  function parseGrade(value) {
    var key = normalizeKey(value);
    if (!key) return { ok: false };
    key = key.replace(/^grade /, "").replace(/ grade$/, "");
    var words = { six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8 };
    if (words[key]) return { ok: true, grade: words[key] };
    var match = key.match(/^([0-9]+)(?:st|nd|rd|th)?$/);
    if (!match) return { ok: false };
    var grade = Number(match[1]);
    if (grade !== 6 && grade !== 7 && grade !== 8) return { ok: false };
    return { ok: true, grade: grade };
  }

  function parseWaiverStrict(value) {
    var key = normalizeKey(value);
    if (!key || key === "blank") return { ok: true, waiver: false, blank: true };
    var yes = { y: 1, yes: 1, yeah: 1, yep: 1, true: 1, "1": 1, waived: 1, waiver: 1, signed: 1 };
    var no = { n: 1, no: 1, nope: 1, false: 1, "0": 1, none: 1 };
    if (yes[key]) return { ok: true, waiver: true, blank: false };
    if (no[key]) return { ok: true, waiver: false, blank: false };
    return { ok: false };
  }

  function takeCoursePhrases(tokens) {
    var choices = [];
    var index = 0;
    while (index < tokens.length && choices.length < 5) {
      var found = null;
      var maxLen = Math.min(8, tokens.length - index);
      for (var len = maxLen; len >= 1; len--) {
        var phrase = tokens.slice(index, index + len).join(" ");
        var match = classifyCourse(phrase);
        var useful = (match.ok && match.course) || match.kind === "ambiguous";
        if (useful) {
          found = { len: len, match: match, typed: phrase };
          break;
        }
      }
      if (!found) {
        var token = tokens[index];
        choices.push({ match: classifyCourse(token), typed: token });
        index += 1;
      } else {
        choices.push(found);
        index += found.len;
      }
    }
    return choices;
  }

  function takeCourseFields(fields) {
    var choices = [];
    var index = 0;
    var limited = fields.slice(0, 8);
    while (index < limited.length && choices.length < 5) {
      var found = null;
      var maxLen = Math.min(3, limited.length - index);
      for (var len = maxLen; len >= 1; len--) {
        var phrase = limited.slice(index, index + len).join(" ").replace(/\s+/g, " ").trim();
        var withComma = limited.slice(index, index + len).join(", ").trim();
        var match = classifyCourse(phrase);
        var commaMatch = classifyCourse(withComma);
        var chosen = match;
        var typed = phrase;
        if ((!match.ok || !match.course) && ((commaMatch.ok && commaMatch.course) || commaMatch.kind === "ambiguous")) {
          chosen = commaMatch;
          typed = withComma;
        }
        if ((chosen.ok && chosen.course) || chosen.kind === "ambiguous") {
          found = { len: len, match: chosen, typed: typed };
          break;
        }
      }
      if (!found) {
        choices.push({ match: classifyCourse(limited[index]), typed: limited[index] });
        index += 1;
      } else {
        choices.push(found);
        index += found.len;
      }
    }
    return choices;
  }

  function parseLooseLine(line) {
    var tokens = line.trim().split(/\s+/);
    var gradeAt = -1;
    var grade = null;
    var gradeWidth = 1;
    for (var i = 0; i < tokens.length; i++) {
      var two = i + 1 < tokens.length ? parseGrade(tokens[i] + " " + tokens[i + 1]) : null;
      var one = parseGrade(tokens[i]);
      if (two && two.ok && normalizeKey(tokens[i]) === "grade") {
        gradeAt = i;
        grade = two;
        gradeWidth = 2;
        break;
      }
      if (one && one.ok && tokens[i + 1] && normalizeKey(tokens[i + 1]) === "grade") {
        gradeAt = i;
        grade = one;
        gradeWidth = 2;
        break;
      }
      if (one && one.ok) {
        gradeAt = i;
        grade = one;
        gradeWidth = 1;
        break;
      }
    }
    if (gradeAt < 0) {
      for (var b = 1; b < tokens.length; b++) {
        var rawGrade = tokens[b];
        var gradeKey = normalizeKey(rawGrade);
        if (/^[0-9]/.test(gradeKey) || /^(nine|ninth|five|fifth|ten|tenth)$/.test(gradeKey)) {
          return { badGrade: true, name: tokens.slice(0, b).join(" "), rawGrade: rawGrade };
        }
      }
      return null;
    }
    if (gradeAt === 0 || !grade) return null;
    var name = tokens.slice(0, gradeAt).join(" ").trim();
    var rest = tokens.slice(gradeAt + gradeWidth);
    var waiver = { ok: true, waiver: false, blank: true, assumed: true };
    if (rest.length && normalizeKey(rest[0]) && parseWaiverStrict(rest[0]).ok) {
      waiver = parseWaiverStrict(rest[0]);
      waiver.assumed = false;
      rest = rest.slice(1);
    } else if (rest[0] && normalizeKey(rest[0]) === "grade") {
      rest = rest.slice(1);
    }
    return {
      name: name,
      grade: grade,
      waiver: waiver,
      choices: takeCoursePhrases(rest)
    };
  }

  function emptyParse(errors) {
    return { students: [], errors: errors || [], notes: [], questions: [] };
  }

  function isHeaderLine(line) {
    var cells = splitFields(line);
    if (normalizeKey(cells[0]) === "name") return true;
    var first = line.trim().split(/\s+/)[0];
    return normalizeKey(first) === "name";
  }

  function ambiguousMessage(lineNumber, name, typed, options) {
    return "Line " + lineNumber + ': "' + typed + '" for ' + name +
      " matches more than one course (" + options.join(", ") + "). Type the full course name.";
  }

  function parseStudentCsv(text) {
    var errors = [];
    var students = [];
    var notes = [];
    var questions = [];
    var raw = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var lines = raw.split("\n");
    var rows = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim()) rows.push({ line: lines[i].trim(), number: i + 1 });
    }
    if (rows.length === 0) {
      errors.push({
        line: 0,
        message: "The import box is empty. Add a header and at least one student."
      });
      return emptyParse(errors);
    }

    var start = 0;
    if (isHeaderLine(rows[0].line)) start = 1;
    if (start >= rows.length) {
      errors.push({
        line: rows[0].number,
        message: "Add at least one student row under the header."
      });
      return emptyParse(errors);
    }

    var acceptedNames = {};
    for (var r = start; r < rows.length; r++) {
      var row = rows[r];
      var name = "";
      var gradeParsed = null;
      var waiverParsed = null;
      var choiceItems = [];
      var waiverNote = "";

      if (!lineHasSeparator(row.line)) {
        var loose = parseLooseLine(row.line);
        if (!loose) {
          errors.push({
            line: row.number,
            message: "Line " + row.number + ": This row is missing a name, grade, or PE waiver. Every student needs all three."
          });
          continue;
        }
        if (loose.badGrade) {
          errors.push({
            line: row.number,
            message: "Line " + row.number + ': Grade "' + loose.rawGrade + '" is not supported for ' + loose.name + ". Use 6, 7, or 8."
          });
          continue;
        }
        name = loose.name;
        gradeParsed = loose.grade;
        waiverParsed = loose.waiver;
        choiceItems = loose.choices;
        if (waiverParsed.assumed) {
          waiverNote = "No PE waiver was written for " + name + ", so this student still takes PE.";
        }
      } else {
        var cells = splitFields(row.line);
        name = cells.length > 0 ? String(cells[0] || "").trim() : "";
        var gradeCell = cells.length > 1 ? cells[1] : "";
        var waiverCell = cells.length > 2 ? cells[2] : "";
        if (!name || cells.length < 3 || String(gradeCell).trim() === "") {
          errors.push({
            line: row.number,
            message: "Line " + row.number + ": This row is missing a name, grade, or PE waiver. Every student needs all three."
          });
          continue;
        }
        gradeParsed = parseGrade(gradeCell);
        if (!String(waiverCell).trim()) {
          waiverParsed = { ok: true, waiver: false, blank: true };
          waiverNote = "Read a blank PE waiver for " + name + " as No.";
        } else {
          waiverParsed = parseWaiverStrict(waiverCell);
        }
        choiceItems = takeCourseFields(cells.slice(3));
      }

      if (!name) {
        errors.push({
          line: row.number,
          message: "Line " + row.number + ": This row is missing a name, grade, or PE waiver. Every student needs all three."
        });
        continue;
      }

      var nameKey = name.toLowerCase();
      if (acceptedNames[nameKey]) {
        errors.push({
          line: row.number,
          message: "Line " + row.number + ': Duplicate student name "' + name + '" (first used on line ' + acceptedNames[nameKey] + ")."
        });
        continue;
      }

      if (!gradeParsed || !gradeParsed.ok) {
        errors.push({
          line: row.number,
          message: "Line " + row.number + ': Grade "' + String(lineHasSeparator(row.line) ? splitFields(row.line)[1] : "").trim() + '" is not supported for ' + name + ". Use 6, 7, or 8."
        });
        continue;
      }

      if (!waiverParsed || !waiverParsed.ok) {
        var waiverText = lineHasSeparator(row.line) ? splitFields(row.line)[2] : "";
        errors.push({
          line: row.number,
          message: "Line " + row.number + ': PE Waiver for ' + name + ' must be Yes or No, not "' + String(waiverText || "").trim() + '".'
        });
        continue;
      }

      var resolved = [];
      var pending = [];
      var rowNotes = [];
      var hard = false;
      if (waiverNote) rowNotes.push(waiverNote);
      for (var c = 0; c < choiceItems.length; c++) {
        var item = choiceItems[c];
        var match = item.match;
        if (!match || (match.ok && !match.course)) continue;
        if (match.kind === "ambiguous") {
          pending.push({ typed: item.typed, options: match.options.slice() });
          continue;
        }
        if (!match.ok) {
          hard = true;
          errors.push({
            line: row.number,
            message: "Line " + row.number + ': Unknown course "' + item.typed + '" for ' + name + ". Check the spelling against the course list."
          });
          continue;
        }
        if (resolved.indexOf(match.course) !== -1) {
          hard = true;
          errors.push({
            line: row.number,
            message: "Line " + row.number + ': "' + match.course + '" is listed more than once for ' + name + "."
          });
          continue;
        }
        resolved.push(match.course);
        if (match.note) rowNotes.push(match.note);
      }
      if (hard) continue;

      if (pending.length) {
        var question = {
          id: "line-" + row.number,
          line: row.number,
          name: name,
          grade: gradeParsed.grade,
          peWaiver: waiverParsed.waiver,
          resolved: resolved,
          pending: pending,
          notes: rowNotes
        };
        questions.push(question);
        for (var p = 0; p < pending.length; p++) {
          errors.push({
            line: row.number,
            questionId: question.id,
            message: ambiguousMessage(row.number, name, pending[p].typed, pending[p].options)
          });
        }
        acceptedNames[nameKey] = row.number;
        continue;
      }

      for (var n = 0; n < rowNotes.length; n++) {
        notes.push({ line: row.number, message: rowNotes[n] });
      }
      acceptedNames[nameKey] = row.number;
      students.push({
        name: name,
        grade: gradeParsed.grade,
        peWaiver: waiverParsed.waiver,
        rankings: resolved
      });
    }

    return { students: students, errors: errors, notes: notes, questions: questions };
  }

  function answerImportQuestion(question, course) {
    if (!question || !question.pending || !question.pending.length) {
      return { ok: false, error: "Nothing left to choose." };
    }
    var problem = question.pending[0];
    var options = problem.options || [];
    if (options.indexOf(course) === -1) {
      return { ok: false, error: "That is not one of the choices." };
    }
    var resolved = (question.resolved || []).slice();
    if (resolved.indexOf(course) !== -1) {
      return { ok: false, error: course + " is already one of this student's choices." };
    }
    resolved.push(course);
    var pending = question.pending.slice(1);
    var notes = (question.notes || []).slice();
    notes.push('Read "' + problem.typed + '" as ' + course + ".");
    var updated = {
      id: question.id,
      line: question.line,
      name: question.name,
      grade: question.grade,
      peWaiver: question.peWaiver,
      resolved: resolved,
      pending: pending,
      notes: notes
    };
    if (pending.length === 0) {
      return {
        ok: true,
        done: true,
        student: {
          name: question.name,
          grade: question.grade,
          peWaiver: question.peWaiver,
          rankings: resolved
        },
        notes: notes,
        question: updated
      };
    }
    return { ok: true, done: false, question: updated, notes: notes };
  }

  function formatImportReport(errors, importedCount) {
    var problems = errors || [];
    var count = importedCount || 0;
    var html = "";
    if (count > 0 && problems.length === 0) {
      html += '<div class="success"><strong>Import successful.</strong> ' + count +
        " student" + (count === 1 ? "" : "s") + " imported. No problems found.</div>";
    } else if (count > 0) {
      html += '<div class="success"><strong>' + count + " student" + (count === 1 ? "" : "s") +
        " imported.</strong> The rows listed below were skipped.</div>";
    }
    if (problems.length > 0) {
      var items = problems.map(function (problem) {
        return "<li>" + escapeHtml(problem.message) + "</li>";
      }).join("");
      html += '<div class="warning"><strong>Import problems (' + problems.length +
        "):</strong><ul>" + items + "</ul>Those rows were not scheduled. Fix them and try again. The importer does not guess course names.</div>";
    }
    return html;
  }

  function cloneSections(sections) {
    var copy = {};
    var courses = Object.keys(sections || {});
    for (var i = 0; i < courses.length; i++) {
      var course = courses[i];
      copy[course] = sections[course].map(function (section) {
        return {
          id: section.id,
          course: section.course,
          period: section.period,
          teacher: section.teacher,
          seats: section.seats,
          capacity: section.capacity,
          priority: section.priority || 0
        };
      });
    }
    return copy;
  }

  function findSection(sections, sectionId) {
    var courses = Object.keys(sections || {});
    for (var i = 0; i < courses.length; i++) {
      var list = sections[courses[i]];
      for (var s = 0; s < list.length; s++) {
        if (list[s].id === sectionId) return list[s];
      }
    }
    return null;
  }

  function releaseSeat(sections, item) {
    if (!item || !item.sectionId) return;
    var section = findSection(sections, item.sectionId);
    if (section && section.seats < section.capacity) section.seats += 1;
  }

  function takeSeat(sections, course, period) {
    var list = sections[course];
    if (!list) return null;
    var options = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].period === period && list[i].seats > 0) options.push(list[i]);
    }
    if (options.length === 0) return null;
    options.sort(compareOpenSections);
    var chosen = options[0];
    chosen.seats -= 1;
    return { course: course, teacher: chosen.teacher, sectionId: chosen.id };
  }

  function commitSeats(live, draft) {
    var courses = Object.keys(live || {});
    for (var i = 0; i < courses.length; i++) {
      var course = courses[i];
      var byId = {};
      var draftList = draft[course] || [];
      for (var d = 0; d < draftList.length; d++) byId[draftList[d].id] = draftList[d];
      var liveList = live[course];
      for (var s = 0; s < liveList.length; s++) {
        if (byId[liveList[s].id]) liveList[s].seats = byId[liveList[s].id].seats;
      }
    }
  }

  function syncElectiveLists(result) {
    var placed = {};
    for (var period = 1; period <= 7; period++) {
      if (result.schedule[period]) placed[result.schedule[period].course] = true;
    }
    var received = [];
    var missed = [];
    var rankings = result.student.rankings || [];
    for (var i = 0; i < rankings.length; i++) {
      if (!rankings[i]) continue;
      if (placed[rankings[i]]) received.push({ course: rankings[i], rank: i + 1 });
      else missed.push({ course: rankings[i], rank: i + 1 });
    }
    result.receivedElectives = received;
    result.missedElectives = missed;
  }

  function readOverrideCourse(coursesByPeriod, period) {
    if (Array.isArray(coursesByPeriod)) return coursesByPeriod[period];
    if (!coursesByPeriod) return "";
    if (coursesByPeriod[period] != null) return coursesByPeriod[period];
    if (coursesByPeriod[String(period)] != null) return coursesByPeriod[String(period)];
    return "";
  }

  function applyManualOverride(result, coursesByPeriod, sections) {
    if (!result || !result.student) return { ok: false, error: "Choose a student first." };
    if (!sections) return { ok: false, error: "Generate a schedule before saving a manual change." };

    var courses = [];
    for (var period = 1; period <= 7; period++) {
      courses.push(String(readOverrideCourse(coursesByPeriod, period) || "").trim());
    }
    for (var p = 0; p < courses.length; p++) {
      if (!courses[p]) {
        return { ok: false, error: "Period " + (p + 1) + " is empty. Choose a class for every period." };
      }
    }

    var families = {};
    for (var f = 0; f < courses.length; f++) {
      var family = subjectFamily(courses[f]);
      if (families[family]) {
        return {
          ok: false,
          error: "Duplicate schedule problem: " + courses[f] + " repeats the same subject as another period."
        };
      }
      families[family] = true;
    }

    var needed = requiredFamilies(result.student);
    for (var n = 0; n < needed.length; n++) {
      if (!families[needed[n]]) {
        return { ok: false, error: "Cannot remove required class: " + needed[n] + "." };
      }
    }

    var draft = cloneSections(sections);
    for (var rel = 1; rel <= 7; rel++) releaseSeat(draft, result.schedule[rel]);

    var newSchedule = {};
    for (var place = 1; place <= 7; place++) {
      var course = courses[place - 1];
      if (!draft[course] || draft[course].length === 0) {
        return { ok: false, error: course + " is not on the master schedule." };
      }
      var offered = false;
      for (var s = 0; s < draft[course].length; s++) {
        if (draft[course][s].period === place) offered = true;
      }
      if (!offered) {
        return { ok: false, error: course + " is not offered in Period " + place + "." };
      }
      var taken = takeSeat(draft, course, place);
      if (!taken) {
        return { ok: false, error: "No open seat in Period " + place + " for " + course + "." };
      }
      newSchedule[place] = taken;
    }

    commitSeats(sections, draft);
    result.schedule = newSchedule;
    result.manual = true;
    result.complete = true;
    result.status = "scheduled";
    result.notes = [];
    result.reasons = [];
    syncElectiveLists(result);
    return { ok: true };
  }

  function allScheduleOptions() {
    var options = [];
    var grades = [6, 7, 8];
    var subjects = ["Math", "ELA", "History", "Science", "PE"];
    for (var g = 0; g < grades.length; g++) {
      for (var s = 0; s < subjects.length; s++) {
        options.push(grades[g] + " " + subjects[s]);
      }
    }
    return options.concat(allRequestCourses);
  }

  function createScheduleHtml(result) {
    var student = result.student || { name: "Student", grade: "", rankings: [], peWaiver: false };
    var lunchAfter = getLunchAfterPeriod(student.grade);
    var rankings = Array.isArray(student.rankings) ? student.rankings : [];
    var rankingHtml = "";
    for (var i = 0; i < rankings.length; i++) {
      if (!rankings[i]) continue;
      rankingHtml += '<span class="pill">#' + (i + 1) + ": " + escapeHtml(rankings[i]) + "</span>";
    }

    var rows = "";
    for (var period = 1; period <= 7; period++) {
      var item = result.schedule ? result.schedule[period] : null;
      var course = item && item.course ? item.course : "Not scheduled";
      var teacher = item && item.teacher ? item.teacher : "—";
      rows += "<tr><td>Period " + period + "</td><td>" + escapeHtml(course) + "</td><td>" + escapeHtml(teacher) + "</td></tr>";
      if (period === lunchAfter) {
        rows += '<tr class="lunch-row"><td colspan="3">Lunch Break After Period ' + lunchAfter + "</td></tr>";
      }
    }

    var receivedList = result.receivedElectives || [];
    var received = receivedList.length
      ? receivedList.map(function (entry) {
          var good = entry.rank <= 2 || entry.rank === "Backup";
          return '<span class="' + (good ? "rank-good" : "rank-low") + '">' +
            escapeHtml(entry.course) + " (#" + escapeHtml(entry.rank) + ")</span>";
        }).join(", ")
      : "No requested courses placed";

    var missedList = result.missedElectives || [];
    var missed = missedList.length
      ? missedList.map(function (entry) {
          return escapeHtml(entry.course) + " (#" + escapeHtml(entry.rank) + ")";
        }).join(", ")
      : "None";

    var manual = result.manual
      ? '<div class="note"><strong>Manual Override:</strong> This student\'s assigned schedule was manually adjusted.</div>'
      : "";

    var reasonText = (result.notes || []).map(escapeHtml).join(" ");
    var partial = result.complete === false
      ? '<div class="warning"><strong>Partial schedule:</strong> This student is not fully scheduled. ' + reasonText + "</div>"
      : "";

    var titleExtra = (student.peWaiver ? " | PE Waiver Recorded" : "") +
      (result.manual ? " | Manually Edited" : "") +
      (result.complete === false ? " | Partial Schedule" : "");

    return '<div class="schedule-card">' +
      '<div class="schedule-title">' + escapeHtml(student.name) + " | Rising Grade " + escapeHtml(student.grade) + titleExtra + "</div>" +
      '<div style="padding:14px;">' +
      partial +
      '<div class="small"><strong>Original Ranked Requests:</strong><br>' + rankingHtml + "</div>" +
      "<table><tr><th>Time</th><th>Assigned Class</th><th>Teacher</th></tr>" + rows + "</table>" +
      '<p class="small"><strong>Requested Courses Received:</strong> ' + received +
      "<br><strong>Requested Courses Not Placed:</strong> " + missed + "</p>" +
      manual +
      "</div></div>";
  }

  function createSummaryHtml(results, modeName, warnings) {
    var list = results || [];
    var firstChoice = 0;
    var anyElective = 0;
    var manualCount = 0;
    var partialCount = 0;
    for (var i = 0; i < list.length; i++) {
      var result = list[i];
      if (result.manual) manualCount += 1;
      if (result.complete === false) partialCount += 1;
      var received = result.receivedElectives || [];
      if (received.some(function (entry) { return entry.rank === 1; })) firstChoice += 1;
      if (received.length > 0) anyElective += 1;
    }
    var html = '<div class="grid grid-4">' +
      '<div class="stat"><strong>' + list.length + "</strong>Students Scheduled</div>" +
      '<div class="stat"><strong>' + firstChoice + "</strong>Received 1st Choice</div>" +
      '<div class="stat"><strong>' + anyElective + "</strong>Received Requested Course</div>" +
      '<div class="stat"><strong>' + manualCount + "</strong>Manual Overrides</div>" +
      "</div>" +
      '<div class="success"><strong>' + escapeHtml(modeName || "Schedules") +
      ":</strong> Core classes were placed first, then PE if required, then electives.</div>";
    if (partialCount > 0) {
      html += '<div class="warning"><strong>' + partialCount + " student" + (partialCount === 1 ? "" : "s") +
        "</strong> could not be fully scheduled. Each one is marked Partial Schedule, and the card explains why.</div>";
    }
    if (warnings && warnings.length > 0) {
      html += '<div class="note"><strong>Teacher names:</strong> ' + warnings.length +
        " section" + (warnings.length === 1 ? "" : "s") +
        " could not be offered at the usual time because that teacher was already teaching another class. No teacher is booked twice.</div>";
    }
    return html;
  }

  return {
    academicCompetitionCourses: academicCompetitionCourses,
    electiveCourses: electiveCourses,
    allRequestCourses: allRequestCourses,
    SCHEDULE_DEFAULTS: SCHEDULE_DEFAULTS,
    assistantTeachers: ASSISTANT_TEACHERS,
    defaultTeacherNames: defaultTeacherNames,
    buildMasterSchedule: buildMasterSchedule,
    generateSchedules: generateSchedules,
    buildStudentSchedule: buildStudentSchedule,
    createDemoStudents: createDemoStudents,
    parseStudentCsv: parseStudentCsv,
    answerImportQuestion: answerImportQuestion,
    searchCourses: searchCourses,
    formatImportReport: formatImportReport,
    applyManualOverride: applyManualOverride,
    createScheduleHtml: createScheduleHtml,
    createSummaryHtml: createSummaryHtml,
    escapeHtml: escapeHtml,
    allScheduleOptions: allScheduleOptions,
    subjectFamily: subjectFamily,
    isBackupEligible: isBackupEligible,
    isCompetitionCourse: isCompetitionCourse,
    requiredCoursesForGrade: requiredCoursesForGrade,
    getLunchAfterPeriod: getLunchAfterPeriod,
    classifyCourse: classifyCourse
  };
});
