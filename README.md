# SmartSchedule AI

SmartSchedule is a small demo that builds fictional middle school schedules for Orlando Gifted Academy. It is one web page plus a scheduler file. All student names in the demo are made up. Schedules stay in the browser. There is no server and no real student data.

The word "AI" is only the project name. The scheduler is a list of rules. It does not use machine learning, and it does not train on anything.

## Files

- `index.html` — the page. It has the forms, the course list, and the buttons. It does not decide who gets which seat.
- `scheduler.js` — the scheduling rules. The page loads this file. The tests load it too, with Node.
- `scheduler.test.js` — checks the rules with fake students.
- `README.md` — this file.

## Run the tests

From this folder, run:

```bash
node --test
```

You need Node.js. You do not need to install packages.

## Open the page

Open `index.html` in a browser. The buttons do the same work the tests call:

1. **Generate 10 Student Schedules** builds the same ten demo students every time.
2. **Generate Imported Schedules** reads the box of comma-separated rows.
3. **Save Manual Schedule Override** edits one student after a schedule exists.

Refreshing the page clears the results.

## How a schedule is built

The program is greedy. It makes one choice at a time and does not go back to reshuffle earlier students.

1. Build the master schedule. That is the school's list of sections: which course meets in which period, with which teacher, and how many seats are left.
2. Sort the students. 8th grade goes first, then 7th, then 6th. Inside a grade, names go A to Z.
3. For each student, place Math, ELA, History, and Science. Each of those is that student's own grade.
4. Place PE, unless the student has a PE waiver.
5. Place the student's requested electives in rank order, into periods that are still open.
6. If a period is still empty, fill it with a backup elective.

A backup is a beginner class: level 1, or a course with no level number. Backups are never level 2, level 3, or an application-only competition course (Chess, Quiz Bowl, Robotics, and the other courses in the competition list).

If a required class or a period still cannot be filled, that student is marked **Partial schedule**. The card says why. The page still shows the student.

## Rules that always stay in place

- A student has at most one class in a period.
- A finished schedule has all 7 periods filled.
- A normal student gets 4 core classes and PE. A student with a PE waiver gets 4 core classes and no PE.
- A section never holds more students than its seat count.
- A teacher never teaches two sections in the same period.
- Level 2, level 3, and competition courses are placed only when the student asked for that exact course.

Class sizes are set at the top of `scheduler.js` in `SCHEDULE_DEFAULTS`. With the default sizes, each core subject has two teachers and one section every period (30 seats each, 420 seats per grade). PE is 40 seats per section (560 seats per grade). The name you type on the page is the first teacher. The second teacher is a fictional partner listed in `assistantTeachers`, so two sections of the same subject can meet at the same time.

Elective sections are smaller, about 12 to 28 seats. Competition courses are the smaller ones.

## CSV import

Each row needs a name, a grade (6, 7, or 8), and a PE waiver (`Yes` or `No`), then up to five choices.

The course text must match a course on the list (capital letters and extra spaces do not matter). `Quiz Bowl` is not silently turned into `Quiz Bowl 1`. The page lists the problem instead. Unknown courses, bad grades, missing fields, and duplicate names are reported the same way. Rows with problems are skipped. Valid rows are still scheduled.

Names from the file are escaped before they are shown, so a name cannot turn into HTML.

## Manual override

After schedules exist, the override form can change one student. It still blocks:

- two classes from the same subject
- deleting a required class (Math, ELA, History, Science, and PE unless that student has a waiver)
- putting a student into a section that is already full, or into a period where that course does not meet

A 6th grader may be moved into a 7th or 8th grade section when a seat is open. Saving gives back the old seat and takes the new one.

## What this demo does not do

- It does not look up last year's classes. If a student asks for Spanish 2, the program can place it. It does not know whether that student already took Spanish 1.
- It does not collect applications for competition courses. A requested competition course is placed when a seat is open.
- It does not move earlier students out of the way. If the school is over full, later students are marked partial instead of breaking the rules above.
- It does not store anything. There are no accounts, no database, and no real student records.
