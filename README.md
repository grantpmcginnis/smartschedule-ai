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

Open `index.html` in a browser.

1. **Add a Student** is the normal way. Type a name, choose a grade, and pick up to five electives. The elective boxes filter the real course list as you type, so you pick a name instead of spelling it. Added students show in a list. Edit or Remove changes that list. **Make schedules for these students** builds the schedules.
2. **Paste a List** is for many students at once. You can type in normal words. `Ava Brooks 7th no span one art 1` is enough. Commas, tabs, and extra spaces are fine, and a header row is optional.
3. **Generate 10 Student Schedules** builds the same ten demo students every time.
4. **Save Manual Schedule Override** edits one student after a schedule exists.

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

## Adding students

Use the form when you are typing one student at a time. The course boxes only accept a course from the list.

Use the paste box when you already have a list. It is forgiving:

- Capital letters, spaces, and punctuation do not have to match. `span one`, `Span 1`, and `span I` all mean Spanish 1.
- Short names work when they are clear: `FLL 1`, `robotics 2`, `info tech 1`, `photo 1`, `art 1`, `debate 1`.
- Grades can look like `7`, `7th`, `seventh`, or `grade 7`.
- PE waiver can be yes, yeah, yep, true, 1, or waived. No, nope, false, 0, blank, or an empty waiver means the student still takes PE.
- A small typo can still match. The page tells you what it did, for example: Read "span one" as Spanish 1.
- If a name could be two courses, such as Quiz Bowl with no level, the page does not guess. It shows **Did you mean…?** with a button for each course. Click the right one and that student is added. You do not have to paste the list again.

A missing name, a grade that is not 6, 7, or 8, or a course that is not close to anything on the list is reported and skipped. Duplicate names are reported too. Student names are escaped before they are shown, so a name cannot turn into HTML.

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
