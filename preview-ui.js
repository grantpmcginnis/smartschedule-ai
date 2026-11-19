/*
 * Plain helpers for the preview page.
 * No scheduling rules live here. Those stay in scheduler.js.
 */
(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PreviewUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  function load(name, globalName) {
    if (typeof module === "object" && module.exports && typeof require === "function") {
      return require(name);
    }
    return root[globalName];
  }

  var catalog = load("./school-data.js", "SCHOOL_CATALOG");
  var engine = load("./scheduler.js", "SmartSchedule");

  var byId = {};
  catalog.courses.forEach(function (course) {
    byId[course.id] = course;
  });

  var sampleNameSet = {};
  function rememberSample(name) {
    if (name) sampleNameSet[name] = true;
  }
  [6, 7, 8].forEach(function (grade) {
    Object.keys(catalog.sampleTeachers.grades[grade]).forEach(function (subject) {
      var row = catalog.sampleTeachers.grades[grade][subject];
      rememberSample(row.primary);
      rememberSample(row.assistant);
    });
  });
  catalog.courses.forEach(function (course) {
    rememberSample(course.sampleTeacher);
  });

  var overrideGroups = [
    { id: "this-grade", label: "This student's grade" },
    { id: "other-grades", label: "Other grades" }
  ].concat(catalog.groups.map(function (group) {
    return { id: group.id, label: group.label };
  }));

  function displayName(courseId) {
    var match = /^([678]) (Math|ELA|History|Science|PE)$/.exec(courseId || "");
    if (match) {
      return match[1] + "th grade " + (catalog.subjectLabels[match[2]] || match[2]);
    }
    var found = byId[courseId];
    return found ? found.displayName : String(courseId || "");
  }

  function courseRecord(courseId) {
    return byId[courseId] || null;
  }

  function statusLine(course) {
    if (!course) return "";
    if (course.publicStatus === "confirmed-language") return "Offered in 2025-26";
    if (course.publicStatus === "not-on-language-list") return "On the demo list. Not on the 2025-26 language list.";
    if (course.competition || course.level >= 2) return "Only placed if you request it";
    return "On the demo course list";
  }

  function aboutLines(course) {
    var lines = [];
    if (!course) return lines;
    if (course.displayName !== course.id) lines.push("Course list name: " + course.id);
    lines.push(course.description ? course.description : catalog.missingDescription);
    if (course.sampleTeacher) lines.push("Sample teacher: " + course.sampleTeacher);
    if (course.publicNote) lines.push(course.publicNote);
    if (course.level >= 2 || course.competition) {
      lines.push("This is not used to fill an empty period. Add it to your list if you want it.");
    }
    return lines;
  }

  function matchesQuery(course, query) {
    var text = String(query || "").trim();
    if (!text) return true;
    var blob = [
      course.displayName,
      course.id,
      course.group,
      course.sampleTeacher,
      course.publicNote,
      statusLine(course)
    ].join(" ").toLowerCase();
    if (blob.indexOf(text.toLowerCase()) !== -1) return true;
    if (engine && engine.searchCourses) {
      return engine.searchCourses(text).indexOf(course.id) !== -1;
    }
    return false;
  }

  function groupedCourses(query, groupFilter) {
    return catalog.groups.map(function (group) {
      if (groupFilter && groupFilter !== "All" && group.id !== groupFilter) {
        return { id: group.id, label: group.label, intro: group.intro, courses: [] };
      }
      var courses = catalog.courses.filter(function (course) {
        return course.group === group.id && matchesQuery(course, query);
      });
      return { id: group.id, label: group.label, intro: group.intro, courses: courses };
    }).filter(function (group) {
      return group.courses.length > 0;
    });
  }

  function plainBlockReason(reason) {
    if (!reason) return "";
    if (reason === "Already picked") return "It is already on your list";
    if (reason.indexOf("Already have ") === 0) return "You already picked " + reason.slice("Already have ".length);
    if (reason === "No seats left") return "That class is full";
    return reason;
  }

  function addRanking(rankings, courseId, sections) {
    var current = (rankings || []).slice();
    if (!courseId || !byId[courseId]) {
      return { ok: false, error: "Choose a class from the list.", rankings: current };
    }
    if (current.length >= 5) {
      return {
        ok: false,
        error: "You already have 5 classes. Remove one to add a different class.",
        rankings: current
      };
    }
    var reason = engine.choiceBlockReason(courseId, current, sections || null);
    if (reason) {
      return {
        ok: false,
        error: displayName(courseId) + " cannot be added. " + plainBlockReason(reason) + ".",
        rankings: current
      };
    }
    current.push(courseId);
    return { ok: true, error: "", rankings: current };
  }

  function removeRanking(rankings, courseId) {
    return (rankings || []).filter(function (id) { return id !== courseId; });
  }

  function moveRanking(rankings, index, direction) {
    var next = (rankings || []).slice();
    var target = index + direction;
    if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
    var held = next[index];
    next[index] = next[target];
    next[target] = held;
    return next;
  }

  function validateIdentity(draft) {
    var name = String(draft && draft.name || "").trim();
    if (!name) return { ok: false, error: "Type your name." };
    if (!draft || (draft.grade !== 6 && draft.grade !== 7 && draft.grade !== 8)) {
      return { ok: false, error: "Choose 6th, 7th, or 8th grade." };
    }
    return { ok: true, error: "" };
  }

  function electiveSlots(peWaiver) {
    return peWaiver ? 3 : 2;
  }

  function electiveSentence(peWaiver) {
    if (peWaiver) return "PE is waived, so 3 of these electives will be placed. List the favorite first.";
    return "You take PE, so 2 of these electives will be placed. List the favorite first.";
  }

  function teacherHint(courseId) {
    var match = /^([678]) (Math|ELA|History|Science|PE)$/.exec(courseId || "");
    if (match) {
      var row = catalog.sampleTeachers.grades[Number(match[1])][match[2]];
      return "Sample teachers: " + row.primary + " or " + row.assistant;
    }
    var found = byId[courseId];
    if (found && found.sampleTeacher) return "Sample teacher: " + found.sampleTeacher;
    return "";
  }

  function labelTeacher(name) {
    var trimmed = String(name || "").trim();
    if (!trimmed) return "";
    if (sampleNameSet[trimmed]) return "Sample teacher: " + trimmed;
    return "Teacher: " + trimmed;
  }

  function isSampleTeacher(name) {
    return !!sampleNameSet[String(name || "").trim()];
  }

  function optionMatches(option, query) {
    var text = String(query || "").trim();
    if (!text) return true;
    var q = text.toLowerCase();
    var name = displayName(option.course).toLowerCase();
    var id = String(option.course || "").toLowerCase();
    var hint = teacherHint(option.course).toLowerCase();
    if (name.indexOf(q) !== -1 || id.indexOf(q) !== -1 || hint.indexOf(q) !== -1) return true;
    if (engine && engine.searchCourses && engine.searchCourses(text).indexOf(option.course) !== -1) return true;
    return false;
  }

  function groupIdForCourse(courseId, studentGrade) {
    var match = /^([678]) (Math|ELA|History|Science|PE)$/.exec(courseId || "");
    if (match) return Number(match[1]) === Number(studentGrade) ? "this-grade" : "other-grades";
    var found = byId[courseId];
    return found ? found.group : "Other";
  }

  function groupPeriodOptions(options, studentGrade, query) {
    var buckets = {};
    overrideGroups.forEach(function (group) { buckets[group.id] = []; });
    (options || []).forEach(function (option) {
      if (!optionMatches(option, query)) return;
      var id = groupIdForCourse(option.course, studentGrade);
      if (!buckets[id]) buckets[id] = [];
      buckets[id].push(option);
    });
    return overrideGroups.map(function (group) {
      var items = buckets[group.id].slice().sort(function (a, b) {
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
        var left = displayName(a.course);
        var right = displayName(b.course);
        if (left < right) return -1;
        if (left > right) return 1;
        return 0;
      });
      return { id: group.id, label: group.label, items: items };
    }).filter(function (group) { return group.items.length > 0; });
  }

  function plainNote(note) {
    var text = String(note || "");
    var missing = /^Missing required class: (.+)\.$/.exec(text);
    if (missing) return "Missing " + displayName(missing[1]) + ".";
    var empty = /^Period (\d+) has no class\.$/.exec(text);
    if (empty) return "Period " + empty[1] + " is empty.";
    if (text === "Flagged for an admin to review.") return "Marked for staff to review.";
    return text;
  }

  function explainPlacement(result) {
    var lines = [];
    var received = result && result.receivedElectives ? result.receivedElectives : [];
    var missed = result && result.missedElectives ? result.missedElectives : [];
    received.forEach(function (entry) {
      if (entry.rank === "Backup") return;
      lines.push({
        kind: "got",
        text: "Choice " + entry.rank + " fit: " + displayName(entry.course) + "."
      });
    });
    missed.forEach(function (entry) {
      lines.push({
        kind: "missed",
        text: "Choice " + entry.rank + " did not fit: " + displayName(entry.course) + "."
      });
    });
    received.forEach(function (entry) {
      if (entry.rank !== "Backup") return;
      lines.push({
        kind: "filler",
        text: displayName(entry.course) + " was added to fill an open period. You did not ask for it."
      });
    });
    return lines;
  }

  function dayPlan(result) {
    var student = result && result.student ? result.student : {};
    var lunchAfter = engine.getLunchAfterPeriod(student.grade);
    var rows = [];
    for (var period = 1; period <= 7; period++) {
      var item = result && result.schedule ? result.schedule[period] : null;
      rows.push({
        type: "class",
        period: period,
        courseId: item && item.course ? item.course : "",
        display: item && item.course ? displayName(item.course) : "Empty",
        teacher: item && item.teacher ? item.teacher : "",
        teacherLabel: item && item.teacher ? labelTeacher(item.teacher) : ""
      });
      if (period === lunchAfter) rows.push({ type: "lunch", text: "Lunch" });
    }
    return rows;
  }

  function summarizeResult(result) {
    var student = result.student || { name: "Student", grade: "", rankings: [] };
    var received = result.receivedElectives || [];
    var rankings = student.rankings || [];
    var gotFirst = received.some(function (entry) { return entry.rank === 1; });
    var status = "Ready";
    var tone = "ready";
    if (result.complete === false) {
      status = "Missing a class";
      tone = "missing";
    } else if (result.flaggedForAdmin) {
      status = "Flagged";
      tone = "flagged";
    } else if (result.manual) {
      status = "Edited";
      tone = "edited";
    }
    var sub = "No electives requested";
    if (result.complete === false) sub = plainNote((result.notes && result.notes[0]) || "Not finished");
    else if (!rankings.length) sub = "No electives requested";
    else if (gotFirst) sub = "Got 1st choice";
    else sub = "1st choice did not fit";
    return {
      name: student.name,
      grade: student.grade,
      status: status,
      tone: tone,
      gotFirst: gotFirst,
      sub: sub
    };
  }

  function emptyTeacherNames() {
    var names = {};
    [6, 7, 8].forEach(function (grade) {
      names[grade] = {};
      Object.keys(catalog.sampleTeachers.grades[grade]).forEach(function (subject) {
        names[grade][subject] = catalog.sampleTeachers.grades[grade][subject].primary;
      });
    });
    return names;
  }

  return {
    catalog: catalog,
    displayName: displayName,
    courseRecord: courseRecord,
    statusLine: statusLine,
    aboutLines: aboutLines,
    matchesQuery: matchesQuery,
    groupedCourses: groupedCourses,
    plainBlockReason: plainBlockReason,
    addRanking: addRanking,
    removeRanking: removeRanking,
    moveRanking: moveRanking,
    validateIdentity: validateIdentity,
    electiveSlots: electiveSlots,
    electiveSentence: electiveSentence,
    teacherHint: teacherHint,
    labelTeacher: labelTeacher,
    isSampleTeacher: isSampleTeacher,
    groupPeriodOptions: groupPeriodOptions,
    plainNote: plainNote,
    explainPlacement: explainPlacement,
    dayPlan: dayPlan,
    summarizeResult: summarizeResult,
    emptyTeacherNames: emptyTeacherNames,
    rules: function () { return catalog.rules.slice(); }
  };
});
