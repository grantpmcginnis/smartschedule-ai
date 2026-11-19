/*
 * SCHOOL CATALOG — the one block to edit
 * =======================================
 * Swap teacher names, classes, and class descriptions here.
 * Do not invent names or descriptions.
 *
 * WHAT IS REAL
 * - Course ids match scheduler.js. Do not rename an id or the scheduler
 *   will not recognize it.
 * - Public 2025-26 middle school languages, from
 *   https://orlandogiftedacademy.ocps.net/school-information-home
 *   Spanish I, French I, French II, Japanese I.
 *   Those four courses use publicStatus "confirmed-language".
 *
 * WHAT IS A SAMPLE
 * - Every teacher name. They are the demo placeholders already used by
 *   scheduler.js. They are not Orlando Gifted Academy staff.
 *
 * WHAT IS MISSING
 * - The 2024-2025 "OGA About Me" PDF. The live page returns 404 and the
 *   file is not in the Wayback Machine. There is no verified teacher roster
 *   and no class description to copy. Every description below is "".
 *
 * WHAT THE SCHEDULER READS
 * - Core and PE first teachers: the staff setup screen, which starts from
 *   sampleTeachers.grades[*].primary in this file.
 * - Core and PE second teachers, and every elective teacher: still assigned
 *   inside scheduler.js. The sampleTeacher field on each course is the label
 *   students see. It must stay the same string as scheduler.js or the tests fail.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SCHOOL_CATALOG = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var missingDescription = "No class description on file yet.";

  var rules = [
    "A student has 7 periods.",
    "Math, language arts, history, and science are added automatically. Students do not pick those.",
    "Students take PE unless a PE waiver is already on file.",
    "With PE, 2 periods are left for electives. With a PE waiver, 3 periods are left.",
    "A student may list up to 5 electives, favorite first. Classes are placed in that order until the open elective periods are full.",
    "An empty period is filled with a beginner elective the student did not request. Level 2, level 3, and competition classes are never used as fillers.",
    "A student can take only one level of the same class.",
    "6th grade lunch is after period 4. 7th and 8th grade lunch is after period 5.",
    "Each core class and PE has two sample teachers in this demo, so two sections can meet at the same time. The name in the box is the first teacher."
  ];

  var missing = [
    "Real middle school teacher names, and which class each person teaches. The 2024-2025 Meet Our Teachers PDF is not online anymore.",
    "Class descriptions. Every description in this file is empty until a verified source is added.",
    "Whether Spanish 2 is offered. The public 2025-26 language list names Spanish I only.",
    "Which demo electives, besides Spanish I, French I, French II, and Japanese I, are really offered this year."
  ];

  var sources = {
    languages: "https://orlandogiftedacademy.ocps.net/school-information-home",
    teachersPdf: "OGA About Me 2024-2025.pdf (not retrievable)"
  };

  var subjectLabels = {
    Math: "math",
    ELA: "language arts",
    History: "history",
    Science: "science",
    PE: "PE"
  };

  // Sample names only. Not real OGA staff. Keys match scheduler.js.
  var sampleTeachers = {
    disclaimer: "Sample names from this demo, not real Orlando Gifted Academy staff.",
    grades: {
      6: {
        Math: { primary: "Mrs. Waters", assistant: "Mr. Hale" },
        ELA: { primary: "Ms. Kendall", assistant: "Mrs. Okonkwo" },
        History: { primary: "Mrs. Patel", assistant: "Ms. Feldman" },
        Science: { primary: "Mr. Emerson", assistant: "Mr. Iqbal" },
        PE: { primary: "Coach Ramirez", assistant: "Coach Diaz" }
      },
      7: {
        Math: { primary: "Mr. Johnson", assistant: "Mrs. Kowalski" },
        ELA: { primary: "Mrs. Langford", assistant: "Mr. Adeyemi" },
        History: { primary: "Mr. Holloway", assistant: "Ms. Cho" },
        Science: { primary: "Dr. Bennett", assistant: "Mrs. Vasquez" },
        PE: { primary: "Coach Whitaker", assistant: "Coach Brennan" }
      },
      8: {
        Math: { primary: "Ms. Rivera", assistant: "Mr. Okada" },
        ELA: { primary: "Mr. Carlisle", assistant: "Mrs. Ibrahim" },
        History: { primary: "Mr. Brooks", assistant: "Ms. Porter" },
        Science: { primary: "Mrs. Donovan", assistant: "Mr. Nilsson" },
        PE: { primary: "Coach Morgan", assistant: "Coach Alvarez" }
      }
    }
  };

  var groups = [
    {
      id: "Languages",
      label: "Languages",
      intro: "The school site lists Spanish I, French I, French II, and Japanese I for 2025-26."
    },
    {
      id: "Art and music",
      label: "Art and music",
      intro: "Art, photo, instrumental music, chorus, and theatre from the demo course list."
    },
    {
      id: "Technology",
      label: "Technology",
      intro: "Computer classes from the demo course list. FIRST Lego League is under Competitions."
    },
    {
      id: "Competitions",
      label: "Competitions",
      intro: "These are placed only if you request them. They are not used to fill an empty period."
    },
    {
      id: "Other",
      label: "Other",
      intro: "Writing, money skills, and the first Future Business Leaders class from the demo course list."
    }
  ];

  function course(id, displayName, group, level, competition, sampleTeacher, publicStatus, publicNote) {
    return {
      id: id,
      displayName: displayName,
      group: group,
      level: level,
      competition: competition,
      // Leave this empty until a real description is copied in. Do not invent one.
      description: "",
      sampleTeacher: sampleTeacher,
      publicStatus: publicStatus,
      publicNote: publicNote || ""
    };
  }

  var languageNote = "OGA's public school page lists this as a middle school language elective for 2025-26.";

  var courses = [
    course("Spanish 1", "Spanish I", "Languages", 1, false, "Señora Cruz", "confirmed-language", languageNote),
    course("French 1", "French I", "Languages", 1, false, "Madame Laurent", "confirmed-language", languageNote),
    course("French 2", "French II", "Languages", 2, false, "Madame Laurent", "confirmed-language", languageNote),
    course("Japanese 1", "Japanese I", "Languages", 1, false, "Mr. Yamamoto", "confirmed-language", languageNote),
    course(
      "Spanish 2",
      "Spanish 2",
      "Languages",
      2,
      false,
      "Señora Cruz",
      "not-on-language-list",
      "The 2025-26 language list names Spanish I, not Spanish II. Spanish 2 is only in this demo's course list."
    ),

    course("M/J 2-D Studio Art 1", "2-D Studio Art 1", "Art and music", 1, false, "Ms. Marquez", "demo", ""),
    course("M/J 2-D Studio Art 2", "2-D Studio Art 2", "Art and music", 2, false, "Ms. Marquez", "demo", ""),
    course("M/J Creative Photography 1", "Creative Photography 1", "Art and music", 1, false, "Mr. Ellison", "demo", ""),
    course("M/J Instrumental Ensemble", "Instrumental Ensemble", "Art and music", 0, false, "Mr. Navarro", "demo", ""),
    course("M/J Chorus 1", "Chorus 1", "Art and music", 1, false, "Mrs. Bellamy", "demo", ""),
    course("M/J Chorus 2", "Chorus 2", "Art and music", 2, false, "Mrs. Bellamy", "demo", ""),
    course("M/J Chorus 3", "Chorus 3", "Art and music", 3, false, "Mrs. Bellamy", "demo", ""),
    course("M/J Theatre 1", "Theatre 1", "Art and music", 1, false, "Ms. Harrington", "demo", ""),
    course("Fundamentals of Visual & Perf Arts", "Fundamentals of Visual and Performing Arts", "Art and music", 0, false, "Mrs. Sato", "demo", ""),

    course("Info & Comm Tech 1", "Info & Comm Tech 1", "Technology", 1, false, "Ms. Nguyen", "demo", ""),
    course("Info & Comm Tech 2", "Info & Comm Tech 2", "Technology", 2, false, "Ms. Nguyen", "demo", ""),
    course("Digital Information Technology", "Digital Information Technology", "Technology", 0, false, "Mr. Carver", "demo", ""),
    course("App Creators/Automation & Robotics", "App Creators and Robotics", "Technology", 0, false, "Mrs. Lennox", "demo", ""),

    course("Odyssey of the Mind 1", "Odyssey of the Mind 1", "Competitions", 1, true, "Ms. Aldridge", "demo", ""),
    course("Odyssey of the Mind 2", "Odyssey of the Mind 2", "Competitions", 2, true, "Ms. Aldridge", "demo", ""),
    course("Odyssey of the Mind 3", "Odyssey of the Mind 3", "Competitions", 3, true, "Ms. Aldridge", "demo", ""),
    course("FIRST Lego League Robotics 1", "FIRST Lego League Robotics 1", "Competitions", 1, true, "Mr. Tanaka", "demo", ""),
    course("FIRST Lego League Robotics 2", "FIRST Lego League Robotics 2", "Competitions", 2, true, "Mr. Tanaka", "demo", ""),
    course("FIRST Lego League Robotics 3", "FIRST Lego League Robotics 3", "Competitions", 3, true, "Mr. Tanaka", "demo", ""),
    course("Science Olympiad 1", "Science Olympiad 1", "Competitions", 1, true, "Mrs. Whitfield", "demo", ""),
    course("Science Olympiad 2", "Science Olympiad 2", "Competitions", 2, true, "Mrs. Whitfield", "demo", ""),
    course("Science Olympiad 3", "Science Olympiad 3", "Competitions", 3, true, "Mrs. Whitfield", "demo", ""),
    course("Chess 1", "Chess 1", "Competitions", 1, true, "Mr. Stein", "demo", ""),
    course("Chess 2", "Chess 2", "Competitions", 2, true, "Mr. Stein", "demo", ""),
    course("Chess 3", "Chess 3", "Competitions", 3, true, "Mr. Stein", "demo", ""),
    course("Quiz Bowl 1", "Quiz Bowl 1", "Competitions", 1, true, "Dr. Mercer", "demo", ""),
    course("Quiz Bowl 2", "Quiz Bowl 2", "Competitions", 2, true, "Dr. Mercer", "demo", ""),
    course("Quiz Bowl 3", "Quiz Bowl 3", "Competitions", 3, true, "Dr. Mercer", "demo", ""),
    course("Advanced Academics, Future Business Leaders of America 2", "Future Business Leaders of America 2", "Competitions", 2, true, "Ms. Caldwell", "demo", ""),
    course("Advanced Academics, Future Business Leaders of America 3", "Future Business Leaders of America 3", "Competitions", 3, true, "Ms. Caldwell", "demo", ""),
    course("M/J Speech-Debate 1", "Speech and Debate 1", "Competitions", 1, true, "Mrs. Sinclair", "demo", ""),
    course("M/J Speech-Debate 2", "Speech and Debate 2", "Competitions", 2, true, "Mrs. Sinclair", "demo", ""),
    course("M/J Speech-Debate 3", "Speech and Debate 3", "Competitions", 3, true, "Mrs. Sinclair", "demo", ""),

    course("Advanced Academics, Future Business Leaders of America 1", "Future Business Leaders of America 1", "Other", 1, false, "Ms. Caldwell", "demo", ""),
    course("M/J Creative Writing 1", "Creative Writing 1", "Other", 1, false, "Mr. Fletcher", "demo", ""),
    course("M/J Creative Writing 2", "Creative Writing 2", "Other", 2, false, "Mr. Fletcher", "demo", ""),
    course("M/J Creative Writing 3", "Creative Writing 3", "Other", 3, false, "Mr. Fletcher", "demo", ""),
    course("M/J Intro to Personal Financial Literacy", "Personal Financial Literacy", "Other", 0, false, "Mr. Grayson", "demo", "")
  ];

  return {
    schoolName: "Orlando Gifted Academy",
    shortName: "OGA",
    place: "Winter Park, Florida",
    mascot: "Owlbert Einstein",
    missingDescription: missingDescription,
    rules: rules,
    missing: missing,
    sources: sources,
    subjectLabels: subjectLabels,
    sampleTeachers: sampleTeachers,
    groups: groups,
    courses: courses
  };
});
