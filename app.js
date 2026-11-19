/*
 * Preview page behavior.
 * Scheduling stays in scheduler.js. This file only shows screens.
 */
(function () {
  "use strict";

  var SAMPLE_PASTE = [
    "Name,Grade,PE Waiver,Choice 1,Choice 2,Choice 3,Choice 4,Choice 5",
    'Student A,6,No,"M/J 2-D Studio Art 1","Info & Comm Tech 1","M/J Creative Writing 1","M/J Theatre 1","Spanish 1"',
    'Student B,7,No,"FIRST Lego League Robotics 1","Digital Information Technology","App Creators/Automation & Robotics","Quiz Bowl 1","Japanese 1"',
    'Student C,8,Yes,"M/J Speech-Debate 1","M/J Creative Photography 1","French 1","M/J Intro to Personal Financial Literacy","Chess 1"'
  ].join("\n");

  function emptyDraft() {
    return { name: "", grade: 0, peWaiver: false, rankings: [] };
  }

  var state = {
    mode: "student",
    wizard: null,
    step: "home",
    adminStep: "setup",
    setupGrade: 6,
    draft: emptyDraft(),
    rosterDraft: emptyDraft(),
    editingId: null,
    courseQuery: "",
    courseGroup: "All",
    roster: [],
    nextId: 1,
    teachers: PreviewUI.emptyTeacherNames(),
    results: [],
    sections: null,
    warnings: [],
    resultsLabel: "",
    selectedIndex: 0,
    studentResult: null,
    pendingQuestions: [],
    importNotes: { notes: [], hard: [], added: 0 },
    questionError: null,
    bulkText: SAMPLE_PASTE,
    overrideProposed: null,
    overrideDirty: false,
    changePeriod: null,
    changeQuery: "",
    message: "",
    messageKind: "",
    formError: "",
    focusHeading: false,
    focusDialog: false,
    announce: ""
  };

  function esc(value) {
    return SmartSchedule.escapeHtml(value);
  }

  function activeDraft() {
    return state.wizard === "roster" ? state.rosterDraft : state.draft;
  }

  function staffNow() {
    return state.mode === "admin" || state.wizard === "roster";
  }

  function teacherPayload() {
    var names = {};
    [6, 7, 8].forEach(function (grade) {
      names[grade] = {};
      ["Math", "ELA", "History", "Science", "PE"].forEach(function (subject) {
        var typed = state.teachers[grade] && state.teachers[grade][subject];
        var value = String(typed == null ? "" : typed).trim();
        names[grade][subject] = value || SCHOOL_CATALOG.sampleTeachers.grades[grade][subject].primary;
      });
    });
    return names;
  }

  function loadOverride(result) {
    var proposed = {};
    for (var period = 1; period <= 7; period++) {
      proposed[period] = result.schedule[period] ? result.schedule[period].course : "";
    }
    state.overrideProposed = proposed;
    state.overrideDirty = false;
  }

  function wrap(inner, wide) {
    var banner = state.wizard === "roster"
      ? '<p class="staff-flag">School staff · adding someone to the list</p>'
      : "";
    return '<div class="wrap' + (wide ? " wide" : "") + '">' + banner + inner + "</div>";
  }

  function progress(step) {
    var labels = ["Who", "Electives", "Review"];
    return '<p class="progress">Step ' + step + " of 3 · " + labels[step - 1] + "</p>";
  }

  function rulesDetails() {
    var items = PreviewUI.rules().map(function (rule) {
      return "<li>" + esc(rule) + "</li>";
    }).join("");
    return '<details class="rules"><summary>How a schedule is filled</summary><ol>' + items + "</ol></details>";
  }

  function messageHtml() {
    if (!state.message) return "";
    var kind = state.messageKind === "warning" ? "msg-warning" : state.messageKind === "success" ? "msg-success" : "msg-note";
    return '<div class="msg ' + kind + '" role="status">' + esc(state.message) + "</div>";
  }

  function errorHtml() {
    if (!state.formError) return "";
    return '<div id="formError" class="msg msg-warning" role="alert" tabindex="-1">' + esc(state.formError) + "</div>";
  }

  function renderHome() {
    var again = state.studentResult
      ? '<button type="button" class="btn btn-secondary" data-action="see-schedule">See my practice schedule</button>'
      : "";
    return wrap(
      "<h1>Enter your course requests</h1>" +
      "<p class='lede'>Your school told you to do this here. If you don't, you may get a random schedule.</p>" +
      '<ol class="todo">' +
      "<li><strong>Your name and grade</strong><span>And whether you take PE.</span></li>" +
      "<li><strong>Up to 5 electives</strong><span>Put your favorite first.</span></li>" +
      "<li><strong>Check your list</strong><span>Then look at a practice schedule.</span></li>" +
      "</ol>" +
      '<button type="button" class="btn btn-primary" data-action="start">Start my course request</button>' +
      again +
      "<p class='help'>This page does not send your list to the school. It stays on this computer until you close it.</p>" +
      rulesDetails()
    );
  }

  function gradePick(draft, grade, label) {
    var checked = Number(draft.grade) === grade ? " checked" : "";
    return '<label class="pick"><input type="radio" name="grade" value="' + grade + '"' + checked + "> " + label + "</label>";
  }

  function renderWho() {
    var draft = activeDraft();
    var staff = state.wizard === "roster";
    var peNo = draft.peWaiver ? "" : " checked";
    var peYes = draft.peWaiver ? " checked" : "";
    var peTakes = staff ? "This student takes PE" : "I take PE";
    return wrap(
      progress(1) +
      "<h1>" + (staff ? "Who is the student?" : "Who are you?") + "</h1>" +
      "<p class='lede'>" + (staff
        ? "Name, grade, and PE. Electives come next."
        : "Math, language arts, history, and science are added for you.") + "</p>" +
      errorHtml() +
      '<form id="whoForm">' +
      '<label for="studentName">Name</label>' +
      '<input id="studentName" name="studentName" autocomplete="name" value="' + esc(draft.name) + '">' +
      "<fieldset><legend>Grade</legend><div class='picks'>" +
      gradePick(draft, 6, "6th grade") + gradePick(draft, 7, "7th grade") + gradePick(draft, 8, "8th grade") +
      "</div></fieldset>" +
      "<fieldset><legend>PE</legend><div class='picks picks-stack'>" +
      '<label class="pick"><input type="radio" name="peWaiver" value="no"' + peNo + "> " + peTakes + "</label>" +
      '<label class="pick"><input type="radio" name="peWaiver" value="yes"' + peYes + "> PE is waived</label>" +
      "</div><p class='help'>Most students take PE. Choose waived only if the school already excused it.</p></fieldset>" +
      '<button type="submit" class="btn btn-primary">' + (staff ? "Choose electives" : "Choose my electives") + "</button>" +
      "</form>" +
      '<button type="button" class="btn btn-tertiary" data-action="' + (staff ? "cancel-roster" : "back-home") + '">Back</button>'
    );
  }

  function renderRanks(rankings) {
    if (!rankings.length) return '<p class="empty">Nothing here yet. Add a class. Favorite first.</p>';
    var html = '<ol class="ranks">';
    rankings.forEach(function (id, index) {
      var name = PreviewUI.displayName(id);
      html += "<li><span class='rank-num'>" + (index + 1) + "</span><span class='rank-name'>" + esc(name) + "</span>";
      html += "<span class='rank-actions'>";
      html += '<button type="button" class="btn btn-small btn-secondary" data-action="move-course" data-index="' + index + '" data-direction="-1"' +
        (index === 0 ? " disabled" : "") + ' aria-label="Move ' + esc(name) + ' up">Up</button>';
      html += '<button type="button" class="btn btn-small btn-secondary" data-action="move-course" data-index="' + index + '" data-direction="1"' +
        (index === rankings.length - 1 ? " disabled" : "") + ' aria-label="Move ' + esc(name) + ' down">Down</button>';
      html += '<button type="button" class="btn btn-small btn-tertiary" data-action="remove-course" data-course="' + esc(id) + '" aria-label="Remove ' + esc(name) + '">Remove</button>';
      html += "</span></li>";
    });
    return html + "</ol>";
  }

  function courseCard(course, rankings) {
    var onList = rankings.indexOf(course.id) !== -1;
    var reason = "";
    if (!onList && rankings.length >= 5) reason = "You already have 5 classes";
    else if (!onList) reason = SmartSchedule.choiceBlockReason(course.id, rankings, state.sections);
    var plain = reason ? PreviewUI.plainBlockReason(reason) : "";
    var about = PreviewUI.aboutLines(course).map(function (line) {
      return "<li>" + esc(line) + "</li>";
    }).join("");
    return '<article class="card"><div class="card-top"><h3>' + esc(course.displayName) + "</h3><p class='status'>" +
      esc(PreviewUI.statusLine(course)) + "</p></div><details><summary>About this class</summary><ul>" + about +
      '</ul></details><button type="button" class="btn btn-secondary" data-action="' + (onList ? "remove-course" : "add-course") +
      '" data-course="' + esc(course.id) + '"' + (!onList && reason ? " disabled" : "") + ">" + (onList ? "Remove" : "Add") +
      "</button>" + (plain ? "<p class='why'>" + esc(plain) + ".</p>" : "") + "</article>";
  }

  function renderCourseCards() {
    var rankings = activeDraft().rankings;
    var groups = PreviewUI.groupedCourses(state.courseQuery, state.courseGroup);
    if (!groups.length) return '<p class="empty">No class has a name like that.</p>';
    return groups.map(function (group) {
      return "<section><h2>" + esc(group.label) + "</h2><p class='help'>" + esc(group.intro) + "</p>" +
        group.courses.map(function (course) { return courseCard(course, rankings); }).join("") +
        "</section>";
    }).join("");
  }

  function renderFinder() {
    var chips = '<div class="chips" role="group" aria-label="Class groups">';
    [{ id: "All", label: "All" }].concat(SCHOOL_CATALOG.groups).forEach(function (group) {
      var pressed = state.courseGroup === group.id ? "true" : "false";
      chips += '<button type="button" class="chip" data-action="group-filter" data-group="' + esc(group.id) + '" aria-pressed="' + pressed + '">' + esc(group.label) + "</button>";
    });
    chips += "</div>";
    return '<label for="courseQuery">Search classes</label>' +
      '<input id="courseQuery" type="search" autocomplete="off" placeholder="Try Spanish, art, robotics" value="' + esc(state.courseQuery) + '">' +
      chips + '<div id="courseMount">' + renderCourseCards() + "</div>";
  }

  function renderPick() {
    var draft = activeDraft();
    var staff = state.wizard === "roster";
    var count = draft.rankings.length;
    var dockLabel = (staff ? "Review this student" : "Review my list") + " (" + count + " of 5)";
    return wrap(
      progress(2) +
      "<h1>" + (staff ? "Pick electives" : "Pick your electives") + "</h1>" +
      "<p class='lede'>" + esc(PreviewUI.electiveSentence(draft.peWaiver)) + "</p>" +
      errorHtml() +
      '<div class="pick-layout"><div class="rank-col"><h2>The list</h2>' + renderRanks(draft.rankings) + "</div><div>" + renderFinder() + "</div></div>",
      true
    ) + '<div class="dock"><button type="button" class="btn btn-secondary" data-action="back-who">Back</button>' +
      '<button type="button" class="btn btn-primary" data-action="continue-pick">' + esc(dockLabel) + "</button></div>";
  }

  function renderReview() {
    var draft = activeDraft();
    var staff = state.wizard === "roster";
    var list = draft.rankings.length
      ? "<ol class='review-list'>" + draft.rankings.map(function (id, index) {
        return "<li>Choice " + (index + 1) + ": " + esc(PreviewUI.displayName(id)) + "</li>";
      }).join("") + "</ol>"
      : '<p class="msg msg-note">No electives yet. Open periods will be filled with beginner classes that were not requested.</p>';
    var primary = staff ? (state.editingId != null ? "Save changes" : "Add to the list") : "See my schedule";
    return wrap(
      progress(3) +
      "<h1>" + (staff ? "Add this student?" : "Check this, then see your schedule") + "</h1>" +
      errorHtml() +
      '<dl class="facts"><div><dt>Name</dt><dd>' + esc(String(draft.name || "").trim()) + "</dd></div>" +
      "<div><dt>Grade</dt><dd>" + esc(draft.grade) + "th</dd></div>" +
      "<div><dt>PE</dt><dd>" + (draft.peWaiver ? "Waived" : "Takes PE") + "</dd></div></dl>" +
      "<h2>Electives</h2>" + list +
      (staff ? "" : "<p class='help'>The next screen is a practice schedule. It is not sent to the school.</p>") +
      '<button type="button" class="btn btn-primary" data-action="finish-review">' + primary + "</button>" +
      '<button type="button" class="btn btn-secondary" data-action="back-pick">Change electives</button>' +
      '<button type="button" class="btn btn-tertiary" data-action="' + (staff ? "cancel-roster" : "start-over") + '">' +
      (staff ? "Cancel" : "Start over") + "</button>"
    );
  }

  function renderDayRow(row) {
    if (row.type === "lunch") return '<li class="lunch">Lunch</li>';
    return '<li class="class-row"><span class="period">Period ' + row.period + "</span><span><strong>" + esc(row.display) + "</strong>" +
      (row.teacherLabel ? "<br><span class='teacher'>" + esc(row.teacherLabel) + "</span>" : "") + "</span></li>";
  }

  function renderSchedule() {
    var result = state.studentResult;
    var lines = PreviewUI.explainPlacement(result).map(function (line) {
      return '<li class="line-' + line.kind + '">' + esc(line.text) + "</li>";
    }).join("");
    var notes = (result.notes || []).map(function (note) {
      return "<li>" + esc(PreviewUI.plainNote(note)) + "</li>";
    }).join("");
    var banner = result.complete === false
      ? '<div class="msg msg-warning" role="status"><strong>This schedule is missing a class.</strong><ul>' + notes + "</ul></div>"
      : '<div class="msg msg-success" role="status">Your practice schedule is ready.</div>';
    var changeClass = result.complete === false ? "btn btn-primary" : "btn btn-secondary";
    return wrap(
      '<p class="progress">Your schedule</p><h1>' + esc(result.student.name) + "</h1>" +
      "<p class='help'>" + esc(result.student.grade) + "th grade · " + (result.student.peWaiver ? "PE waived" : "Takes PE") + "</p>" +
      banner +
      "<p class='help'>This stays on this computer. It is not sent to the school.</p>" +
      (lines ? "<h2>Your electives</h2><ul class='explain'>" + lines + "</ul>" : "") +
      "<h2>Your day</h2><ul class='day'>" + PreviewUI.dayPlan(result).map(renderDayRow).join("") + "</ul>" +
      '<button type="button" class="' + changeClass + '" data-action="back-pick">Change my requests</button>' +
      '<button type="button" class="btn btn-tertiary" data-action="start-over">Start over</button>'
    );
  }

  function stepper(current) {
    var html = '<nav class="steps" aria-label="Staff steps">';
    [["setup", "1. Setup"], ["roster", "2. Students"], ["results", "3. Schedules"]].forEach(function (step) {
      html += '<button type="button" data-action="admin-step" data-step="' + step[0] + '"' +
        (step[0] === current ? ' aria-current="step"' : "") + ">" + step[1] + "</button>";
    });
    return html + "</nav>";
  }

  function renderSetup() {
    var active = state.setupGrade || 6;
    var tabs = [6, 7, 8].map(function (grade) {
      return '<button type="button" class="chip" data-action="grade-tab" data-grade="' + grade + '" aria-pressed="' +
        (grade === active ? "true" : "false") + '">' + grade + "th grade</button>";
    }).join("");
    var fields = ["Math", "ELA", "History", "Science", "PE"].map(function (subject) {
      var row = SCHOOL_CATALOG.sampleTeachers.grades[active][subject];
      var value = state.teachers[active][subject];
      var sample = String(value).trim() === row.primary;
      var label = active + "th grade " + SCHOOL_CATALOG.subjectLabels[subject];
      return '<label for="teacher-' + active + "-" + subject + '">' + esc(label) +
        (sample ? ' <span class="tag">Sample name</span>' : "") + "</label>" +
        '<input id="teacher-' + active + "-" + subject + '" data-teacher-grade="' + active + '" data-teacher-subject="' + subject + '" value="' + esc(value) + '">' +
        "<p class='help'>Second sample teacher: " + esc(row.assistant) + ".</p>";
    }).join("");
    var electiveList = SCHOOL_CATALOG.courses.map(function (course) {
      return "<li>" + esc(course.displayName) + " — sample teacher " + esc(course.sampleTeacher) + "</li>";
    }).join("");
    var missing = SCHOOL_CATALOG.missing.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("");
    return '<div class="wrap">' + stepper("setup") +
      "<h1>Class setup</h1>" +
      '<div class="msg msg-note"><strong>These are sample names, not real OGA teachers.</strong> Class descriptions are blank because the teacher booklet could not be loaded.</div>' +
      "<p class='help'>Students do not see this screen. Each core class has a second sample teacher so two sections can meet at once.</p>" +
      '<div class="chips" role="group" aria-label="Grade">' + tabs + "</div>" +
      fields +
      '<button type="button" class="btn btn-primary" data-action="admin-step" data-step="roster">Continue to students</button>' +
      "<details class='rules'><summary>Sample elective teachers</summary><ul>" + electiveList + "</ul></details>" +
      "<details class='rules'><summary>What is still missing</summary><ul>" + missing + "</ul><p class='help'>Language list: " +
      esc(SCHOOL_CATALOG.sources.languages) + "</p></details>" +
      rulesDetails() +
      "</div>";
  }

  function renderQuestions() {
    return state.pendingQuestions.map(function (question) {
      if (!question.pending.length) return "";
      var problem = question.pending[0];
      var buttons = problem.options.map(function (course) {
        return '<button type="button" class="btn btn-secondary" data-action="answer-question" data-qid="' + esc(question.id) + '" data-course="' + esc(course) + '">' + esc(PreviewUI.displayName(course)) + "</button>";
      }).join("");
      var error = state.questionError && state.questionError.id === question.id
        ? "<p class='why'>" + esc(state.questionError.text) + "</p>"
        : "";
      return '<div class="msg msg-note"><strong>Did you mean…?</strong><p>' + esc(question.name) + ' wrote "' + esc(problem.typed) + '". That name matches more than one class.</p>' + buttons + error + "</div>";
    }).join("");
  }

  function renderRoster() {
    var count = state.roster.length;
    var addClass = count === 0 ? "btn btn-primary" : "btn btn-secondary";
    var people = count === 0
      ? '<p class="empty">No students yet.</p>'
      : "<ul class='people'>" + state.roster.map(function (student) {
        var choices = student.rankings.length
          ? student.rankings.map(function (id, index) { return (index + 1) + ". " + PreviewUI.displayName(id); }).join(" · ")
          : "No electives";
        return "<li><strong>" + esc(student.name) + "</strong><span>" + student.grade + "th grade · " +
          (student.peWaiver ? "PE waived" : "Takes PE") + "</span><span>" + esc(choices) + "</span><span class='row-actions'>" +
          '<button type="button" class="btn btn-small btn-secondary" data-action="edit-roster" data-id="' + student.id + '">Edit</button>' +
          '<button type="button" class="btn btn-small btn-tertiary" data-action="remove-roster" data-id="' + student.id + '">Remove</button></span></li>';
      }).join("") + "</ul>";
    var pasteOpen = (state.pendingQuestions.length || (state.importNotes.hard && state.importNotes.hard.length) || state.importNotes.added) ? " open" : "";
    var run = count
      ? '<button type="button" class="btn btn-primary" data-action="run-roster">Make schedules</button>'
      : "<p class='help'>Add a student, then make schedules.</p>";
    return '<div class="wrap">' + stepper("roster") + messageHtml() +
      "<h1>Students</h1>" +
      "<p class='lede'>" + (count ? count + (count === 1 ? " student is" : " students are") + " ready." : "Add the students you want to schedule.") + "</p>" +
      '<button type="button" class="' + addClass + '" data-action="add-student">' + (count ? "Add another student" : "Add a student") + "</button>" +
      "<details class='paste'" + pasteOpen + "><summary>Paste a list</summary>" +
      "<p class='help'>One student per line. Example: Ava Brooks 7th no span one art 1. The text already in the box is only an example. If a short name matches more than one class, you get buttons. Nothing is guessed.</p>" +
      '<label for="bulkInput">Student list</label><textarea id="bulkInput">' + esc(state.bulkText) + "</textarea>" +
      '<button type="button" class="btn btn-secondary" data-action="paste">Add pasted students</button>' +
      '<div id="importHost"></div><div id="questionMount">' + renderQuestions() + "</div></details>" +
      "<h2>On the list</h2>" + people + run +
      '<button type="button" class="btn btn-tertiary" data-action="run-practice">Use 10 made-up students instead</button></div>';
  }

  function renderResults() {
    if (!state.results.length) {
      var next = state.roster.length
        ? '<button type="button" class="btn btn-primary" data-action="run-roster">Make schedules</button>'
        : '<button type="button" class="btn btn-primary" data-action="admin-step" data-step="roster">Add students</button>';
      return '<div class="wrap">' + stepper("results") + "<h1>Schedules</h1><p class='lede'>No schedules yet.</p>" + next +
        '<button type="button" class="btn btn-tertiary" data-action="run-practice">Make 10 practice schedules</button></div>';
    }
    var partials = state.results.filter(function (result) { return result.complete === false; }).length;
    var firsts = state.results.filter(function (result) { return PreviewUI.summarizeResult(result).gotFirst; }).length;
    var rows = state.results.map(function (result, index) {
      var item = PreviewUI.summarizeResult(result);
      return '<button type="button" class="person-row" data-action="open-result" data-index="' + index + '" aria-label="Open ' + esc(item.name) + '"><span class="person-name">' +
        esc(item.name) + '</span><span class="person-meta">' + esc(item.grade) + 'th grade</span><span class="status status-' + item.tone + '">' +
        esc(item.status) + '</span><span class="open-cue">Open</span><span class="person-sub">' + esc(item.sub) + "</span></button>";
    }).join("");
    var label = state.resultsLabel === "10 practice students"
      ? "10 practice students. The names are made up."
      : "Students you added.";
    return '<div class="wrap wide">' + stepper("results") + "<h1>Schedules</h1><p class='lede'>" + esc(label) + "</p>" +
      '<div class="stats"><p><strong>' + state.results.length + "</strong> students</p><p><strong>" + firsts +
      "</strong> got 1st choice</p><p><strong>" + partials + "</strong> missing a class</p></div>" +
      (partials ? '<p class="msg msg-warning">' + partials + (partials === 1 ? " student is" : " students are") + " missing a class. Open a name to see why.</p>" : "") +
      (state.warnings && state.warnings.length ? '<p class="msg msg-note">Some classes moved so a teacher is not booked twice.</p>' : "") +
      '<div class="result-list">' + rows + "</div>" +
      '<button type="button" class="btn btn-tertiary" data-action="clear-results">Clear these schedules</button></div>';
  }

  function renderDialog(result) {
    var period = state.changePeriod;
    var options = SmartSchedule.periodOptions(period, result.student, state.overrideProposed, state.sections, result.schedule);
    var groups = PreviewUI.groupPeriodOptions(options, result.student.grade, state.changeQuery);
    var body = groups.length ? groups.map(function (group) {
      var open = state.changeQuery || group.id === "this-grade" ? " open" : "";
      var buttons = group.items.map(function (item) {
        return '<button type="button" class="option" data-action="pick-override" data-course="' + esc(item.course) + '"' +
          (item.enabled ? "" : " disabled") + "><span>" + esc(PreviewUI.displayName(item.course)) + "</span><span class='teacher'>" +
          esc(PreviewUI.teacherHint(item.course)) + "</span>" +
          (item.reason ? "<span class='why'>" + esc(item.reason) + "</span>" : "") + "</button>";
      }).join("");
      return "<details" + open + "><summary>" + esc(group.label) + " (" + group.items.length + ")</summary>" + buttons + "</details>";
    }).join("") : '<p class="empty">No class has a name like that.</p>';
    return '<div class="dialog-back"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="changeTitle">' +
      '<h2 id="changeTitle">Change period ' + period + "</h2>" +
      '<label for="changeQuery">Search classes</label>' +
      '<input id="changeQuery" type="search" autocomplete="off" placeholder="Try math, Spanish, art" value="' + esc(state.changeQuery) + '">' +
      '<div id="optionMount">' + body + "</div>" +
      '<button type="button" class="btn btn-tertiary" data-action="close-dialog">Cancel</button></div></div>';
  }

  function renderDetail() {
    var result = state.results[state.selectedIndex];
    if (!result) return renderResults();
    if (!state.overrideProposed) loadOverride(result);
    var summary = PreviewUI.summarizeResult(result);
    var lines = PreviewUI.explainPlacement(result).map(function (line) {
      return "<li>" + esc(line.text) + "</li>";
    }).join("");
    var notes = (result.notes || []).map(function (note) {
      return "<li>" + esc(PreviewUI.plainNote(note)) + "</li>";
    }).join("");
    var proposal = state.overrideDirty ? state.overrideProposed : null;
    var suggestions = SmartSchedule.suggestFixes(result, state.sections, proposal || undefined) || [];
    var fixes = suggestions.length
      ? "<div class='fix-box'><p><strong>Try a fix</strong></p>" + suggestions.map(function (suggestion) {
        var label = suggestion.kind === "flag" ? "Leave it unfinished and mark it for staff" : suggestion.label;
        return '<button type="button" class="btn btn-secondary" data-action="apply-fix" data-fix-id="' + esc(suggestion.id) + '">' + esc(label) + "</button>";
      }).join("") + "</div>"
      : "";
    var periods = "";
    for (var period = 1; period <= 7; period++) {
      var courseId = state.overrideProposed[period] || "";
      periods += '<div class="period-edit"><span>Period ' + period + "</span><strong>" +
        esc(courseId ? PreviewUI.displayName(courseId) : "Empty") + "</strong><span class='teacher'>" +
        esc(courseId ? PreviewUI.teacherHint(courseId) : "") + '</span><button type="button" class="btn btn-small btn-secondary" data-action="change-period" data-period="' +
        period + '">Change</button></div>';
    }
    var banner = result.complete === false
      ? '<div class="msg msg-warning"><strong>' + esc(summary.status) + ".</strong><ul>" + notes + "</ul></div>"
      : '<p class="status status-' + summary.tone + '">' + esc(summary.status) + "</p>";
    return '<div class="wrap"><button type="button" class="btn btn-tertiary" data-action="back-results">Back to all schedules</button>' +
      "<h1>" + esc(result.student.name) + "</h1><p class='help'>" + esc(result.student.grade) + "th grade · " +
      (result.student.peWaiver ? "PE waived" : "Takes PE") + " · " + esc(summary.sub) + "</p>" + banner + messageHtml() +
      "<h2>Day</h2><ul class='day'>" + PreviewUI.dayPlan(result).map(renderDayRow).join("") + "</ul>" +
      (lines ? "<h2>Electives</h2><ul class='explain'>" + lines + "</ul>" : "") + fixes +
      "<h2>Change a class</h2><p class='help'>This changes the schedule, not the original requests. A class that would break a rule is greyed out, and the reason is under the name. Another grade is allowed when a seat is open.</p>" +
      periods +
      (state.overrideDirty ? '<button type="button" class="btn btn-primary" data-action="save-override">Save class changes</button>' : "") +
      (state.changePeriod ? renderDialog(result) : "") + "</div>";
  }

  function renderCurrent() {
    if (state.wizard === "student" || state.wizard === "roster") {
      if (state.step === "who") return renderWho();
      if (state.step === "pick") return renderPick();
      if (state.step === "review") return renderReview();
      if (state.step === "schedule" && state.wizard === "student") return renderSchedule();
    }
    if (state.mode === "admin") {
      if (state.adminStep === "setup") return renderSetup();
      if (state.adminStep === "results") return renderResults();
      if (state.adminStep === "detail") return renderDetail();
      return renderRoster();
    }
    return renderHome();
  }

  function parkImport() {
    var node = document.getElementById("importMessage");
    var park = document.getElementById("importPark");
    if (node && park && node.parentNode !== park) park.appendChild(node);
  }

  function fillImportMessage() {
    var node = document.getElementById("importMessage");
    if (!node) return;
    var hard = state.importNotes.hard || [];
    var notes = state.importNotes.notes || [];
    var html = "";
    if (notes.length) {
      html += "<div class='note'><strong>We read a few names this way:</strong><ul>";
      notes.forEach(function (note) {
        html += "<li>" + esc(note.message) + "</li>";
      });
      html += "</ul></div>";
    }
    if (hard.length) html += SmartSchedule.formatImportReport(hard, 0);
    else if ((state.importNotes.added || 0) > 0 && state.pendingQuestions.length === 0) {
      html += "<div class='success'><strong>Added " + state.importNotes.added + " student" +
        (state.importNotes.added === 1 ? "" : "s") + ".</strong> When the list looks right, make schedules.</div>";
    } else if (state.pendingQuestions.length) {
      html += "<div class='note'><strong>One more step.</strong> Pick the class they meant. Nothing was guessed.</div>";
    }
    node.innerHTML = html;
  }

  function render() {
    parkImport();
    var staff = staffNow();
    document.body.classList.toggle("mode-admin", staff);
    document.body.classList.toggle("has-dock", !!(state.wizard && state.step === "pick"));
    document.body.classList.toggle("dialog-open", state.changePeriod != null);
    document.getElementById("modeToggle").textContent = staff ? "Student page" : "School staff";
    document.getElementById("sideRole").textContent = staff ? "School staff" : "Middle school";
    document.getElementById("sideGrades").textContent = staff ? "Staff tools" : "Grades 6–8";
    document.getElementById("app").innerHTML = renderCurrent();
    var host = document.getElementById("importHost");
    var message = document.getElementById("importMessage");
    if (host && message) host.appendChild(message);
    fillImportMessage();
    var live = document.getElementById("live");
    if (live && state.announce) {
      live.textContent = state.announce;
      state.announce = "";
    }
    if (state.focusDialog) {
      var search = document.getElementById("changeQuery");
      if (search) search.focus();
      state.focusDialog = false;
    } else if (state.focusHeading) {
      var heading = document.querySelector("#app h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
      state.focusHeading = false;
    }
  }

  function readWho() {
    var draft = activeDraft();
    var nameEl = document.getElementById("studentName");
    if (nameEl) draft.name = nameEl.value;
    var grade = document.querySelector("#whoForm input[name='grade']:checked");
    var waiver = document.querySelector("#whoForm input[name='peWaiver']:checked");
    if (grade) draft.grade = Number(grade.value);
    if (waiver) draft.peWaiver = waiver.value === "yes";
  }

  function continueWho() {
    readWho();
    var check = PreviewUI.validateIdentity(activeDraft());
    if (!check.ok) {
      state.formError = check.error;
      state.focusHeading = false;
      state.announce = check.error;
      render();
      var box = document.getElementById("formError");
      if (box) box.focus();
      return;
    }
    activeDraft().name = activeDraft().name.trim();
    state.formError = "";
    state.step = "pick";
    state.courseQuery = "";
    state.courseGroup = "All";
    state.focusHeading = true;
    render();
  }

  function focusCourse(courseId) {
    var buttons = document.querySelectorAll("[data-course]");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute("data-course") === courseId) {
        buttons[i].focus();
        return;
      }
    }
  }

  function changeRanking(next, announce) {
    activeDraft().rankings = next;
    state.formError = "";
    state.announce = announce || "";
    state.focusHeading = false;
    render();
  }

  function finishReview() {
    var draft = activeDraft();
    draft.name = String(draft.name || "").trim();
    if (state.wizard === "student") {
      var output = SmartSchedule.generateSchedules([{
        name: draft.name,
        grade: draft.grade,
        peWaiver: !!draft.peWaiver,
        rankings: draft.rankings.slice()
      }], teacherPayload());
      state.studentResult = output.results[0];
      state.step = "schedule";
      state.focusHeading = true;
      state.announce = "Practice schedule ready for " + draft.name;
      render();
      return;
    }
    var duplicate = state.roster.some(function (student) {
      return student.name.toLowerCase() === draft.name.toLowerCase() && student.id !== state.editingId;
    });
    if (duplicate) {
      state.formError = draft.name + " is already on the list. Edit that student instead.";
      state.focusHeading = false;
      render();
      return;
    }
    if (state.editingId != null) {
      var current = state.roster.find(function (student) { return student.id === state.editingId; });
      if (current) {
        current.name = draft.name;
        current.grade = draft.grade;
        current.peWaiver = !!draft.peWaiver;
        current.rankings = draft.rankings.slice();
      }
    } else {
      state.roster.push({
        id: state.nextId++,
        name: draft.name,
        grade: draft.grade,
        peWaiver: !!draft.peWaiver,
        rankings: draft.rankings.slice()
      });
    }
    state.message = draft.name + " is on the list.";
    state.messageKind = "success";
    state.rosterDraft = emptyDraft();
    state.editingId = null;
    state.wizard = null;
    state.mode = "admin";
    state.adminStep = "roster";
    state.formError = "";
    state.focusHeading = true;
    render();
  }

  function rememberRun(students, output, label) {
    state.results = output.results;
    state.sections = output.sections;
    state.warnings = output.warnings || [];
    state.resultsLabel = label;
    state.adminStep = "results";
    state.mode = "admin";
    state.wizard = null;
    state.selectedIndex = 0;
    state.overrideProposed = null;
    state.overrideDirty = false;
    state.changePeriod = null;
    state.message = "";
    state.focusHeading = true;
  }

  function runRoster() {
    if (!state.roster.length) {
      state.message = "Add at least one student first.";
      state.messageKind = "warning";
      state.adminStep = "roster";
      state.mode = "admin";
      state.wizard = null;
      state.focusHeading = true;
      render();
      return;
    }
    var students = state.roster.map(function (student) {
      return {
        name: student.name,
        grade: student.grade,
        peWaiver: student.peWaiver,
        rankings: student.rankings.slice()
      };
    });
    rememberRun(students, SmartSchedule.generateSchedules(students, teacherPayload()), "Students you added");
    render();
  }

  function runPractice() {
    var students = SmartSchedule.createDemoStudents();
    rememberRun(students, SmartSchedule.generateSchedules(students, teacherPayload()), "10 practice students");
    render();
  }

  function runBulkImport() {
    var box = document.getElementById("bulkInput");
    if (box) state.bulkText = box.value;
    var parsed = SmartSchedule.parseStudentCsv(state.bulkText);
    var hard = (parsed.errors || []).filter(function (error) { return !error.questionId; });
    var addedStudents = [];
    parsed.students.forEach(function (student) {
      var taken = state.roster.some(function (item) { return item.name.toLowerCase() === student.name.toLowerCase(); }) ||
        addedStudents.some(function (item) { return item.name.toLowerCase() === student.name.toLowerCase(); });
      if (taken) {
        hard.push({ message: student.name + " is already on the list, so that row was skipped." });
        return;
      }
      addedStudents.push(student);
      state.roster.push({
        id: state.nextId++,
        name: student.name,
        grade: student.grade,
        peWaiver: student.peWaiver,
        rankings: (student.rankings || []).slice()
      });
    });
    state.pendingQuestions = (parsed.questions || []).map(function (question) {
      return {
        id: question.id,
        line: question.line,
        name: question.name,
        grade: question.grade,
        peWaiver: question.peWaiver,
        resolved: question.resolved.slice(),
        pending: question.pending.map(function (problem) {
          return { typed: problem.typed, options: problem.options.slice() };
        }),
        notes: question.notes.slice()
      };
    });
    state.importNotes = { notes: (parsed.notes || []).slice(), hard: hard, added: addedStudents.length };
    state.questionError = null;
    state.focusHeading = false;
    render();
  }

  function answerQuestion(qid, course) {
    var index = state.pendingQuestions.findIndex(function (question) { return question.id === qid; });
    if (index < 0) return;
    var outcome = SmartSchedule.answerImportQuestion(state.pendingQuestions[index], course);
    if (!outcome.ok) {
      state.questionError = { id: qid, text: outcome.error };
      state.focusHeading = false;
      render();
      return;
    }
    state.questionError = null;
    if (!outcome.done) {
      state.pendingQuestions[index] = outcome.question;
      state.focusHeading = false;
      render();
      return;
    }
    state.pendingQuestions.splice(index, 1);
    var already = state.roster.some(function (student) {
      return student.name.toLowerCase() === outcome.student.name.toLowerCase();
    });
    if (!already) {
      state.roster.push({
        id: state.nextId++,
        name: outcome.student.name,
        grade: outcome.student.grade,
        peWaiver: outcome.student.peWaiver,
        rankings: outcome.student.rankings.slice()
      });
      state.importNotes.added = (state.importNotes.added || 0) + 1;
    }
    state.importNotes.notes = (state.importNotes.notes || []).concat(outcome.notes.map(function (message) {
      return { message: message };
    }));
    state.focusHeading = false;
    render();
  }

  function saveOverride() {
    var result = state.results[state.selectedIndex];
    var outcome = SmartSchedule.applyManualOverride(result, state.overrideProposed, state.sections);
    if (!outcome.ok) {
      state.message = outcome.error;
      state.messageKind = "warning";
      state.focusHeading = false;
      render();
      return;
    }
    loadOverride(result);
    state.message = "Saved. The open seats were updated.";
    state.messageKind = "success";
    state.focusHeading = false;
    render();
  }

  function applyFix(id) {
    var result = state.results[state.selectedIndex];
    var proposal = state.overrideDirty ? state.overrideProposed : null;
    var suggestions = SmartSchedule.suggestFixes(result, state.sections, proposal || undefined) || [];
    var suggestion = null;
    for (var i = 0; i < suggestions.length; i++) {
      if (suggestions[i].id === id) suggestion = suggestions[i];
    }
    if (!suggestion) return;
    var outcome = SmartSchedule.applySuggestion(result, state.sections, suggestion);
    if (!outcome.ok) {
      state.message = outcome.error || "That fix did not work.";
      state.messageKind = "warning";
    } else {
      state.message = suggestion.kind === "flag" ? "Marked for staff." : "Fix applied.";
      state.messageKind = "success";
      loadOverride(result);
    }
    state.focusHeading = false;
    render();
  }

  function onClick(event) {
    if (event.target.classList && event.target.classList.contains("dialog-back")) {
      state.changePeriod = null;
      state.focusHeading = false;
      render();
      return;
    }
    var button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    var action = button.getAttribute("data-action");
    if (action === "start") {
      state.mode = "student";
      state.wizard = "student";
      state.step = "who";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "see-schedule") {
      state.mode = "student";
      state.wizard = "student";
      state.step = "schedule";
      state.focusHeading = true;
      render();
    } else if (action === "back-home") {
      if (document.getElementById("whoForm")) readWho();
      state.wizard = null;
      state.step = "home";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "back-who") {
      state.step = "who";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "continue-pick") {
      state.step = "review";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "back-pick") {
      state.step = "pick";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "finish-review") {
      finishReview();
    } else if (action === "start-over") {
      state.draft = emptyDraft();
      state.studentResult = null;
      state.wizard = null;
      state.mode = "student";
      state.step = "home";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "cancel-roster") {
      state.rosterDraft = emptyDraft();
      state.editingId = null;
      state.wizard = null;
      state.mode = "admin";
      state.adminStep = "roster";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "add-course") {
      var added = PreviewUI.addRanking(activeDraft().rankings, button.getAttribute("data-course"), state.sections);
      if (!added.ok) {
        state.formError = added.error;
        state.announce = added.error;
        state.focusHeading = false;
        render();
      } else {
        var courseId = button.getAttribute("data-course");
        activeDraft().rankings = added.rankings;
        state.formError = "";
        state.announce = "Added " + PreviewUI.displayName(courseId) + " as choice " + added.rankings.length + ".";
        state.focusHeading = false;
        render();
        focusCourse(courseId);
      }
    } else if (action === "remove-course") {
      var removed = button.getAttribute("data-course");
      changeRanking(PreviewUI.removeRanking(activeDraft().rankings, removed), "Removed " + PreviewUI.displayName(removed) + ".");
    } else if (action === "move-course") {
      changeRanking(
        PreviewUI.moveRanking(activeDraft().rankings, Number(button.getAttribute("data-index")), Number(button.getAttribute("data-direction"))),
        ""
      );
    } else if (action === "group-filter") {
      state.courseGroup = button.getAttribute("data-group");
      var chips = document.querySelectorAll("[data-action='group-filter']");
      for (var c = 0; c < chips.length; c++) {
        chips[c].setAttribute("aria-pressed", chips[c].getAttribute("data-group") === state.courseGroup ? "true" : "false");
      }
      var mount = document.getElementById("courseMount");
      if (mount) mount.innerHTML = renderCourseCards();
    } else if (action === "admin-step") {
      state.mode = "admin";
      state.wizard = null;
      state.adminStep = button.getAttribute("data-step");
      state.changePeriod = null;
      state.message = "";
      state.focusHeading = true;
      render();
    } else if (action === "grade-tab") {
      state.setupGrade = Number(button.getAttribute("data-grade"));
      state.focusHeading = false;
      render();
    } else if (action === "add-student") {
      state.mode = "admin";
      state.wizard = "roster";
      state.step = "who";
      state.rosterDraft = emptyDraft();
      state.editingId = null;
      state.formError = "";
      state.message = "";
      state.focusHeading = true;
      render();
    } else if (action === "edit-roster") {
      var editId = Number(button.getAttribute("data-id"));
      var student = null;
      for (var s = 0; s < state.roster.length; s++) {
        if (state.roster[s].id === editId) student = state.roster[s];
      }
      if (!student) return;
      state.rosterDraft = {
        name: student.name,
        grade: student.grade,
        peWaiver: !!student.peWaiver,
        rankings: student.rankings.slice()
      };
      state.editingId = student.id;
      state.wizard = "roster";
      state.step = "who";
      state.formError = "";
      state.focusHeading = true;
      render();
    } else if (action === "remove-roster") {
      var removeId = Number(button.getAttribute("data-id"));
      state.roster = state.roster.filter(function (student) { return student.id !== removeId; });
      if (state.editingId === removeId) {
        state.editingId = null;
        state.rosterDraft = emptyDraft();
      }
      state.focusHeading = false;
      render();
    } else if (action === "run-roster") {
      runRoster();
    } else if (action === "run-practice") {
      runPractice();
    } else if (action === "paste") {
      runBulkImport();
    } else if (action === "answer-question") {
      answerQuestion(button.getAttribute("data-qid"), button.getAttribute("data-course"));
    } else if (action === "clear-results") {
      state.results = [];
      state.sections = null;
      state.warnings = [];
      state.overrideProposed = null;
      state.resultsLabel = "";
      state.adminStep = "results";
      state.focusHeading = true;
      render();
    } else if (action === "open-result") {
      state.selectedIndex = Number(button.getAttribute("data-index"));
      state.adminStep = "detail";
      state.message = "";
      state.changePeriod = null;
      loadOverride(state.results[state.selectedIndex]);
      state.focusHeading = true;
      render();
    } else if (action === "back-results") {
      state.adminStep = "results";
      state.changePeriod = null;
      state.message = "";
      state.focusHeading = true;
      render();
    } else if (action === "change-period") {
      state.changePeriod = Number(button.getAttribute("data-period"));
      state.changeQuery = "";
      state.focusDialog = true;
      state.focusHeading = false;
      render();
    } else if (action === "close-dialog") {
      state.changePeriod = null;
      state.focusHeading = false;
      render();
    } else if (action === "pick-override") {
      state.overrideProposed[state.changePeriod] = button.getAttribute("data-course");
      state.overrideDirty = true;
      state.changePeriod = null;
      state.changeQuery = "";
      state.message = "";
      state.focusHeading = false;
      render();
    } else if (action === "save-override") {
      saveOverride();
    } else if (action === "apply-fix") {
      applyFix(button.getAttribute("data-fix-id"));
    }
  }

  function onInput(event) {
    var target = event.target;
    if (target.id === "courseQuery") {
      state.courseQuery = target.value;
      var mount = document.getElementById("courseMount");
      if (mount) mount.innerHTML = renderCourseCards();
    } else if (target.id === "changeQuery") {
      state.changeQuery = target.value;
      var result = state.results[state.selectedIndex];
      if (!result) return;
      var options = SmartSchedule.periodOptions(state.changePeriod, result.student, state.overrideProposed, state.sections, result.schedule);
      var groups = PreviewUI.groupPeriodOptions(options, result.student.grade, state.changeQuery);
      var optionMount = document.getElementById("optionMount");
      if (!optionMount) return;
      optionMount.innerHTML = groups.length ? groups.map(function (group) {
        var buttons = group.items.map(function (item) {
          return '<button type="button" class="option" data-action="pick-override" data-course="' + esc(item.course) + '"' +
            (item.enabled ? "" : " disabled") + "><span>" + esc(PreviewUI.displayName(item.course)) + "</span><span class='teacher'>" +
            esc(PreviewUI.teacherHint(item.course)) + "</span>" +
            (item.reason ? "<span class='why'>" + esc(item.reason) + "</span>" : "") + "</button>";
        }).join("");
        return "<details open><summary>" + esc(group.label) + " (" + group.items.length + ")</summary>" + buttons + "</details>";
      }).join("") : '<p class="empty">No class has a name like that.</p>';
    } else if (target.id === "bulkInput") {
      state.bulkText = target.value;
    } else if (target.dataset.teacherGrade) {
      state.teachers[target.dataset.teacherGrade][target.dataset.teacherSubject] = target.value;
    } else if (target.id === "studentName") {
      activeDraft().name = target.value;
    }
  }

  function onKeydown(event) {
    if (!state.changePeriod) return;
    if (event.key === "Escape") {
      event.preventDefault();
      state.changePeriod = null;
      state.focusHeading = false;
      render();
      return;
    }
    var dialog = document.querySelector(".dialog");
    if (!dialog) return;
    if (event.key === "Tab") {
      var focusable = dialog.querySelectorAll("button:not(:disabled), input, summary");
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      var buttons = [];
      var all = document.querySelectorAll("#optionMount button");
      for (var i = 0; i < all.length; i++) if (!all[i].disabled) buttons.push(all[i]);
      if (!buttons.length) return;
      event.preventDefault();
      var current = buttons.indexOf(document.activeElement);
      var next = event.key === "ArrowDown" ? current + 1 : current - 1;
      if (current === -1) next = 0;
      if (next < 0) next = buttons.length - 1;
      if (next >= buttons.length) next = 0;
      buttons[next].focus();
    }
  }

  document.getElementById("app").addEventListener("click", onClick);
  document.getElementById("app").addEventListener("input", onInput);
  document.getElementById("app").addEventListener("submit", function (event) {
    if (event.target.id === "whoForm") {
      event.preventDefault();
      continueWho();
    }
  });
  document.getElementById("modeToggle").addEventListener("click", function () {
    state.formError = "";
    state.message = "";
    state.changePeriod = null;
    state.focusHeading = true;
    if (staffNow()) {
      state.editingId = null;
      state.wizard = state.studentResult ? "student" : null;
      state.mode = "student";
      state.step = state.studentResult ? "schedule" : "home";
    } else {
      state.mode = "admin";
      state.wizard = null;
    }
    render();
  });
  document.addEventListener("keydown", onKeydown);
  render();
})();
